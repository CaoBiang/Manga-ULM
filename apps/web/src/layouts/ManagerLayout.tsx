import {
  BookOutlined,
  HeartOutlined,
  HomeOutlined,
  SettingOutlined,
  ToolOutlined
} from '@ant-design/icons'
import { Badge, Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useMatches } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageHeader from '@/components/PageHeader'
import type { RouteHandle } from '@/app/router'
import { useAppSettingsStore } from '@/store/appSettings'

const { Sider, Content } = Layout

const managerBodyClass = 'app-is-manager'

export default function ManagerLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const matches = useMatches()
  const { t } = useTranslation()

  const [collapsed, setCollapsed] = useState(false)
  const [openKeys, setOpenKeys] = useState<string[]>([])

  const managerUiBlurEnabled = useAppSettingsStore((state) => state.managerUiBlurEnabled)
  const managerUiBlurRadiusPx = useAppSettingsStore((state) => state.managerUiBlurRadiusPx)
  const managerUiSurfaceBgOpacity = useAppSettingsStore((state) => state.managerUiSurfaceBgOpacity)
  const managerUiSurfaceBorderOpacity = useAppSettingsStore((state) => state.managerUiSurfaceBorderOpacity)
  const managerUiControlBgOpacity = useAppSettingsStore((state) => state.managerUiControlBgOpacity)
  const managerUiControlBorderOpacity = useAppSettingsStore((state) => state.managerUiControlBorderOpacity)

  const managerUiCssVars = useMemo(
    () => ({
      '--manager-ui-blur-enabled': managerUiBlurEnabled ? '1' : '0',
      '--manager-ui-blur-radius-px': String(managerUiBlurRadiusPx),
      '--manager-ui-surface-bg-opacity': String(managerUiSurfaceBgOpacity),
      '--manager-ui-surface-border-opacity': String(managerUiSurfaceBorderOpacity),
      '--manager-ui-control-bg-opacity': String(managerUiControlBgOpacity),
      '--manager-ui-control-border-opacity': String(managerUiControlBorderOpacity)
    }),
    [
      managerUiBlurEnabled,
      managerUiBlurRadiusPx,
      managerUiControlBgOpacity,
      managerUiControlBorderOpacity,
      managerUiSurfaceBgOpacity,
      managerUiSurfaceBorderOpacity
    ]
  )
  const tasksBadgeEnabled = useAppSettingsStore((state) => state.tasksBadgeEnabled)

  const currentHandle = useMemo(() => {
    const last = matches[matches.length - 1]
    return (last?.handle ?? {}) as RouteHandle
  }, [matches])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.body.classList.add(managerBodyClass)
    for (const [key, value] of Object.entries(managerUiCssVars)) {
      document.body.style.setProperty(key, value)
    }

    return () => {
      document.body.classList.remove(managerBodyClass)
      for (const key of Object.keys(managerUiCssVars)) {
        document.body.style.removeProperty(key)
      }
    }
  }, [managerUiCssVars])

  useEffect(() => {
    const titleKey = currentHandle?.titleKey
    if (!titleKey) {
      return
    }
    if (typeof document !== 'undefined') {
      document.title = `${t(titleKey)} - ${t('appName')}`
    }
  }, [currentHandle?.titleKey, t])

  const menuItems: MenuProps['items'] = useMemo(
    () => [
      { key: '/', label: t('home'), icon: <HomeOutlined /> },
      { key: '/library', label: t('library'), icon: <BookOutlined /> },
      { key: '/likes', label: t('wishlist'), icon: <HeartOutlined /> },
      {
        key: '/settings',
        label: t('settings'),
        icon: <SettingOutlined />,
        children: [
          { key: '/settings/general', label: t('generalSettings') },
          { key: '/settings/library', label: t('librarySettings') },
          { key: '/settings/display', label: t('displaySettings') },
          { key: '/settings/reader', label: t('readerSettings') },
          { key: '/settings/tag-management', label: t('tagManagement') },
          {
            key: '/settings/tasks',
            label: tasksBadgeEnabled ? <Badge dot>{t('taskManager')}</Badge> : t('taskManager')
          },
          { key: '/settings/advanced', label: t('advancedSettings') }
        ]
      },
      { key: '/maintenance', label: t('maintenance'), icon: <ToolOutlined /> }
    ],
    [t, tasksBadgeEnabled]
  )

  const selectedKeys = useMemo(() => {
    const path = location.pathname
    if (path.startsWith('/settings')) {
      return [path]
    }
    if (path.startsWith('/edit/')) return []
    return [path === '/' ? '/' : path]
  }, [location.pathname])

  useEffect(() => {
    if (collapsed) {
      setOpenKeys([])
      return
    }
    if (location.pathname.startsWith('/settings')) {
      setOpenKeys(['/settings'])
      return
    }
    setOpenKeys([])
  }, [collapsed, location.pathname])

  const handleMenuClick: MenuProps['onClick'] = (info) => {
    const key = String(info.key)
    if (key === '/settings') {
      navigate('/settings/general')
      return
    }
    navigate(key)
  }

  return (
    <Layout className="app-layout manager-shell">
      <Sider
        collapsed={collapsed}
        collapsible
        onCollapse={(value) => setCollapsed(value)}
        theme="light"
        width={248}
        collapsedWidth={72}
        breakpoint="lg"
        className="app-sider"
      >
        <Link to="/" className="app-logo">
          <span className="logo-mark">M</span>
          {!collapsed ? <span className="logo-text">{t('appName')}</span> : null}
        </Link>
        <Menu
          mode="inline"
          items={menuItems}
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys.map((value) => String(value)))}
          onClick={handleMenuClick}
        />
      </Sider>

      <Layout className="app-main">
        <PageHeader collapsed={collapsed} onToggleCollapsed={() => setCollapsed(!collapsed)} />
        <Content className="app-content">
          <div className={currentHandle?.fullWidth ? 'w-full' : 'w-full'}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
