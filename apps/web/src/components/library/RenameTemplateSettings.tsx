import { Button, Form, Space, message } from 'antd'
import TextArea from 'antd/es/input/TextArea'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettingsStore } from '@/store/appSettings'

export default function RenameTemplateSettings() {
  const { t } = useTranslation()
  const renameFilenameTemplate = useAppSettingsStore((state) => state.renameFilenameTemplate)
  const setRenameFilenameTemplate = useAppSettingsStore((state) => state.setRenameFilenameTemplate)

  const [saving, setSaving] = useState(false)
  const [template, setTemplate] = useState(renameFilenameTemplate)

  useEffect(() => setTemplate(renameFilenameTemplate), [renameFilenameTemplate])

  const save = async () => {
    setSaving(true)
    try {
      await setRenameFilenameTemplate(template)
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存重命名模板失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    setSaving(true)
    try {
      setTemplate('')
      await setRenameFilenameTemplate('')
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置重命名模板失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Form layout="vertical">
        <Form.Item label={t('renameFilenameTemplate')}>
          <TextArea
            value={template}
            placeholder={t('renameFilenameTemplatePlaceholder')}
            autoSize={{ minRows: 2, maxRows: 6 }}
            onChange={(event) => setTemplate(event.target.value)}
          />
          <div className="mt-1 text-xs text-gray-500">{t('renameFilenameTemplateHelp')}</div>
        </Form.Item>

        <Space>
          <Button type="primary" loading={saving} onClick={() => save().catch(() => {})}>
            {t('save')}
          </Button>
          <Button disabled={saving} onClick={() => resetToDefault().catch(() => {})}>
            {t('resetToDefault')}
          </Button>
        </Space>
      </Form>
    </Space>
  )
}

