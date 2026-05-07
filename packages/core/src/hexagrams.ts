import type { HexagramNumber, State64, Trigram, TrigramId } from "./types.js";
import { getTrigramByBinary, getTrigramById } from "./trigrams.js";
import { linesToBinaryString } from "./lines.js";

type CanonicalHexagramDefinition = {
  number: HexagramNumber;
  wilhelmName: string;
  wilhelmTitle: string;
  lowerTrigramId: TrigramId;
  upperTrigramId: TrigramId;
  family: string;
  kernel: string;
  keywords: readonly string[];
};

function codeOf(number: HexagramNumber): `H${string}` {
  return `H${String(number).padStart(2, "0")}`;
}

function combineKeywords(lower: Trigram, upper: Trigram, definition: CanonicalHexagramDefinition): readonly string[] {
  return Array.from(new Set([...definition.keywords, ...lower.keywords, ...upper.keywords]));
}

function createState(definition: CanonicalHexagramDefinition): State64 {
  const lower = getTrigramById(definition.lowerTrigramId);
  const upper = getTrigramById(definition.upperTrigramId);
  const lines = [...lower.lines, ...upper.lines] as unknown as State64["lines"];
  const binary = linesToBinaryString(lines);

  return {
    id: `S64-${binary}`,
    index: definition.number - 1,
    number: definition.number,
    code: codeOf(definition.number),
    binary,
    lines,
    lowerTrigramId: lower.id,
    upperTrigramId: upper.id,
    wilhelmName: definition.wilhelmName,
    wilhelmTitle: definition.wilhelmTitle,
    family: definition.family,
    kernel: definition.kernel,
    keywords: combineKeywords(lower, upper, definition)
  };
}

// Canonical King Wen / Wilhelm sequence. Interpretive kernels are deliberately
// compressed and modernized; they are not quotations and should not be used
// as divinatory judgements.
export const CANONICAL_HEXAGRAM_DEFINITIONS = [
  {
    number: 1,
    wilhelmName: "Ch'ien",
    wilhelmTitle: "The Creative",
    lowerTrigramId: "qian",
    upperTrigramId: "qian",
    family: "generation",
    kernel: "pure creative force; strong initiating continuity",
    keywords: ["creative", "force", "initiative", "continuity"]
  },
  {
    number: 2,
    wilhelmName: "K'un",
    wilhelmTitle: "The Receptive",
    lowerTrigramId: "kun",
    upperTrigramId: "kun",
    family: "capacity",
    kernel: "pure receptive field; support, bearing and formation",
    keywords: ["receptive", "support", "field", "capacity"]
  },
  {
    number: 3,
    wilhelmName: "Chun",
    wilhelmTitle: "Difficulty at the Beginning",
    lowerTrigramId: "zhen",
    upperTrigramId: "kan",
    family: "formation",
    kernel: "early emergence under uncertainty; ordering confusion",
    keywords: ["beginning", "difficulty", "confusion", "ordering"]
  },
  {
    number: 4,
    wilhelmName: "Meng",
    wilhelmTitle: "Youthful Folly",
    lowerTrigramId: "kan",
    upperTrigramId: "gen",
    family: "learning",
    kernel: "unformed understanding seeking disciplined instruction",
    keywords: ["learning", "inexperience", "discipline", "formation"]
  },
  {
    number: 5,
    wilhelmName: "Hsu",
    wilhelmTitle: "Waiting (Nourishment)",
    lowerTrigramId: "qian",
    upperTrigramId: "kan",
    family: "timing",
    kernel: "active capacity held before risk; waiting with preparation",
    keywords: ["waiting", "timing", "nourishment", "risk"]
  },
  {
    number: 6,
    wilhelmName: "Sung",
    wilhelmTitle: "Conflict",
    lowerTrigramId: "kan",
    upperTrigramId: "qian",
    family: "friction",
    kernel: "sincere impulse obstructed by opposing direction",
    keywords: ["conflict", "obstruction", "caution", "opposition"]
  },
  {
    number: 7,
    wilhelmName: "Shih",
    wilhelmTitle: "The Army",
    lowerTrigramId: "kan",
    upperTrigramId: "kun",
    family: "organization",
    kernel: "danger contained within a receptive collective field",
    keywords: ["organization", "collective", "discipline", "mobilization"]
  },
  {
    number: 8,
    wilhelmName: "Pi",
    wilhelmTitle: "Holding Together (Union)",
    lowerTrigramId: "kun",
    upperTrigramId: "kan",
    family: "cohesion",
    kernel: "receptive field gathers around a binding center",
    keywords: ["union", "cohesion", "alignment", "belonging"]
  },
  {
    number: 9,
    wilhelmName: "Hsiao Ch'u",
    wilhelmTitle: "The Taming Power of the Small",
    lowerTrigramId: "qian",
    upperTrigramId: "xun",
    family: "restraint",
    kernel: "small gradual influence restrains strong force",
    keywords: ["small-restraint", "refinement", "gradual", "containment"]
  },
  {
    number: 10,
    wilhelmName: "Lu",
    wilhelmTitle: "Treading (Conduct)",
    lowerTrigramId: "dui",
    upperTrigramId: "qian",
    family: "conduct",
    kernel: "open expression moves near strong force; careful conduct",
    keywords: ["conduct", "risk", "care", "proximity"]
  },
  {
    number: 11,
    wilhelmName: "T'ai",
    wilhelmTitle: "Peace",
    lowerTrigramId: "qian",
    upperTrigramId: "kun",
    family: "harmony",
    kernel: "creative force below receptive field; exchange and harmony",
    keywords: ["peace", "harmony", "exchange", "openness"]
  },
  {
    number: 12,
    wilhelmName: "P'i",
    wilhelmTitle: "Standstill (Stagnation)",
    lowerTrigramId: "kun",
    upperTrigramId: "qian",
    family: "stagnation",
    kernel: "receptive below creative above; separation and non-communication",
    keywords: ["standstill", "stagnation", "separation", "blockage"]
  },
  {
    number: 13,
    wilhelmName: "T'ung Jen",
    wilhelmTitle: "Fellowship with Men",
    lowerTrigramId: "li",
    upperTrigramId: "qian",
    family: "association",
    kernel: "clarity under heaven; association through shared visibility",
    keywords: ["fellowship", "commonality", "clarity", "association"]
  },
  {
    number: 14,
    wilhelmName: "Ta Yu",
    wilhelmTitle: "Possession in Great Measure",
    lowerTrigramId: "qian",
    upperTrigramId: "li",
    family: "abundance",
    kernel: "strong capacity held in visible clarity",
    keywords: ["possession", "abundance", "clarity", "capacity"]
  },
  {
    number: 15,
    wilhelmName: "Ch'ien",
    wilhelmTitle: "Modesty",
    lowerTrigramId: "gen",
    upperTrigramId: "kun",
    family: "modulation",
    kernel: "mountain within earth; strength lowered and moderated",
    keywords: ["modesty", "balance", "moderation", "proportion"]
  },
  {
    number: 16,
    wilhelmName: "Yu",
    wilhelmTitle: "Enthusiasm",
    lowerTrigramId: "kun",
    upperTrigramId: "zhen",
    family: "mobilization",
    kernel: "movement rising from a receptive collective field",
    keywords: ["enthusiasm", "mobilization", "response", "energy"]
  },
  {
    number: 17,
    wilhelmName: "Sui",
    wilhelmTitle: "Following",
    lowerTrigramId: "zhen",
    upperTrigramId: "dui",
    family: "adaptation",
    kernel: "activation joins expression; movement follows attraction",
    keywords: ["following", "adaptation", "response", "alignment"]
  },
  {
    number: 18,
    wilhelmName: "Ku",
    wilhelmTitle: "Work on What Has Been Spoiled (Decay)",
    lowerTrigramId: "xun",
    upperTrigramId: "gen",
    family: "repair",
    kernel: "penetration beneath stillness; repair of accumulated decay",
    keywords: ["decay", "repair", "correction", "root-cause"]
  },
  {
    number: 19,
    wilhelmName: "Lin",
    wilhelmTitle: "Approach",
    lowerTrigramId: "dui",
    upperTrigramId: "kun",
    family: "approach",
    kernel: "open influence approaches the receptive field",
    keywords: ["approach", "growth", "presence", "nearness"]
  },
  {
    number: 20,
    wilhelmName: "Kuan",
    wilhelmTitle: "Contemplation (View)",
    lowerTrigramId: "kun",
    upperTrigramId: "xun",
    family: "observation",
    kernel: "receptive field under penetrating view; observation and model formation",
    keywords: ["view", "observation", "contemplation", "orientation"]
  },
  {
    number: 21,
    wilhelmName: "Shih Ho",
    wilhelmTitle: "Biting Through",
    lowerTrigramId: "zhen",
    upperTrigramId: "li",
    family: "resolution",
    kernel: "movement and clarity break through obstruction",
    keywords: ["resolution", "decision", "obstruction", "enforcement"]
  },
  {
    number: 22,
    wilhelmName: "Pi",
    wilhelmTitle: "Grace",
    lowerTrigramId: "li",
    upperTrigramId: "gen",
    family: "form",
    kernel: "clarity held by stillness; form, appearance and patterning",
    keywords: ["grace", "form", "appearance", "pattern"]
  },
  {
    number: 23,
    wilhelmName: "Po",
    wilhelmTitle: "Splitting Apart",
    lowerTrigramId: "kun",
    upperTrigramId: "gen",
    family: "erosion",
    kernel: "stillness over receptivity; structure separates and erodes",
    keywords: ["splitting", "erosion", "collapse", "separation"]
  },
  {
    number: 24,
    wilhelmName: "Fu",
    wilhelmTitle: "Return (The Turning Point)",
    lowerTrigramId: "zhen",
    upperTrigramId: "kun",
    family: "return",
    kernel: "new movement returns within the receptive field",
    keywords: ["return", "renewal", "turning-point", "cycle"]
  },
  {
    number: 25,
    wilhelmName: "Wu Wang",
    wilhelmTitle: "Innocence (The Unexpected)",
    lowerTrigramId: "zhen",
    upperTrigramId: "qian",
    family: "spontaneity",
    kernel: "movement under heaven; unforced action and unexpected emergence",
    keywords: ["innocence", "unexpected", "spontaneity", "naturalness"]
  },
  {
    number: 26,
    wilhelmName: "Ta Ch'u",
    wilhelmTitle: "The Taming Power of the Great",
    lowerTrigramId: "qian",
    upperTrigramId: "gen",
    family: "containment",
    kernel: "great force held by a boundary; accumulation and restraint",
    keywords: ["great-restraint", "accumulation", "containment", "discipline"]
  },
  {
    number: 27,
    wilhelmName: "I",
    wilhelmTitle: "The Corners of the Mouth (Providing Nourishment)",
    lowerTrigramId: "zhen",
    upperTrigramId: "gen",
    family: "nourishment",
    kernel: "movement beneath stillness; intake, speech and nourishment",
    keywords: ["nourishment", "intake", "speech", "sustenance"]
  },
  {
    number: 28,
    wilhelmName: "Ta Kuo",
    wilhelmTitle: "Preponderance of the Great",
    lowerTrigramId: "xun",
    upperTrigramId: "dui",
    family: "overload",
    kernel: "great excess around a weak center; structural overloading",
    keywords: ["excess", "overload", "strain", "transition"]
  },
  {
    number: 29,
    wilhelmName: "K'an",
    wilhelmTitle: "The Abysmal (Water)",
    lowerTrigramId: "kan",
    upperTrigramId: "kan",
    family: "risk",
    kernel: "repeated depth and danger; persistence through uncertainty",
    keywords: ["danger", "depth", "repetition", "resilience"]
  },
  {
    number: 30,
    wilhelmName: "Li",
    wilhelmTitle: "The Clinging, Fire",
    lowerTrigramId: "li",
    upperTrigramId: "li",
    family: "clarity",
    kernel: "repeated clarity; mutual dependence and visible pattern",
    keywords: ["fire", "clarity", "attachment", "visibility"]
  },
  {
    number: 31,
    wilhelmName: "Hsien",
    wilhelmTitle: "Influence (Wooing)",
    lowerTrigramId: "gen",
    upperTrigramId: "dui",
    family: "influence",
    kernel: "stillness below open expression; attraction and influence",
    keywords: ["influence", "attraction", "affect", "response"]
  },
  {
    number: 32,
    wilhelmName: "Heng",
    wilhelmTitle: "Duration",
    lowerTrigramId: "xun",
    upperTrigramId: "zhen",
    family: "continuity",
    kernel: "gentle penetration with movement; stable continuity through change",
    keywords: ["duration", "continuity", "persistence", "rhythm"]
  },
  {
    number: 33,
    wilhelmName: "Tun",
    wilhelmTitle: "Retreat",
    lowerTrigramId: "gen",
    upperTrigramId: "qian",
    family: "withdrawal",
    kernel: "boundary beneath force; strategic withdrawal before pressure",
    keywords: ["retreat", "withdrawal", "preservation", "distance"]
  },
  {
    number: 34,
    wilhelmName: "Ta Chuang",
    wilhelmTitle: "The Power of the Great",
    lowerTrigramId: "qian",
    upperTrigramId: "zhen",
    family: "power",
    kernel: "creative force becomes arousing movement; great active power",
    keywords: ["power", "force", "activation", "strength"]
  },
  {
    number: 35,
    wilhelmName: "Chin",
    wilhelmTitle: "Progress",
    lowerTrigramId: "kun",
    upperTrigramId: "li",
    family: "progress",
    kernel: "clarity rises over receptive field; visible advancement",
    keywords: ["progress", "visibility", "advance", "recognition"]
  },
  {
    number: 36,
    wilhelmName: "Ming I",
    wilhelmTitle: "Darkening of the Light",
    lowerTrigramId: "li",
    upperTrigramId: "kun",
    family: "concealment",
    kernel: "clarity placed beneath earth; light hidden or protected",
    keywords: ["darkening", "concealment", "protection", "injury"]
  },
  {
    number: 37,
    wilhelmName: "Chia Jen",
    wilhelmTitle: "The Family (The Clan)",
    lowerTrigramId: "li",
    upperTrigramId: "xun",
    family: "ordering",
    kernel: "clarity within gentle influence; relational order and roles",
    keywords: ["family", "roles", "order", "continuity"]
  },
  {
    number: 38,
    wilhelmName: "Kuei",
    wilhelmTitle: "Opposition",
    lowerTrigramId: "dui",
    upperTrigramId: "li",
    family: "divergence",
    kernel: "open expression and clarity diverge; difference without full break",
    keywords: ["opposition", "divergence", "difference", "tension"]
  },
  {
    number: 39,
    wilhelmName: "Chien",
    wilhelmTitle: "Obstruction",
    lowerTrigramId: "gen",
    upperTrigramId: "kan",
    family: "obstruction",
    kernel: "stillness before danger; blocked movement and detour",
    keywords: ["obstruction", "barrier", "detour", "constraint"]
  },
  {
    number: 40,
    wilhelmName: "Hsieh",
    wilhelmTitle: "Deliverance",
    lowerTrigramId: "kan",
    upperTrigramId: "zhen",
    family: "release",
    kernel: "danger gives way to movement; release after pressure",
    keywords: ["deliverance", "release", "unblocking", "relief"]
  },
  {
    number: 41,
    wilhelmName: "Sun",
    wilhelmTitle: "Decrease",
    lowerTrigramId: "dui",
    upperTrigramId: "gen",
    family: "reduction",
    kernel: "open expression bounded by stillness; reduction and simplification",
    keywords: ["decrease", "reduction", "simplification", "restraint"]
  },
  {
    number: 42,
    wilhelmName: "I",
    wilhelmTitle: "Increase",
    lowerTrigramId: "zhen",
    upperTrigramId: "xun",
    family: "increase",
    kernel: "movement supported by gradual penetration; constructive increase",
    keywords: ["increase", "growth", "support", "amplification"]
  },
  {
    number: 43,
    wilhelmName: "Kuai",
    wilhelmTitle: "Break-through (Resoluteness)",
    lowerTrigramId: "qian",
    upperTrigramId: "dui",
    family: "breakthrough",
    kernel: "force rises to open expression; decisive breakthrough",
    keywords: ["breakthrough", "resolution", "decision", "expression"]
  },
  {
    number: 44,
    wilhelmName: "Kou",
    wilhelmTitle: "Coming to Meet",
    lowerTrigramId: "xun",
    upperTrigramId: "qian",
    family: "encounter",
    kernel: "gentle penetration meets strong force; unexpected encounter",
    keywords: ["encounter", "meeting", "influence", "risk"]
  },
  {
    number: 45,
    wilhelmName: "Ts'ui",
    wilhelmTitle: "Gathering Together (Massing)",
    lowerTrigramId: "kun",
    upperTrigramId: "dui",
    family: "gathering",
    kernel: "receptive field opens into collective gathering",
    keywords: ["gathering", "massing", "assembly", "cohesion"]
  },
  {
    number: 46,
    wilhelmName: "Sheng",
    wilhelmTitle: "Pushing Upward",
    lowerTrigramId: "xun",
    upperTrigramId: "kun",
    family: "ascent",
    kernel: "gentle penetration grows through receptive field",
    keywords: ["pushing-upward", "ascent", "growth", "effort"]
  },
  {
    number: 47,
    wilhelmName: "K'un",
    wilhelmTitle: "Oppression (Exhaustion)",
    lowerTrigramId: "kan",
    upperTrigramId: "dui",
    family: "exhaustion",
    kernel: "depth beneath open surface; constrained expression and depletion",
    keywords: ["oppression", "exhaustion", "constraint", "depletion"]
  },
  {
    number: 48,
    wilhelmName: "Ching",
    wilhelmTitle: "The Well",
    lowerTrigramId: "xun",
    upperTrigramId: "kan",
    family: "source",
    kernel: "penetration into depth; stable source and shared resource",
    keywords: ["well", "source", "resource", "access"]
  },
  {
    number: 49,
    wilhelmName: "Ko",
    wilhelmTitle: "Revolution (Molting)",
    lowerTrigramId: "li",
    upperTrigramId: "dui",
    family: "renewal",
    kernel: "clarity within open exchange; transformation of form",
    keywords: ["revolution", "molting", "renewal", "change"]
  },
  {
    number: 50,
    wilhelmName: "Ting",
    wilhelmTitle: "The Caldron",
    lowerTrigramId: "xun",
    upperTrigramId: "li",
    family: "transmutation",
    kernel: "gentle influence feeds clarity; vessel of transformation",
    keywords: ["caldron", "transformation", "culture", "vessel"]
  },
  {
    number: 51,
    wilhelmName: "Chen",
    wilhelmTitle: "The Arousing (Shock, Thunder)",
    lowerTrigramId: "zhen",
    upperTrigramId: "zhen",
    family: "shock",
    kernel: "repeated activation; shock, awakening and restart",
    keywords: ["shock", "thunder", "awakening", "restart"]
  },
  {
    number: 52,
    wilhelmName: "Ken",
    wilhelmTitle: "Keeping Still, Mountain",
    lowerTrigramId: "gen",
    upperTrigramId: "gen",
    family: "stillness",
    kernel: "repeated stillness; boundary, pause and stabilization",
    keywords: ["stillness", "mountain", "stability", "pause"]
  },
  {
    number: 53,
    wilhelmName: "Chien",
    wilhelmTitle: "Development (Gradual Progress)",
    lowerTrigramId: "gen",
    upperTrigramId: "xun",
    family: "development",
    kernel: "stillness supports gradual penetration; slow development",
    keywords: ["development", "gradual-progress", "maturation", "sequence"]
  },
  {
    number: 54,
    wilhelmName: "Kuei Mei",
    wilhelmTitle: "The Marrying Maiden",
    lowerTrigramId: "dui",
    upperTrigramId: "zhen",
    family: "subordination",
    kernel: "open expression follows arousing movement; dependent positioning",
    keywords: ["marrying-maiden", "subordination", "transition", "position"]
  },
  {
    number: 55,
    wilhelmName: "Feng",
    wilhelmTitle: "Abundance (Fullness)",
    lowerTrigramId: "li",
    upperTrigramId: "zhen",
    family: "fullness",
    kernel: "clarity and movement create fullness at peak intensity",
    keywords: ["abundance", "fullness", "peak", "intensity"]
  },
  {
    number: 56,
    wilhelmName: "Lu",
    wilhelmTitle: "The Wanderer",
    lowerTrigramId: "gen",
    upperTrigramId: "li",
    family: "transience",
    kernel: "clarity above stillness; temporary presence and careful movement",
    keywords: ["wanderer", "transience", "travel", "adaptation"]
  },
  {
    number: 57,
    wilhelmName: "Sun",
    wilhelmTitle: "The Gentle (The Penetrating, Wind)",
    lowerTrigramId: "xun",
    upperTrigramId: "xun",
    family: "penetration",
    kernel: "repeated gentle influence; gradual penetration and diffusion",
    keywords: ["gentle", "wind", "penetration", "diffusion"]
  },
  {
    number: 58,
    wilhelmName: "Tui",
    wilhelmTitle: "The Joyous, Lake",
    lowerTrigramId: "dui",
    upperTrigramId: "dui",
    family: "exchange",
    kernel: "repeated opening; expression, exchange and shared release",
    keywords: ["joyous", "lake", "exchange", "openness"]
  },
  {
    number: 59,
    wilhelmName: "Huan",
    wilhelmTitle: "Dispersion (Dissolution)",
    lowerTrigramId: "kan",
    upperTrigramId: "xun",
    family: "dispersion",
    kernel: "depth dispersed by wind; dissolution of rigid accumulation",
    keywords: ["dispersion", "dissolution", "release", "scattering"]
  },
  {
    number: 60,
    wilhelmName: "Chieh",
    wilhelmTitle: "Limitation",
    lowerTrigramId: "dui",
    upperTrigramId: "kan",
    family: "limitation",
    kernel: "open expression meets depth; measured boundary and limit",
    keywords: ["limitation", "measure", "boundary", "constraint"]
  },
  {
    number: 61,
    wilhelmName: "Chung Fu",
    wilhelmTitle: "Inner Truth",
    lowerTrigramId: "dui",
    upperTrigramId: "xun",
    family: "inner-truth",
    kernel: "open expression penetrated by sincerity; inner coherence",
    keywords: ["inner-truth", "sincerity", "coherence", "trust"]
  },
  {
    number: 62,
    wilhelmName: "Hsiao Kuo",
    wilhelmTitle: "Preponderance of the Small",
    lowerTrigramId: "gen",
    upperTrigramId: "zhen",
    family: "small-excess",
    kernel: "stillness with movement above; small excess and careful adjustment",
    keywords: ["small-excess", "care", "detail", "adjustment"]
  },
  {
    number: 63,
    wilhelmName: "Chi Chi",
    wilhelmTitle: "After Completion",
    lowerTrigramId: "li",
    upperTrigramId: "kan",
    family: "completion",
    kernel: "clarity under danger; completed order requiring vigilance",
    keywords: ["after-completion", "order", "vigilance", "stability"]
  },
  {
    number: 64,
    wilhelmName: "Wei Chi",
    wilhelmTitle: "Before Completion",
    lowerTrigramId: "kan",
    upperTrigramId: "li",
    family: "pre-completion",
    kernel: "danger under clarity; near completion, unresolved transition",
    keywords: ["before-completion", "transition", "unfinished", "potential"]
  },
] as const satisfies readonly CanonicalHexagramDefinition[];

export function generateState64Catalog(): readonly State64[] {
  return CANONICAL_HEXAGRAM_DEFINITIONS.map(createState);
}

export const STATE64_CATALOG = generateState64Catalog();

export function getState64ByNumber(number: HexagramNumber): State64 {
  const state = STATE64_CATALOG.find((item) => item.number === number);
  if (!state) {
    throw new Error(`Unknown hexagram number: ${number}`);
  }
  return state;
}

export function getState64ById(id: State64["id"]): State64 {
  const state = STATE64_CATALOG.find((item) => item.id === id);
  if (!state) {
    throw new Error(`Unknown State64 id: ${id}`);
  }
  return state;
}

export function getState64ByBinary(binary: string): State64 {
  if (!/^[01]{6}$/.test(binary)) {
    throw new Error(`Invalid State64 binary code: ${binary}`);
  }
  return getState64ById(`S64-${binary}`);
}

export function getStatesByTrigramPair(lowerBinary: string, upperBinary: string): State64 {
  const lower = getTrigramByBinary(lowerBinary);
  const upper = getTrigramByBinary(upperBinary);
  return getState64ByBinary(`${lower.binary}${upper.binary}`);
}
