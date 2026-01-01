<template>
  <a-popover
    placement="bottomLeft"
    trigger="click"
    :open="isPopoverOpen"
    @openChange="handlePopoverOpenChange"
    overlay-class-name="tag-selector-overlay"
  >
    <template #content>
      <div class="tag-selector-panel" @click.stop>
        <a-spin :spinning="isLoading">
          <template v-if="loadError">
            <a-result
              status="error"
              :title="$t('failedToLoadLibrary')"
              :sub-title="loadError"
            >
              <template #extra>
                <a-button type="primary" size="small" @click="loadData">
                  {{ $t('retry') }}
                </a-button>
              </template>
            </a-result>
          </template>
          <template v-else>
            <div class="tag-selector-panel__header">
              <a-typography-text strong>
                {{ $t('filterByTags') }}
              </a-typography-text>
              <a-space size="small">
                <a-tooltip :title="$t('tagFilterClearTooltip')">
                  <a-button type="link" size="small" @click="clearSelection" :disabled="!selectedTags.length">
                    {{ $t('tagFilterClear') }}
                  </a-button>
                </a-tooltip>
                <a-button type="primary" size="small" ghost @click="closePopover">
                  {{ $t('tagFilterDone') }}
                </a-button>
              </a-space>
            </div>
            <a-input-search
              v-model:value="tagSearch"
              size="small"
              allow-clear
              :placeholder="$t('searchTagsPlaceholder')"
              class="tag-selector-panel__search"
            />
            <div class="tag-selector-panel__body">
              <div class="tag-selector-panel__types">
                <a-empty
                  v-if="!allTagTypes.length"
                  :description="$t('tagTypesEmpty')"
                />
                <a-menu
                  v-else
                  mode="inline"
                  :selectedKeys="activeTypeKey"
                  @select="handleTypeSelect"
                >
                  <a-menu-item
                    v-for="type in allTagTypes"
                    :key="String(type.id)"
                    class="tag-selector-panel__menu-item"
                  >
                    <span>{{ type.name }}</span>
                    <a-badge
                      :count="tagsByTypeCount[type.id] || 0"
                      :number-style="{ backgroundColor: '#e6f4ff', color: '#1677ff' }"
                    />
                  </a-menu-item>
                </a-menu>
              </div>
              <div class="tag-selector-panel__tags">
                <template v-if="!filteredTags.length">
                  <a-empty :description="$t('tagsEmpty')" />
                </template>
                <template v-else>
                  <a-list
                    :data-source="filteredTags"
                    size="small"
                    :split="false"
                    class="tag-selector-panel__tag-list"
                  >
                    <template #renderItem="{ item }">
                      <a-list-item class="tag-selector-panel__tag">
                        <a-checkable-tag
                          :checked="isTagSelected(item)"
                          @change="() => toggleTag(item)"
                        >
                          {{ item.name }}
                        </a-checkable-tag>
                      </a-list-item>
                    </template>
                  </a-list>
                </template>
              </div>
            </div>
            <div v-if="selectedTags.length" class="tag-selector-panel__footer">
              <a-typography-text type="secondary">
                {{ $t('tagFilterSelectedCount', { count: selectedTags.length }) }}
              </a-typography-text>
              <a-space wrap>
                <a-tag
                  v-for="tag in selectedTags"
                  :key="`selected-tag-${tag.id}`"
                  color="blue"
                  closable
                  @close.prevent="toggleTag(tag)"
                >
                  {{ tag.name }}
                </a-tag>
              </a-space>
            </div>
          </template>
        </a-spin>
      </div>
    </template>

    <a-button>
      <template #icon>
        <FilterOutlined />
      </template>
      {{ filterButtonLabel }}
    </a-button>
  </a-popover>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { FilterOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const allTags = ref([])
const allTagTypes = ref([])
const isLoading = ref(false)
const loadError = ref('')
const selectedTags = ref([...props.modelValue])
const activeTypeId = ref(null)
const isPopoverOpen = ref(false)
const tagSearch = ref('')

const filterButtonLabel = computed(() => {
  if (!selectedTags.value.length) {
    return t('filterByTags')
  }
  return `${t('filterByTags')} (${selectedTags.value.length})`
})

watch(
  () => props.modelValue,
  newValue => {
    selectedTags.value = [...newValue]
  },
  { deep: true }
)

const tagsByTypeCount = computed(() => {
  const map = {}
  for (const tag of allTags.value) {
    map[tag.type_id] = (map[tag.type_id] || 0) + 1
  }
  return map
})

const activeTypeKey = computed(() => (activeTypeId.value ? [String(activeTypeId.value)] : []))

const tagsOfActiveType = computed(() => {
  if (!activeTypeId.value) {
    return allTags.value
  }
  return allTags.value.filter(tag => tag.type_id === activeTypeId.value)
})

const filteredTags = computed(() => {
  const keyword = tagSearch.value.trim().toLowerCase()
  if (!keyword) {
    return tagsOfActiveType.value
  }
  return tagsOfActiveType.value.filter(tag => tag.name.toLowerCase().includes(keyword))
})

const ensureActiveType = () => {
  if (activeTypeId.value && allTagTypes.value.some(type => type.id === activeTypeId.value)) {
    return
  }
  activeTypeId.value = allTagTypes.value[0]?.id ?? null
}

const loadData = async () => {
  isLoading.value = true
  loadError.value = ''
  try {
    const [tagsResponse, typesResponse] = await Promise.all([
      axios.get('/api/v1/tags/all'),
      axios.get('/api/v1/tag_types')
    ])
    allTags.value = tagsResponse.data || []
    allTagTypes.value = typesResponse.data || []
    ensureActiveType()
  } catch (error) {
    console.error('Failed to load tags:', error)
    loadError.value = error.response?.data?.error || error.message || t('errorFetchingTags')
  } finally {
    isLoading.value = false
  }
}

const toggleTag = tag => {
  const exists = selectedTags.value.some(item => item.id === tag.id)
  if (exists) {
    selectedTags.value = selectedTags.value.filter(item => item.id !== tag.id)
  } else {
    selectedTags.value = [...selectedTags.value, tag]
  }
  emit('update:modelValue', selectedTags.value)
}

const isTagSelected = tag => selectedTags.value.some(item => item.id === tag.id)

const handleTypeSelect = ({ key }) => {
  activeTypeId.value = Number(key)
}

const clearSelection = () => {
  if (!selectedTags.value.length) {
    return
  }
  selectedTags.value = []
  emit('update:modelValue', [])
}

const closePopover = () => {
  isPopoverOpen.value = false
}

const handlePopoverOpenChange = open => {
  isPopoverOpen.value = open
  if (open && !allTags.value.length && !isLoading.value) {
    loadData()
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.tag-selector-panel {
  width: 480px;
  max-width: 80vw;
}

.tag-selector-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.tag-selector-panel__search {
  margin-bottom: 12px;
}

.tag-selector-panel__body {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 12px;
  max-height: 320px;
}

.tag-selector-panel__types {
  border-right: 1px solid #f0f0f0;
  padding-right: 12px;
}

.tag-selector-panel__tags {
  min-height: 160px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.tag-selector-panel__tag {
  padding: 4px 0;
}

.tag-selector-panel__footer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.tag-selector-panel__menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
