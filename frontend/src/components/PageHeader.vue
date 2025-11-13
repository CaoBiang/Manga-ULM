<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'

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
  likes: 'wishlist',
  settings: 'settings',
  maintenance: 'maintenance',
  reader: 'reader',
  edit: 'editFileDetails'
}

const pageTitle = computed(() => {
  const key = titleKeyMap[route.name] || 'home'
  return t(key)
})

const breadcrumbItems = computed(() => {
  const crumbs = [
    { key: 'home', label: t('appName'), path: '/' }
  ]
  if (route.name && route.name !== 'home') {
    crumbs.push({ key: route.name, label: pageTitle.value })
  }
  return crumbs
})

const refreshPage = () => {
  router.go(0)
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
        <a-breadcrumb>
          <a-breadcrumb-item
            v-for="item in breadcrumbItems"
            :key="item.key"
          >
            <RouterLink v-if="item.path" :to="item.path" class="text-gray-500 hover:text-primary">
              {{ item.label }}
            </RouterLink>
            <span v-else>{{ item.label }}</span>
          </a-breadcrumb-item>
        </a-breadcrumb>
      </div>
    </div>

    <a-space :size="12">
      <a-tooltip :title="t('refresh')">
        <a-button type="text" shape="circle" @click="refreshPage">
          <ReloadOutlined />
        </a-button>
      </a-tooltip>
    </a-space>
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
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(6px);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}

.page-header__left {
  display: flex;
  align-items: center;
  gap: 16px;
}
</style>
