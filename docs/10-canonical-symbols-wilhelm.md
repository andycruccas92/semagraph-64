# Canonical symbols: Wilhelm/Baynes synthesis

This document defines the canonical symbolic layer for SemaGraph-64. The reference source is the abridged Richard Wilhelm translation rendered into English by Cary F. Baynes. The project does not reproduce the interpretive text. It keeps the canonical sequence, trigram names, hexagram names, and table structure, then compresses them into modern computational kernels.

The system uses the I Ching as a formal matrix: line -> trigram -> hexagram -> transformation. It is not a divination engine.

## Line convention

- `yang` = unbroken line = `1` = continuous / active / present.
- `yin` = broken line = `0` = open / receptive / discontinuous.
- Lines are stored bottom-up. This is mandatory for all APIs, binary codes, and transformations.
- A six-line state is encoded as `S64-<six-bit-bottom-up-code>`. Example: Hexagram 1 is `S64-111111`; Hexagram 2 is `S64-000000`.

## Canonical trigram order

The canonical table order is: Chien, Chen, K-an, Ken, Kun, Sun, Li, Tui. IDs are normalized for code stability.

| ID | Wilhelm name | Wilhelm title | Image | Glyph | Binary bottom-up | SemaGraph kernel |
|---|---:|---|---|---:|---:|---|
| `qian` | Ch'ien | The Creative | Heaven | ☰ | `111` | Continuous generative force; directed activation without internal break. |
| `zhen` | Chen | The Arousing | Thunder | ☳ | `100` | Initial impulse emerging from below; activation, shock, beginning. |
| `kan` | K'an | The Abysmal | Water | ☵ | `010` | Active core enclosed by openness; depth, risk, hidden continuity. |
| `gen` | Ken | Keeping Still | Mountain | ☶ | `001` | External firmness above inner openness; limit, pause, boundary. |
| `kun` | K'un | The Receptive | Earth | ☷ | `000` | Open field of support; receptivity, bearing, capacity, substrate. |
| `xun` | Sun | The Gentle | Wind | ☴ | `011` | Gradual influence entering from below; penetration, diffusion, adaptation. |
| `li` | Li | The Clinging | Fire | ☲ | `101` | Visible pattern held around an open center; clarity, attention, dependence. |
| `dui` | Tui | The Joyous | Lake | ☱ | `110` | Open surface above stable force; exchange, expression, release. |

## Canonical hexagram catalog

Each hexagram keeps the Wilhelm/Baynes number, romanized name, English title, lower and upper trigram pair, and a short SemaGraph kernel. Kernels are paraphrases for computational use, not quotations.

| No. | Code | Wilhelm name | Wilhelm title | Lower | Upper | Family | SemaGraph kernel |
|---:|---|---|---|---|---|---|---|
| 1 | `S64-111111` | Ch'ien | The Creative | Ch'ien | Ch'ien | `generation` | pure creative force; strong initiating continuity |
| 2 | `S64-000000` | K'un | The Receptive | K'un | K'un | `capacity` | pure receptive field; support, bearing and formation |
| 3 | `S64-100010` | Chun | Difficulty at the Beginning | Chen | K'an | `formation` | early emergence under uncertainty; ordering confusion |
| 4 | `S64-010001` | Meng | Youthful Folly | K'an | Ken | `learning` | unformed understanding seeking disciplined instruction |
| 5 | `S64-111010` | Hsu | Waiting (Nourishment) | Ch'ien | K'an | `timing` | active capacity held before risk; waiting with preparation |
| 6 | `S64-010111` | Sung | Conflict | K'an | Ch'ien | `friction` | sincere impulse obstructed by opposing direction |
| 7 | `S64-010000` | Shih | The Army | K'an | K'un | `organization` | danger contained within a receptive collective field |
| 8 | `S64-000010` | Pi | Holding Together (Union) | K'un | K'an | `cohesion` | receptive field gathers around a binding center |
| 9 | `S64-111011` | Hsiao Ch'u | The Taming Power of the Small | Ch'ien | Sun | `restraint` | small gradual influence restrains strong force |
| 10 | `S64-110111` | Lu | Treading (Conduct) | Tui | Ch'ien | `conduct` | open expression moves near strong force; careful conduct |
| 11 | `S64-111000` | T'ai | Peace | Ch'ien | K'un | `harmony` | creative force below receptive field; exchange and harmony |
| 12 | `S64-000111` | P'i | Standstill (Stagnation) | K'un | Ch'ien | `stagnation` | receptive below creative above; separation and non-communication |
| 13 | `S64-101111` | T'ung Jen | Fellowship with Men | Li | Ch'ien | `association` | clarity under heaven; association through shared visibility |
| 14 | `S64-111101` | Ta Yu | Possession in Great Measure | Ch'ien | Li | `abundance` | strong capacity held in visible clarity |
| 15 | `S64-001000` | Ch'ien | Modesty | Ken | K'un | `modulation` | mountain within earth; strength lowered and moderated |
| 16 | `S64-000100` | Yu | Enthusiasm | K'un | Chen | `mobilization` | movement rising from a receptive collective field |
| 17 | `S64-100110` | Sui | Following | Chen | Tui | `adaptation` | activation joins expression; movement follows attraction |
| 18 | `S64-011001` | Ku | Work on What Has Been Spoiled (Decay) | Sun | Ken | `repair` | penetration beneath stillness; repair of accumulated decay |
| 19 | `S64-110000` | Lin | Approach | Tui | K'un | `approach` | open influence approaches the receptive field |
| 20 | `S64-000011` | Kuan | Contemplation (View) | K'un | Sun | `observation` | receptive field under penetrating view; observation and model formation |
| 21 | `S64-100101` | Shih Ho | Biting Through | Chen | Li | `resolution` | movement and clarity break through obstruction |
| 22 | `S64-101001` | Pi | Grace | Li | Ken | `form` | clarity held by stillness; form, appearance and patterning |
| 23 | `S64-000001` | Po | Splitting Apart | K'un | Ken | `erosion` | stillness over receptivity; structure separates and erodes |
| 24 | `S64-100000` | Fu | Return (The Turning Point) | Chen | K'un | `return` | new movement returns within the receptive field |
| 25 | `S64-100111` | Wu Wang | Innocence (The Unexpected) | Chen | Ch'ien | `spontaneity` | movement under heaven; unforced action and unexpected emergence |
| 26 | `S64-111001` | Ta Ch'u | The Taming Power of the Great | Ch'ien | Ken | `containment` | great force held by a boundary; accumulation and restraint |
| 27 | `S64-100001` | I | The Corners of the Mouth (Providing Nourishment) | Chen | Ken | `nourishment` | movement beneath stillness; intake, speech and nourishment |
| 28 | `S64-011110` | Ta Kuo | Preponderance of the Great | Sun | Tui | `overload` | great excess around a weak center; structural overloading |
| 29 | `S64-010010` | K'an | The Abysmal (Water) | K'an | K'an | `risk` | repeated depth and danger; persistence through uncertainty |
| 30 | `S64-101101` | Li | The Clinging, Fire | Li | Li | `clarity` | repeated clarity; mutual dependence and visible pattern |
| 31 | `S64-001110` | Hsien | Influence (Wooing) | Ken | Tui | `influence` | stillness below open expression; attraction and influence |
| 32 | `S64-011100` | Heng | Duration | Sun | Chen | `continuity` | gentle penetration with movement; stable continuity through change |
| 33 | `S64-001111` | Tun | Retreat | Ken | Ch'ien | `withdrawal` | boundary beneath force; strategic withdrawal before pressure |
| 34 | `S64-111100` | Ta Chuang | The Power of the Great | Ch'ien | Chen | `power` | creative force becomes arousing movement; great active power |
| 35 | `S64-000101` | Chin | Progress | K'un | Li | `progress` | clarity rises over receptive field; visible advancement |
| 36 | `S64-101000` | Ming I | Darkening of the Light | Li | K'un | `concealment` | clarity placed beneath earth; light hidden or protected |
| 37 | `S64-101011` | Chia Jen | The Family (The Clan) | Li | Sun | `ordering` | clarity within gentle influence; relational order and roles |
| 38 | `S64-110101` | Kuei | Opposition | Tui | Li | `divergence` | open expression and clarity diverge; difference without full break |
| 39 | `S64-001010` | Chien | Obstruction | Ken | K'an | `obstruction` | stillness before danger; blocked movement and detour |
| 40 | `S64-010100` | Hsieh | Deliverance | K'an | Chen | `release` | danger gives way to movement; release after pressure |
| 41 | `S64-110001` | Sun | Decrease | Tui | Ken | `reduction` | open expression bounded by stillness; reduction and simplification |
| 42 | `S64-100011` | I | Increase | Chen | Sun | `increase` | movement supported by gradual penetration; constructive increase |
| 43 | `S64-111110` | Kuai | Break-through (Resoluteness) | Ch'ien | Tui | `breakthrough` | force rises to open expression; decisive breakthrough |
| 44 | `S64-011111` | Kou | Coming to Meet | Sun | Ch'ien | `encounter` | gentle penetration meets strong force; unexpected encounter |
| 45 | `S64-000110` | Ts'ui | Gathering Together (Massing) | K'un | Tui | `gathering` | receptive field opens into collective gathering |
| 46 | `S64-011000` | Sheng | Pushing Upward | Sun | K'un | `ascent` | gentle penetration grows through receptive field |
| 47 | `S64-010110` | K'un | Oppression (Exhaustion) | K'an | Tui | `exhaustion` | depth beneath open surface; constrained expression and depletion |
| 48 | `S64-011010` | Ching | The Well | Sun | K'an | `source` | penetration into depth; stable source and shared resource |
| 49 | `S64-101110` | Ko | Revolution (Molting) | Li | Tui | `renewal` | clarity within open exchange; transformation of form |
| 50 | `S64-011101` | Ting | The Caldron | Sun | Li | `transmutation` | gentle influence feeds clarity; vessel of transformation |
| 51 | `S64-100100` | Chen | The Arousing (Shock, Thunder) | Chen | Chen | `shock` | repeated activation; shock, awakening and restart |
| 52 | `S64-001001` | Ken | Keeping Still, Mountain | Ken | Ken | `stillness` | repeated stillness; boundary, pause and stabilization |
| 53 | `S64-001011` | Chien | Development (Gradual Progress) | Ken | Sun | `development` | stillness supports gradual penetration; slow development |
| 54 | `S64-110100` | Kuei Mei | The Marrying Maiden | Tui | Chen | `subordination` | open expression follows arousing movement; dependent positioning |
| 55 | `S64-101100` | Feng | Abundance (Fullness) | Li | Chen | `fullness` | clarity and movement create fullness at peak intensity |
| 56 | `S64-001101` | Lu | The Wanderer | Ken | Li | `transience` | clarity above stillness; temporary presence and careful movement |
| 57 | `S64-011011` | Sun | The Gentle (The Penetrating, Wind) | Sun | Sun | `penetration` | repeated gentle influence; gradual penetration and diffusion |
| 58 | `S64-110110` | Tui | The Joyous, Lake | Tui | Tui | `exchange` | repeated opening; expression, exchange and shared release |
| 59 | `S64-010011` | Huan | Dispersion (Dissolution) | K'an | Sun | `dispersion` | depth dispersed by wind; dissolution of rigid accumulation |
| 60 | `S64-110010` | Chieh | Limitation | Tui | K'an | `limitation` | open expression meets depth; measured boundary and limit |
| 61 | `S64-110011` | Chung Fu | Inner Truth | Tui | Sun | `inner-truth` | open expression penetrated by sincerity; inner coherence |
| 62 | `S64-001100` | Hsiao Kuo | Preponderance of the Small | Ken | Chen | `small-excess` | stillness with movement above; small excess and careful adjustment |
| 63 | `S64-101010` | Chi Chi | After Completion | Li | K'an | `completion` | clarity under danger; completed order requiring vigilance |
| 64 | `S64-010101` | Wei Chi | Before Completion | K'an | Li | `pre-completion` | danger under clarity; near completion, unresolved transition |

## Canonicalization policy

1. Do not create alternative names in core code. Use aliases only in adapters or UI layers.
2. Do not paste long passages from source translations into the repository. The core package stores names, titles, compressed kernels, and retrieval tags only.
3. The canonical source layer is historical; the SemaGraph layer is computational. Keep them separate in data structures.
4. Any future dataset must preserve three fields: `wilhelmTitle`, `kernel`, and `family`. The first is reference identity; the second is compressed semantics; the third is routing memory.
5. A generated or LLM-assisted interpretation may suggest a state, but must not create new core symbols.
