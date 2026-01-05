import { Alert, Button, Form, Input, Modal, Space, Table, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'

type SettingRow = {
  key: string
  value: string
}

export default function SettingsAdvancedView() {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [rows, setRows] = useState<SettingRow[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [modalSaving, setModalSaving] = useState(false)
  const [modalKey, setModalKey] = useState('')
  const [modalValue, setModalValue] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await http.get('/api/v1/settings')
      const settings = (response?.data || {}) as Record<string, unknown>
      setRows(
        Object.keys(settings)
          .sort((a, b) => a.localeCompare(b))
          .map((key) => ({ key, value: String(settings[key] ?? '') }))
      )
    } catch (error) {
      console.error('加载高级设置失败：', error)
      message.error(t('failedToFetchSettings'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  const filteredRows = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) {
      return rows
    }
    return rows.filter((item) => item.key.toLowerCase().includes(q))
  }, [keyword, rows])

  const openCreateModal = () => {
    setModalMode('create')
    setModalKey('')
    setModalValue('')
    setModalOpen(true)
  }

  const openEditModal = (record: SettingRow) => {
    setModalMode('edit')
    setModalKey(record.key)
    setModalValue(record.value)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
  }

  const saveModal = async () => {
    if (!modalKey.trim()) {
      message.warning(t('pleaseEnterSettingKey'))
      return
    }
    setModalSaving(true)
    try {
      await http.put(`/api/v1/settings/${modalKey.trim()}`, { value: modalValue })
      message.success(t('settingsSavedSuccessfully'))
      setModalOpen(false)
      await refresh()
    } catch (error) {
      console.error('保存高级设置失败：', error)
      message.error((error as any)?.response?.data?.error || t('failedToSaveSettings'))
    } finally {
      setModalSaving(false)
    }
  }

  const resetOverride = (key: string) => {
    Modal.confirm({
      title: t('confirmResetSetting'),
      okType: 'danger',
      okText: t('confirm'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          await http.delete(`/api/v1/settings/${key}`)
          message.success(t('settingsSavedSuccessfully'))
          await refresh()
        } catch (error) {
          console.error('重置设置失败：', error)
          message.error(t('failedToSaveSettings'))
        }
      }
    })
  }

  const columns: ColumnsType<SettingRow> = useMemo(
    () => [
      { title: t('settingKey'), dataIndex: 'key', key: 'key', width: 340 },
      {
        title: t('settingValue'),
        dataIndex: 'value',
        key: 'value',
        render: (value: string) => (
          <Typography.Text code className="break-all">
            {value}
          </Typography.Text>
        )
      },
      {
        title: t('actions'),
        key: 'actions',
        width: 200,
        render: (_value, record) => (
          <Space>
            <Button size="small" onClick={() => openEditModal(record)}>
              {t('edit')}
            </Button>
            <Button size="small" danger onClick={() => resetOverride(record.key)}>
              {t('resetToDefault')}
            </Button>
          </Space>
        )
      }
    ],
    [t]
  )

  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <GlassSurface>
          <Space direction="vertical" size="middle" className="w-full">
            <Alert message={t('advancedSettingsHelp')} type="info" showIcon />

            <div className="flex flex-wrap gap-3 items-center justify-between">
              <Input.Search
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={t('searchSettingsPlaceholder')}
                allowClear
                style={{ maxWidth: 420 }}
                onSearch={() => refresh().catch(() => {})}
              />
              <Space>
                <Button loading={loading} onClick={() => refresh().catch(() => {})}>
                  {t('refresh')}
                </Button>
                <Button type="primary" onClick={openCreateModal}>
                  {t('add')}
                </Button>
              </Space>
            </div>

            <Table
              dataSource={filteredRows}
              columns={columns}
              loading={loading}
              rowKey={(row) => row.key}
              size="middle"
              pagination={{ pageSize: 50 }}
            />
          </Space>
        </GlassSurface>
      </Space>

      <Modal
        open={modalOpen}
        title={modalMode === 'create' ? t('addSetting') : t('editSetting')}
        confirmLoading={modalSaving}
        onOk={() => saveModal().catch(() => {})}
        onCancel={closeModal}
        okText={t('save')}
        cancelText={t('cancel')}
      >
        <Form layout="vertical">
          <Form.Item label={t('settingKey')} required>
            <Input value={modalKey} disabled={modalMode === 'edit'} onChange={(event) => setModalKey(event.target.value)} />
          </Form.Item>
          <Form.Item label={t('settingValue')} required>
            <Input.TextArea
              value={modalValue}
              autoSize={{ minRows: 2, maxRows: 10 }}
              onChange={(event) => setModalValue(event.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </GlassPage>
  )
}

