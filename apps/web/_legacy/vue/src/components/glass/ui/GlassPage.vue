<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  padding: {
    type: String,
    default: 'md',
    validator: value => ['sm', 'md', 'lg'].includes(value)
  }
})

const hasHeader = computed(() => Boolean(props.title || props.subtitle))
</script>

<template>
  <div class="glass-page" :class="`glass-page--pad-${padding}`">
    <div v-if="hasHeader || $slots.extra" class="glass-page__header">
      <div v-if="hasHeader" class="glass-page__heading">
        <h1 v-if="title" class="glass-page__title">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="glass-page__subtitle">
          {{ subtitle }}
        </p>
      </div>
      <div v-if="$slots.extra" class="glass-page__extra">
        <slot name="extra" />
      </div>
    </div>

    <div class="glass-page__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.glass-page {
  width: 100%;
}

.glass-page--pad-sm {
  padding: 16px;
}

.glass-page--pad-md {
  padding: 16px;
}

.glass-page--pad-lg {
  padding: 18px;
}

@media (min-width: 768px) {
  .glass-page--pad-sm {
    padding: 18px;
  }

  .glass-page--pad-md {
    padding: 24px;
  }

  .glass-page--pad-lg {
    padding: 32px;
  }
}

.glass-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.glass-page__heading {
  min-width: 0;
}

.glass-page__title {
  margin: 0;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0.01em;
  color: var(--manager-ui-text, rgba(15, 23, 42, 0.92));
}

.glass-page__subtitle {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--manager-ui-text-muted, rgba(15, 23, 42, 0.62));
}

.glass-page__extra {
  margin-left: auto;
  flex: 0 0 auto;
}
</style>
