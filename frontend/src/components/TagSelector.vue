<template>
  <div ref="filterContainer" class="relative inline-block text-left z-50">
    <div>
      <button @click="isFilterOpen = !isFilterOpen" type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
        {{ $t('filterByTags') }}
        <svg class="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <div v-if="isFilterOpen" class="origin-top-left absolute left-0 mt-2 w-max rounded-md shadow-2xl bg-white ring-1 ring-black ring-opacity-5 flex focus:outline-none">
      <div class="flex">
        <!-- Left Panel: 标签类型 -->
        <div class="w-48 border-r border-gray-200 py-1">
          <a v-for="tagType in allTagTypes" :key="tagType.id" href="#"
            @mouseover="hoveredType = tagType"
            class="block px-4 py-2 text-sm text-gray-700"
            :class="{ 'bg-gray-100': hoveredType && hoveredType.id === tagType.id }">
            {{ tagType.name }}
          </a>
        </div>

        <!-- Right Panel: Tags -->
        <div class="w-72 py-1">
          <div v-if="!hoveredType" class="px-4 py-2 text-sm text-gray-500">
            {{ $t('hoverTypeToViewTags') }}
          </div>
          <div v-else class="max-h-96 overflow-y-auto">
             <a v-for="tag in tagsOfHoveredType" :key="tag.id" href="#"
              @click.prevent="toggleTag(tag)"
              class="flex justify-between items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <span>{{ tag.name }}</span>
               <svg v-if="isTagSelected(tag)" class="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import axios from 'axios';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue']);

const allTags = ref([]);
const allTagTypes = ref([]);
const isFilterOpen = ref(false);
const hoveredType = ref(null);
const filterContainer = ref(null);

const selectedTags = ref([...props.modelValue]);

watch(() => props.modelValue, (newValue) => {
  selectedTags.value = [...newValue];
}, { deep: true });

const fetchAllTagTypes = async () => {
    try {
        const response = await axios.get('/api/v1/tag_types');
        allTagTypes.value = response.data;
    } catch (error) {
        console.error('Failed to fetch 标签类型:', error);
    }
};

const fetchAllTags = async () => {
    try {
        const response = await axios.get('/api/v1/tags');
        allTags.value = response.data;
    } catch (error) {
        console.error('Failed to fetch tags:', error);
    }
};

const handleClickOutside = (event) => {
  if (filterContainer.value && !filterContainer.value.contains(event.target)) {
    isFilterOpen.value = false;
  }
};

onMounted(() => {
    fetchAllTags();
    fetchAllTagTypes();
    document.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
});

const tagsOfHoveredType = computed(() => {
    if (!hoveredType.value) {
        return [];
    }
    return allTags.value.filter(tag => tag.type_id === hoveredType.value.id);
});

const toggleTag = (tag) => {
    const index = selectedTags.value.findIndex(t => t.id === tag.id);
    if (index > -1) {
        selectedTags.value.splice(index, 1);
    } else {
        selectedTags.value.push(tag);
    }
    emit('update:modelValue', selectedTags.value);
};

const isTagSelected = (tag) => {
    return selectedTags.value.some(t => t.id === tag.id);
};
</script>