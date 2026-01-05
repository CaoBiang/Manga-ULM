import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { Button, Layout, Space, Typography } from 'antd'
import { useMemo } from 'react'
import { useMatches } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { RouteHandle } from '@/app/router'

const { Header } = Layout

export type PageHeaderProps = {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export default function PageHeader({ collapsed, onToggleCollapsed }: PageHeaderProps) {
  const { t } = useTranslation()
  const matches = useMatches()

  const titleKey = useMemo(() => {
    const last = matches[matches.length - 1]
    const handle = (last?.handle ?? {}) as RouteHandle
    return handle.titleKey ?? ''
  }, [matches])

  return (
    <Header className="px-6 flex items-center justify-between bg-transparent">
      <Space size="middle" align="center">
        <Button
          type="text"
          aria-label={collapsed ? t('sidebarExpand') : t('sidebarCollapse')}
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggleCollapsed}
        />
        <Typography.Title level={4} className="m-0">
          {titleKey ? t(titleKey) : ''}
        </Typography.Title>
      </Space>
    </Header>
  )
}
