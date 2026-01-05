import { Alert, Button, ConfigProvider, Space, Spin } from 'antd'
import { useEffect, useMemo } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n/setup'
import { createAppRouter } from '@/app/router'
import { useAppSettingsStore } from '@/store/appSettings'

export default function App() {
  const { t } = useTranslation()
  const ensureLoaded = useAppSettingsStore((state) => state.ensureLoaded)
  const loaded = useAppSettingsStore((state) => state.loaded)
  const loading = useAppSettingsStore((state) => state.loading)
  const lastError = useAppSettingsStore((state) => state.lastError)
  const language = useAppSettingsStore((state) => state.language)

  useEffect(() => {
    ensureLoaded().catch(() => {})
  }, [ensureLoaded])

  useEffect(() => {
    i18n.changeLanguage(language).catch(() => {})
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  const router = useMemo(() => createAppRouter(), [])

  const theme = useMemo(
    () => ({
      token: {
        colorPrimary: '#1677ff',
        colorInfo: '#1677ff',
        colorBgLayout: '#f5f5f5',
        colorBgContainer: '#ffffff',
        colorText: '#1f2937',
        colorLink: '#1677ff',
        borderRadius: 8,
        fontFamily: `'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`
      },
      components: {
        Layout: {
          headerHeight: 64,
          triggerHeight: 48
        },
        Menu: {
          itemSelectedBg: '#e6f4ff',
          itemSelectedColor: '#1677ff'
        }
      }
    }),
    []
  )

  if (!loaded && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spin size="large" tip={t('loadingSettings')} />
      </div>
    )
  }

  if (!loaded && lastError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <Space direction="vertical" size="middle" style={{ width: 420 }}>
          <Alert type="error" showIcon message={t('initFailed')} description={lastError} />
          <Button type="primary" onClick={() => ensureLoaded().catch(() => {})}>
            {t('retryAction')}
          </Button>
        </Space>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Spin size="large" tip={t('initializing')} />
      </div>
    )
  }

  return (
    <ConfigProvider theme={theme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}
