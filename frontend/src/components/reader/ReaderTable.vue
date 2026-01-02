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
  --reader-table-bg: rgba(255, 255, 255, 0.03);
  --reader-table-border: rgba(255, 255, 255, 0.1);
  --reader-table-separator: var(--reader-table-border);
  --reader-table-head-bg: rgba(255, 255, 255, 0.06);
  --reader-table-hover-bg: rgba(255, 255, 255, 0.07);
  --reader-table-text: rgba(255, 255, 255, 0.92);
  --reader-table-text-muted: rgba(255, 255, 255, 0.72);

  background: transparent;
}

.reader-table :deep(.ant-table) {
  background: transparent;
  color: var(--reader-table-text);
}

.reader-table :deep(.ant-table-container) {
  border: 1px solid var(--reader-table-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--reader-table-bg);
}

.reader-table :deep(.ant-table-thead > tr > th) {
  background: var(--reader-table-head-bg);
  color: var(--reader-table-text);
  border-bottom: 1px solid var(--reader-table-separator) !important;
}

.reader-table :deep(.ant-table-tbody > tr > td) {
  background: transparent;
  color: var(--reader-table-text);
  border-top: 1px solid var(--reader-table-separator) !important;
  border-bottom: none !important;
  transition: background 140ms ease;
}

.reader-table :deep(.ant-table-tbody > tr:last-child > td) {
  border-bottom: none !important;
}

.reader-table :deep(.ant-table-tbody > tr.ant-table-placeholder > td) {
  background: transparent;
}

.reader-table :deep(.ant-table-tbody > tr.ant-table-placeholder:hover > td) {
  background: var(--reader-table-hover-bg) !important;
}

.reader-table :deep(.ant-table-tbody > tr.ant-table-row:hover > td),
.reader-table :deep(.ant-table-tbody > tr.ant-table-row-hover > td),
.reader-table :deep(.ant-table-tbody > tr > td.ant-table-cell-row-hover) {
  background: var(--reader-table-hover-bg) !important;
}

.reader-table :deep(.ant-typography),
.reader-table :deep(.ant-typography.ant-typography-secondary) {
  color: var(--reader-table-text);
}

.reader-table :deep(.ant-empty-description) {
  color: var(--reader-table-text-muted);
}
</style>
