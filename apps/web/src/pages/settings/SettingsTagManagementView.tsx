import { Alert, Divider, Space, Spin, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import TagManager from '@/components/tags/TagManager'
import TagTypeManager, { type TagType } from '@/components/tags/TagTypeManager'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'

export default function SettingsTagManagementView() {
  const { t } = useTranslation()

  const [tagTypes, setTagTypes] = useState<TagType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchTagData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await http.get('/api/v1/tag-types')
      setTagTypes((response?.data || []) as TagType[])
    } catch (err) {
      console.error('加载标签类型失败：', err)
      const message = (err as any)?.response?.data?.error || t('failedToFetchTagTypes')
      setError(String(message))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchTagData().catch(() => {})
  }, [fetchTagData])

  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <GlassSurface title={t('tagTypeManagement')}>
          <Space direction="vertical" size="large" className="w-full">
            <div>
              <Typography.Title level={4}>{t('tagTypes')}</Typography.Title>

              {loading ? (
                <div className="py-6">
                  <Spin />
                </div>
              ) : error ? (
                <Alert type="error" showIcon message={t('failedToFetchTagTypes')} description={error} />
              ) : (
                <TagTypeManager types={tagTypes} onDataChanged={fetchTagData} />
              )}
            </div>

            <Divider />

            <TagManager types={tagTypes} />
          </Space>
        </GlassSurface>
      </Space>
    </GlassPage>
  )
}
