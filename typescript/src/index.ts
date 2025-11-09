/**
 * Binary encoding and decoding for Philips Hue Zigbee messages.
 *
 * This module implements encoding and decoding of the binary format used by Hue
 * Zigbee devices, reverse-engineered by Christian Iversen and described at:
 * https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md
 *
 * @module
 */

export const HUE_LIGHT_EFFECT_CLUSTER_ID = 0xfc03;
export const HUE_VENDOR_ID = 0x100b;

/** Bit flags used to indicate which fields are set in a HueLightUpdateMessage. */
const enum Flags {
  ON_OFF = 1 << 0,
  BRIGHTNESS = 1 << 1,
  COLOR_MIRED = 1 << 2,
  COLOR_XY = 1 << 3,
  TRANSITION_TIME = 1 << 4,
  EFFECT = 1 << 5,
  GRADIENT_PARAMS = 1 << 6,
  EFFECT_SPEED = 1 << 7,
  GRADIENT_COLORS = 1 << 8,
}

/** Predefined effects supported by Hue lights. */
export enum HueLightEffect {
  CANDLE = 0x01,
  FIREPLACE = 0x02,
  PRISM = 0x03,
  SUNRISE = 0x09,
  SPARKLE = 0x0a,
  OPAL = 0x0b,
  GLISTEN = 0x0c,
  SUNSET = 0x0d,
  UNDERWATER = 0x0e,
  COSMOS = 0x0f,
  SUNBEAM = 0x10,
  ENCHANT = 0x11,
}

/**
 * Color specified as XY coordinates.
 *
 * X and Y values are integers in the range 0-4095 (0xFFF), corresponding to a
 * maximum X=0.7347 and Y=0.8264 (determined experimentally by Christian
 * Iversen).
 */
export class HueLightColorXYScaled {
  public x: number;
  public y: number;

  public static readonly SCALING_MAX_X = 0.7347;
  public static readonly SCALING_MAX_Y = 0.8264;

  public constructor(init: { x: number; y: number }) {
    this.x = init.x;
    this.y = init.y;
  }

  /** Serialize to a 3-byte buffer. */
  public toBytes(): Uint8Array<ArrayBuffer> {
    const { x, y } = this;
    const result = new Uint8Array(3);
    result[0] = x & 0x0ff;
    result[1] = ((x & 0xf00) >> 8) | ((y & 0x00f) << 4);
    result[2] = (y & 0xff0) >> 4;
    return result;
  }

  /**
   * Deserialize from a 3-byte buffer.
   *
   * @param data An ArrayBuffer or TypedArray containing the serialized message.
   */
  public static fromBytes(data: ArrayBufferLike | ArrayBufferView): HueLightColorXYScaled {
    if (data.byteLength !== 3) {
      throw new Error(`Expected 3 bytes, received ${data.byteLength}`);
    }

    const array = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);

    const a = array[0]!;
    const b = array[1]!;
    const c = array[2]!;
    return new HueLightColorXYScaled({
      x: ((b & 0x0f) << 8) | a,
      y: (c << 4) | (b >> 4),
    });
  }
}

/**
 * Color specified as XY coordinates in the range 0-1.
 *
 * See also: https://viereck.ch/hue-xy-rgb/
 */
export class HueLightColorXY {
  public x: number;
  public y: number;

  public constructor(init: { x: number; y: number }) {
    this.x = init.x;
    this.y = init.y;
  }

  /** Convert from 0-1 to a scaled representation for serialization. */
  public toScaled(): HueLightColorXYScaled {
    return new HueLightColorXYScaled({
      x: Math.trunc(0xfff * Math.max(0, Math.min(this.x / HueLightColorXYScaled.SCALING_MAX_X, 1))),
      y: Math.trunc(0xfff * Math.max(0, Math.min(this.y / HueLightColorXYScaled.SCALING_MAX_Y, 1))),
    });
  }

  /** Convert from a scaled representation to 0-1. */
  public static fromScaled(scaled: HueLightColorXYScaled): HueLightColorXY {
    return new HueLightColorXY({
      x: (scaled.x / 0xfff) * HueLightColorXYScaled.SCALING_MAX_X,
      y: (scaled.y / 0xfff) * HueLightColorXYScaled.SCALING_MAX_Y,
    });
  }
}

/** Color temperature specified in mireds. */
export class HueLightColorMired {
  public mired: number;

  public constructor(init: { mired: number }) {
    this.mired = init.mired;
  }

  /** Create a color by converting from Kelvin to mireds. */
  public static fromKelvin(kelvin: number): HueLightColorMired {
    return new HueLightColorMired({
      mired: Math.trunc(1_000_000 / kelvin),
    });
  }
}

/** Styles that can be used for custom gradients on light strips. */
export enum HueLightGradientStyle {
  LINEAR = 0x00,
  SCATTERED = 0x02,
  MIRRORED = 0x04,
}

/** A custom gradient on a light strip. */
export type HueLightGradient = {
  style: HueLightGradientStyle;
  colors: HueLightColorXY[];
};

/**
 * Gradient scale and offset parameters (for light strips). Values can be
 * between 0 and 31.875 in increments of 0.125 (1/8).
 */
export type HueLightGradientParams  = {
  /**
   * Number of colors that should fit on the light strip. Ignored in the
   * "scattered" gradient style. A value of 0 is special, blending all the
   * gradient colors smoothly across the whole light strip. Read more at:
   * https://github.com/chrivers/bifrost/blob/master/doc/hue-zigbee-format.md#property-gradient_params-scale
   */
  scale: number;
  /** Number of lights to skip at the start of the light strip. */
  offset: number;
};

type HueLightUpdateInit = {
  /** Set to true to turn the light on, false to turn off. */
  isOn?: boolean | undefined;
  /** 0-255 (0xFF), although only values 1 (dimmest) through 254 (brightest) are valid. */
  brightness?: number | undefined;
  /** Color temperature in mireds. You can also use HueLightColorMired.fromKelvin() to convert from Kelvin. */
  colorTemp?: HueLightColorMired | undefined;
  /** Color as XY values. See also: https://viereck.ch/hue-xy-rgb/ */
  colorXY?: HueLightColorXY | undefined;
  /** 0-65535 (0xFFFF). Use 0 for an instantaneous transition, higher numbers for a slower fade. */
  transitionTime?: number | undefined;
  /** Specify one of the light effects from the HueLightEffect enum. */
  effect?: HueLightEffect | undefined;
  /** Animation speed of the selected effect: 0 (slowest) to 255 (fastest). */
  effectSpeed?: number | undefined;
  /** Gradient colors and style (for light strips). */
  gradient?: HueLightGradient | undefined;
  /** Gradient scale and offset parameters (for light strips). */
  gradientParams?: HueLightGradientParams | undefined;
};

/**
 * A combined light state update message.
 *
 * This is a combined state update message that can include any number of light
 * attributes at once. You can leave out some attributes or set them to None)
 * and they will not be modified (and not included in the to_bytes()
 * representation).
 *
 * Use `new HueLightUpdateMessage({...}).toBytes()` to produce a byte string.
 *
 * Use `bytesToHex(new HueLightUpdateMessage({...}).toBytes())` to produce a
 * printable hex string of the same bytes.
 *
 * Use `HueLightUpdateMessage.fromBytes(...)` to parse a byte buffer into a
 * HueLightUpdateMessage instance.
 *
 * Use `HueLightUpdateMessage.fromBytes(bytesToHex(...))` to parse a hex string
 * into a HueLightUpdateMessage instance.
 */
export class HueLightUpdateMessage {
  /** Set to true to turn the light on, false to turn off. */
  public isOn?: boolean | undefined;
  /** 0-255 (0xFF), although only values 1 (dimmest) through 254 (brightest) are valid. */
  public brightness?: number | undefined;
  /** Color temperature in mireds. You can also use HueLightColorMired.fromKelvin() to convert from Kelvin. */
  public colorTemp?: HueLightColorMired | undefined;
  /** Color as XY values. See also: https://viereck.ch/hue-xy-rgb/ */
  public colorXY?: HueLightColorXY | undefined;
  /** 0-65535 (0xFFFF). Use 0 for an instantaneous transition, higher numbers for a slower fade. */
  public transitionTime?: number | undefined;
  /** Specify one of the light effects from the HueLightEffect enum. */
  public effect?: HueLightEffect | undefined;
  /** Animation speed of the selected effect: 0 (slowest) to 255 (fastest). */
  public effectSpeed?: number | undefined;
  /** Gradient colors and style (for light strips). */
  public gradient?: HueLightGradient | undefined;
  /** Gradient scale and offset parameters (for light strips). */
  public gradientParams?: HueLightGradientParams | undefined;

  public constructor(init?: HueLightUpdateInit) {
    if (init) {
      this.isOn = init.isOn;
      this.brightness = init.brightness;
      this.colorTemp = init.colorTemp;
      this.colorXY = init.colorXY;
      this.transitionTime = init.transitionTime;
      this.effect = init.effect;
      this.effectSpeed = init.effectSpeed;
      this.gradient = init.gradient;
      this.gradientParams = init.gradientParams;
    }
  }

  /** Serialize a HueLightUpdateMessage to a byte array. */
  public toBytes(): Uint8Array<ArrayBuffer> {
    const {
      isOn,
      brightness,
      colorTemp,
      colorXY,
      transitionTime,
      effect,
      gradient,
      effectSpeed,
      gradientParams,
    } = this;

    // Calculating the length in advance allows us to avoid the difficulty of
    // reallocating/resizing a buffer
    const encodedLength =
      /* flags */ 2 +
      (isOn != undefined ? 1 : 0) +
      (brightness != undefined ? 1 : 0) +
      (colorTemp != undefined ? 2 : 0) +
      (colorXY != undefined ? 4 : 0) +
      (transitionTime != undefined ? 2 : 0) +
      (effect != undefined ? 1 : 0) +
      (gradient != undefined ? 5 + 3 * gradient.colors.length : 0) +
      (effectSpeed != undefined ? 1 : 0) +
      (gradientParams != undefined ? 2 : 0);

    const array = new Uint8Array(encodedLength);
    const view = new DataView(array.buffer);
    let offset = 2; // flags are written at the end
    let flags = 0;

    if (isOn != undefined) {
      flags |= Flags.ON_OFF;
      view.setUint8(offset, isOn ? 1 : 0);
      offset += 1;
    }
    if (brightness != undefined) {
      if (brightness < 1 || brightness > 254) {
        throw new RangeError("Brightness must be between 1 and 254");
      }
      flags |= Flags.BRIGHTNESS;
      view.setUint8(offset, brightness);
      offset += 1;
    }
    if (colorTemp != undefined) {
      flags |= Flags.COLOR_MIRED;
      view.setUint16(offset, colorTemp.mired, true);
      offset += 2;
    }
    if (colorXY != undefined) {
      flags |= Flags.COLOR_XY;
      view.setUint16(offset, colorXY.x * 0xffff, true);
      view.setUint16(offset + 2, colorXY.y * 0xffff, true);
      offset += 4;
    }
    if (transitionTime != undefined) {
      flags |= Flags.TRANSITION_TIME;
      view.setUint16(offset, transitionTime, true);
      offset += 2;
    }
    if (effect != undefined) {
      flags |= Flags.EFFECT;
      view.setUint8(offset, effect);
      offset += 1;
    }
    if (gradient != undefined) {
      flags |= Flags.GRADIENT_COLORS;
      const size = 4 + 3 * gradient.colors.length;
      view.setUint8(offset, size);
      offset += 1;
      view.setUint8(offset, gradient.colors.length << 4);
      offset += 1;
      view.setUint8(offset, gradient.style);
      offset += 1;
      offset += 2; // reserved/zero
      for (const color of gradient.colors) {
        array.set(color.toScaled().toBytes(), offset);
        offset += 3;
      }
    }
    if (effectSpeed != undefined) {
      flags |= Flags.EFFECT_SPEED;
      view.setUint8(offset, effectSpeed);
      offset += 1;
    }
    if (gradientParams != undefined) {
      flags |= Flags.GRADIENT_PARAMS;
      view.setUint8(offset, gradientParams.scale * 8);
      view.setUint8(offset + 1, gradientParams.offset * 8);
      offset += 2;
    }

    if (offset !== encodedLength) {
      throw new Error(
        `Invariant: precomputed length was ${encodedLength}, but only wrote ${offset} bytes`,
      );
    }

    view.setUint16(0, flags, true);
    return array;
  }

  /**
   * Deserialize a HueLightUpdateMessage from a byte buffer.
   *
   * @param data An ArrayBuffer or TypedArray containing the serialized message.
   */
  public static fromBytes(data: ArrayBufferLike | ArrayBufferView): HueLightUpdateMessage {
    const view = ArrayBuffer.isView(data)
      ? new DataView(data.buffer, data.byteOffset, data.byteLength)
      : new DataView(data);

    const result = new HueLightUpdateMessage();

    let offset = 0;
    const flags = view.getUint16(offset, true);
    offset += 2;

    if ((flags & Flags.ON_OFF) !== 0) {
      result.isOn = view.getUint8(offset) !== 0;
      offset += 1;
    }
    if ((flags & Flags.BRIGHTNESS) !== 0) {
      result.brightness = view.getUint8(offset);
      offset += 1;
    }
    if ((flags & Flags.COLOR_MIRED) !== 0) {
      const mired = view.getUint16(offset, true);
      result.colorTemp = new HueLightColorMired({ mired });
      offset += 2;
    }
    if ((flags & Flags.COLOR_XY) !== 0) {
      const x = view.getUint16(offset, true) / 0xffff;
      offset += 2;
      const y = view.getUint16(offset, true) / 0xffff;
      offset += 2;
      result.colorXY = new HueLightColorXY({ x, y });
    }
    if ((flags & Flags.TRANSITION_TIME) !== 0) {
      result.transitionTime = view.getUint16(offset, true);
      offset += 2;
    }
    if ((flags & Flags.EFFECT) !== 0) {
      result.effect = view.getUint8(offset) as HueLightEffect;
      offset += 1;
    }
    if ((flags & Flags.GRADIENT_COLORS) !== 0) {
      const size = view.getUint8(offset);
      if (size < 4) {
        throw new Error(
          `Failed to parse gradient colors: size=${size} too small, expected at least 4`,
        );
      }
      if (offset + size + 1 > view.byteLength) {
        throw new Error(
          `Failed to parse gradient colors: size=${size} from offset=${
            offset + 1
          } extends beyond end of data`,
        );
      }
      const colorCount = view.getUint8(offset + 1) >> 4;
      const style = view.getUint8(offset + 2) as HueLightGradientStyle;
      const colors: HueLightColorXY[] = [];
      const colorsStart = offset + 5;
      const colorsEnd = colorsStart + colorCount * 3;
      if (colorsEnd > offset + size + 1) {
        throw new Error(
          `Failed to parse gradient colors: not enough data (${colorCount} colors would extend ${colorsEnd - offset} bytes beyond offset=${offset}, expected no more than size=${size})`,
        );
      }
      for (let colorOffset = colorsStart; colorOffset < colorsEnd; colorOffset += 3) {
        colors.push(
          HueLightColorXY.fromScaled(
            HueLightColorXYScaled.fromBytes(
              new Uint8Array(view.buffer, view.byteOffset + colorOffset, 3),
            ),
          ),
        );
      }
      result.gradient = { style, colors };
      offset += size + 1;
    }
    if ((flags & Flags.EFFECT_SPEED) !== 0) {
      result.effectSpeed = view.getUint8(offset);
      offset += 1;
    }
    if ((flags & Flags.GRADIENT_PARAMS) !== 0) {
      result.gradientParams = {
        scale: view.getUint8(offset) / 8,
        offset: view.getUint8(offset + 1) / 8,
      };
      offset += 2;
    }
    return result;
  }
}

const VALID_HEX = /^(?:[0-9a-fA-F]{2})*$/;

/**
 * Convert a hex string, where each byte is represented by two hexadecimal
 * characters, into a Uint8Array. For example, `hexToBytes("01fe")` returns `new
 * Uint8Array([1, 254])`.
 */
export function hexToBytes(str: string): Uint8Array<ArrayBuffer> {
  if (!VALID_HEX.test(str)) {
    throw new Error("Hex string must have even length and contain only 0-9, a-f, or A-F");
  }
  const byteLength = str.length / 2;
  const result = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i += 1) {
    result[i] = parseInt(str.substring(i * 2, i * 2 + 2), 16);
  }
  return result;
}

/**
 * Convert a TypedArray or buffer into a hex string, where each byte is
 * represented by two hexadecimal characters. For example, `bytesToHex(new
 * Uint8Array([1, 254]))` returns `"01fe"`.
 */
export function bytesToHex(bytes: ArrayBufferLike | ArrayBufferView): string {
  const array = ArrayBuffer.isView(bytes)
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : new Uint8Array(bytes);
  let result = "";
  const length = array.length;
  for (let i = 0; i < length; i++) {
    const byte = array[i]!;
    if (byte < 0x10) {
      result += "0";
    }
    result += byte.toString(16);
  }
  return result;
}
