<template>
  <div class="reader-input" :class="{ 'is-disabled': disabled }">
    <input
      ref="inputRef"
      class="reader-input__control"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      :inputmode="inputmode"
      @input="handleInput"
      @keyup.enter="emit('pressEnter')"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  maxlength: {
    type: Number,
    default: undefined
  },
  inputmode: {
    type: String,
    default: undefined
  }
})

const emit = defineEmits(['update:modelValue', 'pressEnter'])

const inputRef = ref(null)

const handleInput = event => {
  emit('update:modelValue', event.target.value)
}

const focus = () => {
  inputRef.value?.focus?.()
}

const select = () => {
  inputRef.value?.select?.()
}

defineExpose({ focus, select })
</script>

<style scoped>
.reader-input {
  --reader-input-surface: var(--reader-ui-control-bg, rgba(18, 18, 18, 0.4));
  --reader-input-border: var(--reader-ui-control-border, rgba(255, 255, 255, 0.14));
  --reader-input-text: var(--reader-ui-control-text, rgba(255, 255, 255, 0.92));
  --reader-input-placeholder: var(--reader-ui-control-placeholder, rgba(255, 255, 255, 0.55));
  --reader-input-shadow: var(--reader-ui-control-shadow, 0 8px 24px rgba(0, 0, 0, 0.35));
  --reader-input-focus: var(--reader-ui-focus-ring, 0 0 0 2px rgba(255, 255, 255, 0.16));

  width: 100%;
}

.reader-input__control {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;

  border: 1px solid var(--reader-input-border);
  background: var(--reader-input-surface);
  backdrop-filter: var(--reader-ui-control-backdrop-filter, none);
  -webkit-backdrop-filter: var(--reader-ui-control-backdrop-filter, none);
  color: var(--reader-input-text);
  box-shadow: var(--reader-input-shadow);

  outline: none;
  transition:
    background 120ms ease,
    border-color 120ms ease,
    box-shadow 120ms ease,
    opacity 120ms ease;
}

.reader-input__control::placeholder {
  color: var(--reader-input-placeholder);
}

.reader-input__control:focus {
  border-color: rgba(255, 255, 255, 0.3);
  box-shadow: var(--reader-input-shadow), var(--reader-input-focus);
}

.reader-input__control:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
