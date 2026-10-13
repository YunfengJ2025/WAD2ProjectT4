import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/signin',
    },
    {
      path: '/signin',
      name: 'sign-in',
      component: () => import('../views/AuthView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/AuthView.vue'),
      props: { createAccount: true },
    },
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
  ],
})

export default router
