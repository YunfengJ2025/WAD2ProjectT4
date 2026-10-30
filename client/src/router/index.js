// Vue Router setup — covered in WAD2 wk6 (Vue Router)
// createRouter and createWebHistory are the standard way to set up
// client-side routing in a Vue 3 app.
import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Static imports — covered in WAD2 wk6 (<script setup> component imports)
import DashboardView from '../views/boards/DashboardView.vue'
import LeaderboardView from '../views/boards/LeaderboardView.vue'

import FindNearby from '@/components/map/FindNearby.vue'

// One list with every page. (createRouter only takes one `routes` list.)
const routes = [
  { path: '/recently-liked', name: 'recently-liked', meta: { requiresAuth: true }, component: () => import('../views/post/RecentlyLikedView.vue') },
  { path: '/my-posts', name: 'my-posts', meta: { requiresAuth: true }, component: () => import('../views/post/MyPostsView.vue') },
  { path: '/community/:postId/edit', name: 'post-edit', meta: { requiresAuth: true }, component: () => import('../views/post/CreatePostView.vue') },
  {
    path: '/community/:postId',
    name: 'post-detail',
    component: () => import('../views/post/PostDetailView.vue'),
  },
  {
    path: '/community',
    name: 'community',
    component: () => import('../views/post/CommunityView.vue'),
  },
  {
    path: '/community/new',
    name: 'post-new',
    meta: { requiresAuth: true },
    component: () => import('../views/post/CreatePostView.vue'),
  },
  // Home is the watering schedule. Logged-out users are sent to sign in.
  {
    path: '/',
    name: 'home',
    meta: { requiresAuth: true },
    component: () => import('../views/WateringSchedView.vue'),
  },

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
  {
    path: '/plants',
    name: 'my-plants',
    component: () => import('../views/plant/MyPlantsView.vue'),
  },
  {
    path: '/plants/new',
    name: 'plant-new',
    component: () => import('../views/plant/PlantFormView.vue'),
  },
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

  {
    path: '/profile',
    name: 'profile',
    meta: { requiresAuth: true },
    component: () => import('../views/user/ProfileView.vue'),
  },
  {
    path: '/profile/:userId',
    name: 'public-profile',
    component: () => import('../views/user/PublicProfileView.vue'),
  },

  { path: '/find-nearby', name: 'Find Nearby', component: FindNearby },
  // Requests: "My Requests" and "My Sits" tabs (?tab=sits)
  { path: '/requests', name: 'requests', meta: { requiresAuth: true }, component: () => import('../views/careRequest/RequestsView.vue') },
  // Old addresses, kept so existing links still work
  { path: '/care-requests', redirect: { path: '/requests' } },
  { path: '/care-visits', redirect: { path: '/requests', query: { tab: 'sits' } } },
  { path: '/reviews', name: 'reviews', meta: { requiresAuth: true }, component: () => import('../views/review/ReviewsView.vue') },

  // Dashboard route — registered as part of Step 2.1
  { path: '/dashboard', name: 'dashboard', component: DashboardView },
  // Leaderboard route — registered as part of Step 2.1
  { path: '/leaderboard', name: 'leaderboard', component: LeaderboardView },

  // Schedule route
  {
    path: '/schedule',
    name: 'schedule',
    meta: { requiresAuth: true },
    component: () => import('../views/WateringSchedView.vue'),
  },
]

const router = createRouter({
  // createWebHistory uses the HTML5 History API for clean URLs (no #)
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

for (const route of router.getRoutes()) {
  if (route.path.startsWith('/plants')) route.meta.requiresAuth = true
}

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.accessToken && !auth.user) {
    try {
      await auth.restoreSession()
    } catch (err) {
      auth.error = err.message
    }
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'sign-in', query: { redirect: to.fullPath } }
  }
  if (['sign-in', 'register'].includes(to.name) && auth.isAuthenticated) {
    return { name: 'my-plants' }
  }
})

export default router
