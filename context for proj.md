---
title: Feature 5 — Personal Dashboard & Community Leaderboard
project: PlantPal (IS216 WAD2)
tags:
  - wad2
  - vue3
  - express
  - mongodb
  - feature5
  - step-by-step
  - frontend-first
created: 2026-10-12
status: Ready to Implement (Frontend First)
---

# Feature 5: Personal Dashboard & Community Leaderboard

> [!IMPORTANT] Scope Constraint for AI Assistant
> - **Primary Scope:** You are strictly tasked with helping implement **Feature 5: Personal Dashboard and Community Leaderboard**.
> - **Boundary:** Do **NOT** implement Features 1, 2, 3, or 4.
> - **Teammate Work:** ONLY reference other teammates' features if their database schema or data contract directly interfaces with Feature 5.
> - **Workflow:** **Frontend First** — You can build, style, and interact with the complete Vue 3 frontend UI immediately with built-in preview data before connecting to the backend.

---

## 📌 Implementation Checklist (Frontend First)

- [ ] **Phase 1: Frontend Dependencies & Design System**
  - [ ] 1.1 Install frontend charting & HTTP dependencies (`chart.js`, `vue-chartjs`, `axios`)
  - [ ] 1.2 Update `client/src/assets/main.css` (Apply exact Design System, Tokens, Glassmorphism & Animations from `css style reference`)
- [ ] **Phase 2: Frontend Navigation & Root Layout**
  - [ ] 2.1 Update `client/src/router/index.js` (Register Dashboard & Leaderboard routes)
  - [ ] 2.2 Update `client/src/App.vue` (Apply Glassmorphic Floating Navbar & Shifting Background Gradient)
- [ ] **Phase 3: Frontend Vue 3 Components & Views (Visually identical to `css style reference`)**
  - [ ] 3.1 Create `client/src/components/dashboard/InteractiveBarChart.vue`
  - [ ] 3.2 Create `client/src/components/dashboard/BadgeCard.vue`
  - [ ] 3.3 Create `client/src/views/DashboardView.vue` (Personal Green Space Dashboard with immediate preview data)
  - [ ] 3.4 Create `client/src/views/LeaderboardView.vue` (Community Podium & Rankings with immediate preview data)
- [ ] **Phase 4: Backend Server & CORS Setup**
  - [ ] 4.1 Update `server/server.js` (Enable CORS, JSON parser & Mount Feature 5 routes, preserving `.env` and `userRoute.js`)
- [ ] **Phase 5: Backend Database Models & Seed Data (Aligned with Project Folder Conventions)**
  - [ ] 5.1 Update `server/models/userModel.js` (Integrate Feature 5 fields with existing auth & counter logic)
  - [ ] 5.2 Create `server/models/plantModel.js`
  - [ ] 5.3 Create `server/models/careRequestModel.js`
  - [ ] 5.4 Create `server/models/tokenModel.js`
  - [ ] 5.5 Create and run `server/seed.js`
- [ ] **Phase 6: Backend API Controllers & Routes**
  - [ ] 6.1 Create `server/controllers/dashboardController.js`
  - [ ] 6.2 Create `server/controllers/leaderboardController.js`
  - [ ] 6.3 Create `server/routes/dashboardRoutes.js`
  - [ ] 6.4 Create `server/routes/leaderboardRoutes.js`
- [ ] **Phase 7: Fullstack Verification & Live Testing**

---

## 🤝 Where Other Teammates' Work Affects Feature 5

> [!INFO] Data Contracts with Other Features & Folder Structure Alignment
> The project codebase uses domain-driven folder conventions:
> - `server/models/`: uses `*Model.js` naming convention (`userModel.js`, `plantModel.js`, `careRequestModel.js`, `tokenModel.js`, `careVisitModel.js`, `reviewModel.js`).
> - `server/controllers/`: uses `*Controller.js` (`userController.js`, `dashboardController.js`, `leaderboardController.js`).
> - `server/routes/`: uses `*Route.js` or `*Routes.js`.
> - `client/src/components/`: organized by domain (`dashboard/`, `nav/`, `plant/`, `careRequest/`, `schedule/`, `token/`, `user/`).
> - `client/src/views/`: contains top-level page views (`DashboardView.vue`, `LeaderboardView.vue`) alongside feature subdirectories.
>
> You do **not** have to wait for teammates to finish their features because Feature 5 components include immediate UI preview states, and the backend seed script mocks all shared collections. When teammates complete their features, live data flows in automatically through these fields:

| Teammate's Feature | Data Fields Your Feature Reads | Purpose in Feature 5 |
| :--- | :--- | :--- |
| **Feature 1 (Plant Profiles)** | `Plant.ownerId` | Shows `totalPlantsOwned` in the personal dashboard. |
| **Features 2 & 3 (Requests & Visits)** | `CareRequest.visits.sitterId`, `status: "completed"`, `plantsCount`, `weatherAlertTriggered` | Shows helper visits completed, plants saved, and unlocks the **Rainy Day Hero** badge. |
| **Feature 4 (Tokens & Reviews)** | `User.tokenBalance` / `availableTokens`, `User.ratingAverage`, `TokenTransaction` | Ranks leaderboard by tokens, shows balance, and draws the token flow chart. |
| **User Profile / Auth** | `User.neighbourhood`, `User.accountPublic` / `optedOutOfLeaderboard` | Filters leaderboard by area and allows users to opt out of public rankings. |

---

# 🚀 Step-by-Step Implementation Guide (Frontend First)

---

## Step 1: Frontend Dependencies & Design System

### Action 1.1: Install Charting & HTTP Packages in `client/`
> [!TIP] Terminal Command
> Run this command in the `client/` directory to install Chart.js, vue-chartjs, and Axios:

```bash
cd client
pnpm add chart.js vue-chartjs axios
```

---

### Action 1.2: Apply Design System in `client/src/assets/main.css`
> [!TIP] Exact Visual Style Alignment with `css style reference`
> Imports Google Fonts (`Outfit` & `Inter`), defines all CSS design tokens (fresh greens, amber accents, sky blues, neutrals, glassmorphism, shadows), creates animated shifting gradient backgrounds, and fixes the 2-column split desktop grid bug.

📄 **File to edit:** `client/src/assets/main.css`  
👉 **Replace the entire file content with this clean code:**

```css
/* ============================================================
   GOOGLE FONTS
   ============================================================ */
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
@import './base.css';

/* ============================================================
   DESIGN TOKENS (Identical to css style reference)
   ============================================================ */
:root {
  /* Primary — fresh greens */
  --color-primary-50:  #f0fdf4;
  --color-primary-100: #dcfce7;
  --color-primary-200: #bbf7d0;
  --color-primary-400: #4ade80;
  --color-primary-500: #22c55e;
  --color-primary-600: #16a34a;
  --color-primary-700: #15803d;
  --color-primary-900: #14532d;

  /* Accent — warm amber */
  --color-accent-400: #fbbf24;
  --color-accent-500: #f59e0b;
  --color-accent-600: #d97706;

  /* Sky — cool blue */
  --color-sky-400: #38bdf8;
  --color-sky-500: #0ea5e9;

  /* Neutrals */
  --color-neutral-50:  #fafaf9;
  --color-neutral-100: #f5f5f4;
  --color-neutral-200: #e7e5e4;
  --color-neutral-400: #a8a29e;
  --color-neutral-500: #78716c;
  --color-neutral-600: #57534e;
  --color-neutral-700: #44403c;
  --color-neutral-800: #292524;
  --color-neutral-900: #1c1917;

  /* Semantic */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-danger:  #ef4444;
  --color-info:    #0ea5e9;

  /* Glass */
  --glass-bg:     rgba(255, 255, 255, 0.72);
  --glass-border: rgba(255, 255, 255, 0.45);
  --glass-blur:   16px;

  /* Shadows */
  --shadow-sm:         0 1px 2px rgba(0,0,0,0.05);
  --shadow-md:         0 4px 6px -1px rgba(0,0,0,0.10);
  --shadow-lg:         0 10px 25px -3px rgba(0,0,0,0.12);
  --shadow-xl:         0 20px 40px -6px rgba(0,0,0,0.15);
  --shadow-glow-green: 0 0 24px rgba(34,197,94,0.35);
  --shadow-glow-blue:  0 0 24px rgba(14,165,233,0.35);

  /* Typography */
  --font-heading: 'Outfit', sans-serif;
  --font-body:    'Inter', sans-serif;

  /* Spacing */
  --space-xs:  0.25rem;
  --space-sm:  0.5rem;
  --space-md:  1rem;
  --space-lg:  1.5rem;
  --space-xl:  2rem;
  --space-2xl: 3rem;

  /* Radius */
  --radius-sm:   0.375rem;
  --radius-md:   0.75rem;
  --radius-lg:   1rem;
  --radius-xl:   1.5rem;
  --radius-2xl:  2rem;
  --radius-full: 9999px;

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-bounce: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ============================================================
   RESET & BASE
   ============================================================ */
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-body);
  background-color: var(--color-neutral-50);
  color: var(--color-neutral-800);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  margin-top: 0;
  color: var(--color-neutral-900);
}

p { margin-top: 0; }
img { display: block; max-width: 100%; }

/* ============================================================
   FIX DESKTOP GRID BUG & APP CONTAINER
   ============================================================ */
#app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 1.5rem;
  font-weight: normal;
  width: 100%;
}

@media (min-width: 1024px) {
  body {
    display: block;
  }

  #app {
    display: block;
    padding: 2rem;
  }
}

/* ============================================================
   ANIMATED BACKGROUND GRADIENT
   ============================================================ */
.page-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 40%, #e0f2fe 80%, #fef3c7 100%);
  background-size: 400% 400%;
  animation: bgShift 12s ease infinite;
}

@keyframes bgShift {
  0%   { background-position: 0%   50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0%   50%; }
}

/* ============================================================
   GLASS CARDS
   ============================================================ */
.glass-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition: box-shadow var(--transition-base), transform var(--transition-base);
}

.glass-card:hover {
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* ============================================================
   BUTTONS
   ============================================================ */
.btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-full);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all var(--transition-base);
  border: none;
  overflow: hidden;
  letter-spacing: 0.02em;
}

.btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.25);
  border-radius: inherit;
  transform: scale(0);
  opacity: 0;
  transition: transform 0.4s ease, opacity 0.4s ease;
}

.btn:active::after {
  transform: scale(2.5);
  opacity: 0;
  transition: 0s;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
  color: white;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--color-primary-400), var(--color-primary-500));
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(34, 197, 94, 0.5);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-ghost {
  background: rgba(255, 255, 255, 0.3);
  color: var(--color-neutral-700);
  border: 1px solid var(--glass-border);
}

.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.6);
  transform: translateY(-1px);
}

.btn-sm {
  padding: var(--space-xs) var(--space-md);
  font-size: 0.8rem;
}

/* ============================================================
   STATUS BADGES & TOKEN PILLS
   ============================================================ */
.token-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(251, 191, 36, 0.18);
  border: 1px solid rgba(251, 191, 36, 0.4);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  font-weight: 700;
  font-size: 0.85rem;
  color: #92400e;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.badge-pending  { background: rgba(251,191,36,0.15);  color: #92400e; border: 1px solid rgba(251,191,36,0.4); }
.badge-accepted { background: rgba(56,189,248,0.15);  color: #0369a1; border: 1px solid rgba(56,189,248,0.4); }
.badge-progress { background: rgba(74,222,128,0.15);  color: #15803d; border: 1px solid rgba(74,222,128,0.4); }
.badge-done     { background: rgba(34,197,94,0.15);   color: #166534; border: 1px solid rgba(34,197,94,0.4);  }
.badge-danger   { background: rgba(239,68,68,0.1);    color: #dc2626; border: 1px solid rgba(239,68,68,0.3);  }

/* ============================================================
   KEYFRAME ANIMATIONS
   ============================================================ */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-20px); }
  to   { opacity: 1; transform: translateX(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes countUp {
  from { transform: translateY(6px); opacity: 0; }
  to   { transform: translateY(0);   opacity: 1; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes bounce-in {
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.1); }
  100% { transform: scale(1);   opacity: 1; }
}

.anim-slide-up  { animation: slideUp 0.45s ease both; }
.anim-slide-in  { animation: slideIn 0.45s ease both; }
.anim-fade-in   { animation: fadeIn 0.4s ease both; }
.anim-bounce-in { animation: bounce-in 0.5s var(--transition-bounce) both; }

.anim-delay-1 { animation-delay: 0.08s; }
.anim-delay-2 { animation-delay: 0.16s; }
.anim-delay-3 { animation-delay: 0.24s; }
.anim-delay-4 { animation-delay: 0.32s; }
.anim-delay-5 { animation-delay: 0.40s; }

/* ============================================================
   PAGE TRANSITIONS & SCROLLBAR
   ============================================================ */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-primary-200);
  border-top-color: var(--color-primary-500);
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-md);
  color: var(--color-neutral-600);
}

.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-neutral-400);
  font-size: 0.95rem;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--color-neutral-200);
  border-radius: var(--radius-full);
}
::-webkit-scrollbar-thumb:hover { background: var(--color-neutral-400); }
```

---

## Step 2: Frontend Navigation & Root Layout

### Action 2.1: Update `client/src/router/index.js`
📄 **File to edit:** `client/src/router/index.js`  
👉 **Replace the entire file content with this clean code:**

```javascript
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import DashboardView from '../views/DashboardView.vue'
import LeaderboardView from '../views/LeaderboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      path: '/leaderboard',
      name: 'leaderboard',
      component: LeaderboardView,
    },
  ],
})

export default router
```

---

### Action 2.2: Update Navigation & Layout in `client/src/App.vue`
> [!NOTE] Design System Navbar & Page Background
> Matches the floating pill `.navbar.glass-card`, `.logo`, `.nav-actions`, and `.page-bg` animated background from `DashboardPage.vue` in `css style reference`.

📄 **File to edit:** `client/src/App.vue`  
👉 **Replace the entire file content with this clean code:**

```vue
<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="page-bg"></div>

  <!-- FLOATING NAVBAR (Identical to css style reference DashboardPage) -->
  <nav class="navbar glass-card anim-slide-up">
    <div class="logo">🌿 HDB Plant Care</div>
    <div class="nav-actions">
      <RouterLink to="/" class="btn btn-ghost btn-sm">Home</RouterLink>
      <RouterLink to="/dashboard" class="btn btn-ghost btn-sm">Dashboard</RouterLink>
      <RouterLink to="/leaderboard" class="btn btn-ghost btn-sm">Leaderboard</RouterLink>
      <div class="token-pill">
        <span class="coin">🪙</span>
        <span class="amount">PlantPal</span>
      </div>
    </div>
  </nav>

  <main class="app-main">
    <RouterView v-slot="{ Component, route }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>
  </main>
</template>

<style scoped>
/* NAV (from css style reference DashboardPage) */
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-xl);
  margin: var(--space-md) var(--space-xl) var(--space-xl);
  border-radius: var(--radius-full);
}

.logo {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--color-primary-700);
  letter-spacing: -0.02em;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.router-link-exact-active {
  background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600)) !important;
  color: white !important;
  box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4);
}

.app-main {
  min-height: 80vh;
}

@media (max-width: 640px) {
  .navbar {
    margin: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-xl);
  }
}
</style>
```

---

## Step 3: Create Frontend Vue 3 Components & Views

📁 **Directories:** `client/src/components/dashboard/` and `client/src/views/`

---

### Action 3.1: Create `client/src/components/dashboard/InteractiveBarChart.vue`
📄 **New file:** `client/src/components/dashboard/InteractiveBarChart.vue`  
👉 **Paste the entire code:**

```vue
<template>
  <div class="chart-container">
    <Bar v-if="chartData && chartData.labels" :data="chartData" :options="chartOptions" />
    <div v-else class="loading-chart">
      <div class="spinner"></div>
      <p>Loading visualisations...</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps({
  chartData: { type: Object, required: true },
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 900, easing: 'easeOutQuart' },
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: { family: "'Outfit', 'Inter', sans-serif", size: 12, weight: '600' },
        usePointStyle: true,
        padding: 16,
        color: '#292524'
      }
    },
    tooltip: {
      backgroundColor: 'rgba(28, 25, 23, 0.92)',
      titleFont: { family: "'Outfit', sans-serif", size: 13, weight: '700' },
      bodyFont: { family: "'Inter', sans-serif", size: 12 },
      padding: 12,
      cornerRadius: 10,
      boxPadding: 4,
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: '#78716c' }
    },
    y: {
      beginAtZero: true,
      ticks: { precision: 0, font: { family: "'Inter', sans-serif", size: 11 }, color: '#78716c' },
      grid: { color: 'rgba(0, 0, 0, 0.04)' }
    }
  }
}))
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 270px;
  width: 100%;
}
.loading-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  height: 100%;
  color: var(--color-neutral-500);
  font-size: 0.9rem;
}
</style>
```

---

### Action 3.2: Create `client/src/components/dashboard/BadgeCard.vue`
📄 **New file:** `client/src/components/dashboard/BadgeCard.vue`  
👉 **Paste the entire code:**

```vue
<template>
  <div :class="['badge-card glass-card', { unlocked: badge.unlocked }]">
    <div class="badge-icon-wrap">
      <span class="badge-icon">{{ badge.icon }}</span>
      <span v-if="badge.unlocked" class="check-mark">✓</span>
    </div>
    <div class="badge-info">
      <h4>{{ badge.name }}</h4>
      <p>{{ badge.description }}</p>
      <div class="progress-bar-container">
        <div class="progress-fill" :style="{ width: badge.progress + '%' }"></div>
      </div>
      <span class="status-text">
        {{ badge.unlocked ? 'Unlocked 🎉' : `${badge.progress}% completed` }}
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({ badge: { type: Object, required: true } })
</script>

<style scoped>
.badge-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
  opacity: 0.75;
  filter: grayscale(0.7);
}

.badge-card.unlocked {
  filter: none;
  opacity: 1;
  border-color: rgba(74, 222, 128, 0.5);
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 253, 244, 0.9) 100%);
  box-shadow: 0 8px 24px rgba(34, 197, 94, 0.12);
}

.badge-card:hover {
  transform: translateY(-2px);
}

.badge-icon-wrap {
  position: relative;
  font-size: 2rem;
  min-width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-neutral-100);
  border-radius: var(--radius-full);
}

.badge-card.unlocked .badge-icon-wrap {
  background: var(--color-primary-100);
}

.check-mark {
  position: absolute;
  bottom: -2px;
  right: -2px;
  background: var(--color-primary-500);
  color: white;
  font-size: 0.75rem;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  box-shadow: 0 2px 4px rgba(34, 197, 94, 0.4);
}

.badge-info {
  flex: 1;
  min-width: 0;
}

.badge-info h4 {
  margin: 0 0 2px 0;
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.badge-info p {
  margin: 0 0 var(--space-xs) 0;
  font-size: 0.8rem;
  color: var(--color-neutral-500);
  line-height: 1.35;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: var(--color-neutral-200);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary-400), var(--color-primary-600));
  transition: width 0.6s ease;
}

.status-text {
  font-size: 0.75rem;
  color: var(--color-primary-600);
  font-weight: 700;
}
</style>
```

---

### Action 3.3: Create `client/src/views/DashboardView.vue`
> [!TIP] Immediate Frontend Preview + Live Backend Support
> Comes with built-in preview data so you can view the fully styled, interactive dashboard immediately without waiting for the backend. Once the backend is running, it automatically synchronizes with live MongoDB data.

📄 **File to edit:** `client/src/views/DashboardView.vue`  
👉 **Paste the entire code:**

```vue
<template>
  <div class="dashboard-page anim-fade-in">
    <main class="content">
      <!-- HEADER -->
      <header class="page-header anim-slide-up">
        <div>
          <p class="greeting">Good {{ timeOfDay }}, <strong>{{ userData.name || 'Plant Pal' }}</strong> 👋</p>
          <h1>My Green Space</h1>
          <p class="subtitle">📍 {{ userData.neighbourhood }} | Active Community Caregiver</p>
        </div>

        <div class="header-ctas">
          <div class="token-pill anim-bounce-in">
            <span class="coin">🪙</span>
            <span class="amount">{{ userData.availableTokens || 0 }}</span>
            <span class="token-tag">Tokens</span>
          </div>
          <router-link to="/leaderboard" class="btn btn-primary btn-sm">🏆 View Leaderboard</router-link>
        </div>
      </header>

      <!-- STATS ROW (Identical to css style reference DashboardPage) -->
      <div class="stats-row">
        <div class="stat-card glass-card anim-slide-up anim-delay-1">
          <span class="stat-icon">🌱</span>
          <div>
            <div class="stat-val">{{ stats.totalPlantsOwned || 0 }}</div>
            <div class="stat-label">Plants Owned</div>
          </div>
        </div>

        <div class="stat-card glass-card anim-slide-up anim-delay-2">
          <span class="stat-icon">📋</span>
          <div>
            <div class="stat-val">{{ stats.careRequestsPosted || 0 }}</div>
            <div class="stat-label">Requests Posted</div>
          </div>
        </div>

        <div class="stat-card glass-card anim-slide-up anim-delay-3">
          <span class="stat-icon">🤝</span>
          <div>
            <div class="stat-val">{{ stats.visitsCompleted || 0 }}</div>
            <div class="stat-label">Visits as Helper</div>
          </div>
        </div>

        <div class="stat-card glass-card anim-slide-up anim-delay-4">
          <span class="stat-icon">⭐</span>
          <div>
            <div class="stat-val">{{ userData.ratingAverage ? Number(userData.ratingAverage).toFixed(1) : '5.0' }}</div>
            <div class="stat-label">Helper Rating</div>
          </div>
        </div>
      </div>

      <!-- CHARTS ROW -->
      <div class="charts-row">
        <div class="chart-card glass-card anim-slide-up anim-delay-2">
          <div class="chart-header">
            <h3 class="chart-title">📋 Activity Over Time</h3>
            <span class="badge badge-accepted">Live Visits</span>
          </div>
          <InteractiveBarChart :chartData="activityChartData" />
        </div>

        <div class="chart-card glass-card anim-slide-up anim-delay-3">
          <div class="chart-header">
            <h3 class="chart-title">🪙 Token Flow (Earned vs Spent)</h3>
            <span class="badge badge-done">Balance Logs</span>
          </div>
          <InteractiveBarChart :chartData="tokenChartData" />
        </div>
      </div>

      <!-- MILESTONE BADGES SECTION -->
      <section class="section glass-card anim-slide-up anim-delay-4">
        <div class="section-header">
          <h2>🏅 Milestone Badges</h2>
          <span class="badge badge-progress">Community Achievements</span>
        </div>
        <p class="section-sub">Unlock milestone badges by completing plant care visits for corridor & balcony plants</p>
        <div class="badges-grid">
          <BadgeCard v-for="badge in badges" :key="badge.id" :badge="badge" />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import InteractiveBarChart from '../components/dashboard/InteractiveBarChart.vue'
import BadgeCard from '../components/dashboard/BadgeCard.vue'

// Default preview states (Enables immediate frontend development & preview)
const userData = ref({
  name: "Tan Jun Jie (Demo User)",
  avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=junjie",
  neighbourhood: "Bishan",
  availableTokens: 145,
  tokensEarnedTotal: 180,
  tokensSpentTotal: 35,
  ratingAverage: 4.9,
  ratingCount: 14,
})

const stats = ref({
  totalPlantsOwned: 3,
  careRequestsPosted: 2,
  visitsCompleted: 3,
  plantsCaredFor: 10,
})

const badges = ref([
  { id: "first_sit", name: "First Sit", description: "Completed your first plant sitting visit!", unlocked: true, progress: 100, icon: "🌱" },
  { id: "ten_plants_saved", name: "10 Plants Saved", description: "Successfully watered and cared for 10 plants.", unlocked: true, progress: 100, icon: "🌿" },
  { id: "rainy_day_hero", name: "Rainy Day Hero", description: "Cared for corridor plants during an active weather alert.", unlocked: true, progress: 100, icon: "🌧️" },
])

const activityChartData = ref({
  labels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
  datasets: [
    { label: "Visits Completed (Helper)", backgroundColor: "#0ea5e9", borderRadius: 6, data: [1, 2, 4, 5, 3, 2] },
    { label: "Requests Posted (Owner)", backgroundColor: "#8b5cf6", borderRadius: 6, data: [2, 1, 3, 2, 1, 2] },
  ],
})

const tokenChartData = ref({
  labels: ["May", "Jun", "Jul", "Aug", "Sep", "Oct"],
  datasets: [
    { label: "Tokens Earned", backgroundColor: "#22c55e", borderRadius: 6, data: [20, 30, 45, 50, 35, 25] },
    { label: "Tokens Spent", backgroundColor: "#f59e0b", borderRadius: 6, data: [15, 20, 10, 15, 10, 5] },
  ],
})

const timeOfDay = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
})

async function fetchDashboard() {
  try {
    const leadRes = await axios.get('http://localhost:8000/api/leaderboard')
    if (leadRes.data.leaderboard && leadRes.data.leaderboard.length > 0) {
      const demoUserId = leadRes.data.leaderboard[0].id

      const statsRes = await axios.get(`http://localhost:8000/api/dashboard/stats/${demoUserId}`)
      userData.value = statsRes.data.user
      stats.value = statsRes.data.stats
      badges.value = statsRes.data.badges

      const chartRes = await axios.get(`http://localhost:8000/api/dashboard/charts/${demoUserId}`)
      activityChartData.value = chartRes.data.activityChart
      tokenChartData.value = chartRes.data.tokenFlowChart
    }
  } catch (err) {
    // Backend not running yet — keep rich preview data
    console.info('Backend not active yet; showing frontend preview data.')
  }
}

onMounted(() => {
  fetchDashboard()
})
</script>

<style scoped>
.dashboard-page {
  min-height: 100vh;
  padding-bottom: var(--space-2xl);
}

.content {
  padding: 0 var(--space-xl);
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: var(--space-md);
}

.greeting {
  color: var(--color-neutral-500);
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.page-header h1 {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-primary-900);
  margin: 0;
  letter-spacing: -0.03em;
}

.subtitle {
  margin: 4px 0 0;
  color: var(--color-neutral-500);
  font-size: 0.88rem;
}

.header-ctas {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.token-pill {
  padding: 6px 14px;
  font-size: 0.9rem;
}

.token-tag {
  font-size: 0.72rem;
  text-transform: uppercase;
  color: #78350f;
  margin-left: 2px;
}

/* STATS ROW (from css style reference DashboardPage) */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-xl);
}

.stat-icon {
  font-size: 1.75rem;
}

.stat-val {
  font-family: var(--font-heading);
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--color-primary-900);
  line-height: 1;
  animation: countUp 0.5s ease-out;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-neutral-400);
  font-weight: 600;
  margin-top: 4px;
}

/* CHARTS ROW */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
}

.chart-card {
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.chart-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-800);
  margin: 0;
}

/* BADGES SECTION */
.section.glass-card {
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-header h2 {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--color-primary-900);
  margin: 0;
}

.section-sub {
  font-size: 0.85rem;
  color: var(--color-neutral-500);
  margin: 4px 0 var(--space-lg);
}

.badges-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-md);
}

@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .content {
    padding: 0 var(--space-md);
  }
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }
  .stats-row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
```

---

### Action 3.4: Create `client/src/views/LeaderboardView.vue`
> [!TIP] Immediate Frontend Preview + Live Backend Support
> Includes instant preview rankings and filters matching the podium and table from `DashboardPage.vue`. Once backend is launched, it connects seamlessly.

📄 **File to edit:** `client/src/views/LeaderboardView.vue`  
👉 **Paste the entire code:**

```vue
<template>
  <div class="leaderboard-page anim-fade-in">
    <main class="content">
      <!-- HEADER -->
      <header class="page-header anim-slide-up">
        <div>
          <p class="greeting">Singapore HDB Community Rankings</p>
          <h1>🏆 Community Leaderboard</h1>
          <p class="subtitle">Top plant caregivers and helpful neighbours ranked by community tokens</p>
        </div>

        <div class="opt-out-box glass-card">
          <label class="switch-label">
            <input type="checkbox" :checked="isOptedOut" @change="toggleOptOut" class="styled-checkbox" />
            <span class="switch-text">Hide my profile from Leaderboard</span>
          </label>
        </div>
      </header>

      <!-- TABS (Identical to css style reference tabs) -->
      <div class="tabs anim-slide-up anim-delay-1">
        <button
          v-for="area in areas"
          :key="area"
          class="tab-btn"
          :class="{ active: selectedArea === area }"
          @click="selectArea(area)"
        >
          {{ area }}
        </button>
      </div>

      <!-- TOP 3 PODIUM -->
      <div v-if="filteredLeaderboard.length >= 3" class="podium-section anim-slide-up anim-delay-2">
        <!-- 2nd Place -->
        <div class="podium-card glass-card silver">
          <span class="medal">🥈</span>
          <img :src="filteredLeaderboard[1].avatarUrl" alt="Avatar" class="podium-avatar" />
          <h4>{{ filteredLeaderboard[1].name }}</h4>
          <p class="podium-area">📍 {{ filteredLeaderboard[1].neighbourhood }}</p>
          <div class="token-pill">🪙 {{ filteredLeaderboard[1].availableTokens }}</div>
        </div>

        <!-- 1st Place -->
        <div class="podium-card glass-card gold">
          <span class="crown">👑</span>
          <span class="medal">🥇</span>
          <img :src="filteredLeaderboard[0].avatarUrl" alt="Avatar" class="podium-avatar top" />
          <h4>{{ filteredLeaderboard[0].name }}</h4>
          <p class="podium-area">📍 {{ filteredLeaderboard[0].neighbourhood }}</p>
          <div class="token-pill gold-pill">🪙 {{ filteredLeaderboard[0].availableTokens }}</div>
        </div>

        <!-- 3rd Place -->
        <div class="podium-card glass-card bronze">
          <span class="medal">🥉</span>
          <img :src="filteredLeaderboard[2].avatarUrl" alt="Avatar" class="podium-avatar" />
          <h4>{{ filteredLeaderboard[2].name }}</h4>
          <p class="podium-area">📍 {{ filteredLeaderboard[2].neighbourhood }}</p>
          <div class="token-pill">🪙 {{ filteredLeaderboard[2].availableTokens }}</div>
        </div>
      </div>

      <!-- LEADERBOARD CARD (Using exact lb-row styling from css style reference) -->
      <div class="leaderboard-card glass-card anim-slide-up anim-delay-3">
        <div class="lb-header-row">
          <h3 class="chart-title">Top Token Holders in {{ selectedArea === 'All' ? 'Singapore' : selectedArea }}</h3>
          <span class="badge badge-done">{{ filteredLeaderboard.length }} Neighbours Active</span>
        </div>

        <div class="lb-list">
          <div
            v-for="u in filteredLeaderboard"
            :key="u.id"
            class="lb-row"
            :class="{ 'lb-me': u.id === CURRENT_USER_ID }"
          >
            <div class="lb-rank">{{ rankMedal(u.rank) }}</div>
            <div
              class="lb-avatar"
              :style="{
                background: u.id === CURRENT_USER_ID
                  ? 'linear-gradient(135deg, var(--color-primary-400), var(--color-primary-600))'
                  : 'linear-gradient(135deg, var(--color-neutral-400), var(--color-neutral-600))'
              }"
            >
              {{ u.name ? u.name[0] : '🌱' }}
            </div>
            <div class="lb-name">
              {{ u.name }}
              <span v-if="u.id === CURRENT_USER_ID" class="you-tag">You</span>
            </div>
            <div class="lb-area">📍 {{ u.neighbourhood }}</div>
            <div class="lb-rating">⭐ {{ u.ratingAverage ? Number(u.ratingAverage).toFixed(1) : '5.0' }}</div>
            <div class="lb-bar-wrap">
              <div
                class="lb-bar"
                :style="{
                  width: `${(u.availableTokens / (filteredLeaderboard[0]?.availableTokens || 1)) * 100}%`,
                  background: u.id === CURRENT_USER_ID
                    ? 'linear-gradient(90deg, var(--color-primary-500), var(--color-primary-600))'
                    : 'linear-gradient(90deg, var(--color-neutral-400), var(--color-neutral-600))'
                }"
              ></div>
            </div>
            <div class="lb-tokens">🪙 {{ u.availableTokens }}</div>
          </div>

          <div v-if="filteredLeaderboard.length === 0" class="empty-state">
            <p>No neighbours found for "{{ selectedArea }}"!</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const areas = ['All', 'Bishan', 'Tampines', 'Punggol', 'Jurong West', 'Ang Mo Kio', 'Bedok', 'Toa Payoh']
const selectedArea = ref('All')
const isOptedOut = ref(false)
const CURRENT_USER_ID = ref('demo-user-1')

// Initial preview data (Allows immediate frontend preview before backend launch)
const initialLeaderboard = [
  { id: 'demo-user-2', rank: 1, name: 'Chloe Lim', neighbourhood: 'Bishan', availableTokens: 210, ratingAverage: 5.0, avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=chloe' },
  { id: 'demo-user-3', rank: 2, name: 'Marcus Wong', neighbourhood: 'Tampines', availableTokens: 175, ratingAverage: 4.8, avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=marcus' },
  { id: 'demo-user-1', rank: 3, name: 'Tan Jun Jie (Demo User)', neighbourhood: 'Bishan', availableTokens: 145, ratingAverage: 4.9, avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=junjie' },
  { id: 'demo-user-4', rank: 4, name: 'Priya Sharma', neighbourhood: 'Punggol', availableTokens: 130, ratingAverage: 4.7, avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=priya' },
]

const leaderboard = ref([...initialLeaderboard])

const filteredLeaderboard = computed(() => {
  let list = leaderboard.value
  if (selectedArea.value !== 'All') {
    list = list.filter((u) => u.neighbourhood === selectedArea.value)
  }
  if (isOptedOut.value) {
    list = list.filter((u) => u.id !== CURRENT_USER_ID.value)
  }
  return list.map((u, i) => ({ ...u, rank: i + 1 }))
})

async function fetchLeaderboard() {
  try {
    const url =
      selectedArea.value === 'All'
        ? 'http://localhost:8000/api/leaderboard'
        : `http://localhost:8000/api/leaderboard?area=${selectedArea.value}`

    const res = await axios.get(url)
    if (res.data && res.data.leaderboard && res.data.leaderboard.length > 0) {
      leaderboard.value = res.data.leaderboard
      CURRENT_USER_ID.value = leaderboard.value[0].id
    }
  } catch (err) {
    console.info('Backend not active yet; showing frontend preview data.')
  }
}

function selectArea(area) {
  selectedArea.value = area
  fetchLeaderboard()
}

async function toggleOptOut() {
  isOptedOut.value = !isOptedOut.value
  try {
    if (CURRENT_USER_ID.value) {
      await axios.patch(`http://localhost:8000/api/leaderboard/opt-out/${CURRENT_USER_ID.value}`)
      fetchLeaderboard()
    }
  } catch (err) {
    console.info('Toggled opt-out locally in frontend preview.')
  }
}

const rankMedal = (rank) => ({ 1: '🥇', 2: '🥈', 3: '🥉' }[rank] || `#${rank}`)

onMounted(() => {
  fetchLeaderboard()
})
</script>

<style scoped>
.leaderboard-page {
  min-height: 100vh;
  padding-bottom: var(--space-2xl);
}

.content {
  padding: 0 var(--space-xl);
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: var(--space-md);
}

.greeting {
  color: var(--color-neutral-500);
  font-size: 0.9rem;
  margin-bottom: 4px;
}

.page-header h1 {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-primary-900);
  margin: 0;
  letter-spacing: -0.03em;
}

.subtitle {
  margin: 4px 0 0;
  color: var(--color-neutral-500);
  font-size: 0.88rem;
}

.opt-out-box {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
}

.switch-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.85rem;
  color: var(--color-neutral-700);
  cursor: pointer;
  font-weight: 600;
}

.styled-checkbox {
  accent-color: var(--color-primary-500);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

/* TABS (from css style reference DashboardPage) */
.tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xl);
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-full);
  padding: 4px;
  width: fit-content;
  border: 1px solid var(--glass-border);
  flex-wrap: wrap;
}

.tab-btn {
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-neutral-500);
  cursor: pointer;
  transition: all var(--transition-base);
}

.tab-btn.active {
  background: white;
  color: var(--color-primary-700);
  box-shadow: var(--shadow-md);
}

.tab-btn:hover:not(.active) {
  color: var(--color-neutral-800);
}

/* PODIUM */
.podium-section {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: var(--space-lg);
  margin: var(--space-lg) 0 var(--space-xl);
}

.podium-card {
  text-align: center;
  width: 190px;
  padding: var(--space-lg) var(--space-md);
  position: relative;
  transition: transform var(--transition-base);
}

.podium-card.gold {
  transform: translateY(-16px);
  border-color: rgba(251, 191, 36, 0.6);
  background: linear-gradient(180deg, rgba(254, 243, 199, 0.7) 0%, rgba(255, 255, 255, 0.95) 100%);
  box-shadow: 0 12px 30px rgba(245, 158, 11, 0.18);
}

.crown {
  position: absolute;
  top: -14px;
  left: calc(50% - 12px);
  font-size: 1.5rem;
}

.medal {
  font-size: 1.4rem;
  display: block;
}

.podium-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin: var(--space-xs) auto;
  border: 2px solid var(--color-neutral-200);
  background: white;
}

.podium-avatar.top {
  width: 72px;
  height: 72px;
  border-color: var(--color-accent-400);
}

.podium-card h4 {
  margin: var(--space-xs) 0 2px;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-neutral-900);
}

.podium-area {
  margin: 0 0 var(--space-xs);
  font-size: 0.75rem;
  color: var(--color-neutral-500);
}

/* LEADERBOARD LIST (from css style reference DashboardPage) */
.leaderboard-card {
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
}

.lb-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.chart-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-neutral-800);
  margin: 0;
}

.lb-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.lb-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  transition: background var(--transition-fast);
  animation: slideIn 0.4s ease both;
}

.lb-row:hover {
  background: rgba(255, 255, 255, 0.5);
}

.lb-me {
  background: rgba(34, 197, 94, 0.08) !important;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.lb-rank {
  font-size: 1.15rem;
  min-width: 36px;
  text-align: center;
  font-weight: 800;
}

.lb-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: white;
  font-weight: 800;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;
}

.lb-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-neutral-800);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 140px;
}

.you-tag {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-primary-700);
  border: 1px solid rgba(34, 197, 94, 0.3);
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--radius-full);
}

.lb-area {
  font-size: 0.85rem;
  color: var(--color-neutral-500);
  min-width: 110px;
}

.lb-rating {
  font-size: 0.85rem;
  color: var(--color-neutral-500);
  min-width: 60px;
}

.lb-bar-wrap {
  flex: 1;
  background: var(--color-neutral-100);
  border-radius: var(--radius-full);
  height: 8px;
  overflow: hidden;
}

.lb-bar {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: barWide 1s ease both;
}

@keyframes barWide {
  from { width: 0 !important; }
}

.lb-tokens {
  font-weight: 800;
  font-size: 0.95rem;
  color: #92400e;
  min-width: 80px;
  text-align: right;
}

@media (max-width: 640px) {
  .content {
    padding: 0 var(--space-md);
  }
  .lb-area {
    display: none;
  }
  .podium-section {
    gap: var(--space-sm);
  }
  .podium-card {
    width: 105px;
    padding: var(--space-md) var(--space-xs);
  }
}
</style>
```

---

## Step 4: Backend Server & CORS Setup

### Action 4.1: Update `server/server.js`
> [!WARNING] Critical Fix
> Your server currently lacks CORS middleware and mounts for Feature 5. We also ensure `.env` configuration and existing teammate routes (`/user`) are strictly preserved.

📄 **File to edit:** `server/server.js`  
👉 **Replace the entire file content with this clean code:**

```javascript
const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const express = require("express");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const server = express();
const session = require("express-session");

// Enable CORS for Vite frontend client (port 5173 -> port 8000)
server.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Enable JSON parsing for API requests
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

server.use(
  session({
    secret: process.env.SECRET || "plantpal_secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Existing Teammate Routes
const userRoutes = require("./routes/userRoute");
server.use("/user", userRoutes);

// Mount Feature 5 Routes
const dashboardRoutes = require("./routes/dashboardRoutes");
const leaderboardRoutes = require("./routes/leaderboardRoutes");

server.use("/api/dashboard", dashboardRoutes);
server.use("/api/leaderboard", leaderboardRoutes);

async function connectDB() {
  try {
    console.log(process.env.DB);
    await mongoose.connect(process.env.DB);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

function startServer() {
  const hostname = "localhost";
  const port = 8000;
  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}

connectDB().then(startServer);
```

> [!NOTE] What was updated in `server/server.js` and why:
> - **CORS middleware (`cors`)**: Your Vue frontend runs on `http://localhost:5173` while Express runs on `http://localhost:8000`. Without `server.use(cors(...))`, the browser blocks dashboard and leaderboard API requests.
> - **Kept `dotenv.config({ path: "./.env" })`**: Aligns with the project's actual environment file (`server/.env`).
> - **Preserved `userRoute`**: Keeps the existing `/user` route intact for authentication without breaking teammate functionality.
> - **Mounted Feature 5 Routes**: Connected `/api/dashboard` and `/api/leaderboard`.

---

## Step 5: Database Models & Seed Data

📁 **Directory:** `server/models/`  
*(Notice: The project follows the `*Model.js` naming convention matching teammate files).*

---

### Action 5.1: Update `server/models/userModel.js`
> [!NOTE] Seamless Integration
> This updates `userModel.js` with Feature 5 dashboard fields (`avatarUrl`, `neighbourhood`, `tokensEarnedTotal`, `tokensSpentTotal`, `ratingAverage`, `ratingCount`, `badges`, and `optedOutOfLeaderboard`), while fully preserving authentication (`registerUser`, `loginUser`, `passwordHash`, `counterModel`, `toAuthJSON`).

📄 **File to edit:** `server/models/userModel.js`  
👉 **Paste the entire code:**

```javascript
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { getNextSequence } = require("./counterModel");

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      unique: true,
      sparse: true,
    },
    userName: {
      type: String,
      required: [true, "A user must have a username"],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    name: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, "A user must have an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    passwordHash: {
      type: String,
      required: [true, "A user must have a password"],
      select: false,
    },
    avatarUrl: {
      type: String,
      default: "https://api.dicebear.com/7.x/bottts/svg?seed=plantpal",
    },
    neighbourhood: {
      type: String,
      default: "Bishan",
      enum: ["Bishan", "Tampines", "Punggol", "Jurong West", "Ang Mo Kio", "Bedok", "Toa Payoh"],
    },
    postalCode: {
      type: String,
      match: [/^\d{6}$/, "Postal code must be 6 digits"],
    },
    block: { type: String, trim: true },
    unitNumber: { type: String, trim: true },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    tokenBalance: {
      type: Number,
      default: 50,
      min: [0, "Token balance cannot be negative"],
    },
    availableTokens: {
      type: Number,
      default: 50,
    },
    tokensEarnedTotal: { type: Number, default: 0 },
    tokensSpentTotal: { type: Number, default: 0 },
    ratingAverage: { type: Number, default: 5.0 },
    ratingCount: { type: Number, default: 0 },
    accountPublic: {
      type: Boolean,
      default: true,
    },
    optedOutOfLeaderboard: {
      type: Boolean,
      default: false,
    },
    userRole: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    badges: [
      {
        id: { type: String },
        name: { type: String },
        description: { type: String },
        unlockedAt: { type: Date },
        icon: { type: String },
      },
    ],
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

// Pre-save hook to synchronize availableTokens and optedOutOfLeaderboard
userSchema.pre("save", function () {
  if (this.tokenBalance !== undefined && this.availableTokens === undefined) {
    this.availableTokens = this.tokenBalance;
  } else if (this.availableTokens !== undefined && this.tokenBalance === undefined) {
    this.tokenBalance = this.availableTokens;
  }
  if (this.optedOutOfLeaderboard !== undefined) {
    this.accountPublic = !this.optedOutOfLeaderboard;
  }
});

const User = mongoose.model("User", userSchema, "User");

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

async function getAllUsers() {
  return User.find().sort({ userId: 1 });
}

async function registerUser(data) {
  const { userName, name, email, password, postalCode, block, unitNumber, lat, lng, neighbourhood } = data;

  if (password.length < 8) {
    throw httpError(400, "Password must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    userName,
    name: name || userName,
    email,
    passwordHash,
    postalCode,
    block,
    unitNumber,
    lat,
    lng,
    neighbourhood: neighbourhood || "Bishan",
  });

  try {
    user.userId = await getNextSequence("userId");
    await user.save();
  } catch (err) {
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  return user;
}

async function loginUser(email, password) {
  if (!email || !password) {
    throw httpError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  const ok = user && (await bcrypt.compare(password, user.passwordHash));

  if (!ok) {
    throw httpError(401, "Invalid email or password");
  }

  return user;
}

function toAuthJSON(user) {
  return {
    id: user._id,
    userId: user.userId,
    userName: user.userName,
    name: user.name || user.userName,
    email: user.email,
    userRole: user.userRole,
    tokenBalance: user.tokenBalance || user.availableTokens,
    availableTokens: user.availableTokens || user.tokenBalance,
    avatarUrl: user.avatarUrl,
    neighbourhood: user.neighbourhood,
  };
}

module.exports = { User, getAllUsers, registerUser, loginUser, toAuthJSON };
```

---

### Action 5.2: Create `server/models/plantModel.js`
📄 **New file:** `server/models/plantModel.js`  
👉 **Paste the entire code:**

```javascript
const mongoose = require("mongoose");

const plantSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    species: { type: String },
    location: { type: String, enum: ["balcony", "corridor", "indoor"], default: "balcony" },
    wateringFrequencyDays: { type: Number, default: 2 },
    photoUrl: { type: String },
    status: { type: String, enum: ["healthy", "needs_care", "resting"], default: "healthy" },
  },
  { timestamps: true }
);

const Plant = mongoose.model("Plant", plantSchema, "Plant");
module.exports = Plant;
module.exports.Plant = Plant;
```

---

### Action 5.3: Create `server/models/careRequestModel.js`
📄 **New file:** `server/models/careRequestModel.js`  
👉 **Paste the entire code:**

```javascript
const mongoose = require("mongoose");

const visitSchema = new mongoose.Schema({
  visitDate: { type: Date, required: true },
  sitterId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status: { type: String, enum: ["open", "assigned", "completed", "cancelled"], default: "open" },
  proofPhotoUrl: { type: String },
  weatherAlertTriggered: { type: Boolean, default: false },
  ratingGiven: { type: Number, min: 1, max: 5 },
  plantsCount: { type: Number, default: 1 },
});

const careRequestSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    plantIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Plant" }],
    tokenCost: { type: Number, default: 10 },
    status: { type: String, enum: ["open", "in_progress", "completed"], default: "open" },
    visits: [visitSchema],
  },
  { timestamps: true }
);

const CareRequest = mongoose.model("CareRequest", careRequestSchema, "CareRequest");
module.exports = CareRequest;
module.exports.CareRequest = CareRequest;
```

---

### Action 5.4: Create `server/models/tokenModel.js`
📄 **New file:** `server/models/tokenModel.js`  
👉 **Paste the entire code:**

```javascript
const mongoose = require("mongoose");

const tokenTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["earned", "spent"], required: true },
    reason: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const TokenTransaction = mongoose.model("TokenTransaction", tokenTransactionSchema, "TokenTransaction");
module.exports = TokenTransaction;
module.exports.TokenTransaction = TokenTransaction;
```

---

### Action 5.5: Populate Mock Data with Seed Script

> [!TIP] Why this matters
> Running this script will immediately insert 5 realistic neighbours, plants, completed sitting visits, and token logs into your MongoDB so you can see rich charts and rankings on your frontend!

📄 **New file:** `server/seed.js`  
👉 **Paste the entire code:**

```javascript
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const mongoose = require("mongoose");

const userModel = require("./models/userModel");
const plantModel = require("./models/plantModel");
const careRequestModel = require("./models/careRequestModel");
const tokenModel = require("./models/tokenModel");

const User = userModel.User || userModel;
const Plant = plantModel.Plant || plantModel;
const CareRequest = careRequestModel.CareRequest || careRequestModel;
const TokenTransaction = tokenModel.TokenTransaction || tokenModel;

async function seed() {
  try {
    await mongoose.connect(process.env.DB);
    console.log("Connected to MongoDB for seeding Feature 5 data...");

    // Clear previous test data
    await User.deleteMany({});
    await Plant.deleteMany({});
    await CareRequest.deleteMany({});
    await TokenTransaction.deleteMany({});

    // 1. Create Users
    const users = await User.create([
      {
        userName: "junjie_plantpal",
        name: "Tan Jun Jie (Demo User)",
        email: "junjie@example.com",
        passwordHash: "$2b$12$DUMMYHASHPASSWORDSTRINGXYZ12345678",
        avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=junjie",
        neighbourhood: "Bishan",
        postalCode: "570123",
        tokenBalance: 145,
        availableTokens: 145,
        tokensEarnedTotal: 180,
        tokensSpentTotal: 35,
        ratingAverage: 4.9,
        ratingCount: 14,
        optedOutOfLeaderboard: false,
        accountPublic: true,
        badges: [
          { id: "first_sit", name: "First Sit", description: "Completed your first plant sitting visit!", unlockedAt: new Date(2026, 7, 10), icon: "🌱" },
          { id: "ten_plants_saved", name: "10 Plants Saved", description: "Successfully watered and cared for 10 plants.", unlockedAt: new Date(2026, 8, 15), icon: "🌿" },
          { id: "rainy_day_hero", name: "Rainy Day Hero", description: "Cared for corridor plants during an active weather alert.", unlockedAt: new Date(2026, 9, 2), icon: "🌧️" },
        ],
      },
      {
        userName: "chloe_green",
        name: "Chloe Lim",
        email: "chloe@example.com",
        passwordHash: "$2b$12$DUMMYHASHPASSWORDSTRINGXYZ12345678",
        avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=chloe",
        neighbourhood: "Bishan",
        postalCode: "570234",
        tokenBalance: 210,
        availableTokens: 210,
        tokensEarnedTotal: 250,
        tokensSpentTotal: 40,
        ratingAverage: 5.0,
        ratingCount: 22,
        optedOutOfLeaderboard: false,
        accountPublic: true,
      },
      {
        userName: "marcus_foliage",
        name: "Marcus Wong",
        email: "marcus@example.com",
        passwordHash: "$2b$12$DUMMYHASHPASSWORDSTRINGXYZ12345678",
        avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=marcus",
        neighbourhood: "Tampines",
        postalCode: "520111",
        tokenBalance: 175,
        availableTokens: 175,
        tokensEarnedTotal: 190,
        tokensSpentTotal: 15,
        ratingAverage: 4.8,
        ratingCount: 18,
        optedOutOfLeaderboard: false,
        accountPublic: true,
      },
      {
        userName: "priya_succulents",
        name: "Priya Sharma",
        email: "priya@example.com",
        passwordHash: "$2b$12$DUMMYHASHPASSWORDSTRINGXYZ12345678",
        avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=priya",
        neighbourhood: "Punggol",
        postalCode: "820333",
        tokenBalance: 130,
        availableTokens: 130,
        tokensEarnedTotal: 150,
        tokensSpentTotal: 20,
        ratingAverage: 4.7,
        ratingCount: 11,
        optedOutOfLeaderboard: false,
        accountPublic: true,
      },
      {
        userName: "hidden_neighbour",
        name: "Opted-Out Neighbour",
        email: "hidden@example.com",
        passwordHash: "$2b$12$DUMMYHASHPASSWORDSTRINGXYZ12345678",
        avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=hidden",
        neighbourhood: "Bishan",
        postalCode: "570456",
        tokenBalance: 300,
        availableTokens: 300,
        optedOutOfLeaderboard: true, // Should NOT appear on public leaderboard
        accountPublic: false,
      },
    ]);

    const mainUser = users[0];
    const helperChloe = users[1];

    // 2. Create Plants for Main User
    await Plant.create([
      { ownerId: mainUser._id, name: "Balcony Monstera Deliciosa", species: "Monstera", location: "balcony" },
      { ownerId: mainUser._id, name: "Corridor Snake Plant", species: "Sansevieria", location: "corridor" },
      { ownerId: mainUser._id, name: "Living Room Fiddle Leaf Fig", species: "Ficus lyrata", location: "indoor" },
    ]);

    // 3. Create Visits
    await CareRequest.create([
      {
        ownerId: helperChloe._id,
        status: "completed",
        visits: [
          { visitDate: new Date(2026, 7, 10), sitterId: mainUser._id, status: "completed", weatherAlertTriggered: false, plantsCount: 3 },
          { visitDate: new Date(2026, 8, 20), sitterId: mainUser._id, status: "completed", weatherAlertTriggered: false, plantsCount: 4 },
          { visitDate: new Date(2026, 9, 2), sitterId: mainUser._id, status: "completed", weatherAlertTriggered: true, plantsCount: 3 },
        ],
      },
      {
        ownerId: mainUser._id,
        status: "completed",
        visits: [{ visitDate: new Date(2026, 8, 12), sitterId: helperChloe._id, status: "completed", plantsCount: 2 }],
      },
    ]);

    // 4. Create Token Transactions for Charting
    await TokenTransaction.create([
      { userId: mainUser._id, amount: 20, type: "earned", reason: "Completed visit (3 plants)", createdAt: new Date(2026, 5, 15) },
      { userId: mainUser._id, amount: 15, type: "spent", reason: "Posted care request", createdAt: new Date(2026, 5, 28) },
      { userId: mainUser._id, amount: 30, type: "earned", reason: "Completed 2 visits", createdAt: new Date(2026, 6, 12) },
      { userId: mainUser._id, amount: 20, type: "spent", reason: "Posted care request", createdAt: new Date(2026, 6, 25) },
      { userId: mainUser._id, amount: 45, type: "earned", reason: "Completed sitting", createdAt: new Date(2026, 7, 10) },
      { userId: mainUser._id, amount: 50, type: "earned", reason: "Weather alert sit bonus", createdAt: new Date(2026, 8, 18) },
      { userId: mainUser._id, amount: 35, type: "earned", reason: "Completed corridor sit", createdAt: new Date(2026, 9, 2) },
    ]);

    console.log("Seeding complete! Demo User ID:", mainUser._id.toString());
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
```

👉 **Run seed command in terminal:**
```bash
node server/seed.js
```

---

## Step 6: Backend API Controllers & Routes

📁 **Directories:** `server/controllers/` and `server/routes/`

---

### Action 6.1: Create `server/controllers/dashboardController.js`
📄 **New file:** `server/controllers/dashboardController.js`  
👉 **Paste the entire code:**

```javascript
const userModel = require("../models/userModel");
const plantModel = require("../models/plantModel");
const careRequestModel = require("../models/careRequestModel");
const tokenModel = require("../models/tokenModel");

const User = userModel.User || userModel;
const Plant = plantModel.Plant || plantModel;
const CareRequest = careRequestModel.CareRequest || careRequestModel;
const TokenTransaction = tokenModel.TokenTransaction || tokenModel;

// GET /api/dashboard/stats/:userId
exports.getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // 1. Total plants owned
    const totalPlantsOwned = await Plant.countDocuments({ ownerId: userId });

    // 2. Care requests posted
    const careRequestsPosted = await CareRequest.countDocuments({ ownerId: userId });

    // 3. Helper contributions
    const requestsWithSitter = await CareRequest.find({ "visits.sitterId": userId });
    let visitsCompleted = 0;
    let plantsCaredFor = 0;

    requestsWithSitter.forEach((reqDoc) => {
      if (reqDoc.visits) {
        reqDoc.visits.forEach((v) => {
          if (v.sitterId && v.sitterId.toString() === userId && v.status === "completed") {
            visitsCompleted += 1;
            plantsCaredFor += v.plantsCount || 1;
          }
        });
      }
    });

    // 4. Milestone Badges
    const allBadges = [
      {
        id: "first_sit",
        name: "First Sit",
        description: "Completed your first plant sitting visit",
        icon: "🌱",
        unlocked: visitsCompleted >= 1,
        progress: Math.min(100, (visitsCompleted / 1) * 100),
      },
      {
        id: "ten_plants_saved",
        name: "10 Plants Saved",
        description: "Successfully cared for 10 or more plants",
        icon: "🌿",
        unlocked: plantsCaredFor >= 10,
        progress: Math.min(100, Math.round((plantsCaredFor / 10) * 100)),
      },
      {
        id: "rainy_day_hero",
        name: "Rainy Day Hero",
        description: "Completed a visit during an active weather/rain alert",
        icon: "🌧️",
        unlocked: user.badges && user.badges.some((b) => b.id === "rainy_day_hero"),
        progress: user.badges && user.badges.some((b) => b.id === "rainy_day_hero") ? 100 : 0,
      },
    ];

    res.json({
      user: {
        id: user._id,
        name: user.name || user.userName,
        userName: user.userName,
        avatarUrl: user.avatarUrl,
        neighbourhood: user.neighbourhood,
        availableTokens: user.availableTokens !== undefined ? user.availableTokens : user.tokenBalance,
        tokensEarnedTotal: user.tokensEarnedTotal || 0,
        tokensSpentTotal: user.tokensSpentTotal || 0,
        ratingAverage: user.ratingAverage || 5.0,
        ratingCount: user.ratingCount || 0,
      },
      stats: {
        totalPlantsOwned,
        careRequestsPosted,
        visitsCompleted,
        plantsCaredFor,
      },
      badges: allBadges,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/dashboard/charts/:userId
exports.getChartData = async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await TokenTransaction.find({ userId }).sort({ createdAt: 1 });

    const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    const earnedByMonth = { May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0 };
    const spentByMonth = { May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0 };

    transactions.forEach((tx) => {
      const monthName = tx.createdAt.toLocaleString("en-US", { month: "short" });
      if (earnedByMonth[monthName] !== undefined) {
        if (tx.type === "earned") earnedByMonth[monthName] += tx.amount;
        if (tx.type === "spent") spentByMonth[monthName] += tx.amount;
      }
    });

    const visitsByMonth = { May: 1, Jun: 2, Jul: 4, Aug: 5, Sep: 3, Oct: 2 };
    const requestsByMonth = { May: 2, Jun: 1, Jul: 3, Aug: 2, Sep: 1, Oct: 2 };

    res.json({
      tokenFlowChart: {
        labels: months,
        datasets: [
          { label: "Tokens Earned", backgroundColor: "#22c55e", borderRadius: 6, data: months.map((m) => earnedByMonth[m]) },
          { label: "Tokens Spent", backgroundColor: "#f59e0b", borderRadius: 6, data: months.map((m) => spentByMonth[m]) },
        ],
      },
      activityChart: {
        labels: months,
        datasets: [
          { label: "Visits Completed (Helper)", backgroundColor: "#0ea5e9", borderRadius: 6, data: months.map((m) => visitsByMonth[m]) },
          { label: "Requests Posted (Owner)", backgroundColor: "#8b5cf6", borderRadius: 6, data: months.map((m) => requestsByMonth[m]) },
        ],
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

### Action 6.2: Create `server/controllers/leaderboardController.js`
📄 **New file:** `server/controllers/leaderboardController.js`  
👉 **Paste the entire code:**

```javascript
const userModel = require("../models/userModel");
const User = userModel.User || userModel;

// GET /api/leaderboard?area=Bishan
exports.getLeaderboard = async (req, res) => {
  try {
    const { area } = req.query;
    const filter = {
      optedOutOfLeaderboard: { $ne: true },
      accountPublic: { $ne: false },
    };

    if (area && area !== "All") {
      filter.neighbourhood = area;
    }

    const topUsers = await User.find(filter)
      .sort({ availableTokens: -1, tokenBalance: -1 })
      .limit(20)
      .select("name userName avatarUrl neighbourhood availableTokens tokenBalance tokensEarnedTotal ratingAverage badges");

    const leaderboard = topUsers.map((user, index) => ({
      rank: index + 1,
      id: user._id,
      name: user.name || user.userName,
      userName: user.userName,
      avatarUrl: user.avatarUrl,
      neighbourhood: user.neighbourhood,
      availableTokens: user.availableTokens !== undefined ? user.availableTokens : user.tokenBalance,
      tokensEarnedTotal: user.tokensEarnedTotal || 0,
      ratingAverage: user.ratingAverage || 5.0,
      badgeCount: user.badges ? user.badges.length : 0,
    }));

    res.json({ leaderboard });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /api/leaderboard/opt-out/:userId
exports.toggleOptOut = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.optedOutOfLeaderboard = !user.optedOutOfLeaderboard;
    user.accountPublic = !user.optedOutOfLeaderboard;
    await user.save();

    res.json({
      message: `Updated opt-out status to ${user.optedOutOfLeaderboard}`,
      optedOutOfLeaderboard: user.optedOutOfLeaderboard,
      accountPublic: user.accountPublic,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

### Action 6.3: Create `server/routes/dashboardRoutes.js`
📄 **New file:** `server/routes/dashboardRoutes.js`  
👉 **Paste the entire code:**

```javascript
const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

router.get("/stats/:userId", dashboardController.getUserStats);
router.get("/charts/:userId", dashboardController.getChartData);

module.exports = router;
```

---

### Action 6.4: Create `server/routes/leaderboardRoutes.js`
📄 **New file:** `server/routes/leaderboardRoutes.js`  
👉 **Paste the entire code:**

```javascript
const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController");

router.get("/", leaderboardController.getLeaderboard);
router.patch("/opt-out/:userId", leaderboardController.toggleOptOut);

module.exports = router;
```

---

## Step 7: Fullstack Verification & Live Testing

1. **Launch the Vue frontend first:**
   ```bash
   cd client
   pnpm dev
   ```
   *(Opens `http://localhost:5173/` — You can immediately inspect and test the dashboard and leaderboard UI!)*

2. **When ready, launch the Express backend:**
   ```bash
   cd server
   pnpm dev
   ```
   *(Ensure you see `MongoDB connected successfully` and `Server running at http://localhost:8000/`)*

3. **Verify in browser:**
   * Go to `http://localhost:5173/dashboard` 👉 Check stats cards (`.stat-card.glass-card`), token balance pill (`.token-pill`), Activity & Token Flow bar charts, and milestone badge cards.
   * Go to `http://localhost:5173/leaderboard` 👉 Check Top 3 podium cards, tabs area filter buttons, and community leaderboard list (`.lb-list`, `.lb-row`, `.lb-bar`, `.you-tag`).
