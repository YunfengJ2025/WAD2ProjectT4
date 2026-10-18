
import { createRouter, createWebHistory } from 'vue-router'
import MyPlants from '@/components/plant/MyPlants.vue'
import FindNearby from '@/components/map/FindNearby.vue'
import CareVisits from '@/components/careVisit/CareVisits.vue'
import Dashboard from '@/components/dashboard/Dashboard.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/my-plants', name: 'My Plants', component: MyPlants },
  { path:'/find-nearby', name: 'Find Nearby', component: FindNearby},
  { path:'/care-visits' , name: 'Care Visits', component: CareVisits },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
