import { Form, Select, Space } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'
import { useAppSettingsStore } from '@/store/appSettings'

export default function SettingsGeneralView() {
  const { t } = useTranslation()
  const language = useAppSettingsStore((state) => state.language)
  const setLanguage = useAppSettingsStore((state) => state.setLanguage)

  const [selectedLanguage, setSelectedLanguage] = useState(language)

  useEffect(() => {
    setSelectedLanguage(language)
  }, [language])

  const changeLanguage = async (nextLanguage: 'zh' | 'en') => {
    setSelectedLanguage(nextLanguage)
    await setLanguage(nextLanguage)
  }

  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <GlassSurface title={t('language')}>
          <Form layout="vertical">
            <Form.Item label={t('language')}>
              <Select
                value={selectedLanguage}
                style={{ maxWidth: 240 }}
                onChange={(value) => changeLanguage(value).catch(() => {})}
                options={[
                  { value: 'en', label: t('english') },
                  { value: 'zh', label: t('chinese') }
                ]}
              />
            </Form.Item>
          </Form>
        </GlassSurface>
      </Space>
    </GlassPage>
  )
}
