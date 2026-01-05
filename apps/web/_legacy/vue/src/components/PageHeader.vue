<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'
import { useAppSettingsStore } from '@/store/appSettings'

const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['toggle-collapsed'])

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const titleKeyMap = {
  home: 'home',
  library: 'library',
  likes: 'wishlist',
  settings: 'settings',
  'settings-general': 'generalSettings',
  'settings-library': 'librarySettings',
  'settings-display': 'displaySettings',
  'settings-reader': 'readerSettings',
  'settings-tags': 'tagManagement',
  'settings-tasks': 'taskManager',
  'settings-advanced': 'advancedSettings',
  maintenance: 'maintenance',
  reader: 'reader',
  edit: 'editFileDetails'
}

const appSettingsStore = useAppSettingsStore()
const { libraryViewMode } = storeToRefs(appSettingsStore)

const pageTitle = computed(() => {
  const key = route.meta?.titleKey || titleKeyMap[route.name] || 'home'
  return t(key)
})

const refreshPage = () => {
  router.go(0)
}

const viewToggleOptions = computed(() => [
  { label: t('viewGrid'), value: 'grid' },
  { label: t('viewList'), value: 'list' }
])

const showViewToggle = computed(() => route.name === 'library')

const handleViewModeChange = (mode) => {
  appSettingsStore.setLibraryViewMode(mode)
}
</script>

<template>
  <a-layout-header class="page-header">
    <div class="page-header__left">
      <a-button
        type="text"
        shape="circle"
        size="large"
        @click="emit('toggle-collapsed')"
      >
        <MenuUnfoldOutlined v-if="props.collapsed" />
        <MenuFoldOutlined v-else />
      </a-button>
      <div>
        <a-typography-title :level="4" class="!mb-0 text-gray-800">
          {{ pageTitle }}
        </a-typography-title>
      </div>
    </div>

    <div class="page-header__right">
      <div v-if="showViewToggle" class="page-header__view-toggle">
        <span class="page-header__view-label">
          {{ t('viewModeLabel') }}
        </span>
        <a-segmented
          :value="libraryViewMode"
          :options="viewToggleOptions"
          size="small"
          @change="handleViewModeChange"
        />
      </div>
      <a-space :size="12">
        <a-tooltip :title="t('refresh')">
          <a-button type="text" shape="circle" @click="refreshPage">
            <ReloadOutlined />
          </a-button>
        </a-tooltip>
      </a-space>
    </div>
  </a-layout-header>
</template>

<style scoped>
.page-header {
  position: sticky;
  top: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--manager-ui-surface-bg, rgba(255, 255, 255, 0.72));
  backdrop-filter: var(--manager-ui-backdrop-filter, blur(10px));
  -webkit-backdrop-filter: var(--manager-ui-backdrop-filter, blur(10px));
  box-shadow: var(--manager-ui-shadow-sm, 0 6px 18px rgba(15, 23, 42, 0.08));
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}

.page-header__left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-header__right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-header__view-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-header__view-label {
  display: none;
  font-size: 0.875rem;
  color: #475467;
  font-weight: 500;
}

@media (min-width: 768px) {
  .page-header__view-label {
    display: inline-block;
  }
}
</style>
