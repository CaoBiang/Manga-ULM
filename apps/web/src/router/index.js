import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/HomeView.vue'),
      meta: { keepAlive: true }
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('../pages/LibraryView.vue'),
      meta: { keepAlive: true, fullWidth: true }
    },
    {
      path: '/likes',
      name: 'likes',
      component: () => import('../pages/LikeView.vue'),
      meta: { fullWidth: true }
    },
    {
      path: '/reader/:id',
      name: 'reader',
      component: () => import('../pages/ReaderView.vue'),
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
      component: () => import('../pages/settings/SettingsGeneralView.vue')
    },
    {
      path: '/settings/library',
      name: 'settings-library',
      component: () => import('../pages/settings/SettingsLibraryView.vue')
    },
    {
      path: '/settings/display',
      name: 'settings-display',
      component: () => import('../pages/settings/SettingsDisplayView.vue')
    },
    {
      path: '/settings/reader',
      name: 'settings-reader',
      component: () => import('../pages/settings/SettingsReaderView.vue')
    },
    {
      path: '/settings/reader-interaction',
      name: 'settings-reader-interaction',
      component: () => import('../pages/settings/SettingsReaderInteractionView.vue')
    },
    {
      path: '/settings/tag-management',
      name: 'settings-tags',
      component: () => import('../pages/settings/SettingsTagManagementView.vue')
    },
    {
      path: '/settings/tasks',
      name: 'settings-tasks',
      component: () => import('../pages/settings/SettingsTasksView.vue')
    },
    {
      path: '/settings/advanced',
      name: 'settings-advanced',
      component: () => import('../pages/settings/SettingsAdvancedView.vue')
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: () => import('../pages/MaintenanceView.vue'),
    },
    {
      path: '/edit/:id',
      name: 'edit',
      component: () => import('../pages/EditView.vue'),
      props: true
    }
  ]
})

export default router 
