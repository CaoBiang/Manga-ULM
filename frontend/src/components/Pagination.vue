<template>
  <a-pagination
    simple
    :current="currentPage"
    :total="totalPages"
    :page-size="1"
    @change="changePage"
  />
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
