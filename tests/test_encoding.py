import pytest

from hue_zigbee_encoding import (
    HueLightColorMired,
    HueLightColorXY,
    HueLightColorXYScaled,
    HueLightEffect,
    HueLightGradient,
    HueLightGradientParams,
    HueLightGradientStyle,
    HueLightUpdateMessage,
)


@pytest.mark.parametrize(
    ("message", "expected_bytes"),
    [
        (HueLightUpdateMessage(), b"\x00\x00"),
        (HueLightUpdateMessage(is_on=False), b"\x01\x00\x00"),
        (HueLightUpdateMessage(is_on=True), b"\x01\x00\x01"),
        (HueLightUpdateMessage(brightness=0x7F), b"\x02\x00\x7f"),
        (
            HueLightUpdateMessage(color_temp=HueLightColorMired(mired=0x1234)),
            b"\x04\x00\x34\x12",
        ),
        (
            HueLightUpdateMessage(
                color_xy=HueLightColorXY(x=0x6677 / 0xFFFF, y=0x2233 / 0xFFFF),
            ),
            b"\x08\x00\x77\x66\x33\x22",
        ),
        (HueLightUpdateMessage(transition_time=0x1234), b"\x10\x00\x34\x12"),
        (HueLightUpdateMessage(effect=HueLightEffect.SUNSET), b"\x20\x00\x0d"),
        (
            HueLightUpdateMessage(
                gradient=HueLightGradient(
                    style=HueLightGradientStyle.SCATTERED,
                    colors=[],
                ),
            ),
            b"\x00\x01"  # flags
            b"\x04"  # byte size of style+colors
            b"\x00"  # 0 colors
            b"\x02\x00\x00",  # style + reserved
        ),
        (
            HueLightUpdateMessage(
                gradient_params=HueLightGradientParams(scale=0xCC / 8, offset=0xDD / 8),
            ),
            b"\x40\x00"  # flags
            b"\xcc\xdd",  # scale + offset
        ),
        (
            HueLightUpdateMessage(
                gradient=HueLightGradient(
                    style=HueLightGradientStyle.SCATTERED,
                    colors=[],
                ),
                gradient_params=HueLightGradientParams(scale=0xCC / 8, offset=0xDD / 8),
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
                ),
                gradient_params=HueLightGradientParams(scale=0xCC / 8, offset=0xDD / 8),
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
    assert HueLightUpdateMessage.from_bytes(expected_bytes) == message


def test_encoding_xy_scaled():
    color = HueLightColorXYScaled(x=0x123, y=0xABC)
    assert color.to_bytes() == b"\x23\xc1\xab"
    assert HueLightColorXYScaled.from_bytes(b"\x23\xc1\xab") == color


@pytest.mark.parametrize(
    ("data", "expected_message"),
    [
        (
            bytes.fromhex("ab00012e6f2f40100f7f"),
            HueLightUpdateMessage(
                is_on=True,
                brightness=46,
                color_xy=HueLightColorXY(x=0.18529030289158466, y=0.06347753109025711),
                effect=HueLightEffect.COSMOS,
                effect_speed=127,
            ),
        ),
        (
            bytes.fromhex("19000132518f530400"),
            HueLightUpdateMessage(
                is_on=True,
                color_xy=HueLightColorXY(x=0.3171740291447318, y=0.32640573739223316),
                transition_time=4,
            ),
        ),
        (
            bytes.fromhex("1100000800"),
            HueLightUpdateMessage(is_on=False, transition_time=8),
        ),
    ],
)
def test_examples(data: bytes, expected_message: HueLightUpdateMessage):
    """
    Test some examples from https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md
    """

    assert HueLightUpdateMessage.from_bytes(data) == expected_message
    assert expected_message.to_bytes() == data
