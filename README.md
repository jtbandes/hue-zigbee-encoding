# hue-zigbee-encoding

`hue-zigbee-encoding` implements encoding and decoding of the binary format used
by Philips Hue Zigbee devices.

The format was reverse-engineered by Christian Iversen and described at:
https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md

Other related resources:

- https://kjagiello.github.io/hue-gradient-command-wizard/
- https://viereck.ch/hue-xy-rgb/

## Packages

`hue-zigbee-encoding` is available for both Python and JavaScript/TypeScript.

| Language   | Version                                                                                                                          | Documentation                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Python     | [![hue-zigbee-encoding on PyPI](https://shields.io/pypi/v/hue-zigbee-encoding)](https://pypi.org/project/hue-zigbee-encoding/)   | [Python README](./python#readme)         |
| TypeScript | [![hue-zigbee-encoding on NPM](https://shields.io/npm/v/hue-zigbee-encoding)](https://www.npmjs.com/package/hue-zigbee-encoding) | [TypeScript README](./typescript#readme) |

### Python quick start

```py
from hue_zigbee_encoding import HueLightUpdateMessage

# Convert to bytes: returns b"\x03\x00\x01\x7f"
HueLightUpdateMessage(is_on=True, brightness=127).to_bytes()

# Convert from bytes: returns a HueLightUpdateMessage object
HueLightUpdateMessage.from_bytes(b"\x03\x00\x01\x7f")
```

### TypeScript quick start

```ts
import { HueLightUpdateMessage } from "hue-zigbee-encoding";

// Convert to bytes: returns `new Uint8Array([0x03, 0x00, 0x01, 0x7f])`
new HueLightUpdateMessage({ isOn: true, brightness: 127 }).toBytes();

// Convert from bytes: returns a HueLightUpdateMessage object
HueLightUpdateMessage.fromBytes(new Uint8Array([0x03, 0x00, 0x01, 0x7f]));
```
