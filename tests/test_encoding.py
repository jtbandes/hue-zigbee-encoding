import pytest

from hue_zigbee_encoding import (
    HueLightColorXY,
    HueLightColorXYScaled,
    HueLightEffect,
    HueLightGradient,
    HueLightGradientStyle,
    HueLightUpdateMessage,
)


@pytest.mark.parametrize(
    "message,expected_bytes",
    [
        (HueLightUpdateMessage(), b"\x00\x00"),
        (HueLightUpdateMessage(on_off=False), b"\x01\x00\x00"),
        (HueLightUpdateMessage(on_off=True), b"\x01\x00\x01"),
        (HueLightUpdateMessage(brightness=0x7F), b"\x02\x00\x7f"),
        (HueLightUpdateMessage(color_temperature=0x1234), b"\x04\x00\x34\x12"),
        (
            HueLightUpdateMessage(color_xy=HueLightColorXY(x=0.5, y=0.25)),
            b"\x08\x00\xff\x7f\xff\x3f",
        ),
        (HueLightUpdateMessage(transition_time=0x1234), b"\x10\x00\x34\x12"),
        (HueLightUpdateMessage(effect=HueLightEffect.SUNSET), b"\x20\x00\x0d"),
        (
            HueLightUpdateMessage(
                gradient=HueLightGradient(
                    style=HueLightGradientStyle.SCATTERED,
                    scale=0xCC / 8,
                    offset=0xDD / 8,
                    colors=[],
                )
            ),
            b"\x40\x01"  # flags
            b"\x04"  # byte size of style+colors
            b"\x00"  # 0 colors
            b"\x02\x00\x00"  # style + reserved
            b"\xcc\xdd",  # scale + offset
        ),
        (
            HueLightUpdateMessage(
                gradient=HueLightGradient(
                    style=HueLightGradientStyle.SCATTERED,
                    scale=0xCC / 8,
                    offset=0xDD / 8,
                    colors=[
                        HueLightColorXY(
                            x=0x123 / 0xFFF * HueLightColorXYScaled.SCALING_MAX_X,
                            y=0xABC / 0xFFF * HueLightColorXYScaled.SCALING_MAX_Y,
                        ),
                        HueLightColorXY(
                            x=0x789 / 0xFFF * HueLightColorXYScaled.SCALING_MAX_X,
                            y=0xDEF / 0xFFF * HueLightColorXYScaled.SCALING_MAX_Y,
                        ),
                    ],
                )
            ),
            b"\x40\x01"  # flags
            b"\x0a"  # byte size of style+colors
            b"\x20"  # 2 colors
            b"\x02\x00\x00"  # style + reserved
            b"\x23\xc1\xab"  # color 1
            b"\x89\xf7\xde"  # color 2
            b"\xcc\xdd",  # scale + offset
        ),
        (HueLightUpdateMessage(effect_speed=0x12), b"\x80\x00\x12"),
    ],
)
def test_encoding(message: HueLightUpdateMessage, expected_bytes: bytes):
    assert message.to_bytes() == expected_bytes
