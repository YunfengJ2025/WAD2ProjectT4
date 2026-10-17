import { createRouter, createWebHistory } from 'vue-router';
import CareRequestCreateView from '../views/careRequest/CareRequestCreateView.vue';
import CareRequestDetailView from '../views/careRequest/CareRequestDetailView.vue';
import SitterMarketplaceView from '../views/careVisit/SitterMarketplaceView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'owner-create', component: CareRequestCreateView },
    { path: '/care-requests/:id', name: 'owner-detail', component: CareRequestDetailView },
    { path: '/sitter', name: 'sitter-marketplace', component: SitterMarketplaceView }
  ]
});

export default router;