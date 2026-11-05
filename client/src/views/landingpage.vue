<script setup>
defineOptions({ name: 'LandingPage' })
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import logo from '@/assets/Leaf It to Us Logo.png'
import paintedTree from '@/assets/landing-painted-tree.png'

const skySection = ref(null)
function scrollToSky() {
  skySection.value?.scrollIntoView({
    behavior: reducedMotion.value ? 'auto' : 'smooth',
    block: 'start',
  })
  document.getElementById('welcome-title')?.focus({ preventScroll: true })
}

// second "Scroll down": sky section -> how it works
const featuresSection = ref(null)
function scrollToFeatures() {
  featuresSection.value?.scrollIntoView({
    behavior: reducedMotion.value ? 'auto' : 'smooth',
    block: 'start',
  })
  document.getElementById('features-title')?.focus({ preventScroll: true })
}

const canvas = ref(null)
const treeButton = ref(null)
const orbitRadius = ref(320)
const activeFeature = ref(0)
const features = [
  {
    title: 'Check your plant water schedule',
    label: 'Your plants',
    summary: 'Know when to water and keep every plant on track.',
    text: 'Keep your plants, watering schedules and care checklists together. Give every leaf the attention it needs.',
    points: [
      'A home for every plant profile',
      'Watering reminders at a glance',
      'Care instructions you can check off',
    ],
    link: '/schedule',
    action: 'View watering schedule',
  },
  {
    title: 'Find helpers to sit your plants',
    label: 'Nearby help',
    summary: 'Arrange a little care from a neighbour while you’re away.',
    text: 'Heading away? Request a helping hand. Have a little time? Find plant-care visits near you and choose a day that works.',
    points: [
      'Explore requests on the map',
      'Pick individual visits',
      'Share clear care instructions',
    ],
    link: '/find-nearby',
    action: 'Explore nearby requests',
  },
  {
    title: 'Meet other plant lovers',
    label: 'Our community',
    summary: 'Share your garden and connect with fellow plant lovers.',
    text: 'Share your plant updates, exchange ideas and find inspiration from other plant lovers in the community.',
    points: [
      'Share your growing journey',
      'Discover other plant lovers',
      'Celebrate the little wins',
    ],
    link: '/community',
    action: 'Explore the community',
  },
]

const reducedMotion = ref(false)
const compact = ref(false)
const orbitRotation = ref(0)
const orbitStep = ref(0)
let orbitFrame
let orbitTarget = 0
function spinFeatures() {
  orbitStep.value++
  orbitTarget += (Math.PI * 2) / features.length
  cancelAnimationFrame(orbitFrame)
  if (reducedMotion.value) {
    orbitRotation.value = orbitTarget
    return
  }
  const from = orbitRotation.value
  const started = performance.now()
  function tick(now) {
    const progress = Math.min((now - started) / 1100, 1)
    const eased = 1 - (1 - progress) ** 3
    orbitRotation.value = from + (orbitTarget - from) * eased
    if (progress < 1) orbitFrame = requestAnimationFrame(tick)
  }
  orbitFrame = requestAnimationFrame(tick)
}

// The cards follow an ellipse: cards behind the tree are smaller and sit behind its trunk.
function orbitStyle(index) {
  if (reducedMotion.value) return {}
  const angle = (index * Math.PI * 2) / features.length + orbitRotation.value + Math.PI / 2
  const depth = Math.sin(angle)
  return {
    transform: `translate(-50%, -50%) translate(${Math.cos(angle) * orbitRadius.value}px, ${depth * 65}px) scale(${0.86 + depth * 0.14})`,
    zIndex: depth > 0 ? 4 : 1,
    opacity: 0.8 + (depth + 1) * 0.1,
  }
}
const showcasePaused = ref(false)
const showcaseHovered = ref(false)
let showcaseTimer
function changeFeature(direction) {
  activeFeature.value = (activeFeature.value + direction + features.length) % features.length
}
// Leaves fall into a bounded pile at the tree's roots. Ground leaves react to hover.
let ctx, observer, frame, mediaQuery, visibilityObserver
let width = 0,
  height = 0,
  previousTime = 0
let leaves = []
let fallingLeaves = []
let sceneVisible = false
const leafColors = ['#4b9148', '#86aa4c', '#b9a45b', '#5d9d55']
function newLeaf(x, y, falling = false) {
  return {
    x,
    y,
    homeX: x,
    homeY: y,
    vx: 0,
    vy: 0,
    size: 7 + Math.random() * 6,
    angle: Math.random() * Math.PI * 2,
    opacity: 0.7 + Math.random() * 0.2,
    color: leafColors[Math.floor(Math.random() * leafColors.length)],
    falling,
    speed: 0.45 + Math.random() * 0.45,
    phase: Math.random() * 6,
  }
}
function resetFallingLeaf(leaf) {
  const scene = canvas.value.getBoundingClientRect()
  const tree = treeButton.value.getBoundingClientRect()
  const canopyWidth = Math.min(tree.width, tree.height * 0.94)
  Object.assign(
    leaf,
    newLeaf(
      tree.left - scene.left + tree.width / 2 + (Math.random() - 0.5) * canopyWidth * 0.7,
      tree.top - scene.top + tree.height * (0.26 + Math.random() * 0.3),
      true,
    ),
  )
}
function startLeaves() {
  if (ctx && width && sceneVisible && !reducedMotion.value && frame == null)
    frame = requestAnimationFrame(animate)
}
function drawLeaf(leaf) {
  ctx.save()
  ctx.translate(leaf.x, leaf.y)
  ctx.rotate(leaf.angle + (leaf.falling ? 0 : (leaf.x - leaf.homeX) * 0.008))
  if (!leaf.falling) ctx.scale(1, 0.55)
  ctx.globalAlpha = leaf.opacity
  ctx.fillStyle = leaf.color
  ctx.beginPath()
  ctx.moveTo(-leaf.size, 0)
  ctx.bezierCurveTo(-leaf.size * 0.2, -leaf.size, leaf.size * 0.9, -leaf.size * 0.6, leaf.size, 0)
  ctx.bezierCurveTo(leaf.size * 0.2, leaf.size, -leaf.size * 0.9, leaf.size * 0.6, -leaf.size, 0)
  ctx.fill()
  ctx.strokeStyle = '#eff8f2'
  ctx.lineWidth = 0.9
  ctx.beginPath()
  ctx.moveTo(-leaf.size, 0)
  ctx.quadraticCurveTo(0, -leaf.size * 0.12, leaf.size, 0)
  ctx.stroke()
  ctx.restore()
}
function paint() {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)
  leaves.forEach(drawLeaf)
  if (!reducedMotion.value) fallingLeaves.forEach(drawLeaf)
}
function animate(time) {
  frame = null
  const delta = previousTime ? Math.min((time - previousTime) / 16.67, 2) : 1
  previousTime = time
  for (const leaf of leaves) {
    leaf.vx += (leaf.homeX - leaf.x) * 0.015 * delta
    leaf.vy += (leaf.homeY - leaf.y) * 0.015 * delta
    leaf.vx *= Math.pow(0.88, delta)
    leaf.vy *= Math.pow(0.88, delta)
    leaf.x += leaf.vx * delta
    leaf.y += leaf.vy * delta
    leaf.x = Math.max(12, Math.min(width - 12, leaf.x))
    leaf.y = Math.max(height - 70, Math.min(height - 10, leaf.y))
  }
  for (const leaf of fallingLeaves) {
    leaf.y += leaf.speed * delta
    leaf.x += Math.sin(time / 900 + leaf.phase) * 0.5 * delta
    leaf.angle += 0.012 * delta
    if (leaf.y >= height - 32 + Math.sin(leaf.phase) * 14) {
      leaves.push(newLeaf(leaf.x, leaf.y))
      if (leaves.length > 75) leaves.shift()
      resetFallingLeaf(leaf)
    }
  }
  paint()
  startLeaves()
}
function movePointer(event) {
  if (reducedMotion.value) return
  const bounds = canvas.value.getBoundingClientRect()
  const pointerX = event.clientX - bounds.left
  const pointerY = event.clientY - bounds.top
  for (const leaf of leaves) {
    const dx = leaf.x - pointerX,
      dy = leaf.y - pointerY
    const distance = Math.hypot(dx, dy)
    if (distance < 90) {
      const force = (1 - distance / 90) * 2.5
      leaf.vx += distance ? (dx / distance) * force : force
      leaf.vy += distance ? (dy / distance) * force : -force
    }
  }
  startLeaves()
}
function syncMotion() {
  reducedMotion.value = mediaQuery.matches
  compact.value = window.innerWidth < 700
  orbitRadius.value = Math.min(320, (window.innerWidth - (compact.value ? 205 : 230)) / 2)
  cancelAnimationFrame(frame)
  frame = null
  previousTime = 0
  for (const leaf of leaves) {
    leaf.x = leaf.homeX
    leaf.y = leaf.homeY
    leaf.vx = 0
    leaf.vy = 0
  }
  paint()
  cancelAnimationFrame(orbitFrame)
  orbitRotation.value = orbitTarget
  startLeaves()
}
onMounted(() => {
  showcaseTimer = setInterval(() => {
    if (!reducedMotion.value && !showcasePaused.value && !showcaseHovered.value) changeFeature(1)
  }, 6000)
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  mediaQuery.addEventListener('change', syncMotion)
  window.addEventListener('resize', syncMotion)
  syncMotion()
  ctx = canvas.value.getContext('2d')
  if (!ctx) return
  observer = new ResizeObserver(() => {
    const bounds = canvas.value.getBoundingClientRect()
    width = bounds.width
    height = bounds.height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.value.width = width * dpr
    canvas.value.height = height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    leaves = Array.from({ length: width < 600 ? 30 : 55 }, () =>
      newLeaf(width * 0.12 + Math.random() * width * 0.76, height - 15 - Math.random() * 48),
    )
    fallingLeaves = Array.from({ length: 7 }, () => {
      const leaf = newLeaf(0, 0, true)
      resetFallingLeaf(leaf)
      leaf.y += Math.random() * Math.min(220, height * 0.35)
      return leaf
    })
    startLeaves()
    paint()
  })
  observer.observe(canvas.value)
  if (typeof IntersectionObserver !== 'undefined') {
    visibilityObserver = new IntersectionObserver(([entry]) => {
      sceneVisible = entry.isIntersecting
      cancelAnimationFrame(frame)
      frame = null
      previousTime = 0
      if (sceneVisible) startLeaves()
    })
    visibilityObserver.observe(canvas.value)
  } else {
    sceneVisible = true
    startLeaves()
  }
})
onUnmounted(() => {
  clearInterval(showcaseTimer)
  cancelAnimationFrame(frame)
  cancelAnimationFrame(orbitFrame)
  observer?.disconnect()
  visibilityObserver?.disconnect()
  mediaQuery?.removeEventListener('change', syncMotion)
  window.removeEventListener('resize', syncMotion)
})
</script>

<template>
  <div class="landing">
    <section id="galaxy-intro" class="galaxy-intro" aria-labelledby="brand-title">
      <h1 id="brand-title" class="galaxy-brand" aria-label="Leaf It to Us">
        <img :src="logo" alt="" width="1536" height="1024" fetchpriority="high" />
      </h1>
      <a class="scroll-cue" href="#sky-intro" @click.prevent="scrollToSky">
        <span>Scroll down</span>
        <svg viewBox="0 0 24 40" width="24" height="40" fill="none" aria-hidden="true">
          <path
            d="M12 2v32m-7-7 7 7 7-7"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </a>
    </section>
    <div class="atmosphere">
      <main>
        <section id="sky-intro" ref="skySection" class="hero" aria-labelledby="welcome-title">
          <div class="hero-copy">
            <p class="eyebrow">PLANT CARE, SHARED.</p>
            <h2 id="welcome-title" class="hero-title" tabindex="-1">
              Happy plants.<br />Helping hands.<br /><em>Right next door.</em>
            </h2>
            <p class="hero-description">
              Keep your plants healthy, find a neighbour to care for them while you’re away, and
              share what you grow. Plant care starts here.
            </p>
            <p class="signup-prompt">Create your own digital garden now</p>
            <div class="hero-actions">
              <RouterLink to="/register" class="landing-button">Sign up</RouterLink>
              <RouterLink to="/signin" class="login-button"
                >Log in <span aria-hidden="true">→</span></RouterLink
              >
            </div>
          </div>

          <section
            class="feature-showcase"
            aria-label="App features"
            @mouseenter="showcaseHovered = true"
            @mouseleave="showcaseHovered = false"
            @focusin="showcaseHovered = true"
            @focusout="showcaseHovered = false"
          >
            <div class="showcase-heading">
              <span class="eyebrow">DESIGNED FOR EVERYDAY CARE</span
              ><span class="showcase-count">0{{ activeFeature + 1 }} / 03</span>
            </div>
            <div class="showcase-symbol" aria-hidden="true">
              <svg v-if="activeFeature === 0" viewBox="0 0 64 64" fill="none">
                <path
                  d="M32 49V25M32 36C14 38 10 23 12 15c16-2 23 8 20 21ZM33 29C32 16 42 9 54 10c1 13-7 22-21 19Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linejoin="round"
                />
                <path d="M19 48h26l-4 12H23z" fill="currentColor" opacity=".2" />
              </svg>
              <svg v-else-if="activeFeature === 1" viewBox="0 0 64 64" fill="none">
                <path
                  d="M51 25c0 15-19 33-19 33S13 40 13 25a19 19 0 1 1 38 0Z"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <circle cx="32" cy="25" r="7" stroke="currentColor" stroke-width="2" />
              </svg>
              <svg v-else viewBox="0 0 64 64" fill="none">
                <circle cx="24" cy="22" r="9" stroke="currentColor" stroke-width="2" />
                <path
                  d="M7 55v-7a17 17 0 0 1 34 0v7M43 14a9 9 0 0 1 0 17m5 7a17 17 0 0 1 9 15"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <div class="showcase-copy" :key="activeFeature">
              <h2>{{ features[activeFeature].title }}</h2>
              <p>{{ features[activeFeature].text }}</p>
              <ul>
                <li v-for="point in features[activeFeature].points" :key="point">
                  <span aria-hidden="true">✓</span>{{ point }}
                </li>
              </ul>
            </div>
            <div class="showcase-controls">
              <div class="showcase-progress" aria-hidden="true">
                <span
                  v-for="(_, index) in features"
                  :key="index"
                  :class="{ current: index === activeFeature }"
                ></span>
              </div>
              <div>
                <button type="button" aria-label="Previous feature" @click="changeFeature(-1)">
                  ←</button
                ><button
                  type="button"
                  :aria-pressed="showcasePaused"
                  :aria-label="
                    showcasePaused ? 'Resume feature rotation' : 'Pause feature rotation'
                  "
                  @click="showcasePaused = !showcasePaused"
                >
                  {{ showcasePaused ? '▷' : 'Ⅱ' }}</button
                ><button type="button" aria-label="Next feature" @click="changeFeature(1)">
                  →
                </button>
              </div>
            </div>
          </section>

          <!-- same scroll cue as the galaxy intro, in the theme green -->
          <a class="scroll-cue sky-cue" href="#how-it-works" @click.prevent="scrollToFeatures">
            <span>Scroll down</span>
            <svg viewBox="0 0 24 40" width="24" height="40" fill="none" aria-hidden="true">
              <path
                d="M12 2v32m-7-7 7 7 7-7"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </a>
        </section>

        <section
          id="how-it-works"
          ref="featuresSection"
          class="tree-section"
          aria-labelledby="features-title"
        >
          <div class="tree-sticky">
            <div class="section-intro">
              <p class="eyebrow">ROOTED IN COMMUNITY</p>
              <h2 id="features-title" tabindex="-1">
                Everything you need.<br /><span>One growing community.</span>
              </h2>
              <p class="tree-hint">Click the tree to explore the next feature.</p>
            </div>
            <div class="tree-stage" @pointermove="movePointer">
              <canvas ref="canvas" class="ground-leaves" aria-hidden="true" />
              <button
                type="button"
                class="community-tree"
                ref="treeButton"
                aria-label="Rotate features around the tree"
                @click="spinFeatures"
              >
                <img
                  :src="paintedTree"
                  alt="A sunlit illustrated tree with spreading branches and roots in the meadow"
                  width="1216"
                  height="1296"
                  draggable="false"
                />
              </button>
              <article
                v-for="(feature, index) in features"
                :key="feature.label"
                class="orbit-card"
                :class="{
                  highlighted:
                    orbitStep > 0 &&
                    index === (features.length - (orbitStep % features.length)) % features.length,
                }"
                :style="orbitStyle(index)"
              >
                <span class="feature-number">FEATURE 0{{ index + 1 }}</span>
                <h3>{{ feature.title }}</h3>
                <p>{{ feature.summary }}</p>
                <RouterLink class="text-link" :to="feature.link"
                  >{{ feature.action }} <span aria-hidden="true">↗</span></RouterLink
                >
              </article>
            </div>
          </div>
        </section>
      </main>
      <footer class="landing-footer">
        <span>Leaf It to Us</span>
        <p>A little neighbourly care. A greener place to call home.</p>
        <a href="#galaxy-intro">Back to top ↑</a>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.landing {
  position: relative;
  isolation: isolate;
  width: 100vw;
  margin-left: calc(50% - 50vw);
  /* cancel #app's 1.5rem bottom padding (main.css), so no pale strip under the footer */
  margin-bottom: -1.5rem;
  --descent-height: clamp(240px, 38svh, 420px);
  color: var(--ink);
  overflow: clip;
  font-family: var(--font-body);
  background: #9fd6f2;
}
/* (Carolyn) from 1024px, #app's bottom padding is 2rem instead (main.css) */
@media (min-width: 1024px) {
  .landing {
    margin-bottom: -2rem;
  }
}
.galaxy-intro {
  position: relative;
  z-index: 1;
  height: 100svh;
  display: grid;
  place-items: center;
  background: #06112b;
}
/* The galaxy artwork extends into the sky and fades through a long shared region. */
.galaxy-intro::before {
  content: '';
  position: absolute;
  inset: 0 0 calc(-1 * var(--descent-height));
  background:
    radial-gradient(ellipse at 50% 35%, rgba(2, 8, 25, 0.38), transparent 58%),
    url('@/assets/landing-galaxy.png') center / cover no-repeat;
  -webkit-mask-image: linear-gradient(
    to bottom,
    #000 calc(100% - var(--descent-height)),
    transparent 100%
  );
  mask-image: linear-gradient(to bottom, #000 calc(100% - var(--descent-height)), transparent 100%);
  pointer-events: none;
}
.galaxy-brand {
  position: relative;
  isolation: isolate;
  margin: -6svh 0 0;
  width: clamp(320px, 48vw, 700px);
  max-width: min(90vw, 90svh);
}
.galaxy-brand::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: -22% -18%;
  background: radial-gradient(
    ellipse,
    rgba(147, 211, 255, 0.2),
    rgba(92, 163, 233, 0.09) 38%,
    transparent 70%
  );
  pointer-events: none;
}
.galaxy-brand img {
  display: block;
  width: 100%;
  height: auto;
  filter: brightness(0) invert(1)
    drop-shadow(0 8px 20px rgba(1, 8, 22, 0.5))
    drop-shadow(0 0 36px rgba(164, 217, 255, 0.35));
}
.scroll-cue {
  position: absolute;
  bottom: max(36px, 7svh);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  color: #eef5ff;
  font-size: 0.72rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 12px;
}
.scroll-cue:hover {
  color: #fff;
  background: transparent;
}
.scroll-cue:focus-visible {
  outline-color: #fff !important;
}
.atmosphere {
  position: relative;
  padding-top: var(--descent-height);
  background-color: #9fd6f2;
  background-image:
    linear-gradient(
      to bottom,
      rgba(242, 250, 255, 0.55),
      rgba(242, 250, 255, 0.4) 42%,
      transparent 70%
    ),
    url('@/assets/landing-sky-meadow.png');
  background-position: center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
}
.ground-leaves {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  pointer-events: none;
}

.hero,
.landing-footer {
  width: min(1120px, calc(100% - 80px));
  margin-inline: auto;
}
.hero {
  position: relative; /* so the scroll cue sits at its bottom */
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 100px;
  min-height: 94svh;
  padding-block: 60px;
}
/* sky scroll cue: green text on the light sky, below the content */
.scroll-cue.sky-cue {
  bottom: 8px;
  color: var(--primary);
  font-weight: 600;
}
.scroll-cue.sky-cue:hover {
  color: var(--primary-deep, var(--primary));
}
.eyebrow {
  display: block;
  color: var(--primary);
  font-size: 0.63rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  margin-bottom: 20px;
}
.hero-title {
  font: 600 clamp(2.8rem, 5.1vw, 4.2rem)/1.1 var(--font-heading);
  letter-spacing: -0.045em;
  color: var(--ink);
  margin-bottom: 24px;
}
.hero-title em {
  font: inherit;
  color: var(--primary);
}
.hero-description {
  font-size: 0.93rem;
  line-height: 1.85;
  color: var(--muted);
  max-width: 440px;
  margin-bottom: 30px;
}
.signup-prompt {
  margin: 0 0 14px;
  color: var(--ink);
  font-size: 0.9rem;
  font-weight: 500;
}
.hero-actions {
  display: flex;
  gap: 28px;
  align-items: center;
}
.landing a {
  text-decoration: none;
}
.landing-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 130px;
  padding: 12px 25px;
  border-radius: 8px;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 0.9rem;
  font-weight: 600;
}
.landing-button:hover {
  background: var(--primary-deep);
}
.login-button {
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 600;
}
.login-button span {
  margin-left: 10px;
}
.login-button:hover {
  background: transparent;
  color: var(--primary-deep);
}
.feature-showcase {
  padding: 40px 0 40px 50px;
  border-left: 1px solid rgba(255, 255, 255, 0.65);
}
.showcase-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 50px;
}
.showcase-heading .eyebrow {
  margin: 0;
  font-size: 0.57rem;
}
.showcase-count {
  font-size: 0.62rem;
  color: var(--muted);
  white-space: nowrap;
}
.showcase-symbol {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin-bottom: 30px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--tint);
  color: var(--primary);
}
.showcase-symbol svg {
  width: 43px;
  height: 43px;
}
.showcase-copy {
  min-height: 255px;
}
.showcase-copy h2 {
  font: 600 2rem/1.2 var(--font-heading);
  letter-spacing: -0.025em;
  color: var(--ink);
  margin-bottom: 18px;
}
.showcase-copy p {
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.8;
  margin-bottom: 25px;
}
.showcase-copy ul {
  list-style: none;
  padding: 18px 20px;
  margin: 0;
  background: rgba(255, 255, 255, 0.55);
  border-left: 2px solid var(--primary);
  border-radius: 0 8px 8px 0;
}
.showcase-copy li {
  display: flex;
  gap: 12px;
  font-size: 0.75rem;
  margin-block: 9px;
  color: var(--muted);
}
.showcase-copy li span {
  color: var(--primary);
}
.showcase-controls {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  margin-top: 28px;
}
.showcase-progress {
  display: flex;
  gap: 5px;
  flex: 1;
  max-width: 180px;
}
.showcase-progress span {
  height: 3px;
  flex: 1;
  border-radius: 4px;
  background: var(--line);
}
.showcase-progress .current {
  background: var(--primary);
}
.showcase-controls > div:last-child {
  display: flex;
  gap: 7px;
}
.showcase-controls button {
  width: 30px;
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: transparent;
  color: var(--primary);
  cursor: pointer;
  font-size: 0.75rem;
}
.showcase-controls button:hover {
  background: var(--tint);
}
.text-link {
  color: var(--primary);
  font-size: 0.8rem;
  font-weight: 600;
}
.text-link:hover {
  background: transparent;
  text-decoration: underline;
}
.landing-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid rgba(43, 88, 37, 0.2);
  padding-block: 25px;
}
.landing-footer > span {
  font: 500 1rem var(--font-heading);
}
.landing-footer p,
.landing-footer a {
  font-size: 0.64rem;
  color: var(--muted);
  margin: 0;
}
.landing :is(a, button):focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 4px;
}
/* Features orbit on tree clicks; this section follows normal document flow. */
.tree-section {
  position: relative;
  padding-top: 50px;
  scroll-margin-top: 0;
}
.tree-sticky {
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px 0 0;
}
.section-intro {
  text-align: center;
  position: relative;
  z-index: 5;
}
.section-intro .eyebrow {
  justify-content: center;
  margin-bottom: 10px;
}
h2 {
  font: 600 clamp(1.8rem, 3vw, 2.7rem)/1.15 var(--font-heading);
  color: var(--ink);
  letter-spacing: -0.03em;
  margin-bottom: 12px;
}
h2 span {
  color: var(--primary);
  font-weight: inherit;
}
.tree-hint {
  font-size: 0.78rem;
  color: var(--muted);
  margin-bottom: 0;
}
.tree-stage {
  position: relative;
  width: min(1120px, 100%);
  height: 690px;
  flex-shrink: 0;
  margin-inline: auto;
}
.community-tree {
  position: absolute;
  width: min(610px, 72vw);
  height: 640px;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 2;
  border: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}
.community-tree img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 9px 8px rgba(37, 73, 21, 0.12));
}
.orbit-card.highlighted {
  border-color: var(--primary);
}
.orbit-card {
  position: absolute;
  top: 57%;
  left: 50%;
  width: 195px;
  padding: 15px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 250, 0.95);
  box-shadow: 0 8px 24px rgba(31, 75, 38, 0.14);
  transform-origin: center;
}
.orbit-card:focus-within {
  z-index: 6 !important;
  opacity: 1 !important;
}
.feature-number {
  font-size: 0.63rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--primary);
  font-weight: 600;
}
.orbit-card h3 {
  font: 600 1.05rem/1.25 var(--font-heading);
  color: var(--ink);
  margin: 8px 0;
}
.orbit-card p {
  color: var(--muted);
  font-size: 0.76rem;
  line-height: 1.7;
  margin-bottom: 12px;
}
.orbit-card ul {
  list-style: none;
  margin: 0 0 12px;
  padding: 0;
}
.orbit-card li {
  font-size: 0.67rem;
  display: flex;
  gap: 7px;
  margin-block: 7px;
  color: var(--muted);
}
.orbit-card li span {
  color: var(--primary);
}
.orbit-card .text-link {
  font-size: 0.73rem;
}
@media (prefers-reduced-motion: reduce) {
  .tree-section {
    height: auto;
    min-height: 0;
    padding: 48px 24px 0;
  }
  .tree-sticky {
    position: relative;
    height: auto;
    min-height: 0;
    padding: 0;
  }
  .tree-stage {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    height: auto;
    padding-top: 25px;
    padding-bottom: 360px;
  }
  .community-tree {
    top: auto;
    bottom: 0;
    width: 330px;
    height: 340px;
  }
  .orbit-track {
    display: none;
  }
  .orbit-card {
    position: relative;
    top: auto;
    left: auto;
    width: auto;
    transform: none !important;
    opacity: 1 !important;
    padding: 18px;
  }
  .feature-options {
    display: none;
  }
}

@media (max-width: 800px) {
  .hero {
    gap: 40px;
  }
  .feature-showcase {
    padding-left: 25px;
  }
  .showcase-copy h2 {
    font-size: 1.65rem;
  }
}
@media (max-width: 700px) {
  .hero,
  .landing-footer,
  .garden-controls {
    width: calc(100% - 40px);
  }
  .hero {
    grid-template-columns: 1fr;
    gap: 45px;
    padding-block: 30px 120px; /* was 30px 40px; room for the scroll cue */
    min-height: auto;
  }
  .hero-title {
    font-size: clamp(2.8rem, 10vw, 4rem);
  }
  .feature-showcase {
    padding: 35px 0 0;
    border-left: 0;
    border-top: 1px solid var(--line);
  }
  .showcase-heading {
    margin-bottom: 30px;
  }
  .showcase-copy {
    min-height: 0;
  }
  .landing-footer {
    flex-wrap: wrap;
    gap: 10px;
  }
  .landing-footer p {
    order: 3;
    flex-basis: 100%;
  }
}
@media (max-width: 699px) {
  .atmosphere {
    background-size: auto 100%;
  }
}
@media (max-width: 699px) and (prefers-reduced-motion: no-preference) {
  .tree-stage {
    height: 480px;
  }
  .community-tree {
    width: 330px;
    height: 350px;
  }
  .orbit-card {
    width: 145px;
    padding: 12px;
  }
  .orbit-card h3 {
    font-size: 0.88rem;
  }
  .orbit-card p {
    font-size: 0.68rem;
    line-height: 1.5;
  }
  .orbit-card .text-link {
    font-size: 0.65rem;
  }
  .feature-number {
    font-size: 0.5rem;
  }
}
@media (max-width: 699px) and (prefers-reduced-motion: reduce) {
  .tree-stage {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .landing *,
  .landing *::before,
  .landing *::after {
    transition: none !important;
    scroll-behavior: auto;
  }
}
</style>
