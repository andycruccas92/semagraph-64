import type { LineValue, Trigram, TrigramId } from "./types.js";
import { linesToBinaryString } from "./lines.js";

function defineTrigram(input: {
  id: TrigramId;
  label: string;
  wilhelmName: string;
  wilhelmTitle: string;
  image: string;
  unicode: string;
  lines: readonly [LineValue, LineValue, LineValue];
  kernel: string;
  keywords: readonly string[];
}): Trigram {
  return {
    ...input,
    binary: linesToBinaryString(input.lines)
  };
}

// Canonical order follows the Wilhelm/Baynes hexagram reference table:
// Ch'ien, Chen, K'an, Ken, K'un, Sun, Li, Tui.
// Lines are stored bottom-up.
export const TRIGRAMS = [
  defineTrigram({
    id: "qian",
    label: "Heaven / creative force",
    wilhelmName: "Ch'ien",
    wilhelmTitle: "The Creative",
    image: "Heaven",
    unicode: "☰",
    lines: ["yang", "yang", "yang"],
    kernel: "Continuous generative force; directed activation without internal break.",
    keywords: ["creative", "continuity", "force", "direction", "agency"]
  }),
  defineTrigram({
    id: "zhen",
    label: "Thunder / arousing motion",
    wilhelmName: "Chen",
    wilhelmTitle: "The Arousing",
    image: "Thunder",
    unicode: "☳",
    lines: ["yang", "yin", "yin"],
    kernel: "Initial impulse emerging from below; activation, shock, beginning.",
    keywords: ["arousal", "start", "shock", "movement", "activation"]
  }),
  defineTrigram({
    id: "kan",
    label: "Water / abysmal depth",
    wilhelmName: "K'an",
    wilhelmTitle: "The Abysmal",
    image: "Water",
    unicode: "☵",
    lines: ["yin", "yang", "yin"],
    kernel: "Active core enclosed by openness; depth, risk, hidden continuity.",
    keywords: ["depth", "risk", "hidden", "flow", "danger"]
  }),
  defineTrigram({
    id: "gen",
    label: "Mountain / keeping still",
    wilhelmName: "Ken",
    wilhelmTitle: "Keeping Still",
    image: "Mountain",
    unicode: "☶",
    lines: ["yin", "yin", "yang"],
    kernel: "External firmness above inner openness; limit, pause, boundary.",
    keywords: ["stillness", "limit", "boundary", "pause", "containment"]
  }),
  defineTrigram({
    id: "kun",
    label: "Earth / receptive field",
    wilhelmName: "K'un",
    wilhelmTitle: "The Receptive",
    image: "Earth",
    unicode: "☷",
    lines: ["yin", "yin", "yin"],
    kernel: "Open field of support; receptivity, bearing, capacity, substrate.",
    keywords: ["receptive", "field", "support", "potential", "capacity"]
  }),
  defineTrigram({
    id: "xun",
    label: "Wind / gentle penetration",
    wilhelmName: "Sun",
    wilhelmTitle: "The Gentle",
    image: "Wind",
    unicode: "☴",
    lines: ["yin", "yang", "yang"],
    kernel: "Gradual influence entering from below; penetration, diffusion, adaptation.",
    keywords: ["gentle", "penetration", "gradual", "influence", "diffusion"]
  }),
  defineTrigram({
    id: "li",
    label: "Fire / clinging clarity",
    wilhelmName: "Li",
    wilhelmTitle: "The Clinging",
    image: "Fire",
    unicode: "☲",
    lines: ["yang", "yin", "yang"],
    kernel: "Visible pattern held around an open center; clarity, attention, dependence.",
    keywords: ["clarity", "visibility", "pattern", "attention", "attachment"]
  }),
  defineTrigram({
    id: "dui",
    label: "Lake / joyous exchange",
    wilhelmName: "Tui",
    wilhelmTitle: "The Joyous",
    image: "Lake",
    unicode: "☱",
    lines: ["yang", "yang", "yin"],
    kernel: "Open surface above stable force; exchange, expression, release.",
    keywords: ["joyous", "exchange", "opening", "surface", "communication"]
  })
] as const satisfies readonly Trigram[];

export function getTrigramById(id: TrigramId): Trigram {
  const trigram = TRIGRAMS.find((item) => item.id === id);
  if (!trigram) {
    throw new Error(`Unknown trigram id: ${id}`);
  }
  return trigram;
}

export function getTrigramByBinary(binary: string): Trigram {
  const trigram = TRIGRAMS.find((item) => item.binary === binary);
  if (!trigram) {
    throw new Error(`Unknown trigram binary: ${binary}`);
  }
  return trigram;
}
