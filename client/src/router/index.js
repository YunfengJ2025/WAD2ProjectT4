// Vue Router setup — covered in WAD2 wk6 (Vue Router)
// createRouter and createWebHistory are the standard way to set up
// client-side routing in a Vue 3 app.
import { createRouter, createWebHistory } from 'vue-router'

// Static imports — covered in WAD2 wk6 (<script setup> component imports)
import HomeView from '../views/HomeView.vue'
import DashboardView from '../views/boards/DashboardView.vue'
import LeaderboardView from '../views/boards/LeaderboardView.vue'

const router = createRouter({
  // createWebHistory uses the HTML5 History API for clean URLs (no #)
  // import.meta.env.BASE_URL is a Vite env variable — [NOT IN WAD2 CONTENT]
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      // Lazy-loaded route — [NOT IN WAD2 CONTENT]
      // () => import(...) loads the component only when the route is visited,
      // which improves initial page load performance (code splitting).
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      // Dashboard route — registered as part of Step 2.1
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
    },
    {
      // Leaderboard route — registered as part of Step 2.1
      path: '/leaderboard',
      name: 'leaderboard',
      component: LeaderboardView,
    },
  ],
})

export default router
