<template>
  <button
    class="reader-button"
    :class="[
      `reader-button--appearance-${appearance}`,
      `reader-button--${variant}`,
      `reader-button--${size}`,
      shape ? `reader-button--${shape}` : '',
      { 'is-active': active, 'is-icon-only': isIconOnly }
    ]"
    :type="nativeType"
    :disabled="disabled"
    :aria-label="resolvedAriaLabel"
    @click="handleClick"
  >
    <span v-if="$slots.icon" class="reader-button__icon">
      <slot name="icon" />
    </span>
    <span v-if="$slots.default" class="reader-button__text">
      <slot />
    </span>
  </button>
</template>

<script setup>
import { computed, useSlots } from 'vue'

const props = defineProps({
  appearance: {
    type: String,
    default: 'floating',
    validator: value => ['floating', 'embedded'].includes(value)
  },
  variant: {
    type: String,
    default: 'default',
    validator: value => ['default', 'primary', 'danger', 'ghost'].includes(value)
  },
  size: {
    type: String,
    default: 'md',
    validator: value => ['sm', 'md', 'lg'].includes(value)
  },
  shape: {
    type: String,
    default: '',
    validator: value => ['', 'circle', 'round'].includes(value)
  },
  active: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  ariaLabel: {
    type: String,
    default: ''
  },
  nativeType: {
    type: String,
    default: 'button',
    validator: value => ['button', 'submit', 'reset'].includes(value)
  }
})

const emit = defineEmits(['click'])
const slots = useSlots()

const isIconOnly = computed(() => Boolean(slots.icon) && !Boolean(slots.default))

const resolvedAriaLabel = computed(() => {
  if (!isIconOnly.value) {
    return undefined
  }
  const trimmed = String(props.ariaLabel || '').trim()
  return trimmed ? trimmed : undefined
})

const handleClick = event => {
  if (props.disabled) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<style scoped>
.reader-button {
  --reader-button-surface: var(--reader-ui-control-bg, rgba(18, 18, 18, 0.4));
  --reader-button-surface-hover: var(--reader-ui-control-bg-hover, rgba(24, 24, 24, 0.48));
  --reader-button-surface-active: var(--reader-ui-control-bg-active, rgba(24, 24, 24, 0.48));
  --reader-button-border: var(--reader-ui-control-border, rgba(255, 255, 255, 0.14));
  --reader-button-border-hover: var(--reader-ui-control-border-hover, rgba(255, 255, 255, 0.22));
  --reader-button-text: var(--reader-ui-control-text, rgba(255, 255, 255, 0.92));
  --reader-button-text-muted: var(--reader-ui-control-text-muted, rgba(255, 255, 255, 0.8));
  --reader-button-shadow: var(--reader-ui-control-shadow, 0 8px 24px rgba(0, 0, 0, 0.35));
  --reader-button-focus: var(--reader-ui-focus-ring, 0 0 0 2px rgba(255, 255, 255, 0.16));

  appearance: none;
  border: 1px solid var(--reader-button-border);
  background: var(--reader-button-surface);
  backdrop-filter: var(--reader-ui-control-backdrop-filter, none);
  -webkit-backdrop-filter: var(--reader-ui-control-backdrop-filter, none);
  color: var(--reader-button-text);
  box-shadow: var(--reader-button-shadow);
  border-radius: 10px;
  padding: 0 12px;
  height: 36px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  transition:
    background 120ms ease,
    border-color 120ms ease,
    transform 120ms ease,
    box-shadow 120ms ease,
    opacity 120ms ease;
}

.reader-button:hover:not(:disabled) {
  border-color: var(--reader-button-border-hover);
  background: var(--reader-button-surface-hover);
}

.reader-button:active:not(:disabled) {
  transform: translateY(1px);
  background: var(--reader-button-surface-active);
  opacity: 0.92;
}

.reader-button:focus-visible {
  outline: none;
  box-shadow: var(--reader-button-shadow), var(--reader-button-focus);
}

.reader-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.reader-button__icon :deep(svg) {
  display: block;
}

.reader-button--sm {
  height: 30px;
  padding: 0 10px;
  border-radius: 9px;
  font-size: 13px;
}

.reader-button--md {
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 14px;
}

.reader-button--lg {
  height: 44px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 15px;
}

.reader-button--circle {
  border-radius: 999px;
  padding: 0;
  width: 36px;
}

.reader-button--circle.reader-button--sm {
  width: 30px;
}

.reader-button--circle.reader-button--lg {
  width: 44px;
}

.reader-button.is-icon-only .reader-button__text {
  display: none;
}

.reader-button--appearance-embedded {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  --reader-button-surface-hover: transparent;
  --reader-button-surface-active: transparent;
  --reader-button-border-hover: rgba(255, 255, 255, 0.18);
}

.reader-button--appearance-embedded:hover:not(:disabled) {
  background: transparent;
  border-color: var(--reader-button-border-hover);
}

.reader-button--appearance-embedded:active:not(:disabled) {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.22);
}

.reader-button--appearance-embedded.reader-button--primary,
.reader-button--appearance-embedded.reader-button.is-active {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.32);
  color: rgba(255, 255, 255, 0.98);
}

.reader-button--appearance-embedded.reader-button--primary:hover:not(:disabled),
.reader-button--appearance-embedded.reader-button.is-active:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.38);
}

.reader-button--appearance-embedded.reader-button--ghost {
  background: transparent;
  border-color: transparent;
  color: rgba(255, 255, 255, 0.86);
}

.reader-button--appearance-embedded.reader-button--ghost:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.94);
}

.reader-button--ghost {
  background: transparent;
  box-shadow: none;
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--reader-button-text-muted);
  --reader-button-surface-hover: rgba(255, 255, 255, 0.06);
  --reader-button-border-hover: rgba(255, 255, 255, 0.18);
  --reader-button-surface-active: rgba(255, 255, 255, 0.08);
}

.reader-button--ghost:hover:not(:disabled) {
  box-shadow: none;
}

.reader-button--primary {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.28);
  color: rgba(255, 255, 255, 0.96);
  --reader-button-surface-hover: rgba(255, 255, 255, 0.16);
  --reader-button-border-hover: rgba(255, 255, 255, 0.34);
  --reader-button-surface-active: rgba(255, 255, 255, 0.18);
}

.reader-button--primary:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.98);
}

.reader-button.is-active {
  background: var(--reader-button-surface-active);
  border-color: var(--reader-button-border-hover);
  color: rgba(255, 255, 255, 0.98);
  box-shadow:
    var(--reader-button-shadow),
    0 0 0 1px rgba(255, 255, 255, 0.16),
    0 0 18px rgba(255, 255, 255, 0.06);
}

.reader-button--danger {
  background: rgba(255, 59, 48, 0.12);
  border-color: rgba(255, 59, 48, 0.32);
  color: rgba(255, 255, 255, 0.96);
  --reader-button-surface-hover: rgba(255, 59, 48, 0.16);
  --reader-button-border-hover: rgba(255, 59, 48, 0.38);
  --reader-button-surface-active: rgba(255, 59, 48, 0.18);
}

.reader-button--danger:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.98);
}
</style>
