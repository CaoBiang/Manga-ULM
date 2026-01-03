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
import PageHeader from '@/components/PageHeader.vue'
import { useAppSettingsStore } from '@/store/appSettings'

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
        key: 'settings-reader-interaction',
        label: t('readerInteractionSettings'),
        path: '/settings/reader-interaction'
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
                <span>{{ child.label }}</span>
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
  overflow: auto;
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
