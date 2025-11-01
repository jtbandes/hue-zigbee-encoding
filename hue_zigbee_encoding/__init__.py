from __future__ import annotations

import enum
import struct
from dataclasses import dataclass

HUE_LIGHT_CLUSTER_ID = 0xFC03
HUE_MANUFACTURER_CODE = 0x100B

_uint16 = struct.Struct("<H")


class _Flags(enum.IntFlag):
    ON_OFF = 1 << 0
    BRIGHTNESS = 1 << 1
    COLOR_TEMPERATURE = 1 << 2
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
    Color specified as XY coordinates scaled to the range 0-0xFFF, corresponding
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


@dataclass(kw_only=True)
class HueLightColorXY:
    """
    Color specified as XY coordinates in the range 0-1
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


class HueLightGradientStyle(enum.IntEnum):
    LINEAR = 0x00
    SCATTERED = 0x02
    MIRRORED = 0x04


@dataclass(kw_only=True)
class HueLightGradient:
    style: HueLightGradientStyle
    scale: float
    offset: float
    colors: list[HueLightColorXY]


@dataclass(kw_only=True)
class HueLightUpdateMessage:
    on_off: bool | None = None
    brightness: int | None = None
    color_temperature: int | None = None
    color_xy: HueLightColorXY | None = None
    transition_time: int | None = None
    effect: HueLightEffect | None = None
    gradient: HueLightGradient | None = None
    effect_speed: int | None = None

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
        if self.color_temperature is not None:
            flags |= _Flags.COLOR_TEMPERATURE
            result += _uint16.pack(self.color_temperature)
        if self.color_xy is not None:
            flags |= _Flags.COLOR_XY
            result.extend(_uint16.pack(int(self.color_xy.x * 0xFFFF)))
            result.extend(_uint16.pack(int(self.color_xy.y * 0xFFFF)))
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
                result.extend(color.to_scaled().to_bytes())
        if self.effect_speed is not None:
            flags |= _Flags.EFFECT_SPEED
            result.append(self.effect_speed)
        if self.gradient is not None:
            flags |= _Flags.GRADIENT_PARAMS
            result.append(int(self.gradient.scale * 8))
            result.append(int(self.gradient.offset * 8))

        return _uint16.pack(flags) + result
