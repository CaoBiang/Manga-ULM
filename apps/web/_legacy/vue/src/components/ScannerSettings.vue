<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-card
      v-if="libraryStore.scanStatus !== 'idle'"
      :title="$t('scanStatus')"
      type="inner"
      class="shadow-sm"
    >
      <a-space direction="vertical" size="middle" class="w-full">
        <div class="flex justify-between items-center">
          <a-typography-text strong>{{ getStatusText() }}</a-typography-text>
          <a-typography-text type="secondary">
            {{ Math.round(libraryStore.scanProgress) }}%
          </a-typography-text>
        </div>
        <a-progress
          :percent="Math.round(libraryStore.scanProgress)"
          :status="progressStatus"
        />

        <a-descriptions v-if="currentScanDisplay" size="small" :column="1">
          <a-descriptions-item :label="$t('currentFile')">
            <a-typography-text code>{{ currentScanDisplay }}</a-typography-text>
          </a-descriptions-item>
        </a-descriptions>

        <div v-if="scanTasks.length">
          <a-typography-text type="secondary">{{ $t('activeTasks') }}</a-typography-text>
          <a-list :data-source="scanTasks" item-layout="vertical">
            <template #renderItem="{ item }">
              <a-list-item>
                <div class="flex flex-col gap-2 w-full">
                  <div class="flex flex-wrap justify-between gap-2">
                    <div>
                      <a-typography-text strong>{{ item.name }}</a-typography-text>
                      <div class="text-xs text-gray-500">
                        {{ $t('status') }}:
                        {{ getTaskStatusText(item.status) }}
                        <span v-if="item.total_files > 0">
                          ({{ item.processed_files || 0 }}/{{ item.total_files }})
                        </span>
                      </div>
                    </div>
                    <a-button
                      v-if="item.is_active"
                      type="primary"
                      danger
                      size="small"
                      @click="cancelTask(item.id)"
                    >
                      {{ $t('cancel') }}
                    </a-button>
                  </div>
                  <a-typography-text v-if="item.current_file || currentScanDisplay" code>
                    {{ item.current_file || currentScanDisplay }}
                  </a-typography-text>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </div>

        <a-space>
          <a-button size="small" @click="libraryStore.clearErrors()">
            {{ $t('clearErrors') }}
          </a-button>
          <a-button type="primary" size="small" @click="libraryStore.checkActiveTasks()">
            {{ $t('refreshStatus') }}
          </a-button>
        </a-space>
      </a-space>
    </a-card>

    <a-card
      v-if="libraryStore.scanErrors.length > 0"
      :title="$t('scanErrors')"
      type="inner"
      class="shadow-sm"
    >
      <a-list
        :data-source="libraryStore.scanErrors"
        item-layout="vertical"
        class="max-h-56 overflow-y-auto"
      >
        <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta :description="formatTime(item.timestamp)">
                <template #title>
                  <a-typography-text type="danger">{{ getScanErrorMessage(item) }}</a-typography-text>
                </template>
              </a-list-item-meta>
            </a-list-item>
        </template>
      </a-list>
    </a-card>

    <a-card :title="$t('mangaLibraryFolders')" class="shadow-sm">
      <a-list
        :data-source="libraryPaths"
        item-layout="horizontal"
        :locale="{ emptyText: $t('noLibraryPath') }"
      >
        <template #renderItem="{ item }">
          <a-list-item>
            <div class="flex w-full flex-wrap items-center justify-between gap-3">
              <a-typography-text class="flex-1 truncate" :title="item.path">
                {{ item.path }}
              </a-typography-text>
              <a-space size="small">
                <a-button
                  type="primary"
                  size="small"
                  :disabled="libraryStore.hasActiveScanTasks"
                  @click="startScan(item)"
                >
                  {{ libraryStore.hasActiveScanTasks ? $t('scanning') : $t('scan') }}
                </a-button>
                <a-button danger size="small" @click="deletePath(item.id)">
                  {{ $t('delete') }}
                </a-button>
              </a-space>
            </div>
          </a-list-item>
        </template>
      </a-list>

      <a-divider />

      <a-form layout="vertical" @submit.prevent>
        <a-form-item :label="$t('addNewFolder')">
          <a-input-search
            v-model:value="newPath"
            :placeholder="$t('pathPlaceholder')"
            allow-clear
            :enter-button="$t('add')"
            @search="addPath"
          />
        </a-form-item>
      </a-form>

      <a-button
        type="primary"
        block
        :disabled="libraryStore.hasActiveScanTasks"
        :loading="libraryStore.hasActiveScanTasks"
        @click="scanAll"
      >
        {{ libraryStore.hasActiveScanTasks ? $t('scanning') : $t('scanAll') }}
      </a-button>
    </a-card>

    <a-card :title="$t('advancedSettings')" class="shadow-sm">
      <a-form layout="vertical">
        <a-form-item :label="$t('maxParallelScanProcesses')">
          <a-input-number
            v-model:value="maxWorkers"
            :min="1"
            :max="128"
            style="width: 160px"
            @change="() => saveSetting('scan.max_workers', maxWorkers)"
          />
        </a-form-item>
        <a-typography-text type="secondary">
          {{ $t('maxParallelScanProcessesHelp') }}
        </a-typography-text>

        <a-divider class="!my-4" />

        <a-form-item :label="$t('scanCancelCheckInterval')">
          <a-input-number
            v-model:value="cancelCheckIntervalMs"
            :min="50"
            :max="5000"
            :step="50"
            addon-after="ms"
            style="width: 220px"
            @change="() => saveSetting('scan.cancel_check.interval_ms', cancelCheckIntervalMs)"
          />
          <div class="mt-1 text-xs text-gray-500">
            {{ $t('scanCancelCheckIntervalHelp') }}
          </div>
        </a-form-item>

        <a-divider class="!my-4" />

        <a-form-item :label="$t('scanHashMode')">
          <a-select
            v-model:value="hashMode"
            style="width: 220px"
            @change="() => saveSetting('scan.hash.mode', hashMode)"
          >
            <a-select-option value="full">{{ $t('scanHashModeFull') }}</a-select-option>
            <a-select-option value="off">{{ $t('scanHashModeOff') }}</a-select-option>
          </a-select>
          <div class="mt-1 text-xs text-gray-500">
            {{ $t('scanHashModeHelp') }}
          </div>
        </a-form-item>

        <a-divider class="!my-4" />

        <a-form-item :label="$t('scanCoverMode')">
          <a-select
            v-model:value="coverMode"
            style="width: 220px"
            @change="() => saveSetting('scan.cover.mode', coverMode)"
          >
            <a-select-option value="scan">{{ $t('scanCoverModeScan') }}</a-select-option>
            <a-select-option value="off">{{ $t('scanCoverModeOff') }}</a-select-option>
          </a-select>
          <div class="mt-1 text-xs text-gray-500">
            {{ $t('scanCoverModeHelp') }}
          </div>
        </a-form-item>

        <a-form-item :label="$t('scanCoverRegenerateMissing')">
          <a-switch
            v-model:checked="coverRegenerateMissing"
            @change="() => saveSetting('scan.cover.regenerate_missing', coverRegenerateMissing ? 1 : 0)"
          />
          <div class="mt-1 text-xs text-gray-500">
            {{ $t('scanCoverRegenerateMissingHelp') }}
          </div>
        </a-form-item>

        <a-form-item :label="$t('coverCacheShardCount')">
          <a-input-number
            v-model:value="coverShardCount"
            :min="1"
            :max="4096"
            style="width: 220px"
            @change="() => saveSetting('cover.cache.shard_count', coverShardCount)"
          />
          <div class="mt-1 text-xs text-gray-500">
            {{ $t('coverCacheShardCountHelp') }}
          </div>
        </a-form-item>

        <a-divider class="!my-4" />

        <a-typography-title :level="5" class="!mb-2">
          {{ $t('scanCoverSettings') }}
        </a-typography-title>

        <div class="grid gap-4 md:grid-cols-2">
          <a-form-item :label="$t('scanCoverMaxWidth')">
            <a-input-number
              v-model:value="coverMaxWidth"
              :min="64"
              :max="4000"
              :step="10"
              addon-after="px"
              style="width: 220px"
              @change="() => saveSetting('scan.cover.max_width', coverMaxWidth)"
            />
          </a-form-item>

          <a-form-item :label="$t('scanCoverTargetKb')">
            <a-input-number
              v-model:value="coverTargetKb"
              :min="50"
              :max="5000"
              :step="50"
              addon-after="KB"
              style="width: 220px"
              @change="() => saveSetting('scan.cover.target_kb', coverTargetKb)"
            />
          </a-form-item>

          <a-form-item :label="$t('scanCoverQualityStart')">
            <a-input-number
              v-model:value="coverQualityStart"
              :min="1"
              :max="100"
              :step="1"
              style="width: 220px"
              @change="() => saveSetting('scan.cover.quality_start', coverQualityStart)"
            />
          </a-form-item>

          <a-form-item :label="$t('scanCoverQualityMin')">
            <a-input-number
              v-model:value="coverQualityMin"
              :min="1"
              :max="100"
              :step="1"
              style="width: 220px"
              @change="() => saveSetting('scan.cover.quality_min', coverQualityMin)"
            />
          </a-form-item>

          <a-form-item :label="$t('scanCoverQualityStep')">
            <a-input-number
              v-model:value="coverQualityStep"
              :min="1"
              :max="50"
              :step="1"
              style="width: 220px"
              @change="() => saveSetting('scan.cover.quality_step', coverQualityStep)"
            />
          </a-form-item>
        </div>
        <a-typography-text type="secondary">
          {{ $t('scanCoverSettingsHelp') }}
        </a-typography-text>
      </a-form>
    </a-card>

    <a-alert
      v-if="statusMessage"
      show-icon
      :type="statusAlertType"
      :message="statusMessage"
      class="shadow-sm"
    />
  </a-space>
</template>

<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useLibraryStore } from '@/store/library'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'

const { t } = useI18n()
const libraryStore = useLibraryStore()

const currentScanDisplay = computed(
  () => libraryStore.currentScanFile || (libraryStore.currentScanMessageKey ? t(libraryStore.currentScanMessageKey) : '')
)

const libraryPaths = ref([])
const newPath = ref('')
const maxWorkers = ref(12)
const cancelCheckIntervalMs = ref(200)
const hashMode = ref('full')
const coverMode = ref('scan')
const coverRegenerateMissing = ref(true)
const coverShardCount = ref(256)
const coverMaxWidth = ref(500)
const coverTargetKb = ref(300)
const coverQualityStart = ref(80)
const coverQualityMin = ref(10)
const coverQualityStep = ref(10)
const statusMessage = ref('')
const isError = ref(false)
let statusTimer = null

const scanTasks = computed(() =>
  libraryStore.activeTasks.filter(task => task.task_type === 'scan')
)

const statusAlertType = computed(() => (isError.value ? 'error' : 'success'))

const progressStatus = computed(() => {
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
})

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString()
}

function getScanErrorMessage(error) {
  return error.message || (error.messageKey ? t(error.messageKey) : '')
}

function showStatus(msg, error = false) {
  statusMessage.value = msg
  isError.value = error
  const handler = error ? message.error : message.success
  handler(msg)
  if (statusTimer) {
    clearTimeout(statusTimer)
  }
  statusTimer = setTimeout(() => {
    statusMessage.value = ''
  }, 3000)
}

function getStatusText() {
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

function getTaskStatusText(status) {
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

function cancelTask(taskId) {
  Modal.confirm({
    title: t('confirmCancelTask'),
    okType: 'danger',
    onOk: async () => {
      try {
        await libraryStore.cancelTask(taskId)
        showStatus(t('taskCancelled'))
      } catch (error) {
        console.error('Failed to cancel task:', error)
        showStatus(t('failedToCancelTask'), true)
      }
    }
  })
}

async function fetchLibraryPaths() {
  try {
    const response = await axios.get('/api/v1/library-paths')
    libraryPaths.value = response.data
  } catch (error) {
    console.error('Failed to fetch library paths:', error)
    showStatus(t('failedToFetchLibraryPaths'), true)
  }
}

async function addPath() {
  if (!newPath.value.trim()) {
    message.warning(t('pleaseEnterPath'))
    return
  }

  try {
    await axios.post('/api/v1/library-paths', { path: newPath.value })
    newPath.value = ''
    await fetchLibraryPaths()
    showStatus(t('pathAddedSuccessfully'))
  } catch (error) {
    console.error('Failed to add path:', error)
    showStatus(error.response?.data?.error || t('failedToAddPath'), true)
  }
}

function deletePath(id) {
  Modal.confirm({
    title: t('confirmRemovePath'),
    okType: 'danger',
    onOk: async () => {
      try {
        await axios.delete(`/api/v1/library-paths/${id}`)
        await fetchLibraryPaths()
        showStatus(t('pathRemovedSuccessfully'))
      } catch (error) {
        console.error('Failed to delete path:', error)
        showStatus(error.response?.data?.error || t('failedToRemovePath'), true)
      }
    }
  })
}

async function fetchSettings() {
  try {
    const response = await axios.get('/api/v1/settings')
    const settings = response.data || {}

    const toInt = (value, fallback) => {
      const parsed = Number.parseInt(String(value), 10)
      return Number.isNaN(parsed) ? fallback : parsed
    }
    const toBool = (value, fallback) => {
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

    maxWorkers.value = toInt(settings['scan.max_workers'], 12)
    cancelCheckIntervalMs.value = toInt(settings['scan.cancel_check.interval_ms'], 200)
    const rawHashMode = String(settings['scan.hash.mode'] || '').trim().toLowerCase()
    hashMode.value = ['full', 'off'].includes(rawHashMode) ? rawHashMode : 'full'
    const rawCoverMode = String(settings['scan.cover.mode'] || '').trim().toLowerCase()
    coverMode.value = ['scan', 'off'].includes(rawCoverMode) ? rawCoverMode : 'scan'
    coverRegenerateMissing.value = toBool(settings['scan.cover.regenerate_missing'], true)
    coverShardCount.value = toInt(settings['cover.cache.shard_count'], 256)

    coverMaxWidth.value = toInt(settings['scan.cover.max_width'], 500)
    coverTargetKb.value = toInt(settings['scan.cover.target_kb'], 300)
    coverQualityStart.value = toInt(settings['scan.cover.quality_start'], 80)
    coverQualityMin.value = toInt(settings['scan.cover.quality_min'], 10)
    coverQualityStep.value = toInt(settings['scan.cover.quality_step'], 10)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    showStatus(t('failedToFetchSettings'), true)
  }
}

async function saveSetting(key, value) {
  try {
    await axios.put(`/api/v1/settings/${key}`, { value })
    showStatus(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error(`Failed to save setting ${key}:`, error)
    showStatus(t('failedToSaveSettings'), true)
  }
}

async function startScan(item) {
  try {
    await libraryStore.startScan(item.id)
    showStatus(t('scanStartedFor', { path: item.path }))
  } catch (error) {
    console.error('Failed to start scan:', error)
    showStatus(error.response?.data?.error || t('failedToStartScan'), true)
  }
}

async function scanAll() {
  try {
    await libraryStore.startScanAll()
    showStatus(t('scanStartedForAll'))
  } catch (error) {
    console.error('Failed to start scan all:', error)
    showStatus(error.response?.data?.error || t('failedToStartScanAll'), true)
  }
}

onMounted(() => {
  fetchLibraryPaths()
  fetchSettings()
  libraryStore.checkActiveTasks()
})

onBeforeUnmount(() => {
  if (statusTimer) {
    clearTimeout(statusTimer)
  }
})
</script>
