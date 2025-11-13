import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
      meta: { keepAlive: true }
    },
    {
      path: '/likes',
      name: 'likes',
      component: () => import('../views/LikeView.vue')
    },
    {
      path: '/reader/:id',
      name: 'reader',
      component: () => import('../views/ReaderView.vue'),
      props: true,
      meta: { fullScreen: true }
    },
    {
      path: '/settings',
      redirect: { name: 'settings-library' }
    },
    {
      path: '/settings/library-paths',
      name: 'settings-library',
      component: () => import('../views/SettingsLibraryView.vue')
    },
    {
      path: '/settings/tag-management',
      name: 'settings-tags',
      component: () => import('../views/SettingsTagManagementView.vue')
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: () => import('../views/MaintenanceView.vue')
    },
    {
      path: '/edit/:id',
      name: 'edit',
      component: () => import('../views/EditView.vue'),
      props: true
    }
  ]
})

export default router 
