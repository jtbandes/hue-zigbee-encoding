"""
Serialization and deserialization utilities for Philips Hue Zigbee messages.

This module implements encoding and decoding of the binary format used by Hue
Zigbee devices, reverse-engineered by Christian Iversen and described at:
https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md
"""

from __future__ import annotations

import enum
import struct
from dataclasses import dataclass

HUE_LIGHT_EFFECT_CLUSTER_ID = 0xFC03
HUE_VENDOR_ID = 0x100B

_uint16 = struct.Struct("<H")


class _Flags(enum.IntFlag):
    """
    Bit flags used to indicate which fields are set in a serialized HueLightUpdateMessage.
    """

    ON_OFF = 1 << 0
    BRIGHTNESS = 1 << 1
    COLOR_MIRED = 1 << 2
    COLOR_XY = 1 << 3
    TRANSITION_TIME = 1 << 4
    EFFECT = 1 << 5
    GRADIENT_PARAMS = 1 << 6
    EFFECT_SPEED = 1 << 7
    GRADIENT_COLORS = 1 << 8


class HueLightEffect(enum.IntEnum):
    CANDLE = 0x01
    FIREPLACE = 0x02
    PRISM = 0x03
    SUNRISE = 0x09
    SPARKLE = 0x0A
    OPAL = 0x0B
    GLISTEN = 0x0C
    SUNSET = 0x0D
    UNDERWATER = 0x0E
    COSMOS = 0x0F
    SUNBEAM = 0x10
    ENCHANT = 0x11


@dataclass(kw_only=True)
class HueLightColorXYScaled:
    """
    Color specified as XY coordinates in the range 0-4095 (0xFFF), corresponding
    to a maximum X=0.7347 and Y=0.8264 (determined experimentally by Christian
    Iversen).
    """

    x: int
    y: int

    SCALING_MAX_X = 0.7347
    SCALING_MAX_Y = 0.8264

    def to_bytes(self) -> bytes:
        return bytes(
            (
                self.x & 0x0FF,
                (self.x & 0xF00) >> 8 | (self.y & 0x00F) << 4,
                (self.y & 0xFF0) >> 4,
            )
        )

    @classmethod
    def from_bytes(cls, data: bytes) -> HueLightColorXYScaled:
        if len(data) != 3:
            raise ValueError(f"Expected 3 bytes, received {len(data)}")
        a, b, c = data
        x = ((b & 0x0F) << 8) | a
        y = (c << 4) | (b >> 4)
        return cls(x=x, y=y)


@dataclass(kw_only=True)
class HueLightColorXY:
    """
    Color specified as XY coordinates in the range 0-1. See also: https://viereck.ch/hue-xy-rgb/
    """

    x: float
    y: float

    def to_scaled(self) -> HueLightColorXYScaled:
        return HueLightColorXYScaled(
            x=int(0xFFF * max(0, min(self.x / HueLightColorXYScaled.SCALING_MAX_X, 1))),
            y=int(0xFFF * max(0, min(self.y / HueLightColorXYScaled.SCALING_MAX_Y, 1))),
        )

    @classmethod
    def from_scaled(cls, scaled: HueLightColorXYScaled) -> HueLightColorXY:
        return cls(
            x=scaled.x / 0xFFF * HueLightColorXYScaled.SCALING_MAX_X,
            y=scaled.y / 0xFFF * HueLightColorXYScaled.SCALING_MAX_Y,
        )


@dataclass(kw_only=True)
class HueLightColorMired:
    """
    Color temperature specified in mireds.
    """

    mired: int

    @classmethod
    def from_kelvin(cls, kelvin: int) -> HueLightColorMired:
        return cls(mired=int(1_000_000 / kelvin))


class HueLightGradientStyle(enum.IntEnum):
    LINEAR = 0x00
    SCATTERED = 0x02
    MIRRORED = 0x04


@dataclass(kw_only=True)
class HueLightGradient:
    """
    A custom gradient on a light strip.
    """

    style: HueLightGradientStyle
    colors: list[HueLightColorXY]


@dataclass(kw_only=True)
class HueLightGradientParams:
    """
    Gradient scale and offset parameters (for light strips). Values can be between 0 and 31.875 in increments of 0.125 (1/8).

    Attributes:
        scale: Number of colors that should fit on the light strip. Ignored in the "scattered" gradient style. A value of 0 is special, blending all the gradient colors smoothly across the whole light strip. Read more at: https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md#property-gradient_params-scale
        offset: Number of lights to skip at the start of the light strip.
    """

    scale: float
    offset: float


@dataclass(kw_only=True)
class HueLightUpdateMessage:
    """
    A combined state update message that can include any number of light
    attributes at once. You can leave out some attributes or set them to None)
    and they will not be modified (and not included in the to_bytes()
    representation).

    Use `HueLightUpdateMessage(...).to_bytes()` to produce a byte string.

    Use `HueLightUpdateMessage(...).to_bytes().hex()` to produce a printable hex string of the same bytes.

    Use `HueLightUpdateMessage.from_bytes(...)` to parse a byte string into a HueLightUpdateMessage object.

    Use `HueLightUpdateMessage.from_bytes(bytes.fromhex(...))` to parse a hex string into a HueLightUpdateMessage object.

    Attributes:
        on_off: Set to True to turn the light on, False to turn off.
        brightness: 0-255 (0xFF), although only values 1 (dimmest) through 254 (brightest) are valid.
        color_temp: Color temperature in mireds. You can also use HueLightColorMired.from_kelvin() to convert from Kelvin.
        color_xy: Color as XY values. See also: https://viereck.ch/hue-xy-rgb/
        transition_time: 0-65535 (0xFFFF). Use 0 for an instantaneous transition, higher numbers for a slower fade.
        effect: Specify one of the light effects from the HueLightEffect enum.
        effect_speed: Animation speed of the selected effect: 0 (slowest) to 255 (fastest).
        gradient: Gradient colors and style (for light strips).
        gradient_params: Gradient scale and offset parameters (for light strips).
    """

    on_off: bool | None = None
    brightness: int | None = None
    color_temp: HueLightColorMired | None = None
    color_xy: HueLightColorXY | None = None
    transition_time: int | None = None
    effect: HueLightEffect | None = None
    effect_speed: int | None = None
    gradient: HueLightGradient | None = None
    gradient_params: HueLightGradientParams | None = None

    def to_bytes(self) -> bytes:
        result = bytearray()
        flags = _Flags(0)
        if self.on_off is not None:
            flags |= _Flags.ON_OFF
            result.append(1 if self.on_off else 0)
        if self.brightness is not None:
            if not (1 <= self.brightness <= 254):
                raise ValueError("Brightness must be between 1 and 254")
            flags |= _Flags.BRIGHTNESS
            result.append(self.brightness)
        if self.color_temp is not None:
            flags |= _Flags.COLOR_MIRED
            result += _uint16.pack(self.color_temp.mired)
        if self.color_xy is not None:
            flags |= _Flags.COLOR_XY
            result += _uint16.pack(int(self.color_xy.x * 0xFFFF))
            result += _uint16.pack(int(self.color_xy.y * 0xFFFF))
        if self.transition_time is not None:
            flags |= _Flags.TRANSITION_TIME
            result += _uint16.pack(self.transition_time)
        if self.effect is not None:
            flags |= _Flags.EFFECT
            result.append(self.effect.value)
        if self.gradient is not None:
            flags |= _Flags.GRADIENT_COLORS
            size = 4 + 3 * len(self.gradient.colors)
            result.extend(
                (
                    size,
                    len(self.gradient.colors) << 4,
                    self.gradient.style.value,
                    0,
                    0,
                )
            )
            for color in self.gradient.colors:
                result += color.to_scaled().to_bytes()
        if self.effect_speed is not None:
            flags |= _Flags.EFFECT_SPEED
            result.append(self.effect_speed)
        if self.gradient_params is not None:
            flags |= _Flags.GRADIENT_PARAMS
            result.append(int(self.gradient_params.scale * 8))
            result.append(int(self.gradient_params.offset * 8))

        return _uint16.pack(flags) + result

    @classmethod
    def from_bytes(cls, data: bytes) -> HueLightUpdateMessage:
        result = HueLightUpdateMessage()
        flags = _Flags(_uint16.unpack_from(data, 0)[0])
        offset = _uint16.size
        if _Flags.ON_OFF in flags:
            result.on_off = data[offset] != 0
            offset += 1
        if _Flags.BRIGHTNESS in flags:
            result.brightness = data[offset]
            offset += 1
        if _Flags.COLOR_MIRED in flags:
            result.color_temp = HueLightColorMired(
                mired=_uint16.unpack_from(data, offset)[0]
            )
            offset += _uint16.size
        if _Flags.COLOR_XY in flags:
            result.color_xy = HueLightColorXY(
                x=_uint16.unpack_from(data, offset)[0] / 0xFFFF,
                y=_uint16.unpack_from(data, offset + _uint16.size)[0] / 0xFFFF,
            )
            offset += 2 * _uint16.size
        if _Flags.TRANSITION_TIME in flags:
            result.transition_time = _uint16.unpack_from(data, offset)[0]
            offset += _uint16.size
        if _Flags.EFFECT in flags:
            result.effect = HueLightEffect(data[offset])
            offset += 1
        if _Flags.GRADIENT_COLORS in flags:
            size = data[offset]
            if size < 4:
                raise ValueError(
                    f"Failed to parse gradient colors: size={size} too small, expected at least 4"
                )
            if offset + size + 1 > len(data):
                raise ValueError(
                    f"Failed to parse gradient colors: size={size} from offset={offset+1} extends beyond end of data"
                )
            color_count = data[offset + 1] >> 4
            style = HueLightGradientStyle(data[offset + 2])
            # offset + 3 and offset + 4 are reserved
            colors: list[HueLightColorXY] = []
            colors_start = offset + 5
            colors_end = colors_start + color_count * 3
            if colors_end > offset + size + 1:
                raise ValueError(
                    f"Failed to parse gradient colors: not enough data ({color_count} colors would extend {colors_end-offset} bytes beyond offset={offset}, expected no more than size={size})"
                )
            for color_offset in range(colors_start, colors_end, 3):
                colors.append(
                    HueLightColorXY.from_scaled(
                        HueLightColorXYScaled.from_bytes(
                            data[color_offset : color_offset + 3]
                        )
                    )
                )
            result.gradient = HueLightGradient(style=style, colors=colors)
            offset += size + 1
        if _Flags.EFFECT_SPEED in flags:
            result.effect_speed = data[offset]
            offset += 1
        if _Flags.GRADIENT_PARAMS in flags:
            result.gradient_params = HueLightGradientParams(
                scale=data[offset] / 8,
                offset=data[offset + 1] / 8,
            )
            offset += 2

        return result
