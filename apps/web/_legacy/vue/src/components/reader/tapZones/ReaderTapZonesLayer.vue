<template>
  <div
    class="reader-tap-zones-layer"
    :class="{ 'is-disabled': disabled }"
    @click.stop="handleClick"
  ></div>
</template>

<script setup>
import { computed } from 'vue'
import { DEFAULT_READER_TAP_ZONES } from '@/store/appSettings'

const props = defineProps({
  config: {
    type: Object,
    default: () => DEFAULT_READER_TAP_ZONES
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['trigger'])

const normalizedConfig = computed(() => {
  const value = props.config && typeof props.config === 'object' ? props.config : DEFAULT_READER_TAP_ZONES
  return {
    boundaries: value.boundaries || DEFAULT_READER_TAP_ZONES.boundaries,
    actions: value.actions || DEFAULT_READER_TAP_ZONES.actions
  }
})

const resolveZoneKey = xRatio => {
  const boundaries = normalizedConfig.value.boundaries
  const left = Number(boundaries?.left ?? DEFAULT_READER_TAP_ZONES.boundaries.left)
  const right = Number(boundaries?.right ?? DEFAULT_READER_TAP_ZONES.boundaries.right)
  if (xRatio < left) {
    return 'left'
  }
  if (xRatio > right) {
    return 'right'
  }
  return 'middle'
}

const handleClick = event => {
  if (props.disabled) {
    return
  }
  const host = event.currentTarget
  if (!host || typeof host.getBoundingClientRect !== 'function') {
    return
  }
  const rect = host.getBoundingClientRect()
  if (!rect.width || !rect.height) {
    return
  }

  const xRatio = (event.clientX - rect.left) / rect.width
  const zoneKey = resolveZoneKey(xRatio)
  const action = normalizedConfig.value.actions?.[zoneKey] ?? 'none'
  emit('trigger', { zoneKey, action })
}
</script>

<style scoped>
.reader-tap-zones-layer {
  position: absolute;
  inset: 0;
  cursor: pointer;
  background: transparent;
}

.reader-tap-zones-layer.is-disabled {
  pointer-events: none;
}
</style>

