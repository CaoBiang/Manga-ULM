import { createRouter, createWebHistory } from 'vue-router'
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/HomeView.vue'),
      meta: { keepAlive: true, titleKey: 'libraryDashboardTitle' }
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('../pages/LibraryView.vue'),
      meta: { keepAlive: true, fullWidth: true, titleKey: 'library' }
    },
    {
      path: '/likes',
      name: 'likes',
      component: () => import('../pages/LikeView.vue'),
      meta: { fullWidth: true, titleKey: 'myWishlist' }
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
      component: () => import('../pages/settings/SettingsGeneralView.vue'),
      meta: { titleKey: 'generalSettings' }
    },
    {
      path: '/settings/library',
      name: 'settings-library',
      component: () => import('../pages/settings/SettingsLibraryView.vue'),
      meta: { titleKey: 'librarySettings' }
    },
    {
      path: '/settings/display',
      name: 'settings-display',
      component: () => import('../pages/settings/SettingsDisplayView.vue'),
      meta: { titleKey: 'displaySettings' }
    },
    {
      path: '/settings/reader',
      name: 'settings-reader',
      component: () => import('../pages/settings/SettingsReaderView.vue'),
      meta: { titleKey: 'readerSettings' }
    },
    {
      path: '/settings/tag-management',
      name: 'settings-tags',
      component: () => import('../pages/settings/SettingsTagManagementView.vue'),
      meta: { titleKey: 'tagManagement' }
    },
    {
      path: '/settings/tasks',
      name: 'settings-tasks',
      component: () => import('../pages/settings/SettingsTasksView.vue'),
      meta: { titleKey: 'taskManager' }
    },
    {
      path: '/settings/advanced',
      name: 'settings-advanced',
      component: () => import('../pages/settings/SettingsAdvancedView.vue'),
      meta: { titleKey: 'advancedSettings' }
    },
    {
      path: '/maintenance',
      name: 'maintenance',
      component: () => import('../pages/MaintenanceView.vue'),
      meta: { titleKey: 'maintenance' }
    },
    {
      path: '/edit/:id',
      name: 'edit',
      component: () => import('../pages/EditView.vue'),
      props: true,
      meta: { titleKey: 'editFileDetails' }
    }
  ]
})

export default router 
