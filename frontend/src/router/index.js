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
      path: '/library',
      name: 'library',
      component: () => import('../views/LibraryView.vue'),
      meta: { keepAlive: true, fullWidth: true }
    },
    {
      path: '/likes',
      name: 'likes',
      component: () => import('../views/LikeView.vue'),
      meta: { fullWidth: true }
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
      redirect: { name: 'settings-general' }
    },
    {
      path: '/settings/general',
      name: 'settings-general',
      component: () => import('../views/SettingsGeneralView.vue')
    },
    {
      path: '/settings/library',
      name: 'settings-library',
      component: () => import('../views/SettingsLibraryView.vue')
    },
    {
      path: '/settings/display',
      name: 'settings-display',
      component: () => import('../views/SettingsDisplayView.vue')
    },
    {
      path: '/settings/reader',
      name: 'settings-reader',
      component: () => import('../views/SettingsReaderView.vue')
    },
    {
      path: '/settings/tag-management',
      name: 'settings-tags',
      component: () => import('../views/SettingsTagManagementView.vue')
    },
    {
      path: '/settings/tasks',
      name: 'settings-tasks',
      component: () => import('../views/SettingsTasksView.vue')
    },
    {
      path: '/settings/advanced',
      name: 'settings-advanced',
      component: () => import('../views/SettingsAdvancedView.vue')
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
