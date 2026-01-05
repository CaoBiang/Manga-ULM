<script setup>
import { computed, ref, watch, watchEffect, onBeforeUnmount } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  HomeOutlined,
  HeartOutlined,
  SettingOutlined,
  ToolOutlined,
  BookOutlined
} from '@ant-design/icons-vue'
import { notification } from 'ant-design-vue'
import PageHeader from '@/components/PageHeader.vue'
import { useAppSettingsStore } from '@/store/appSettings'
import { useLibraryStore } from '@/store/library'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const collapsed = ref(false)

const navItems = computed(() => [
  { key: 'home', label: t('home'), path: '/', icon: HomeOutlined },
  { key: 'library', label: t('library'), path: '/library', icon: BookOutlined },
  { key: 'likes', label: t('wishlist'), path: '/likes', icon: HeartOutlined },
  {
    key: 'settings',
    label: t('settings'),
    icon: SettingOutlined,
    children: [
      {
        key: 'settings-general',
        label: t('generalSettings'),
        path: '/settings/general'
      },
      {
        key: 'settings-library',
        label: t('librarySettings'),
        path: '/settings/library'
      },
      {
        key: 'settings-display',
        label: t('displaySettings'),
        path: '/settings/display'
      },
      {
        key: 'settings-reader',
        label: t('readerSettings'),
        path: '/settings/reader'
      },
      {
        key: 'settings-tags',
        label: t('tagManagement'),
        path: '/settings/tag-management'
      },
      {
        key: 'settings-tasks',
        label: t('taskManager'),
        path: '/settings/tasks'
      },
      {
        key: 'settings-advanced',
        label: t('advancedSettings'),
        path: '/settings/advanced'
      }
    ]
  },
  { key: 'maintenance', label: t('maintenance'), path: '/maintenance', icon: ToolOutlined }
])

const selectedKeys = computed(() => (route.name ? [route.name] : []))

const handleMenuClick = ({ key }) => {
  const target = findNavItem(key)
  if (target && target.path !== route.path) {
    router.push(target.path)
  }
}

const openKeys = ref([])

const handleOpenChange = keys => {
  openKeys.value = keys
}

const toggleCollapsed = () => {
  collapsed.value = !collapsed.value
}

watch(
  () => route.name,
  () => {
    if (collapsed.value) {
      openKeys.value = []
      return
    }
    const info = findNavItem(route.name, true)
    openKeys.value = info?.parentKey ? [info.parentKey] : []
  },
  { immediate: true }
)

watch(
  () => collapsed.value,
  value => {
    if (value) {
      openKeys.value = []
    } else {
      const info = findNavItem(route.name, true)
      openKeys.value = info?.parentKey ? [info.parentKey] : []
    }
  }
)

function findNavItem(key, withParent = false, items = navItems.value, parentKey = null) {
  for (const item of items) {
    if (item.key === key) {
      return withParent ? { ...item, parentKey } : item
    }
    if (item.children) {
      const result = findNavItem(key, withParent, item.children, item.key)
      if (result) {
        return result
      }
    }
  }
  return null
}

const isFullScreenRoute = computed(() => route.meta?.fullScreen)

const appSettingsStore = useAppSettingsStore()
const libraryStore = useLibraryStore()

const taskBadgeInfo = computed(() => {
  if (!appSettingsStore.tasksBadgeEnabled) {
    return { visible: false, count: 0, className: '' }
  }

  const activeCount = Array.isArray(libraryStore.activeTasks) ? libraryStore.activeTasks.length : 0
  const unseenHistory = Number(libraryStore.unseenHistoryCount ?? 0) || 0
  const unseenFailed = Number(libraryStore.unseenFailedCount ?? 0) || 0

  if (activeCount > 0) {
    return { visible: true, count: activeCount, className: 'manager-badge--orange' }
  }
  if (unseenHistory > 0) {
    return { visible: true, count: unseenHistory, className: unseenFailed > 0 ? 'manager-badge--red' : 'manager-badge--blue' }
  }
  return { visible: false, count: 0, className: '' }
})

const TASK_NOTIFY_CURSOR_KEY = 'manga-ulm.tasks.notify.cursor.v1'

const loadNotifyCursor = () => {
  if (typeof localStorage === 'undefined') {
    return { cursor: { ts: 0, id: 0 }, initialized: false }
  }
  try {
    const raw = localStorage.getItem(TASK_NOTIFY_CURSOR_KEY)
    if (!raw) {
      return { cursor: { ts: 0, id: 0 }, initialized: false }
    }
    const parsed = JSON.parse(raw)
    const ts = Number(parsed?.ts)
    const id = Number(parsed?.id)
    if (!Number.isFinite(ts) || !Number.isFinite(id)) {
      return { cursor: { ts: 0, id: 0 }, initialized: false }
    }
    return { cursor: { ts, id }, initialized: true }
  } catch (_error) {
    return { cursor: { ts: 0, id: 0 }, initialized: false }
  }
}

const saveNotifyCursor = (cursor) => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(TASK_NOTIFY_CURSOR_KEY, JSON.stringify(cursor))
  } catch (_error) {
    // 忽略写入失败
  }
}

const taskToCursor = (task) => {
  const rawTime = task?.finished_at || task?.created_at || ''
  const ts = rawTime ? Date.parse(String(rawTime)) : 0
  const id = Number(task?.id) || 0
  return { ts: Number.isFinite(ts) ? ts : 0, id }
}

const isAfterCursor = (cursor, baseline) => {
  if (cursor.ts > baseline.ts) return true
  if (cursor.ts < baseline.ts) return false
  return cursor.id > baseline.id
}

const maxCursor = (a, b) => {
  if (a.ts > b.ts) return a
  if (a.ts < b.ts) return b
  return a.id >= b.id ? a : b
}

const loadedNotifyCursor = loadNotifyCursor()
let notifyCursor = loadedNotifyCursor.cursor
let notifyCursorInitialized = loadedNotifyCursor.initialized

const pushTaskNotification = (task) => {
  if (!task || task.is_active) {
    return
  }

  if (task.status === 'failed') {
    if (!appSettingsStore.tasksNotifyOnFail) {
      return
    }
    notification.error({
      message: t('taskNotifyFailedTitle'),
      description: task.error_message ? `${task.name}\n${task.error_message}` : task.name,
      duration: 6,
      onClick: () => router.push('/settings/tasks')
    })
    return
  }

  if (task.status === 'completed') {
    if (!appSettingsStore.tasksNotifyOnComplete) {
      return
    }
    notification.success({
      message: t('taskNotifyCompletedTitle'),
      description: task.name,
      duration: 4,
      onClick: () => router.push('/settings/tasks')
    })
  }
}

watch(
  () => libraryStore.recentTasks,
  (tasks) => {
    const list = Array.isArray(tasks) ? tasks : []
    const history = list.filter(item => item && !item.is_active && (item.finished_at || item.created_at))

    if (!notifyCursorInitialized) {
      if (history.length > 0) {
        notifyCursor = history
          .map(taskToCursor)
          .reduce((acc, cur) => maxCursor(acc, cur), { ts: 0, id: 0 })
        saveNotifyCursor(notifyCursor)
      }
      notifyCursorInitialized = true
      return
    }

    if (history.length === 0) {
      return
    }

    const newlyFinished = history
      .map(task => ({ task, cursor: taskToCursor(task) }))
      .filter(item => isAfterCursor(item.cursor, notifyCursor))
      .sort((a, b) => {
        if (a.cursor.ts !== b.cursor.ts) return a.cursor.ts - b.cursor.ts
        return a.cursor.id - b.cursor.id
      })

    if (newlyFinished.length === 0) {
      return
    }

    for (const item of newlyFinished) {
      pushTaskNotification(item.task)
      notifyCursor = maxCursor(notifyCursor, item.cursor)
    }
    saveNotifyCursor(notifyCursor)
  }
)

const managerUiCssVars = computed(() => ({
  '--manager-ui-blur-enabled': appSettingsStore.managerUiBlurEnabled ? '1' : '0',
  '--manager-ui-blur-radius-px': String(appSettingsStore.managerUiBlurRadiusPx),
  '--manager-ui-surface-bg-opacity': String(appSettingsStore.managerUiSurfaceBgOpacity),
  '--manager-ui-surface-border-opacity': String(appSettingsStore.managerUiSurfaceBorderOpacity),
  '--manager-ui-control-bg-opacity': String(appSettingsStore.managerUiControlBgOpacity),
  '--manager-ui-control-border-opacity': String(appSettingsStore.managerUiControlBorderOpacity)
}))

const managerBodyClass = 'app-is-manager'
const managerVarKeys = Object.freeze(Object.keys(managerUiCssVars.value))

const cleanupManagerUiFromBody = () => {
  if (typeof document === 'undefined') {
    return
  }
  document.body.classList.remove(managerBodyClass)
  for (const key of managerVarKeys) {
    document.body.style.removeProperty(key)
  }
}

watchEffect(() => {
  if (typeof document === 'undefined') {
    return
  }

  if (isFullScreenRoute.value) {
    cleanupManagerUiFromBody()
    return
  }

  document.body.classList.add(managerBodyClass)
  for (const [key, value] of Object.entries(managerUiCssVars.value)) {
    document.body.style.setProperty(key, value)
  }
})

onBeforeUnmount(() => {
  cleanupManagerUiFromBody()
})

const theme = computed(() => ({
  token: {
    colorPrimary: '#1677ff',
    colorInfo: '#1677ff',
    colorBgLayout: '#f5f5f5',
    colorBgContainer: '#ffffff',
    colorText: '#1f2937',
    colorLink: '#1677ff',
    borderRadius: 8,
    fontFamily: `'Inter', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`
  },
  components: {
    Layout: {
      headerHeight: 64,
      triggerHeight: 48
    },
    Menu: {
      itemSelectedBg: '#e6f4ff',
      itemSelectedColor: '#1677ff'
    }
  }
}))
</script>

<template>
  <a-config-provider :theme="theme">
    <div v-if="isFullScreenRoute" class="min-h-screen bg-black">
      <router-view v-slot="{ Component, route }">
        <keep-alive>
          <component :is="Component" :key="route.name" v-if="route.meta.keepAlive" />
        </keep-alive>
        <component :is="Component" :key="route.name" v-if="!route.meta.keepAlive" />
      </router-view>
    </div>
    <a-layout v-else class="app-layout manager-shell">
      <a-layout-sider
        v-model:collapsed="collapsed"
        collapsible
        theme="light"
        :width="248"
        :collapsed-width="72"
        breakpoint="lg"
        class="app-sider"
      >
        <RouterLink to="/" class="app-logo">
          <span class="logo-mark">M</span>
          <span v-if="!collapsed" class="logo-text">{{ t('appName') }}</span>
        </RouterLink>
        <a-menu
          mode="inline"
          :selectedKeys="selectedKeys"
          :openKeys="openKeys"
          @click="handleMenuClick"
          @openChange="handleOpenChange"
        >
          <template v-for="item in navItems" :key="item.key">
            <a-sub-menu v-if="item.children" :key="item.key">
              <template #icon>
                <component :is="item.icon" />
              </template>
              <template #title>
                <span>{{ item.label }}</span>
              </template>
              <a-menu-item
                v-for="child in item.children"
                :key="child.key"
                class="flex items-center"
              >
                <template v-if="child.key === 'settings-tasks' && taskBadgeInfo.visible">
                  <a-badge
                    :count="taskBadgeInfo.count"
                    :overflow-count="99"
                    :offset="[10, 0]"
                    :class="taskBadgeInfo.className"
                  >
                    <span>{{ child.label }}</span>
                  </a-badge>
                </template>
                <template v-else>
                  <span>{{ child.label }}</span>
                </template>
              </a-menu-item>
            </a-sub-menu>
            <a-menu-item
              v-else
              :key="item.key"
              class="flex items-center"
            >
              <template #icon>
                <component :is="item.icon" />
              </template>
              <span>{{ item.label }}</span>
            </a-menu-item>
          </template>
        </a-menu>
      </a-layout-sider>

      <a-layout class="app-main">
        <PageHeader :collapsed="collapsed" @toggle-collapsed="toggleCollapsed" />
        <a-layout-content class="app-content">
          <div class="w-full">
            <router-view v-slot="{ Component, route }">
              <keep-alive>
                <component :is="Component" :key="route.name" v-if="route.meta.keepAlive" />
              </keep-alive>
              <component :is="Component" :key="route.name" v-if="!route.meta.keepAlive" />
            </router-view>
          </div>
        </a-layout-content>
      </a-layout>
    </a-layout>
  </a-config-provider>
</template>

<style scoped>
.app-layout {
  height: 100vh;
  overflow: hidden;
  background: transparent;
}

.app-sider {
  border-inline-end: 1px solid rgba(15, 23, 42, 0.08);
  height: 100vh;
  position: sticky;
  top: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--manager-ui-surface-bg, rgba(255, 255, 255, 0.72));
  backdrop-filter: var(--manager-ui-backdrop-filter, none);
  -webkit-backdrop-filter: var(--manager-ui-backdrop-filter, none);
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 64px;
  padding: 0 16px;
  font-weight: 600;
  color: var(--manager-ui-text, rgba(15, 23, 42, 0.92));
  letter-spacing: 0.02em;
}

.logo-mark {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: #1677ff;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.logo-text {
  font-size: 18px;
}

.app-content {
  padding: 24px;
  flex: 1 1 auto;
  overflow: auto;
  background: transparent;
}

.app-main {
  height: 100vh;
  overflow: hidden;
}
</style>
