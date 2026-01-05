import { createBrowserRouter, Navigate } from 'react-router-dom'
import ManagerLayout from '@/layouts/ManagerLayout'
import EditView from '@/pages/EditView'
import HomeView from '@/pages/HomeView'
import LibraryView from '@/pages/LibraryView'
import LikeView from '@/pages/LikeView'
import MaintenanceView from '@/pages/MaintenanceView'
import ReaderView from '@/pages/ReaderView'
import SettingsAdvancedView from '@/pages/settings/SettingsAdvancedView'
import SettingsDisplayView from '@/pages/settings/SettingsDisplayView'
import SettingsGeneralView from '@/pages/settings/SettingsGeneralView'
import SettingsLibraryView from '@/pages/settings/SettingsLibraryView'
import SettingsReaderView from '@/pages/settings/SettingsReaderView'
import SettingsTagManagementView from '@/pages/settings/SettingsTagManagementView'
import SettingsTasksView from '@/pages/settings/SettingsTasksView'

export type RouteHandle = {
  titleKey?: string
  fullScreen?: boolean
  fullWidth?: boolean
}

export function createAppRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <ManagerLayout />,
      children: [
        { index: true, element: <HomeView />, handle: { titleKey: 'libraryDashboardTitle' } satisfies RouteHandle },
        { path: 'library', element: <LibraryView />, handle: { titleKey: 'library', fullWidth: true } satisfies RouteHandle },
        { path: 'likes', element: <LikeView />, handle: { titleKey: 'myWishlist', fullWidth: true } satisfies RouteHandle },
        { path: 'maintenance', element: <MaintenanceView />, handle: { titleKey: 'maintenance' } satisfies RouteHandle },
        { path: 'edit/:id', element: <EditView />, handle: { titleKey: 'editFileDetails' } satisfies RouteHandle },
        { path: 'settings', element: <Navigate to="/settings/general" replace /> },
        { path: 'settings/general', element: <SettingsGeneralView />, handle: { titleKey: 'generalSettings' } satisfies RouteHandle },
        { path: 'settings/library', element: <SettingsLibraryView />, handle: { titleKey: 'librarySettings' } satisfies RouteHandle },
        { path: 'settings/display', element: <SettingsDisplayView />, handle: { titleKey: 'displaySettings' } satisfies RouteHandle },
        { path: 'settings/reader', element: <SettingsReaderView />, handle: { titleKey: 'readerSettings' } satisfies RouteHandle },
        { path: 'settings/tag-management', element: <SettingsTagManagementView />, handle: { titleKey: 'tagManagement' } satisfies RouteHandle },
        { path: 'settings/tasks', element: <SettingsTasksView />, handle: { titleKey: 'taskManager' } satisfies RouteHandle },
        { path: 'settings/advanced', element: <SettingsAdvancedView />, handle: { titleKey: 'advancedSettings' } satisfies RouteHandle }
      ]
    },
    {
      path: '/reader/:id',
      element: <ReaderView />,
      handle: { fullScreen: true } satisfies RouteHandle
    }
  ])
}

