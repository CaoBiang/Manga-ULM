<script setup>
import { computed, useAttrs } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  columns: {
    type: Array,
    default: () => []
  },
  dataSource: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: [String, Function],
    default: undefined
  },
  emptyText: {
    type: String,
    default: ''
  }
})

const attrs = useAttrs()

const locale = computed(() => {
  if (!props.emptyText) {
    return undefined
  }
  return { emptyText: props.emptyText }
})
</script>

<template>
  <a-table
    class="reader-table"
    size="small"
    :pagination="false"
    :columns="props.columns"
    :data-source="props.dataSource"
    :row-key="props.rowKey"
    :locale="locale"
    v-bind="attrs"
  >
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps" />
    </template>
  </a-table>
</template>

<style scoped>
.reader-table {
  background: transparent;
}

.reader-table :deep(.ant-table) {
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
}

.reader-table :deep(.ant-table-container) {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
}

.reader-table :deep(.ant-table-thead > tr > th) {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.reader-table :deep(.ant-table-tbody > tr > td) {
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.reader-table :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: none;
}

.reader-table :deep(.ant-table-tbody > tr.ant-table-row:hover > td) {
  background: rgba(255, 255, 255, 0.06);
}

.reader-table :deep(.ant-typography),
.reader-table :deep(.ant-typography.ant-typography-secondary) {
  color: rgba(255, 255, 255, 0.92);
}

.reader-table :deep(.ant-empty-description) {
  color: rgba(255, 255, 255, 0.72);
}
</style>

