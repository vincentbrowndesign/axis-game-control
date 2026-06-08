export type AxisOverlayStyle = {
  colors: {
    background: string;
    ball: string;
    black: string;
    lime: string;
    white: string;
  };
  fade: {
    labelAlpha: number;
    ringAlpha: number;
    trailCoreAlpha: number;
    trailTailAlpha: number;
  };
  glow: {
    ballBloomRadius: number;
    ballCoreRadius: number;
    ballShadowBlur: number;
    pulseShadowBlur: number;
    ringShadowBlur: number;
  };
  label: {
    backgroundAlpha: number;
    height: number;
    minWidth: number;
    paddingX: number;
    textColor: string;
    textSize: number;
    verticalOffset: number;
  };
  ring: {
    confidenceThreshold: number;
    fillAlpha: number;
    heightScale: number;
    maxHeight: number;
    maxWidth: number;
    minHeight: number;
    minWidth: number;
    neutralColor: string;
    strokeWidth: number;
    widthScale: number;
  };
  trail: {
    confidenceThreshold: number;
    coreSize: number;
    highlightColor: string;
    maxAgeSeconds: number;
    maxHistory: number;
    tailSize: number;
  };
};

export const axisOverlayStyleV1 = {
  colors: {
    background: "#050607",
    ball: "#ff7a1a",
    black: "#050607",
    lime: "#aeff4e",
    white: "#f5f8ef",
  },
  fade: {
    labelAlpha: 0.92,
    ringAlpha: 0.94,
    trailCoreAlpha: 0.88,
    trailTailAlpha: 0.42,
  },
  glow: {
    ballBloomRadius: 26,
    ballCoreRadius: 6,
    ballShadowBlur: 42,
    pulseShadowBlur: 22,
    ringShadowBlur: 18,
  },
  label: {
    backgroundAlpha: 0.68,
    height: 28,
    minWidth: 34,
    paddingX: 10,
    textColor: "#f5f8ef",
    textSize: 18,
    verticalOffset: 38,
  },
  ring: {
    confidenceThreshold: 0.35,
    fillAlpha: 0.22,
    heightScale: 0.15,
    maxHeight: 30,
    maxWidth: 118,
    minHeight: 12,
    minWidth: 48,
    neutralColor: "#f5f8ef",
    strokeWidth: 4,
    widthScale: 0.82,
  },
  trail: {
    confidenceThreshold: 0.25,
    coreSize: 6,
    highlightColor: "#aeff4e",
    maxAgeSeconds: 0.6,
    maxHistory: 16,
    tailSize: 9,
  },
} satisfies AxisOverlayStyle;

export function axisRgba(hex: string, alpha = 1) {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

export function axisFfmpegColor(hex: string) {
  return `0x${hex.replace("#", "").toUpperCase()}`;
}
