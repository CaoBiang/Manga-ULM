import { Alert, Button, Descriptions, Divider, Form, Input, InputNumber, List, Progress, Select, Space, Spin, Switch, Typography, message } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import GlassSurface from '@/components/glass/ui/GlassSurface'
import { useLibraryStore } from '@/store/library'

type LibraryPath = {
  id: number
  path: string
}

type ScanHashMode = 'full' | 'off'
type ScanCoverMode = 'scan' | 'off'

const toInt = (value: unknown, fallback: number) => {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const toBool = (value: unknown, fallback: boolean) => {
  if (value === null || value === undefined || value === '') {
    return fallback
  }
  if (value === true || value === false) {
    return value
  }
  const raw = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) {
    return true
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) {
    return false
  }
  return fallback
}

export default function ScannerSettings() {
  const { t } = useTranslation()
  const libraryStore = useLibraryStore()

  const scanTasks = useMemo(() => libraryStore.activeTasks.filter((task) => task.task_type === 'scan'), [libraryStore.activeTasks])

  const currentScanDisplay = useMemo(() => {
    if (libraryStore.currentScanFile) {
      return libraryStore.currentScanFile
    }
    if (libraryStore.currentScanMessageKey) {
      return t(libraryStore.currentScanMessageKey)
    }
    return ''
  }, [libraryStore.currentScanFile, libraryStore.currentScanMessageKey, t])

  const progressStatus = useMemo(() => {
    switch (libraryStore.scanStatus) {
      case 'scanning':
      case 'pending':
        return 'active'
      case 'finished':
        return 'success'
      case 'error':
        return 'exception'
      default:
        return 'normal'
    }
  }, [libraryStore.scanStatus])

  const getStatusText = () => {
    switch (libraryStore.scanStatus) {
      case 'scanning':
        return t('scanning')
      case 'finished':
        return t('scanFinished')
      case 'error':
        return t('scanError')
      case 'pending':
        return t('scanPending')
      default:
        return t('idle')
    }
  }

  const getTaskStatusText = (status: string) => {
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

  const getScanErrorMessage = (error: { message?: string | null; messageKey?: string | null }) =>
    error.message || (error.messageKey ? t(error.messageKey) : '')

  const [libraryPaths, setLibraryPaths] = useState<LibraryPath[]>([])
  const [newPath, setNewPath] = useState('')

  const [maxWorkers, setMaxWorkers] = useState(12)
  const [cancelCheckIntervalMs, setCancelCheckIntervalMs] = useState(200)
  const [hashMode, setHashMode] = useState<ScanHashMode>('full')
  const [coverMode, setCoverMode] = useState<ScanCoverMode>('scan')
  const [coverRegenerateMissing, setCoverRegenerateMissing] = useState(true)
  const [coverShardCount, setCoverShardCount] = useState(256)
  const [coverMaxWidth, setCoverMaxWidth] = useState(500)
  const [coverTargetKb, setCoverTargetKb] = useState(300)
  const [coverQualityStart, setCoverQualityStart] = useState(80)
  const [coverQualityMin, setCoverQualityMin] = useState(10)
  const [coverQualityStep, setCoverQualityStep] = useState(10)

  const [statusMessage, setStatusMessage] = useState('')
  const [statusIsError, setStatusIsError] = useState(false)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showStatus = (msg: string, error = false) => {
    setStatusMessage(msg)
    setStatusIsError(error)
    const handler = error ? message.error : message.success
    handler(msg)

    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current)
    }
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage('')
    }, 3000)
  }

  const fetchLibraryPaths = useCallback(async () => {
    try {
      const response = await http.get('/api/v1/library-paths')
      setLibraryPaths((response?.data || []) as LibraryPath[])
    } catch (error) {
      console.error('加载图书馆路径失败：', error)
      showStatus(t('failedToFetchLibraryPaths'), true)
    }
  }, [t])

  const fetchSettings = useCallback(async () => {
    try {
      const response = await http.get('/api/v1/settings')
      const settings = (response?.data || {}) as Record<string, unknown>

      setMaxWorkers(toInt(settings['scan.max_workers'], 12))
      setCancelCheckIntervalMs(toInt(settings['scan.cancel_check.interval_ms'], 200))
      const rawHashMode = String(settings['scan.hash.mode'] || '').trim().toLowerCase()
      setHashMode(rawHashMode === 'off' ? 'off' : 'full')
      const rawCoverMode = String(settings['scan.cover.mode'] || '').trim().toLowerCase()
      setCoverMode(rawCoverMode === 'off' ? 'off' : 'scan')
      setCoverRegenerateMissing(toBool(settings['scan.cover.regenerate_missing'], true))
      setCoverShardCount(toInt(settings['cover.cache.shard_count'], 256))
      setCoverMaxWidth(toInt(settings['scan.cover.max_width'], 500))
      setCoverTargetKb(toInt(settings['scan.cover.target_kb'], 300))
      setCoverQualityStart(toInt(settings['scan.cover.quality_start'], 80))
      setCoverQualityMin(toInt(settings['scan.cover.quality_min'], 10))
      setCoverQualityStep(toInt(settings['scan.cover.quality_step'], 10))
    } catch (error) {
      console.error('加载扫描设置失败：', error)
      showStatus(t('failedToFetchSettings'), true)
    }
  }, [t])

  const saveSetting = async (key: string, value: unknown) => {
    try {
      await http.put(`/api/v1/settings/${key}`, { value })
      showStatus(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error(`保存设置失败：${key}`, error)
      showStatus(t('failedToSaveSettings'), true)
    }
  }

  const addPath = async () => {
    if (!newPath.trim()) {
      message.warning(t('pleaseEnterPath'))
      return
    }
    try {
      await http.post('/api/v1/library-paths', { path: newPath })
      setNewPath('')
      await fetchLibraryPaths()
      showStatus(t('pathAddedSuccessfully'))
    } catch (error) {
      console.error('新增路径失败：', error)
      showStatus((error as any)?.response?.data?.error || t('failedToAddPath'), true)
    }
  }

  const deletePath = async (id: number) => {
    if (!window.confirm(t('confirmRemovePath'))) {
      return
    }
    try {
      await http.delete(`/api/v1/library-paths/${id}`)
      await fetchLibraryPaths()
      showStatus(t('pathRemovedSuccessfully'))
    } catch (error) {
      console.error('删除路径失败：', error)
      showStatus((error as any)?.response?.data?.error || t('failedToRemovePath'), true)
    }
  }

  const startScan = async (item: LibraryPath) => {
    try {
      await libraryStore.startScan(item.id)
      showStatus(t('scanStartedFor', { path: item.path }))
    } catch (error) {
      console.error('启动扫描失败：', error)
      showStatus((error as any)?.response?.data?.error || t('failedToStartScan'), true)
    }
  }

  const scanAll = async () => {
    try {
      await libraryStore.startScanAll()
      showStatus(t('scanStartedForAll'))
    } catch (error) {
      console.error('启动全库扫描失败：', error)
      showStatus((error as any)?.response?.data?.error || t('failedToStartScanAll'), true)
    }
  }

  useEffect(() => {
    fetchLibraryPaths().catch(() => {})
    fetchSettings().catch(() => {})
    libraryStore.checkActiveTasks().catch(() => {})

    return () => {
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current)
        statusTimerRef.current = null
      }
    }
  }, [fetchLibraryPaths, fetchSettings])

  return (
    <Space direction="vertical" size="large" className="w-full">
      {libraryStore.scanStatus !== 'idle' ? (
        <GlassSurface title={t('scanStatus')}>
          <Space direction="vertical" size="middle" className="w-full">
            <div className="flex justify-between items-center">
              <Typography.Text strong>{getStatusText()}</Typography.Text>
              <Typography.Text type="secondary">{Math.round(libraryStore.scanProgress)}%</Typography.Text>
            </div>
            <Progress percent={Math.round(libraryStore.scanProgress)} status={progressStatus as any} />

            {currentScanDisplay ? (
              <Descriptions size="small" column={1}>
                <Descriptions.Item label={t('currentFile')}>
                  <Typography.Text code>{currentScanDisplay}</Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            ) : null}

            {scanTasks.length ? (
              <div>
                <Typography.Text type="secondary">{t('activeTasks')}</Typography.Text>
                <List
                  dataSource={scanTasks}
                  itemLayout="vertical"
                  renderItem={(item) => (
                    <List.Item key={`scan-task-${item.id}`}>
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <Typography.Text strong>{item.name}</Typography.Text>
                            <div className="text-xs text-gray-500">
                              {t('status')}: {getTaskStatusText(item.status)}
                              {item.total_files > 0 ? ` (${item.processed_files || 0}/${item.total_files})` : ''}
                            </div>
                          </div>
                          {item.is_active ? (
                            <Button
                              danger
                              size="small"
                              onClick={() => libraryStore.cancelTask(item.id).then(() => showStatus(t('taskCancelled'))).catch(() => showStatus(t('failedToCancelTask'), true))}
                            >
                              {t('cancel')}
                            </Button>
                          ) : null}
                        </div>
                        {item.current_file || currentScanDisplay ? (
                          <Typography.Text code>{item.current_file || currentScanDisplay}</Typography.Text>
                        ) : null}
                      </div>
                    </List.Item>
                  )}
                />
              </div>
            ) : null}

            <Space>
              <Button size="small" onClick={() => libraryStore.clearErrors()}>
                {t('clearErrors')}
              </Button>
              <Button type="primary" size="small" onClick={() => libraryStore.checkActiveTasks().catch(() => {})}>
                {t('refreshStatus')}
              </Button>
            </Space>
          </Space>
        </GlassSurface>
      ) : null}

      {libraryStore.scanErrors.length ? (
        <GlassSurface title={t('scanErrors')}>
          <List
            dataSource={libraryStore.scanErrors}
            itemLayout="vertical"
            className="max-h-56 overflow-y-auto"
            renderItem={(item) => (
              <List.Item key={`scan-error-${item.timestamp}`}>
                <List.Item.Meta
                  description={new Date(item.timestamp).toLocaleString()}
                  title={<Typography.Text type="danger">{getScanErrorMessage(item)}</Typography.Text>}
                />
              </List.Item>
            )}
          />
        </GlassSurface>
      ) : null}

      <GlassSurface title={t('mangaLibraryFolders')}>
        <List
          dataSource={libraryPaths}
          itemLayout="horizontal"
          locale={{ emptyText: t('noLibraryPath') }}
          renderItem={(item) => (
            <List.Item key={`library-path-${item.id}`}>
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <Typography.Text className="flex-1 truncate" title={item.path}>
                  {item.path}
                </Typography.Text>
                <Space size="small">
                  <Button
                    type="primary"
                    size="small"
                    disabled={libraryStore.hasActiveScanTasks}
                    onClick={() => startScan(item).catch(() => {})}
                  >
                    {libraryStore.hasActiveScanTasks ? t('scanning') : t('scan')}
                  </Button>
                  <Button danger size="small" onClick={() => deletePath(item.id).catch(() => {})}>
                    {t('delete')}
                  </Button>
                </Space>
              </div>
            </List.Item>
          )}
        />

        <Divider />

        <Form layout="vertical">
          <Form.Item label={t('addNewFolder')}>
            <Input.Search
              value={newPath}
              placeholder={t('pathPlaceholder')}
              allowClear
              enterButton={t('add')}
              onChange={(event) => setNewPath(event.target.value)}
              onSearch={() => addPath().catch(() => {})}
            />
          </Form.Item>
        </Form>

        <Button
          type="primary"
          block
          disabled={libraryStore.hasActiveScanTasks}
          loading={libraryStore.hasActiveScanTasks}
          onClick={() => scanAll().catch(() => {})}
        >
          {libraryStore.hasActiveScanTasks ? t('scanning') : t('scanAll')}
        </Button>
      </GlassSurface>

      <GlassSurface title={t('advancedSettings')}>
        <Form layout="vertical">
          <Form.Item label={t('maxParallelScanProcesses')}>
            <InputNumber
              min={1}
              max={128}
              style={{ width: 160 }}
              value={maxWorkers}
              onChange={(value) => {
                const next = Number(value ?? 0)
                setMaxWorkers(next)
                saveSetting('scan.max_workers', next).catch(() => {})
              }}
            />
          </Form.Item>
          <Typography.Text type="secondary">{t('maxParallelScanProcessesHelp')}</Typography.Text>

          <Divider className="!my-4" />

          <Form.Item label={t('scanCancelCheckInterval')}>
            <InputNumber
              min={50}
              max={5000}
              step={50}
              addonAfter="ms"
              style={{ width: 220 }}
              value={cancelCheckIntervalMs}
              onChange={(value) => {
                const next = Number(value ?? 0)
                setCancelCheckIntervalMs(next)
                saveSetting('scan.cancel_check.interval_ms', next).catch(() => {})
              }}
            />
            <div className="mt-1 text-xs text-gray-500">{t('scanCancelCheckIntervalHelp')}</div>
          </Form.Item>

          <Divider className="!my-4" />

          <Form.Item label={t('scanHashMode')}>
            <Select
              style={{ width: 220 }}
              value={hashMode}
              onChange={(value) => {
                const next = value === 'off' ? 'off' : 'full'
                setHashMode(next)
                saveSetting('scan.hash.mode', next).catch(() => {})
              }}
              options={[
                { value: 'full', label: t('scanHashModeFull') },
                { value: 'off', label: t('scanHashModeOff') }
              ]}
            />
            <div className="mt-1 text-xs text-gray-500">{t('scanHashModeHelp')}</div>
          </Form.Item>

          <Divider className="!my-4" />

          <Form.Item label={t('scanCoverMode')}>
            <Select
              style={{ width: 220 }}
              value={coverMode}
              onChange={(value) => {
                const next = value === 'off' ? 'off' : 'scan'
                setCoverMode(next)
                saveSetting('scan.cover.mode', next).catch(() => {})
              }}
              options={[
                { value: 'scan', label: t('scanCoverModeScan') },
                { value: 'off', label: t('scanCoverModeOff') }
              ]}
            />
            <div className="mt-1 text-xs text-gray-500">{t('scanCoverModeHelp')}</div>
          </Form.Item>

          <Form.Item label={t('scanCoverRegenerateMissing')}>
            <Switch
              checked={coverRegenerateMissing}
              onChange={(value) => {
                setCoverRegenerateMissing(value)
                saveSetting('scan.cover.regenerate_missing', value ? 1 : 0).catch(() => {})
              }}
            />
            <div className="mt-1 text-xs text-gray-500">{t('scanCoverRegenerateMissingHelp')}</div>
          </Form.Item>

          <Form.Item label={t('coverCacheShardCount')}>
            <InputNumber
              min={1}
              max={4096}
              style={{ width: 220 }}
              value={coverShardCount}
              onChange={(value) => {
                const next = Number(value ?? 0)
                setCoverShardCount(next)
                saveSetting('cover.cache.shard_count', next).catch(() => {})
              }}
            />
            <div className="mt-1 text-xs text-gray-500">{t('coverCacheShardCountHelp')}</div>
          </Form.Item>

          <Divider className="!my-4" />

          <Typography.Title level={5} className="!mb-2">
            {t('scanCoverSettings')}
          </Typography.Title>

          <div className="grid gap-4 md:grid-cols-2">
            <Form.Item label={t('scanCoverMaxWidth')}>
              <InputNumber
                min={64}
                max={4000}
                step={10}
                addonAfter="px"
                style={{ width: 220 }}
                value={coverMaxWidth}
                onChange={(value) => {
                  const next = Number(value ?? 0)
                  setCoverMaxWidth(next)
                  saveSetting('scan.cover.max_width', next).catch(() => {})
                }}
              />
            </Form.Item>

            <Form.Item label={t('scanCoverTargetKb')}>
              <InputNumber
                min={50}
                max={5000}
                step={50}
                addonAfter="KB"
                style={{ width: 220 }}
                value={coverTargetKb}
                onChange={(value) => {
                  const next = Number(value ?? 0)
                  setCoverTargetKb(next)
                  saveSetting('scan.cover.target_kb', next).catch(() => {})
                }}
              />
            </Form.Item>

            <Form.Item label={t('scanCoverQualityStart')}>
              <InputNumber
                min={1}
                max={100}
                step={1}
                style={{ width: 220 }}
                value={coverQualityStart}
                onChange={(value) => {
                  const next = Number(value ?? 0)
                  setCoverQualityStart(next)
                  saveSetting('scan.cover.quality_start', next).catch(() => {})
                }}
              />
            </Form.Item>

            <Form.Item label={t('scanCoverQualityMin')}>
              <InputNumber
                min={1}
                max={100}
                step={1}
                style={{ width: 220 }}
                value={coverQualityMin}
                onChange={(value) => {
                  const next = Number(value ?? 0)
                  setCoverQualityMin(next)
                  saveSetting('scan.cover.quality_min', next).catch(() => {})
                }}
              />
            </Form.Item>

            <Form.Item label={t('scanCoverQualityStep')}>
              <InputNumber
                min={1}
                max={50}
                step={1}
                style={{ width: 220 }}
                value={coverQualityStep}
                onChange={(value) => {
                  const next = Number(value ?? 0)
                  setCoverQualityStep(next)
                  saveSetting('scan.cover.quality_step', next).catch(() => {})
                }}
              />
            </Form.Item>
          </div>

          <Typography.Text type="secondary">{t('scanCoverSettingsHelp')}</Typography.Text>
        </Form>
      </GlassSurface>

      {statusMessage ? <Alert showIcon type={statusIsError ? 'error' : 'success'} message={statusMessage} /> : null}
    </Space>
  )
}
