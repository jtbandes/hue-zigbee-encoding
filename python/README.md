# hue-zigbee-encoding

`hue-zigbee-encoding` implements encoding and decoding of the binary format used
by Philips Hue Zigbee devices.

The format was reverse-engineered by Christian Iversen and described at:
https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md

Other related resources:

- https://kjagiello.github.io/hue-gradient-command-wizard/
- https://viereck.ch/hue-xy-rgb/

## Installation

With pip: `pip install hue-zigbee-encoding`

With uv: `uv add hue-zigbee-encoding`

## Documentation

### `HueLightUpdateMessage`

The `HueLightUpdateMessage` class represents multiple attributes of a Hue light,
combined into one object. It supports conversion to and from `bytes`:

```py
from hue_zigbee_encoding import HueLightUpdateMessage

# Convert to bytes: returns b"\x03\x00\x01\x7f"
HueLightUpdateMessage(is_on=True, brightness=127).to_bytes()

# Convert from bytes: returns a HueLightUpdateMessage object
HueLightUpdateMessage.from_bytes(b"\x03\x00\x01\x7f")
```

Use `hex` and `fromhex` to convert to and from printable strings:

```py
# Convert to a hex string: returns "0300017f"
HueLightUpdateMessage(is_on=True, brightness=127).to_bytes().hex()

# Convert from a hex string: returns a HueLightUpdateMessage object
HueLightUpdateMessage.from_bytes(bytes.fromhex("0300017f"))
```

#### HueLightUpdateMessage attributes

All attributes are optional (they accept a value of `None`). You can apply
a subset of attributes to change only those settings of Hue lights.

| Attribute         | Type                                                                   | Description                                                                                              |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `is_on`           | `bool \| None`                                                         | Set to `True` to turn the light on, `False` to turn off.                                                 |
| `brightness`      | `int \| None`                                                          | 0–255 (0xFF), although only values 1 (dimmest) through 254 (brightest) are valid.                        |
| `color_temp`      | <code>[HueLightColorMired](#huelightcolormired) \| None</code>         | Color temperature in mireds. You can also use `HueLightColorMired.from_kelvin()` to convert from Kelvin. |
| `color_xy`        | <code>[HueLightColorXY](#huelightcolorxy) \| None</code>               | Color as XY values. See also: https://viereck.ch/hue-xy-rgb/                                             |
| `transition_time` | `int \| None`                                                          | 0–65535 (0xFFFF). Use 0 for an instantaneous transition, higher numbers for a slower fade.               |
| `effect`          | <code>[HueLightEffect](#huelighteffect) \| None</code>                 | Specify one of the light effects from the HueLightEffect enum.                                           |
| `effect_speed`    | `int \| None`                                                          | Animation speed of the selected effect: 0 (slowest) to 255 (fastest).                                    |
| `gradient`        | <code>[HueLightGradient](#huelightgradient) \| None</code>             | Gradient colors and style (for light strips).                                                            |
| `gradient_params` | <code>[HueLightGradientParams](#huelightgradientparams) \| None</code> | Gradient scale and offset parameters (for light strips).                                                 |

### `HueLightColorXY`

Color specified as [XY coordinates](https://en.wikipedia.org/wiki/CIE_1931_color_space) in the range 0–1. See also: https://viereck.ch/hue-xy-rgb/

```py
from hue_zigbee_encoding import HueLightColorXY

HueLightColorXY(x=0.424, y=0.285)
```

### `HueLightColorMired`

Color temperature specified in [mireds](https://en.wikipedia.org/wiki/Mired).

```py
from hue_zigbee_encoding import HueLightColorMired

# Specify a color temperature in mireds:
HueLightColorMired(mired=40)

# Specify a color temperature in Kelvin:
HueLightColorMired.from_kelvin(25000)
```

### `HueLightEffect`

This enum describes the predefined effects supported by Hue lights.

| Name                        | Decimal value | Hex value |
| --------------------------- | ------------: | --------- |
| `HueLightEffect.CANDLE`     |             1 | 0x01      |
| `HueLightEffect.FIREPLACE`  |             2 | 0x02      |
| `HueLightEffect.PRISM`      |             3 | 0x03      |
| `HueLightEffect.SUNRISE`    |             9 | 0x09      |
| `HueLightEffect.SPARKLE`    |            10 | 0x0A      |
| `HueLightEffect.OPAL`       |            11 | 0x0B      |
| `HueLightEffect.GLISTEN`    |            12 | 0x0C      |
| `HueLightEffect.SUNSET`     |            13 | 0x0D      |
| `HueLightEffect.UNDERWATER` |            14 | 0x0E      |
| `HueLightEffect.COSMOS`     |            15 | 0x0F      |
| `HueLightEffect.SUNBEAM`    |            16 | 0x10      |
| `HueLightEffect.ENCHANT`    |            17 | 0x11      |

### `HueLightGradient`

This class represents a custom gradient on a light strip.

```py
from hue_zigbee_encoding import HueLightGradient

HueLightGradient(
    style=HueLightGradientStyle.SCATTERED,
    colors=[
        HueLightColorXY(x=0.424, y=0.285),
        HueLightColorXY(x=0.229, y=0.279),
    ],
)
```

| Attribute | Type                                                   | Description                                         |
| --------- | ------------------------------------------------------ | --------------------------------------------------- |
| `style`   | [`HueLightGradientStyle`](#huelightgradientstyle)      | The type of gradient effect. See below for options. |
| `colors`  | <code>list[[HueLightColorXY](#huelightcolorxy)]</code> | List of colors in the gradient.                     |

### `HueLightGradientStyle`

This enum describes the different styles that can be used for custom gradients on light strips.

| Name                              | Decimal value | Hex value |
| --------------------------------- | ------------: | --------- |
| `HueLightGradientStyle.LINEAR`    |             0 | 0x00      |
| `HueLightGradientStyle.SCATTERED` |             2 | 0x02      |
| `HueLightGradientStyle.MIRRORED`  |             4 | 0x04      |

### `HueLightGradientParams`

Gradient scale and offset parameters (for light strips). Values can be between 0
and 31.875 in increments of 0.125 (1/8).

| Attribute | Type    | Description                                                                                                                                                                                                                                                                                                            |
| --------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scale`   | `float` | Number of colors that should fit on the light strip. Ignored in the "scattered" gradient style. A value of 0 is special, blending all the gradient colors smoothly across the whole light strip. Read more at: https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md#property-gradient_params-scale |
| `offset`  | `float` | Number of lights to skip at the start of the light strip.                                                                                                                                                                                                                                                              |
