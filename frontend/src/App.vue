<script setup>
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  HomeOutlined,
  HeartOutlined,
  SettingOutlined,
  ToolOutlined
} from '@ant-design/icons-vue'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const collapsed = ref(false)

const navItems = computed(() => [
  { key: 'home', label: t('home'), path: '/', icon: HomeOutlined },
  { key: 'likes', label: t('wishlist'), path: '/likes', icon: HeartOutlined },
  {
    key: 'settings',
    label: t('settings'),
    icon: SettingOutlined,
    children: [
      {
        key: 'settings-library',
        label: t('libraryPathManagement'),
        path: '/settings/library-paths'
      },
      {
        key: 'settings-tags',
        label: t('tagManagement'),
        path: '/settings/tag-management'
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
    <a-layout v-else class="min-h-screen bg-gray-50">
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

      <a-layout>
        <PageHeader :collapsed="collapsed" @toggle-collapsed="toggleCollapsed" />
        <a-layout-content class="app-content">
          <div class="mx-auto w-full max-w-7xl">
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
.app-sider {
  border-inline-end: 1px solid #f0f0f0;
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 64px;
  padding: 0 16px;
  font-weight: 600;
  color: #1f2937;
  letter-spacing: 0.02em;
}

.logo-mark {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1677ff, #69c0ff);
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
  min-height: calc(100vh - 64px);
  background: #f5f5f5;
}
</style>
