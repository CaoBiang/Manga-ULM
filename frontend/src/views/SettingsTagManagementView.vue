<template>
  <div class="p-4 md:p-8">
    <a-space direction="vertical" size="large" class="w-full">
      <a-typography-title :level="2" class="!mb-0">
        {{ $t('tagManagement') }}
      </a-typography-title>

      <a-card :title="$t('tagTypeManagement')" :bordered="false">
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
      </a-card>
    </a-space>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import axios from 'axios'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'

import TagTypeManager from '@/components/TagTypeManager.vue'
import TagManager from '@/components/TagManager.vue'

const { t } = useI18n()
const tagTypes = ref([])

const fetchTagData = async () => {
  try {
    const response = await axios.get('/api/v1/tag_types')
    tagTypes.value = response.data
  } catch (error) {
    console.error('Failed to fetch tag types:', error)
    message.error(t('failedToFetchTagTypes'))
  }
}

onMounted(fetchTagData)
</script>
