// Vue Router setup — covered in WAD2 wk6 (Vue Router)
// createRouter and createWebHistory are the standard way to set up
// client-side routing in a Vue 3 app.
import { createRouter, createWebHistory } from 'vue-router'

// Static imports — covered in WAD2 wk6 (<script setup> component imports)
import DashboardView from '../views/boards/DashboardView.vue'
import LeaderboardView from '../views/boards/LeaderboardView.vue'

import FindNearby from '@/components/map/FindNearby.vue'
import CareVisits from '@/components/careVisit/CareVisits.vue'
import Dashboard from '@/components/dashboard/Dashboard.vue'

// Merged and corrected routes list
// Path '/' routes to DashboardView so you immediately see the completed dashboard with stats and charts
const routes = [
  { path: '/', name: 'Dashboard', component: DashboardView },
  { path: '/dashboard', name: 'DashboardView', component: DashboardView },
  { path: '/leaderboard', name: 'Leaderboard', component: LeaderboardView },
  { path: '/my-plants', name: 'My Plants', component: MyPlants },
  { path: '/find-nearby', name: 'Find Nearby', component: FindNearby },
  { path: '/care-visits', name: 'Care Visits', component: CareVisits },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/AboutView.vue'),
  },
// One list with every page. (createRouter only takes one `routes` list.)
const routes = [
  // Home — the navbar's "Home" link goes here
  { path: '/', name: 'Dashboard', component: Dashboard },

  // Sign in / create account
  // Lazy-loaded route — [NOT IN WAD2 CONTENT]
  // () => import(...) loads the component only when the route is visited,
  // which improves initial page load performance (code splitting).
  { path: '/signin', name: 'sign-in', component: () => import('../views/AuthView.vue') },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/AuthView.vue'),
    props: { createAccount: true },
  },

  // My Plants
  { path: '/plants', name: 'my-plants', component: () => import('../views/plant/MyPlantsView.vue') },
  { path: '/plants/new', name: 'plant-new', component: () => import('../views/plant/PlantFormView.vue') },
  {
    path: '/plants/:plantId',
    name: 'plant-detail',
    component: () => import('../views/plant/PlantDetailView.vue'),
  },
  {
    path: '/plants/:plantId/edit',
    name: 'plant-edit',
    component: () => import('../views/plant/PlantFormView.vue'),
  },

  { path: '/find-nearby', name: 'Find Nearby', component: FindNearby },
  { path: '/care-visits', name: 'Care Visits', component: CareVisits },

  // Dashboard route — registered as part of Step 2.1
  { path: '/dashboard', name: 'dashboard', component: DashboardView },
  // Leaderboard route — registered as part of Step 2.1
  { path: '/leaderboard', name: 'leaderboard', component: LeaderboardView },
]

const router = createRouter({
  // createWebHistory uses the HTML5 History API for clean URLs (no #)
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
