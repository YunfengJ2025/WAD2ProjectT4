<script setup>
// Plant icons drawn in SVG at the same angle as the garden island.
// type: leafy / cactus / flower / herb / tree / snake / monstera / vine / succulent / wilted.
// overdue = show wilted instead.
import { computed } from 'vue'

const LABELS = {
  leafy: 'Leafy pot plant',
  cactus: 'Cactus',
  flower: 'Flowering plant',
  herb: 'Herb',
  tree: 'Small tree',
  snake: 'Snake plant',
  monstera: 'Monstera',
  vine: 'Hanging vine',
  succulent: 'Succulent',
  wilted: 'Wilted plant (overdue)',
}

// Monstera leaves: [x, y, rotation°, class]. Each leaf is drawn pointing right from its base.
const MONSTERA = [
  [14.6, 24.3, -149, 'leaf-d'],
  [49, 21.7, -35, 'leaf-l'],
  [31, 15, -95, 'leaf-l'],
]

// Pothos heart leaves: [x, y, rotation°, scale]
const VINE = [
  [19, 40, -30, 1],
  [17, 47, 20, 1],
  [16, 53, -10, 0.9],
  [13, 59, 15, 0.8],
  [45, 40, 30, 1],
  [47, 47, -20, 1],
  [48, 52, 10, 0.9],
  [51, 57, -15, 0.8],
  [28, 36, -20, 1.2],
  [36, 36, 20, 1.2],
  [30, 32, -10, 1.2],
  [34, 31, 10, 1.2],
  [32, 35, 0, 1.3],
]

// Succulent rosette rings, outer first: [radius, how many leaves, leaf half-width, angle offset°, class]
const ROSETTE_RINGS = [
  [16, 9, 4.6, 0, 'cactus-d'],
  [11, 7, 3.8, 25, 'cactus-l'],
  [6, 5, 2.8, 10, 'leaf-top'],
]

// One pointed fleshy leaf from the base (bx, by) to the tip (tx, ty), half-width w.
// It's two curves (Q) that bulge out to each side of the line from base to tip.
function leafPath(bx, by, tx, ty, w) {
  const dx = tx - bx
  const dy = ty - by
  const len = Math.hypot(dx, dy) // length of the line (Pythagoras)
  const nx = (-dy / len) * w // sideways direction, w long
  const ny = (dx / len) * w
  const mx = bx + dx * 0.45 // point a bit before the middle of the leaf
  const my = by + dy * 0.45
  const r = (v) => Math.round(v * 10) / 10 // 1 decimal place
  // SVG path text: M = move to, Q = curve to, Z = close the shape
  return (
    `M${r(bx)} ${r(by)}Q${r(mx + nx)} ${r(my + ny)} ${r(tx)} ${r(ty)}` +
    `Q${r(mx - nx)} ${r(my - ny)} ${r(bx)} ${r(by)}Z`
  )
}
const FLOWER_HEADS = [
  { x: 26, y: 19 },
  { x: 32, y: 13 },
  { x: 39, y: 20 },
]

const props = defineProps({
  // validator: Vue shows a console warning if type isn't one of these names.
  // The list is written here because defineProps can't use variables from this script.
  type: {
    type: String,
    default: 'leafy',
    validator: (v) =>
      [
        'leafy',
        'cactus',
        'flower',
        'herb',
        'tree',
        'snake',
        'monstera',
        'vine',
        'succulent',
        'wilted',
      ].includes(v),
  },
  size: { type: [Number, String], default: 48 },
  overdue: { type: Boolean, default: false },
})

// Each icon needs its own mask id, or two monsteras on the page would share one
// toString(36).slice(2) turns the random number into short letters + numbers, e.g. "k3j9x2"
const maskId = 'plant-icon-mask-' + Math.random().toString(36).slice(2)

const shown = computed(() => (props.overdue ? 'wilted' : props.type))
const label = computed(() => LABELS[shown.value])

// 5 petals around each flower head. cos/sin place them in a circle,
// squashed a little vertically so the flower sits at the island's angle.
const flowers = computed(() =>
  FLOWER_HEADS.map(({ x, y }) => ({
    x,
    y,
    petals: [0, 72, 144, 216, 288].map((deg) => {
      const a = ((deg - 90) * Math.PI) / 180 // degrees -> radians (what cos/sin need)
      return { x: x + Math.cos(a) * 2.6, y: y + Math.sin(a) * 1.9 }
    }),
  })),
)

// SVG transform text for each monstera / vine leaf.
// [x, y, a, cls] takes the values out of each row of the list above.
const monsteraLeaves = MONSTERA.map(([x, y, a, cls]) => ({
  t: `translate(${x} ${y}) rotate(${a})`,
  cls: cls,
}))
const vineLeaves = VINE.map(([x, y, a, scale], i) => ({
  t: `translate(${x} ${y}) rotate(${a}) scale(${scale})`,
  cls: i % 2 === 1 ? 'leaf-d' : 'leaf-l', // every other leaf darker
}))

// Succulent: leaves spread in rings around the centre, squashed to the island's angle.
// Each ring is sorted so the back leaves are drawn first (front ones cover them).
const rosette = []
for (const [R, count, w, offset, cls] of ROSETTE_RINGS) {
  const ring = []
  for (let i = 0; i < count; i++) {
    const a = ((offset + (360 / count) * i) * Math.PI) / 180
    const tx = 32 + Math.cos(a) * R
    const ty = 38 + Math.sin(a) * R * 0.55 - R * 0.35 // 0.55 = flatten, - R * 0.35 = tips curl up
    ring.push({ ty: ty, cls: cls, d: leafPath(32, 38, tx, ty, w) })
  }
  ring.sort((p, q) => p.ty - q.ty) // smaller ty = further back = drawn first
  for (const leaf of ring) rosette.push(leaf)
}
</script>

<template>
  <svg
    class="plant-icon"
    viewBox="0 0 64 64"
    :width="size"
    :height="size"
    role="img"
    :aria-label="label"
  >
    <!-- viewBox: everything is drawn on a 64 x 64 grid; width/height scale it to any size.
         role="img" + <title>: screen readers read out the plant name. -->
    <title>{{ label }}</title>

    <!-- <g> = a group of shapes. v-if shows only the group for this plant type.
         path d: M = move, L = line, H / V = straight line, Q / C = curve, A = arc, Z = close -->

    <!-- Terracotta pot, shared by every icon except the tree -->
    <g v-if="shown !== 'tree'">
      <path class="pot-l" d="M18 42L32 49V61L21 55Z" />
      <path class="pot-r" d="M32 49L46 42L43 55L32 61Z" />
      <path class="pot-top" d="M18 42L32 35L46 42L32 49Z" />
      <path class="soil" d="M21 42L32 36.5L43 42L32 47.5Z" />
    </g>

    <!-- Leafy pot plant -->
    <g v-if="shown === 'leafy'">
      <path class="leaf-d" d="M32 42Q31.5 25.6 20 14Q20.5 30.4 32 42Z" />
      <path class="leaf-d" d="M32 42Q43.5 30.4 44 14Q32.5 25.6 32 42Z" />
      <path class="leaf-l" d="M32 42Q24.2 29.9 10 28Q17.8 40.1 32 42Z" />
      <path class="leaf-l" d="M32 42Q46.2 40.1 54 28Q39.8 29.9 32 42Z" />
      <path class="leaf-l" d="M32 42Q38 25 32 8Q26 25 32 42Z" />
      <path class="leaf-l" d="M32 42Q26.1 36.2 18 38Q23.9 43.8 32 42Z" />
      <path class="leaf-l" d="M32 42Q40.1 43.8 46 38Q37.9 36.2 32 42Z" />
      <g class="vein-d">
        <path d="M32 42Q22 33.5 10 28" />
        <path d="M32 42Q44 36.5 54 28" />
        <path d="M32 42Q33.8 25 32 8" />
        <path d="M32 42Q25.3 38.8 18 38" />
        <path d="M32 42Q39.3 41.2 46 38" />
      </g>
    </g>

    <!-- Cactus -->
    <g v-if="shown === 'cactus'">
      <path class="arm-l" d="M27 34H21.5V25" />
      <path class="arm-r" d="M37 30H42.5V22" />
      <path class="cactus-l" d="M32 16A6 6 0 0 0 26 22V43H32Z" />
      <path class="cactus-d" d="M32 16A6 6 0 0 1 38 22V43H32Z" />
      <g class="rib">
        <path d="M29 19V42" />
        <path d="M35 19V42" />
      </g>
      <circle class="petal" cx="32" cy="15.5" r="2.6" />
      <circle class="center" cx="32" cy="15.5" r="1.1" />
    </g>

    <!-- Flowering plant -->
    <g v-if="shown === 'flower'">
      <g class="stem">
        <path d="M32 42Q28 32 26 20" />
        <path d="M32 42V14" />
        <path d="M32 42Q36 32 39 21" />
      </g>
      <path class="leaf-l" d="M31 40Q28.2 32 20 30Q22.8 38 31 40Z" />
      <path class="leaf-d" d="M33 40Q41.2 38 44 30Q35.8 32 33 40Z" />
      <path class="leaf-l" d="M32 41Q29.6 36 24 36Q26.4 41 32 41Z" />
      <path class="leaf-d" d="M32 41Q37.6 41 40 36Q34.4 36 32 41Z" />
      <g v-for="(f, i) in flowers" :key="i">
        <ellipse
          v-for="(p, j) in f.petals"
          :key="j"
          class="petal"
          :cx="p.x"
          :cy="p.y"
          rx="2.6"
          ry="2"
        />
        <circle class="center" :cx="f.x" :cy="f.y" r="1.8" />
      </g>
    </g>

    <!-- Herb (basil-style sprigs) -->
    <g v-if="shown === 'herb'">
      <g class="stem">
        <path d="M32 42Q27 36 26 22" />
        <path d="M32 42Q37 36 38 20" />
        <path d="M32 42V16" />
      </g>
      <path class="leaf-l" d="M26 30Q24.7 25.5 20 25Q21.3 29.5 26 30Z" />
      <path class="leaf-d" d="M26 30Q30.2 28.4 30 24Q25.8 25.6 26 30Z" />
      <path class="leaf-l" d="M26 22Q25.9 18 22 17Q22.1 21 26 22Z" />
      <path class="leaf-d" d="M26 22Q29.9 21 30 17Q26.1 18 26 22Z" />
      <path class="leaf-l" d="M38 28Q38.2 23.6 34 22Q33.8 26.4 38 28Z" />
      <path class="leaf-d" d="M38 28Q42.7 27.5 44 23Q39.3 23.5 38 28Z" />
      <path class="leaf-l" d="M38 20Q38.6 16.3 35 15Q34.4 18.7 38 20Z" />
      <path class="leaf-d" d="M38 20Q41.9 19 42 15Q38.1 16 38 20Z" />
      <path class="leaf-l" d="M32 24Q31.9 20 28 19Q28.1 23 32 24Z" />
      <path class="leaf-d" d="M32 24Q35.9 23 36 19Q32.1 20 32 24Z" />
      <path class="leaf-l" d="M32 16Q34.2 13 32 10Q29.8 13 32 16Z" />
    </g>

    <!-- Small tree on a grass block (blocky canopy to match the island) -->
    <g v-if="shown === 'tree'">
      <path class="dirt-l" d="M14 46L32 55V61L14 52Z" />
      <path class="dirt-r" d="M32 55L50 46V52L32 61Z" />
      <path class="grass" d="M14 46L32 37L50 46L32 55Z" />
      <path class="trunk-l" d="M30 33H32V47L30 46Z" />
      <path class="trunk-r" d="M32 33H34V46L32 47Z" />
      <path class="leaf-l" d="M20 20L32 26V38L20 32Z" />
      <path class="leaf-d" d="M32 26L44 20V32L32 38Z" />
      <path class="leaf-top" d="M20 20L32 14L44 20L32 26Z" />
    </g>

    <!-- Snake plant: tall upright sword leaves -->
    <g v-if="shown === 'snake'">
      <path class="leaf-d" d="M24 43Q22 28 22 13Q28 26 30 43Z" />
      <path class="leaf-d" d="M34 43Q38 26 42 11Q42 27 40 43Z" />
      <path class="leaf-l edge" d="M27 44Q26 24 29 7Q33 24 33 44Z" />
      <path class="leaf-l edge" d="M32 45Q34 30 37 17Q39 30 38 44Z" />
      <path class="leaf-l edge" d="M24 44Q21 36 19 27Q26 34 29 45Z" />
      <g class="band">
        <path d="M27.5 36Q30 35 32.8 36" />
        <path d="M27.4 28Q30 27 32.4 28" />
        <path d="M28 20Q30 19.2 31.6 20" />
        <path d="M33.2 38Q35.5 37 37.8 38" />
        <path d="M34 30Q36 29.2 37.8 30" />
      </g>
    </g>

    <!-- Monstera: big split leaves (the slits are cut out with a mask) -->
    <g v-if="shown === 'monstera'">
      <!-- mask: white = keep, black lines = cut out (makes the slits in the leaves) -->
      <defs>
        <mask :id="maskId" maskUnits="userSpaceOnUse" x="-20" y="-20" width="40" height="40">
          <rect x="-20" y="-20" width="40" height="40" fill="#fff" />
          <g stroke="#000" stroke-width="1.4" stroke-linecap="round">
            <path d="M-4 -9L-3 -3" />
            <path d="M2 -9L2.5 -3" />
            <path d="M7 -7.5L6.5 -2.5" />
            <path d="M-4 9L-3 3" />
            <path d="M2 9L2.5 3" />
            <path d="M7 7.5L6.5 2.5" />
          </g>
        </mask>
      </defs>
      <g class="stem">
        <path d="M32 42Q27 36 24 30" />
        <path d="M32 42Q36 34 40 28" />
        <path d="M32 42V26" />
      </g>
      <!-- transform: move (translate), turn (rotate) and resize (scale) each leaf -->
      <g v-for="(l, i) in monsteraLeaves" :key="i" :transform="l.t">
        <path
          :class="l.cls"
          :mask="`url(#${maskId})`"
          d="M-11 0Q-8 -9 2 -8Q11 -6 12 0Q11 6 2 8Q-8 9 -11 0Z"
        />
        <path class="vein-d" d="M-11 0H11" />
      </g>
    </g>

    <!-- Vine / hanging plant (pothos) -->
    <g v-if="shown === 'vine'">
      <g class="stem">
        <path d="M25 40Q17 39 17 46Q16 54 13 60" />
        <path d="M39 40Q47 40 47 47Q48 53 51 57" />
      </g>
      <path
        v-for="(h, i) in vineLeaves"
        :key="i"
        :class="h.cls"
        :transform="h.t"
        d="M0 3C-4 0 -4 -3.5 0 -2C4 -3.5 4 0 0 3Z"
      />
    </g>

    <!-- Succulent rosette (aloe, jade, echeveria) -->
    <g v-if="shown === 'succulent'">
      <path v-for="(p, i) in rosette" :key="i" :class="p.cls" :d="p.d" />
    </g>

    <!-- Wilted (overdue) -->
    <g v-if="shown === 'wilted'">
      <path class="dry-stem" d="M32 42Q31 34 32 28" />
      <path class="dry-l" d="M30 30Q20.2 34.2 16 44Q25.8 39.8 30 30Z" />
      <path class="dry-d" d="M34 30Q38.2 39.8 48 44Q43.8 34.2 34 30Z" />
      <path class="dry-l" d="M32 28Q25.7 35.9 26 46Q32.3 38.1 32 28Z" />
      <g class="vein-dry">
        <path d="M30 30Q22.2 36.2 16 44" />
        <path d="M34 30Q40.2 37.8 48 44" />
        <path d="M32 28Q28 36.7 26 46" />
      </g>
      <path class="dry-d" d="M36 44.5Q39 42.5 41 44Q38 46 36 44.5Z" />
    </g>
  </svg>
</template>

<style scoped>
.plant-icon {
  display: inline-block;
  vertical-align: middle;
  overflow: visible;
}

/* fill = inside colour, stroke = outline colour.
   var(--name, fallback): uses --name if it's set, otherwise the colour after the comma */
.leaf-l {
  fill: var(--plant-leaf, #7ccf5a);
}
.leaf-d {
  fill: var(--plant-leaf-dark, #4e9a3a);
}
.leaf-top {
  fill: var(--plant-leaf-top, #9be070);
}
.vein-d {
  fill: none;
  stroke: var(--plant-leaf-dark, #4e9a3a);
  stroke-width: 0.8;
  stroke-linecap: round;
  opacity: 0.7;
}
/* Yellow edge on snake plant leaves */
.edge {
  stroke: var(--plant-leaf-edge, #d8e46a);
  stroke-width: 0.9;
  stroke-linejoin: round;
}
/* Darker stripes across snake plant leaves */
.band {
  fill: none;
  stroke: var(--plant-leaf-dark, #4e9a3a);
  stroke-width: 0.9;
  stroke-linecap: round;
  opacity: 0.55;
}
.stem {
  fill: none;
  stroke: var(--plant-leaf-dark, #4e9a3a);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.pot-top {
  fill: var(--plant-pot, #e48d5c);
}
.pot-l {
  fill: var(--plant-pot-left, #c96f43);
}
.pot-r {
  fill: var(--plant-pot-right, #a9582f);
}
.soil {
  fill: var(--plant-soil, #6b4a2f);
}

.cactus-l {
  fill: var(--plant-cactus, #5fb06a);
}
.cactus-d {
  fill: var(--plant-cactus-dark, #3f8a4c);
}
.arm-l {
  fill: none;
  stroke: var(--plant-cactus, #5fb06a);
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.arm-r {
  fill: none;
  stroke: var(--plant-cactus-dark, #3f8a4c);
  stroke-width: 4.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.rib {
  fill: none;
  stroke: #2f6b3a;
  stroke-width: 0.7;
  opacity: 0.45;
}

.petal {
  fill: var(--plant-petal, #f28ab2);
}
.center {
  fill: var(--plant-flower-center, #ffd35c);
}

.trunk-l {
  fill: var(--plant-trunk, #9a6b43);
}
.trunk-r {
  fill: var(--plant-trunk-dark, #7a5233);
}
.grass {
  fill: var(--plant-grass, #7ccf5a);
}
.dirt-l {
  fill: var(--plant-dirt, #8a5a35);
}
.dirt-r {
  fill: var(--plant-dirt-dark, #6f4729);
}

.dry-l {
  fill: var(--plant-dry, #c9a15a);
}
.dry-d {
  fill: var(--plant-dry-dark, #9c7a3e);
}
.dry-stem {
  fill: none;
  stroke: var(--plant-dry-dark, #9c7a3e);
  stroke-width: 1.4;
  stroke-linecap: round;
}
.vein-dry {
  fill: none;
  stroke: var(--plant-dry-dark, #9c7a3e);
  stroke-width: 0.8;
  stroke-linecap: round;
  opacity: 0.8;
}
</style>
