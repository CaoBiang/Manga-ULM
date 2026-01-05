import { Button, Checkbox, Empty, List, Modal, Space, Spin, Typography, message } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'
import BackupManager from '@/components/maintenance/BackupManager'
import { useLibraryStore } from '@/store/library'

type FileItem = {
  id: number
  file_path?: string | null
}

export default function MaintenanceView() {
  const { t } = useTranslation()
  const checkActiveTasks = useLibraryStore((state) => state.checkActiveTasks)

  const [duplicates, setDuplicates] = useState<FileItem[][]>([])
  const [loadingDuplicates, setLoadingDuplicates] = useState(false)

  const [missingFiles, setMissingFiles] = useState<FileItem[]>([])
  const [loadingMissing, setLoadingMissing] = useState(false)
  const [selectedMissingFiles, setSelectedMissingFiles] = useState<Set<number>>(() => new Set())

  const selectedMissingCount = useMemo(() => selectedMissingFiles.size, [selectedMissingFiles])

  const findDuplicates = useCallback(async () => {
    setLoadingDuplicates(true)
    setDuplicates([])
    try {
      const response = await http.get('/api/v1/reports/duplicate-files')
      setDuplicates((response?.data || []) as FileItem[][])
    } catch (error) {
      console.error('查找重复文件失败：', error)
      message.error(t('errorLoadingData', { error: t('duplicateFinder') }))
    } finally {
      setLoadingDuplicates(false)
      checkActiveTasks().catch(() => {})
    }
  }, [checkActiveTasks, t])

  const findMissingFiles = useCallback(async () => {
    setLoadingMissing(true)
    setMissingFiles([])
    try {
      const response = await http.get('/api/v1/files', {
        params: { is_missing: true, per_page: 9999 }
      })
      setMissingFiles((response?.data?.files || []) as FileItem[])
    } catch (error) {
      console.error('查找缺失文件失败：', error)
      message.error(t('errorLoadingData', { error: t('missingFileCleanup') }))
    } finally {
      setLoadingMissing(false)
    }
  }, [t])

  const cleanupSelectedMissingFiles = () => {
    if (selectedMissingFiles.size === 0) {
      message.warning(t('pleaseSelectFileToRename'))
      return
    }

    Modal.confirm({
      title: t('deleteSelectedRecords'),
      content: `${t('deleteSelectedRecords')} (${selectedMissingFiles.size})`,
      okType: 'danger',
      okText: t('delete'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          const ids = Array.from(selectedMissingFiles)
          const response = await http.post('/api/v1/missing-file-cleanups', { file_ids: ids })
          message.success(response?.data?.message || t('successfullySaved'))
          setSelectedMissingFiles(new Set())
          await findMissingFiles()
        } catch (error) {
          console.error('清理缺失文件记录失败：', error)
          message.error((error as any)?.response?.data?.error || t('error'))
        } finally {
          checkActiveTasks().catch(() => {})
        }
      }
    })
  }

  useEffect(() => {
    findMissingFiles().catch(() => {})
  }, [findMissingFiles])

  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <BackupManager />

        <GlassSurface title={t('duplicateFinder')}>
          <Button type="primary" loading={loadingDuplicates} onClick={() => findDuplicates().catch(() => {})}>
            {loadingDuplicates ? t('scanning') : t('findDuplicates')}
          </Button>

          {loadingDuplicates ? (
            <div className="mt-4 flex justify-center">
              <Spin />
            </div>
          ) : duplicates.length ? (
            <List
              className="mt-4"
              bordered
              dataSource={duplicates}
              renderItem={(group, index) => (
                <List.Item key={`dup-${index}`}>
                  <div className="w-full">
                    <Typography.Title level={5} className="mb-3">
                      {t('duplicateFinder')} #{index + 1}
                    </Typography.Title>
                    <List
                      size="small"
                      dataSource={group}
                      renderItem={(file) => (
                        <List.Item key={`dup-file-${file.id}`}>
                          <Typography.Text code className="truncate block">
                            {file.file_path || `#${file.id}`}
                          </Typography.Text>
                        </List.Item>
                      )}
                    />
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Empty className="mt-4" description={t('noDuplicatesFound')} />
          )}
        </GlassSurface>

        <GlassSurface title={t('missingFileCleanup')}>
          <Space wrap className="mb-4">
            <Button type="primary" loading={loadingMissing} onClick={() => findMissingFiles().catch(() => {})}>
              {loadingMissing ? t('scanning') : t('findMissingFiles')}
            </Button>
            {missingFiles.length ? (
              <Button danger onClick={cleanupSelectedMissingFiles}>
                {t('deleteSelectedRecords')}
                {selectedMissingCount ? ` (${selectedMissingCount})` : ''}
              </Button>
            ) : null}
          </Space>

          {loadingMissing ? (
            <div className="flex justify-center py-8">
              <Spin />
            </div>
          ) : missingFiles.length ? (
            <List
              bordered
              dataSource={missingFiles}
              renderItem={(item) => {
                const checked = selectedMissingFiles.has(item.id)
                return (
                  <List.Item key={`missing-${item.id}`}>
                    <Checkbox
                      checked={checked}
                      onChange={(event) => {
                        setSelectedMissingFiles((prev) => {
                          const next = new Set(prev)
                          if (event.target.checked) {
                            next.add(item.id)
                          } else {
                            next.delete(item.id)
                          }
                          return next
                        })
                      }}
                    >
                      <span className="text-sm">{item.file_path || `#${item.id}`}</span>
                    </Checkbox>
                  </List.Item>
                )
              }}
            />
          ) : (
            <Empty description={t('noMissingFilesFound')} />
          )}
        </GlassSurface>
      </Space>
    </GlassPage>
  )
}

