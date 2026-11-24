import {
  CARD_BORDER,
  CARD_RADIUS,
  type GuideMetrics,
} from "@/features/full-guide/utils/guide-metrics";

const CUT_EDGE_WIDTH = CARD_RADIUS + CARD_BORDER;

const CARD_INSET = 20;

export type TextBox = {
  left: number;
  width: number;
};

/** Where a card keeps its text: the insets give way as it narrows, down to its closed ends. */
export function getTextBox(width: number, metrics: GuideMetrics): TextBox {
  const inner = width - CARD_BORDER * 2;
  const glyph = metrics.titleSize;
  const left = inner - CARD_INSET >= glyph ? CARD_INSET : CUT_EDGE_WIDTH;
  const right = Math.min(
    CARD_INSET,
    Math.max(inner - left - glyph * 2, CUT_EDGE_WIDTH),
  );

  return { left, width: Math.max(inner - left - right, 0) };
}
