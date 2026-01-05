import { Alert, Button, Form, InputNumber, Popconfirm, Space, Switch, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import { useAppSettingsStore } from '@/store/appSettings'
import { useLibraryStore } from '@/store/library'

export default function TaskSettings() {
  const { t } = useTranslation()

  const tasksHistoryLimit = useAppSettingsStore((state) => state.tasksHistoryLimit)
  const tasksHistoryRetentionDays = useAppSettingsStore((state) => state.tasksHistoryRetentionDays)
  const tasksNotifyOnComplete = useAppSettingsStore((state) => state.tasksNotifyOnComplete)
  const tasksNotifyOnFail = useAppSettingsStore((state) => state.tasksNotifyOnFail)
  const tasksBadgeEnabled = useAppSettingsStore((state) => state.tasksBadgeEnabled)

  const setTasksHistoryLimit = useAppSettingsStore((state) => state.setTasksHistoryLimit)
  const setTasksHistoryRetentionDays = useAppSettingsStore((state) => state.setTasksHistoryRetentionDays)
  const setTasksNotifyOnComplete = useAppSettingsStore((state) => state.setTasksNotifyOnComplete)
  const setTasksNotifyOnFail = useAppSettingsStore((state) => state.setTasksNotifyOnFail)
  const setTasksBadgeEnabled = useAppSettingsStore((state) => state.setTasksBadgeEnabled)

  const checkActiveTasks = useLibraryStore((state) => state.checkActiveTasks)

  const [historyLimitInput, setHistoryLimitInput] = useState(tasksHistoryLimit)
  const [retentionDaysInput, setRetentionDaysInput] = useState(tasksHistoryRetentionDays)
  const [cleaning, setCleaning] = useState(false)

  useEffect(() => {
    setHistoryLimitInput(tasksHistoryLimit)
  }, [tasksHistoryLimit])

  useEffect(() => {
    setRetentionDaysInput(tasksHistoryRetentionDays)
  }, [tasksHistoryRetentionDays])

  const saveHistoryLimit = async () => {
    await setTasksHistoryLimit(historyLimitInput)
    await checkActiveTasks()
  }

  const saveRetentionDays = async () => {
    await setTasksHistoryRetentionDays(retentionDaysInput)
  }

  const cleanupHistory = async () => {
    setCleaning(true)
    try {
      const response = await http.delete('/api/v1/task-history', {
        data: { days: tasksHistoryRetentionDays }
      })
      message.success(response?.data?.message || t('cleanupHistorySuccess'))
      await checkActiveTasks()
    } catch (error) {
      console.error('清理历史任务失败：', error)
      message.error((error as any)?.response?.data?.error || t('cleanupHistoryFailed'))
    } finally {
      setCleaning(false)
    }
  }

  return (
    <Space direction="vertical" size="middle" className="w-full">
      <Alert message={t('taskSettingsHelp')} type="info" showIcon />

      <Form layout="vertical">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item label={t('taskHistoryLimit')} help={t('taskHistoryLimitHelp')}>
            <InputNumber
              min={10}
              max={500}
              step={10}
              style={{ width: '100%' }}
              value={historyLimitInput}
              onChange={(value) => setHistoryLimitInput(Number(value ?? 0))}
              onBlur={() => saveHistoryLimit().catch(() => {})}
            />
          </Form.Item>

          <Form.Item label={t('taskHistoryRetentionDays')} help={t('taskHistoryRetentionDaysHelp')}>
            <InputNumber
              min={0}
              max={3650}
              step={1}
              style={{ width: '100%' }}
              value={retentionDaysInput}
              onChange={(value) => setRetentionDaysInput(Number(value ?? 0))}
              onBlur={() => saveRetentionDays().catch(() => {})}
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item label={t('taskNotifyOnComplete')} help={t('taskNotifyOnCompleteHelp')}>
            <Switch checked={tasksNotifyOnComplete} onChange={(value) => setTasksNotifyOnComplete(value).catch(() => {})} />
          </Form.Item>

          <Form.Item label={t('taskNotifyOnFail')} help={t('taskNotifyOnFailHelp')}>
            <Switch checked={tasksNotifyOnFail} onChange={(value) => setTasksNotifyOnFail(value).catch(() => {})} />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item label={t('taskBadgeEnabled')} help={t('taskBadgeEnabledHelp')}>
            <Switch checked={tasksBadgeEnabled} onChange={(value) => setTasksBadgeEnabled(value).catch(() => {})} />
          </Form.Item>

          <Form.Item label={t('taskHistoryCleanup')} help={t('taskHistoryCleanupHelp')}>
            <Popconfirm
              title={t('confirmCleanupTasks', { days: tasksHistoryRetentionDays })}
              okText={t('confirm')}
              cancelText={t('cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={() => cleanupHistory().catch(() => {})}
            >
              <Button danger loading={cleaning}>
                {t('cleanupHistory')}
              </Button>
            </Popconfirm>
          </Form.Item>
        </div>
      </Form>
    </Space>
  )
}

