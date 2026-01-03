<template>
  <GlassPage :title="$t('tagManagement')">
    <a-space direction="vertical" size="large" class="w-full">
      <GlassSurface :title="$t('tagTypeManagement')">
        <a-space direction="vertical" size="large" class="w-full">
          <div>
            <a-typography-title :level="4">
              {{ $t('tagTypes') }}
            </a-typography-title>
            <TagTypeManager :types="tagTypes" @dataChanged="fetchTagData" />
          </div>

          <a-divider />

          <TagManager :types="tagTypes" />
        </a-space>
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'

import TagTypeManager from '@/components/TagTypeManager.vue'
import TagManager from '@/components/TagManager.vue'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'

const { t } = useI18n()
const tagTypes = ref([])

const fetchTagData = async () => {
  try {
    const response = await axios.get('/api/v1/tag_types')
    tagTypes.value = response.data
  } catch (error) {
    console.error('加载标签类型失败：', error)
    message.error(t('failedToFetchTagTypes'))
  }
}

onMounted(fetchTagData)
</script>
