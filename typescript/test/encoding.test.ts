import { describe, expect, it } from "vitest";

import {
  bytesToHex,
  hexToBytes,
  HueLightColorMired,
  HueLightColorXY,
  HueLightColorXYScaled,
  HueLightEffect,
  HueLightGradientStyle,
  HueLightUpdateMessage,
} from "../src";

function binaryStringToBytes(str: string): Uint8Array {
  return Uint8Array.from(str, (char) => char.codePointAt(0)!);
}

describe("binaryStringToBytes", () => {
  const x: number = "hi";
  it.each([
    ["", []],
    ["\x7f", [0x7f]],
    ["\x00\xff\x02\xfe", [0x00, 0xff, 0x02, 0xfe]],
  ])("converts string to bytes", (str, bytes) => {
    expect(binaryStringToBytes(str)).toEqual(new Uint8Array(bytes));
  });
});

describe("hexToBytes/bytesToHex", () => {
  it.each([
    ["", []],
    ["7f", [0x7f]],
    ["00ff02fe", [0x00, 0xff, 0x02, 0xfe]],
  ])("converts %s <=> %s", (hex, byteArray) => {
    const bytes = new Uint8Array(byteArray);
    expect(hexToBytes(hex)).toEqual(bytes);
    expect(bytesToHex(bytes)).toEqual(hex);
  });

  it("rejects invalid hex strings", () => {
    expect(() => hexToBytes("0")).toThrow(
      "Hex string must have even length and contain only 0-9, a-f, or A-F",
    );
    expect(() => hexToBytes("012")).toThrow(
      "Hex string must have even length and contain only 0-9, a-f, or A-F",
    );
    expect(() => hexToBytes(" a")).toThrow(
      "Hex string must have even length and contain only 0-9, a-f, or A-F",
    );
  });
});

describe("HueLightUpdateMessage encoding", () => {
  it.each([
    [new HueLightUpdateMessage(), "\x00\x00"],
    [new HueLightUpdateMessage({ isOn: false }), "\x01\x00\x00"],
    [new HueLightUpdateMessage({ isOn: true }), "\x01\x00\x01"],
    [new HueLightUpdateMessage({ brightness: 0x7f }), "\x02\x00\x7f"],
    [
      new HueLightUpdateMessage({ colorTemp: new HueLightColorMired({ mired: 0x1234 }) }),
      "\x04\x00\x34\x12",
    ],
    [
      new HueLightUpdateMessage({
        colorXY: new HueLightColorXY({ x: 0x6677 / 0xffff, y: 0x2233 / 0xffff }),
      }),
      "\x08\x00\x77\x66\x33\x22",
    ],
    [new HueLightUpdateMessage({ transitionTime: 0x1234 }), "\x10\x00\x34\x12"],
    [new HueLightUpdateMessage({ effect: HueLightEffect.SUNSET }), "\x20\x00\x0d"],
    [
      new HueLightUpdateMessage({
        gradient: { style: HueLightGradientStyle.SCATTERED, colors: [] },
      }),

      "\x00\x01" + // flags
        "\x04" + // byte size of style+colors
        "\x00" + // 0 colors
        "\x02\x00\x00", // style + reserved,
    ],
    [
      new HueLightUpdateMessage({ gradientParams: { scale: 0xcc / 8, offset: 0xdd / 8 } }),

      "\x40\x00" + // flags
        "\xcc\xdd", // scale + offset
    ],
    [
      new HueLightUpdateMessage({
        gradient: { style: HueLightGradientStyle.SCATTERED, colors: [] },
        gradientParams: { scale: 0xcc / 8, offset: 0xdd / 8 },
      }),

      "\x40\x01" + // flags
        "\x04" + // byte size of style+colors
        "\x00" + // 0 colors
        "\x02\x00\x00" + // style + reserved
        "\xcc\xdd", // scale + offset
    ],
    [
      new HueLightUpdateMessage({
        gradient: {
          style: HueLightGradientStyle.SCATTERED,
          colors: [
            new HueLightColorXY({
              x: (0x123 / 0xfff) * HueLightColorXYScaled.SCALING_MAX_X,
              y: (0xabc / 0xfff) * HueLightColorXYScaled.SCALING_MAX_Y,
            }),
            new HueLightColorXY({
              x: (0x789 / 0xfff) * HueLightColorXYScaled.SCALING_MAX_X,
              y: (0xdef / 0xfff) * HueLightColorXYScaled.SCALING_MAX_Y,
            }),
          ],
        },
        gradientParams: { scale: 0xcc / 8, offset: 0xdd / 8 },
      }),

      "\x40\x01" + // flags
        "\x0a" + // byte size of style+colors
        "\x20" + // 2 colors
        "\x02\x00\x00" + // style + reserved
        "\x23\xc1\xab" + // color 1
        "\x89\xf7\xde" + // color 2
        "\xcc\xdd", // scale + offset
    ],
    [new HueLightUpdateMessage({ effectSpeed: 0x12 }), "\x80\x00\x12"],
  ])("encodes and decodes from expected bytes: %s", (message, expectedStr) => {
    const expectedBytes = binaryStringToBytes(expectedStr);
    expect(message.toBytes()).toEqual(expectedBytes);
    expect(HueLightUpdateMessage.fromBytes(expectedBytes)).toEqual(message);
  });

  // Test some examples from https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md
  it.each([
    [
      "ab00012e6f2f40100f7f",
      new HueLightUpdateMessage({
        isOn: true,
        brightness: 46,
        colorXY: new HueLightColorXY({ x: 0.18529030289158466, y: 0.06347753109025711 }),
        effect: HueLightEffect.COSMOS,
        effectSpeed: 127,
      }),
    ],
    [
      "19000132518f530400",
      new HueLightUpdateMessage({
        isOn: true,
        colorXY: new HueLightColorXY({ x: 0.3171740291447318, y: 0.32640573739223316 }),
        transitionTime: 4,
      }),
    ],
    ["1100000800", new HueLightUpdateMessage({ isOn: false, transitionTime: 8 })],
  ])("decodes example", (hex, expectedMsg) => {
    const bytes = hexToBytes(hex);
    expect(HueLightUpdateMessage.fromBytes(bytes)).toEqual(expectedMsg);
    expect(Array.from(expectedMsg.toBytes())).toEqual(Array.from(bytes));
  });
});

describe("HueLightColorXYScaled", () => {
  it("encodes and decodes from expected bytes", () => {
    const color = new HueLightColorXYScaled({ x: 0x123, y: 0xabc });
    const expected = new Uint8Array([0x23, 0xc1, 0xab]);
    expect(color.toBytes()).toEqual(expected);
    expect(HueLightColorXYScaled.fromBytes(expected)).toEqual(color);
  });
});
