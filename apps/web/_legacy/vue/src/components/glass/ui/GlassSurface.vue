<script setup>
import { computed, useSlots } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  variant: {
    type: String,
    default: 'panel',
    validator: value => ['panel', 'card', 'plain'].includes(value)
  },
  padding: {
    type: String,
    default: 'md',
    validator: value => ['none', 'sm', 'md', 'lg'].includes(value)
  }
})

const slots = useSlots()

const hasHeader = computed(() => {
  return Boolean(
    props.title ||
      props.subtitle ||
      slots.title ||
      slots.subtitle ||
      slots.extra
  )
})
</script>

<template>
  <section
    class="glass-surface"
    :class="[
      `glass-surface--${variant}`,
      `glass-surface--pad-${padding}`
    ]"
  >
    <header v-if="hasHeader" class="glass-surface__header">
      <div class="glass-surface__heading">
        <div class="glass-surface__title-row">
          <slot name="title">
            <h3 v-if="title" class="glass-surface__title">
              {{ title }}
            </h3>
          </slot>
          <slot name="extra" />
        </div>
        <slot name="subtitle">
          <p v-if="subtitle" class="glass-surface__subtitle">
            {{ subtitle }}
          </p>
        </slot>
      </div>
    </header>

    <div class="glass-surface__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.glass-surface {
  border-radius: var(--manager-ui-radius-lg, 16px);
  border: 1px solid var(--manager-ui-surface-border, rgba(255, 255, 255, 0.18));
  background: var(--manager-ui-surface-bg, rgba(255, 255, 255, 0.72));
  box-shadow: var(--manager-ui-shadow, 0 12px 32px rgba(15, 23, 42, 0.1));
  backdrop-filter: var(--manager-ui-backdrop-filter, none);
  -webkit-backdrop-filter: var(--manager-ui-backdrop-filter, none);
  overflow: hidden;
}

.glass-surface--plain {
  border: none;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.glass-surface--card {
  border-radius: var(--manager-ui-radius-md, 14px);
}

.glass-surface__header {
  padding: 16px 18px;
  border-bottom: 1px solid var(--manager-ui-surface-border, rgba(255, 255, 255, 0.14));
}

.glass-surface__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.glass-surface__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--manager-ui-text, rgba(15, 23, 42, 0.92));
}

.glass-surface__subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--manager-ui-text-muted, rgba(15, 23, 42, 0.62));
}

.glass-surface__body {
  color: var(--manager-ui-text, rgba(15, 23, 42, 0.92));
}

.glass-surface--pad-none .glass-surface__body {
  padding: 0;
}

.glass-surface--pad-sm .glass-surface__body {
  padding: 12px;
}

.glass-surface--pad-md .glass-surface__body {
  padding: 16px 18px;
}

.glass-surface--pad-lg .glass-surface__body {
  padding: 20px 22px;
}
</style>
