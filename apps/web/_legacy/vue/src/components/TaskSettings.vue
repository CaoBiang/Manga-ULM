<template>
  <a-space direction="vertical" size="middle" class="w-full">
    <a-alert :message="$t('taskSettingsHelp')" type="info" show-icon />

    <a-form layout="vertical" @submit.prevent>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <a-form-item :label="$t('taskHistoryLimit')" :help="$t('taskHistoryLimitHelp')">
          <a-input-number
            v-model:value="historyLimitInput"
            :min="10"
            :max="500"
            :step="10"
            style="width: 100%"
            @change="saveHistoryLimit"
          />
        </a-form-item>

        <a-form-item :label="$t('taskHistoryRetentionDays')" :help="$t('taskHistoryRetentionDaysHelp')">
          <a-input-number
            v-model:value="retentionDaysInput"
            :min="0"
            :max="3650"
            :step="1"
            style="width: 100%"
            @change="saveRetentionDays"
          />
        </a-form-item>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <a-form-item :label="$t('taskNotifyOnComplete')" :help="$t('taskNotifyOnCompleteHelp')">
          <a-switch :checked="appSettingsStore.tasksNotifyOnComplete" @change="appSettingsStore.setTasksNotifyOnComplete" />
        </a-form-item>

        <a-form-item :label="$t('taskNotifyOnFail')" :help="$t('taskNotifyOnFailHelp')">
          <a-switch :checked="appSettingsStore.tasksNotifyOnFail" @change="appSettingsStore.setTasksNotifyOnFail" />
        </a-form-item>
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <a-form-item :label="$t('taskBadgeEnabled')" :help="$t('taskBadgeEnabledHelp')">
          <a-switch :checked="appSettingsStore.tasksBadgeEnabled" @change="appSettingsStore.setTasksBadgeEnabled" />
        </a-form-item>

        <a-form-item :label="$t('taskHistoryCleanup')" :help="$t('taskHistoryCleanupHelp')">
          <a-popconfirm
            :title="$t('confirmCleanupTasks', { days: appSettingsStore.tasksHistoryRetentionDays })"
            :ok-text="$t('confirm')"
            :cancel-text="$t('cancel')"
            @confirm="cleanupHistory"
          >
            <a-button danger :loading="cleaning">
              {{ $t('cleanupHistory') }}
            </a-button>
          </a-popconfirm>
        </a-form-item>
      </div>
    </a-form>
  </a-space>
</template>

<script setup>
import { ref, watch } from 'vue'
import axios from 'axios'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useAppSettingsStore } from '@/store/appSettings'
import { useLibraryStore } from '@/store/library'

const { t } = useI18n()
const appSettingsStore = useAppSettingsStore()
const libraryStore = useLibraryStore()

const historyLimitInput = ref(appSettingsStore.tasksHistoryLimit)
const retentionDaysInput = ref(appSettingsStore.tasksHistoryRetentionDays)
const cleaning = ref(false)

watch(
  () => appSettingsStore.tasksHistoryLimit,
  (value) => {
    historyLimitInput.value = value
  }
)

watch(
  () => appSettingsStore.tasksHistoryRetentionDays,
  (value) => {
    retentionDaysInput.value = value
  }
)

const saveHistoryLimit = async () => {
  await appSettingsStore.setTasksHistoryLimit(historyLimitInput.value)
  await libraryStore.checkActiveTasks()
}

const saveRetentionDays = async () => {
  await appSettingsStore.setTasksHistoryRetentionDays(retentionDaysInput.value)
}

const cleanupHistory = async () => {
  cleaning.value = true
  try {
    const response = await axios.delete('/api/v1/task-history', {
      data: { days: appSettingsStore.tasksHistoryRetentionDays }
    })
    message.success(response.data?.message || t('cleanupHistorySuccess'))
    await libraryStore.checkActiveTasks()
  } catch (error) {
    console.error('清理历史任务失败:', error)
    message.error(error.response?.data?.error || t('cleanupHistoryFailed'))
  } finally {
    cleaning.value = false
  }
}
</script>
