import { ColorVariable, HarloweCustomDataType, PredefinedColorName } from "../types";

// Helper function to convert hex to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (hex === 'transparent') {
    return { r: 0, g: 0, b: 0 };
  }
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : { r: 0, g: 0, b: 0 };
}

// Helper function to convert RGB to HSL
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: s,
    l: l,
  };
}

// Helper function to convert RGB to LCH (via LAB)
export function rgbToLch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  // Convert RGB to XYZ
  r = r / 255;
  g = g / 255;
  b = b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100;

  // Convert XYZ to LAB (D65 illuminant)
  const xn = 95.047;
  const yn = 100.0;
  const zn = 108.883;

  const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1 / 3) : (7.787 * x / xn) + 16 / 116;
  const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1 / 3) : (7.787 * y / yn) + 16 / 116;
  const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1 / 3) : (7.787 * z / zn) + 16 / 116;

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const B = 200 * (fy - fz);

  // Convert LAB to LCH
  const c = Math.sqrt(a * a + B * B);
  let h = Math.atan2(B, a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return { l: L, c: c, h: h };
}

// Create ColorVariable from hex color
export function createColorVariable(hex: string, alpha: number = 1): Readonly<ColorVariable> {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const lch = rgbToLch(r, g, b);

  return Object.freeze({
    [HarloweCustomDataType]: 'Colour' as const,
    r,
    g,
    b,
    a: hex === 'transparent' ? 0 : alpha,
    h,
    s,
    l,
    lch: Object.freeze(lch),
  });
}

// Predefined color variables
export const allPredefinedColors = Object.freeze({
  red: createColorVariable('#e61919'),
  orange: createColorVariable('#e68019'),
  yellow: createColorVariable('#e5e619'),
  lime: createColorVariable('#80e619'),
  green: createColorVariable('#19e619'),
  aqua: createColorVariable('#19e5e6'),
  cyan: createColorVariable('#19e5e6'),
  blue: createColorVariable('#197fe6'),
  navy: createColorVariable('#1919e6'),
  purple: createColorVariable('#7f19e6'),
  magenta: createColorVariable('#e619e5'),
  fuchsia: createColorVariable('#e619e5'),
  white: createColorVariable('#fff'),
  black: createColorVariable('#000'),
  grey: createColorVariable('#888'),
  gray: createColorVariable('#888'),
  transparent: createColorVariable('transparent'),
} satisfies Readonly<Record<PredefinedColorName, ColorVariable>>);
