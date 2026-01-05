import { Button, List, Modal, Space, Typography, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import GlassSurface from '@/components/glass/ui/GlassSurface'
import { useLibraryStore } from '@/store/library'

type BackupItem = {
  filename: string
  size: number
  mtime: number
}

export default function BackupManager() {
  const { t } = useTranslation()
  const checkActiveTasks = useLibraryStore((state) => state.checkActiveTasks)

  const [backups, setBackups] = useState<BackupItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBackups = useCallback(async () => {
    setLoading(true)
    try {
      const response = await http.get('/api/v1/backups')
      setBackups((response?.data?.backups || []) as BackupItem[])
    } catch (error) {
      console.error('加载备份列表失败：', error)
      message.error(t('errorFetchingBackups'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    fetchBackups().catch(() => {})
  }, [fetchBackups])

  const createBackup = async () => {
    Modal.confirm({
      title: t('confirmCreateBackup'),
      okText: t('confirm'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          setLoading(true)
          await http.post('/api/v1/backups')
          message.success(t('backupCreatedSuccessfully'))
          await fetchBackups()
        } catch (error) {
          console.error('创建备份失败：', error)
          message.error(t('errorCreatingBackup'))
        } finally {
          setLoading(false)
          checkActiveTasks().catch(() => {})
        }
      }
    })
  }

  const restoreBackup = (filename: string) => {
    Modal.confirm({
      title: t('confirmRestore'),
      okText: t('restore'),
      cancelText: t('cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          setLoading(true)
          await http.post('/api/v1/backup-restores', { filename })
          message.success(t('restoreSuccessful'))
        } catch (error) {
          console.error('还原备份失败：', error)
          message.error(t('errorRestoringBackup'))
        } finally {
          setLoading(false)
          checkActiveTasks().catch(() => {})
        }
      }
    })
  }

  return (
    <GlassSurface title={t('backupRestore')}>
      <Space direction="vertical" size="large" className="w-full">
        <Button type="primary" loading={loading} onClick={() => createBackup().catch(() => {})}>
          {t('createNewBackup')}
        </Button>

        <div>
          <Typography.Title level={5} className="mb-3">
            {t('availableBackups')}
          </Typography.Title>
          <List
            bordered
            loading={loading}
            dataSource={backups}
            locale={{ emptyText: t('noBackupsFound') }}
            renderItem={(item) => (
              <List.Item className="flex items-center justify-between">
                <Typography.Text code className="text-sm">
                  {item.filename}
                </Typography.Text>
                <Button danger type="primary" size="small" onClick={() => restoreBackup(item.filename)}>
                  {t('restore')}
                </Button>
              </List.Item>
            )}
          />
        </div>
      </Space>
    </GlassSurface>
  )
}

