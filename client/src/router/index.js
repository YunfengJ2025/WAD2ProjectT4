// Vue Router setup — covered in WAD2 wk6 (Vue Router)
// createRouter and createWebHistory are the standard way to set up
// client-side routing in a Vue 3 app.
import { createRouter, createWebHistory } from 'vue-router'

// Static imports — covered in WAD2 wk6 (<script setup> component imports)
import HomeView from '../views/HomeView.vue'
import DashboardView from '../views/boards/DashboardView.vue'
import LeaderboardView from '../views/boards/LeaderboardView.vue'

import MyPlants from '@/components/plant/MyPlants.vue'
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
]

const router = createRouter({
  // createWebHistory uses the HTML5 History API for clean URLs (no #)
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
