<template>
  <div class="flex justify-center items-center space-x-2">
    <button
      @click="changePage(currentPage - 1)"
      :disabled="currentPage <= 1"
      class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
    >
      {{ $t('prev') }}
    </button>
    <span>{{ currentPage }} / {{ totalPages }}</span>
    <button
      @click="changePage(currentPage + 1)"
      :disabled="currentPage >= totalPages"
      class="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
    >
      {{ $t('next') }}
    </button>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
  },
  totalPages: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['page-changed']);

const changePage = (page) => {
  if (page > 0 && page <= props.totalPages) {
    emit('page-changed', page);
  }
};
</script>