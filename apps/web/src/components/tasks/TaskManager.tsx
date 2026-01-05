import { Alert, Button, Card, Descriptions, Empty, Progress, Space, Tabs, Tag, Typography } from 'antd'
import type { TabsProps } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLibraryStore } from '@/store/library'

const getStatusMeta = (status: string) => {
  switch (status) {
    case 'pending':
      return { tagColor: 'gold' as const, progressStatus: 'active' as const, strokeColor: '#faad14' }
    case 'running':
      return { tagColor: 'blue' as const, progressStatus: 'active' as const, strokeColor: '#1677ff' }
    case 'completed':
      return { tagColor: 'green' as const, progressStatus: 'success' as const, strokeColor: '#52c41a' }
    case 'failed':
      return { tagColor: 'red' as const, progressStatus: 'exception' as const, strokeColor: '#ff4d4f' }
    case 'cancelled':
      return { tagColor: 'default' as const, progressStatus: 'normal' as const, strokeColor: '#bfbfbf' }
    default:
      return { tagColor: 'blue' as const, progressStatus: 'normal' as const, strokeColor: '#1677ff' }
  }
}

const formatTime = (timestamp: string | null | undefined) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString()
}

export default function TaskManager() {
  const { t } = useTranslation()

  const activeTasks = useLibraryStore((state) => state.activeTasks)
  const historyTasks = useLibraryStore((state) => state.historyTasks)
  const unseenHistoryCount = useLibraryStore((state) => state.unseenHistoryCount)
  const checkActiveTasks = useLibraryStore((state) => state.checkActiveTasks)
  const cancelTaskInStore = useLibraryStore((state) => state.cancelTask)
  const markHistorySeen = useLibraryStore((state) => state.markHistoryTasksSeen)

  const [loading, setLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active')

  const refreshTasks = async () => {
    try {
      setLoading(true)
      setErrorMessage('')
      await checkActiveTasks()
    } catch (error) {
      console.error('刷新任务失败：', error)
      setErrorMessage(t('failedToFetchTasks'))
    } finally {
      setLoading(false)
    }
  }

  const cancelTask = async (taskId: number) => {
    if (!window.confirm(t('confirmCancelTask'))) {
      return
    }
    try {
      setCancellingId(taskId)
      await cancelTaskInStore(taskId)
      await refreshTasks()
    } catch (error) {
      console.error('取消任务失败：', error)
      setErrorMessage(t('failedToCancelTask'))
    } finally {
      setCancellingId(null)
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return t('pending')
      case 'running':
        return t('running')
      case 'completed':
        return t('completed')
      case 'failed':
        return t('failed')
      case 'cancelled':
        return t('cancelled')
      default:
        return status
    }
  }

  const getTaskTypeText = (taskType: string) => {
    switch (taskType) {
      case 'scan':
        return t('scanTask')
      case 'rename':
        return t('renameTask')
      case 'backup':
        return t('backupTask')
      case 'duplicates':
        return t('duplicatesTask')
      case 'missing_cleanup':
        return t('missingCleanupTask')
      case 'integrity':
        return t('integrityTask')
      case 'tag_scan':
        return t('tagScanTask')
      case 'merge':
      case 'tag_merge':
        return t('mergeTask')
      case 'bulk_tags':
        return t('bulkTagsTask')
      case 'split':
      case 'tag_split':
        return t('splitTask')
      case 'delete':
      case 'tag_file_delete':
        return t('deleteTask')
      default:
        return taskType
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}${t('secondsShort')}`
    }
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60)
      const secs = Math.round(seconds % 60)
      return `${minutes}${t('minutesShort')} ${secs}${t('secondsShort')}`
    }
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}${t('hoursShort')} ${minutes}${t('minutesShort')}`
  }

  useEffect(() => {
    refreshTasks().catch(() => {})
  }, [])

  useEffect(() => {
    if (activeTab === 'history') {
      markHistorySeen()
    }
  }, [activeTab, markHistorySeen])

  useEffect(() => {
    if (activeTasks.length === 0 && unseenHistoryCount > 0) {
      setActiveTab('history')
    }
  }, [activeTasks.length, unseenHistoryCount])

  const tabs: TabsProps['items'] = [
    {
      key: 'active',
      label: `${t('activeTasks')} (${activeTasks.length})`,
      children: activeTasks.length ? (
        <Space direction="vertical" size="middle" className="w-full">
          {activeTasks.map((task) => {
            const meta = getStatusMeta(task.status)
            return (
              <Card
                key={task.id}
                size="small"
                title={task.name}
                extra={
                  <Space size="small" align="center">
                    <Tag color={meta.tagColor}>{getStatusText(task.status)}</Tag>
                    <Typography.Text type="secondary">{getTaskTypeText(task.task_type)}</Typography.Text>
                    {task.created_at ? <Typography.Text type="secondary">{formatTime(task.created_at)}</Typography.Text> : null}
                    {task.is_active ? (
                      <Button danger size="small" loading={cancellingId === task.id} onClick={() => cancelTask(task.id).catch(() => {})}>
                        {cancellingId === task.id ? t('cancelling') : t('cancel')}
                      </Button>
                    ) : null}
                  </Space>
                }
              >
                <Space direction="vertical" size="small" className="w-full">
                  {task.progress !== null && task.progress !== undefined ? (
                    <div>
                      <div className="flex justify-between text-sm text-gray-500 mb-1">
                        <span>{t('progress')}</span>
                        <span>{Math.round(Number(task.progress))}%</span>
                      </div>
                      <Progress
                        percent={Math.round(Number(task.progress))}
                        status={meta.progressStatus as any}
                        strokeColor={meta.strokeColor}
                        showInfo={false}
                      />
                    </div>
                  ) : null}

                  {task.total_files > 0 ? (
                    <Descriptions size="small" column={1} className="bg-gray-50 rounded-md p-2">
                      <Descriptions.Item label={t('filesProcessed')}>
                        {task.processed_files || 0} / {task.total_files}
                      </Descriptions.Item>
                    </Descriptions>
                  ) : null}

                  {task.current_file ? (
                    <Typography.Paragraph code className="!mb-0">
                      {task.current_file}
                    </Typography.Paragraph>
                  ) : null}

                  {task.target_path ? (
                    <Typography.Paragraph className="!mb-0 text-gray-600">
                      <strong>{t('targetPath')}:</strong> {task.target_path}
                    </Typography.Paragraph>
                  ) : null}

                  {task.error_message ? <Alert type="error" showIcon message={t('error')} description={task.error_message} /> : null}

                  {task.duration && task.duration > 0 ? (
                    <Typography.Text type="secondary">
                      {t('duration')}: {formatDuration(task.duration)}
                    </Typography.Text>
                  ) : null}
                </Space>
              </Card>
            )
          })}
        </Space>
      ) : (
        <Empty
          description={
            <div className="text-center">
              <p className="font-medium text-gray-700">{t('noActiveTasks')}</p>
              <p className="text-sm text-gray-500">{t('noActiveTasksDescription')}</p>
            </div>
          }
        />
      )
    },
    {
      key: 'history',
      label: `${t('historyTasks')} (${historyTasks.length})`,
      children: historyTasks.length ? (
        <Space direction="vertical" size="middle" className="w-full">
          {historyTasks.map((task) => {
            const meta = getStatusMeta(task.status)
            return (
              <Card
                key={task.id}
                size="small"
                title={task.name}
                extra={
                  <Space size="small" align="center">
                    <Tag color={meta.tagColor}>{getStatusText(task.status)}</Tag>
                    <Typography.Text type="secondary">{getTaskTypeText(task.task_type)}</Typography.Text>
                    {task.finished_at ? <Typography.Text type="secondary">{formatTime(task.finished_at)}</Typography.Text> : null}
                  </Space>
                }
              >
                <Space direction="vertical" size="small" className="w-full">
                  {task.progress !== null && task.progress !== undefined ? (
                    <div>
                      <div className="flex justify-between text-sm text-gray-500 mb-1">
                        <span>{t('progress')}</span>
                        <span>{Math.round(Number(task.progress))}%</span>
                      </div>
                      <Progress
                        percent={Math.round(Number(task.progress))}
                        status={meta.progressStatus as any}
                        strokeColor={meta.strokeColor}
                        showInfo={false}
                      />
                    </div>
                  ) : null}

                  {task.total_files > 0 ? (
                    <Descriptions size="small" column={1} className="bg-gray-50 rounded-md p-2">
                      <Descriptions.Item label={t('filesProcessed')}>
                        {task.processed_files || 0} / {task.total_files}
                      </Descriptions.Item>
                    </Descriptions>
                  ) : null}

                  {task.current_file ? (
                    <Typography.Paragraph code className="!mb-0">
                      {task.current_file}
                    </Typography.Paragraph>
                  ) : null}

                  {task.target_path ? (
                    <Typography.Paragraph className="!mb-0 text-gray-600">
                      <strong>{t('targetPath')}:</strong> {task.target_path}
                    </Typography.Paragraph>
                  ) : null}

                  {task.error_message ? <Alert type="error" showIcon message={t('error')} description={task.error_message} /> : null}

                  {task.duration && task.duration > 0 ? (
                    <Typography.Text type="secondary">
                      {t('duration')}: {formatDuration(task.duration)}
                    </Typography.Text>
                  ) : null}
                </Space>
              </Card>
            )
          })}
        </Space>
      ) : (
        <Empty
          description={
            <div className="text-center">
              <p className="font-medium text-gray-700">{t('noHistoryTasks')}</p>
              <p className="text-sm text-gray-500">{t('noHistoryTasksDescription')}</p>
            </div>
          }
        />
      )
    }
  ]

  return (
    <Card bodyStyle={{ padding: 20 }} className="shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <Typography.Title level={4} className="!mb-0">
          {t('taskManager')}
        </Typography.Title>
        <Button type="primary" size="small" loading={loading} onClick={() => refreshTasks().catch(() => {})}>
          {t('refresh')}
        </Button>
      </div>

      {unseenHistoryCount > 0 ? (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message={t('taskResultsUnseen', { count: unseenHistoryCount })}
          action={
            <Space>
              <Button size="small" onClick={() => setActiveTab('history')}>
                {t('viewHistory')}
              </Button>
              <Button size="small" type="text" onClick={() => markHistorySeen()}>
                {t('markAsRead')}
              </Button>
            </Space>
          }
        />
      ) : null}

      <Tabs activeKey={activeTab} items={tabs} onChange={(key) => setActiveTab(key as any)} />

      {errorMessage ? (
        <Alert className="mt-4" type="error" showIcon message={errorMessage} />
      ) : null}
    </Card>
  )
}
