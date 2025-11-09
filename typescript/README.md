# hue-zigbee-encoding

`hue-zigbee-encoding` implements encoding and decoding of the binary format used
by Philips Hue Zigbee devices.

The format was reverse-engineered by Christian Iversen and described at:
https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md

Other related resources:

- https://kjagiello.github.io/hue-gradient-command-wizard/
- https://viereck.ch/hue-xy-rgb/

## Installation

With npm: `npm install hue-zigbee-encoding`

With yarn: `yarn add hue-zigbee-encoding`

## Documentation

### `HueLightUpdateMessage`

The `HueLightUpdateMessage` class represents multiple attributes of a Hue light,
combined into one object. It supports conversion to and from `bytes`:

```ts
import { HueLightUpdateMessage } from "hue-zigbee-encoding";

// Convert to bytes: returns `new Uint8Array([0x03, 0x00, 0x01, 0x7f])`
new HueLightUpdateMessage({ isOn: true, brightness: 127 }).toBytes();

// Convert from bytes: returns a HueLightUpdateMessage object
HueLightUpdateMessage.fromBytes(new Uint8Array([0x03, 0x00, 0x01, 0x7f]));
```

Use `bytesToHex` and `hexToBytes` to convert to and from printable strings:

```ts
import { HueLightUpdateMessage, bytesToHex, hexToBytes } from "hue-zigbee-encoding";

// Convert to a hex string: returns "0300017f"
bytesToHex(new HueLightUpdateMessage({ isOn: true, brightness: 127 }).toBytes());

// Convert from a hex string: returns a HueLightUpdateMessage object
HueLightUpdateMessage.fromBytes(hexToBytes("0300017f"));
```

#### HueLightUpdateMessage properties

All properties are optional (they accept a value of `undefined`). You can apply
a subset of properties to change only those settings of Hue lights.

| Property         | Type                                                                        | Description                                                                                             |
| ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `isOn`           | `boolean \| undefined`                                                      | Set to `true` to turn the light on, `false` to turn off.                                                |
| `brightness`     | `number \| undefined`                                                       | 0–255 (0xFF), although only values 1 (dimmest) through 254 (brightest) are valid.                       |
| `colorTemp`      | <code>[HueLightColorMired](#huelightcolormired) \| undefined</code>         | Color temperature in mireds. You can also use `HueLightColorMired.fromKelvin()` to convert from Kelvin. |
| `colorXY`        | <code>[HueLightColorXY](#huelightcolorxy) \| undefined</code>               | Color as XY values. See also: https://viereck.ch/hue-xy-rgb/                                            |
| `transitionTime` | `number \| undefined`                                                       | 0–65535 (0xFFFF). Use 0 for an instantaneous transition, higher numbers for a slower fade.              |
| `effect`         | <code>[HueLightEffect](#huelighteffect) \| undefined</code>                 | Specify one of the light effects from the HueLightEffect enum.                                          |
| `effectSpeed`    | `number \| undefined`                                                       | Animation speed of the selected effect: 0 (slowest) to 255 (fastest).                                   |
| `gradient`       | <code>[HueLightGradient](#huelightgradient) \| undefined</code>             | Gradient colors and style (for light strips).                                                           |
| `gradientParams` | <code>[HueLightGradientParams](#huelightgradientparams) \| undefined</code> | Gradient scale and offset parameters (for light strips).                                                |

### `HueLightColorXY`

Color specified as [XY coordinates](https://en.wikipedia.org/wiki/CIE_1931_color_space) in the range 0–1. See also: https://viereck.ch/hue-xy-rgb/

```ts
import { HueLightColorXY } from "hue-zigbee-encoding";

new HueLightColorXY({ x: 0.424, y: 0.285 });
```

### `HueLightColorMired`

Color temperature specified in [mireds](https://en.wikipedia.org/wiki/Mired).

```ts
import { HueLightColorMired } from "hue-zigbee-encoding";

// Specify a color temperature in mireds:
new HueLightColorMired({ mired: 40 });

// Specify a color temperature in Kelvin:
HueLightColorMired.fromKelvin(25000);
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

This type represents a custom gradient on a light strip.

```ts
import { HueLightColorXY, type HueLightGradient } from "hue-zigbee-encoding";

const gradient: HueLightGradient = {
  style: HueLightGradientStyle.SCATTERED,
  colors: [
    new HueLightColorXY({ x: 0.424, y: 0.285 }),
    new HueLightColorXY({ x: 0.229, y: 0.279 }),
  ],
};
```

| Attribute | Type                                               | Description                                         |
| --------- | -------------------------------------------------- | --------------------------------------------------- |
| `style`   | [`HueLightGradientStyle`](#huelightgradientstyle)  | The type of gradient effect. See below for options. |
| `colors`  | <code>[HueLightColorXY](#huelightcolorxy)[]</code> | List of colors in the gradient.                     |

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

```ts
import { type HueLightGradientParams } from "hue-zigbee-encoding";

const gradientParams: HueLightGradientParams = {
  scale: 0.0,
  offset: 2.0,
};
```

| Property | Type     | Description                                                                                                                                                                                                                                                                                                            |
| -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scale`  | `number` | Number of colors that should fit on the light strip. Ignored in the "scattered" gradient style. A value of 0 is special, blending all the gradient colors smoothly across the whole light strip. Read more at: https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md#property-gradient_params-scale |
| `offset` | `number` | Number of lights to skip at the start of the light strip.                                                                                                                                                                                                                                                              |
