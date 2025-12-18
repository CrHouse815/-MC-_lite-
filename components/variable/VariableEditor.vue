<!--
  MClite - 变量编辑器组件 v2
  支持不同类型变量的编辑：string、number、boolean、array、object
  内联编辑体验优化
-->
<template>
  <div class="variable-editor" :class="[`type-${type}`]">
    <!-- 字符串编辑 -->
    <template v-if="type === 'string'">
      <input
        ref="inputRef"
        type="text"
        v-model="localValue"
        class="editor-input"
        @keydown.enter="handleSave"
        @keydown.escape="handleCancel"
        placeholder="输入字符串值..."
      />
    </template>

    <!-- 数字编辑 -->
    <template v-else-if="type === 'number'">
      <input
        ref="inputRef"
        type="number"
        v-model.number="localValue"
        class="editor-input"
        step="any"
        @keydown.enter="handleSave"
        @keydown.escape="handleCancel"
        placeholder="输入数字..."
      />
    </template>

    <!-- 布尔值编辑 -->
    <template v-else-if="type === 'boolean'">
      <div class="boolean-editor">
        <button class="bool-btn" :class="{ active: localValue === true }" @click="localValue = true">
          <span class="bool-icon">✓</span>
          <span class="bool-label">true</span>
        </button>
        <button class="bool-btn" :class="{ active: localValue === false }" @click="localValue = false">
          <span class="bool-icon">✗</span>
          <span class="bool-label">false</span>
        </button>
      </div>
    </template>

    <!-- JSON编辑（数组或对象） -->
    <template v-else-if="type === 'array' || type === 'object'">
      <div class="json-editor">
        <textarea
          ref="textareaRef"
          v-model="jsonText"
          class="editor-textarea"
          :class="{ 'has-error': jsonError }"
          @keydown.ctrl.enter="handleSave"
          @keydown.escape="handleCancel"
          placeholder="输入JSON..."
          rows="4"
        ></textarea>
        <div v-if="jsonError" class="json-error">
          <span class="error-icon">⚠️</span>
          <span class="error-text">{{ jsonError }}</span>
        </div>
        <div class="json-hint">Ctrl+Enter 保存 | Esc 取消</div>
      </div>
    </template>

    <!-- null/undefined 编辑 -->
    <template v-else>
      <div class="null-editor">
        <select v-model="nullType" class="null-select">
          <option value="null">null</option>
          <option value="undefined">undefined</option>
          <option value="empty-string">空字符串 ""</option>
          <option value="zero">数字 0</option>
          <option value="false">false</option>
          <option value="empty-object">空对象 {}</option>
          <option value="empty-array">空数组 []</option>
        </select>
      </div>
    </template>

    <!-- 操作按钮 -->
    <div class="editor-actions">
      <button class="btn-save" @click="handleSave" :disabled="!canSave" title="保存">✓</button>
      <button class="btn-cancel" @click="handleCancel" title="取消">✗</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';

// ============ Props ============
interface Props {
  value: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'undefined';
  path: string;
}

const props = defineProps<Props>();

// ============ Emits ============
const emit = defineEmits<{
  (e: 'save', value: any): void;
  (e: 'cancel'): void;
}>();

// ============ Refs ============
const inputRef = ref<HTMLInputElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// ============ 状态 ============
const localValue = ref<any>(props.value);
const jsonText = ref('');
const jsonError = ref<string | null>(null);
const nullType = ref<string>('null');

// ============ 计算属性 ============

const canSave = computed(() => {
  if (props.type === 'array' || props.type === 'object') {
    return !jsonError.value && jsonText.value.trim().length > 0;
  }
  return true;
});

// ============ 方法 ============

function initializeValue(): void {
  if (props.type === 'array' || props.type === 'object') {
    try {
      jsonText.value = JSON.stringify(props.value, null, 2);
      jsonError.value = null;
    } catch (e) {
      jsonText.value = '';
      jsonError.value = '无法序列化当前值';
    }
  } else {
    localValue.value = props.value;
  }

  if (props.value === null) {
    nullType.value = 'null';
  } else if (props.value === undefined) {
    nullType.value = 'undefined';
  }
}

function validateJson(): void {
  if (!jsonText.value.trim()) {
    jsonError.value = 'JSON 不能为空';
    return;
  }

  try {
    JSON.parse(jsonText.value);
    jsonError.value = null;
  } catch (e) {
    jsonError.value = (e as Error).message;
  }
}

function getFinalValue(): any {
  switch (props.type) {
    case 'string':
      return String(localValue.value ?? '');

    case 'number':
      const num = Number(localValue.value);
      return isNaN(num) ? 0 : num;

    case 'boolean':
      return Boolean(localValue.value);

    case 'array':
    case 'object':
      try {
        return JSON.parse(jsonText.value);
      } catch {
        return props.value;
      }

    case 'null':
    case 'undefined':
      switch (nullType.value) {
        case 'null':
          return null;
        case 'undefined':
          return undefined;
        case 'empty-string':
          return '';
        case 'zero':
          return 0;
        case 'false':
          return false;
        case 'empty-object':
          return {};
        case 'empty-array':
          return [];
        default:
          return null;
      }

    default:
      return localValue.value;
  }
}

function handleSave(): void {
  if (!canSave.value) return;
  const finalValue = getFinalValue();
  emit('save', finalValue);
}

function handleCancel(): void {
  emit('cancel');
}

// ============ 监听 ============

watch(jsonText, () => {
  if (props.type === 'array' || props.type === 'object') {
    validateJson();
  }
});

// ============ 生命周期 ============

onMounted(() => {
  initializeValue();

  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.focus();
      inputRef.value.select();
    } else if (textareaRef.value) {
      textareaRef.value.focus();
    }
  });
});
</script>

<style lang="scss" scoped>
// ============ 基础变量 ============
$font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
$font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;

$bg-primary: #1a1a1a;
$bg-secondary: #222222;
$bg-tertiary: #2a2a2a;

$border-color: #3a3a3a;
$text-primary: #e8e8e8;
$text-secondary: #a0a0a0;
$text-muted: #666666;

$accent-color: #4a9eff;
$success-color: #4ade80;
$danger-color: #f87171;

$type-boolean: #7eb8da;

.variable-editor {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: $bg-secondary;
  border: 1px solid $accent-color;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

// ============ 输入框 ============
.editor-input {
  flex: 1;
  min-width: 140px;
  padding: 8px 12px;
  border: 1px solid $border-color;
  border-radius: 6px;
  font-size: 14px;
  font-family: $font-mono;
  background: $bg-tertiary;
  color: $text-primary;
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: $accent-color;
  }

  &::placeholder {
    color: $text-muted;
  }
}

input[type='number'].editor-input {
  -moz-appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}

// ============ 布尔值编辑器 ============
.boolean-editor {
  display: flex;
  gap: 6px;
}

.bool-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid $border-color;
  border-radius: 6px;
  background: $bg-tertiary;
  color: $text-secondary;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;

  .bool-icon {
    font-size: 12px;
  }

  &:hover {
    background: #333;
    color: $text-primary;
  }

  &.active {
    border-color: $type-boolean;
    background: rgba($type-boolean, 0.15);
    color: $type-boolean;
  }
}

// ============ JSON 编辑器 ============
.json-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 220px;
}

.editor-textarea {
  width: 100%;
  min-height: 100px;
  padding: 10px 12px;
  border: 1px solid $border-color;
  border-radius: 6px;
  font-family: $font-mono;
  font-size: 13px;
  line-height: 1.5;
  background: $bg-tertiary;
  color: $text-primary;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: $accent-color;
  }

  &.has-error {
    border-color: $danger-color;
    background: rgba($danger-color, 0.05);
  }
}

.json-error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 10px;
  background: rgba($danger-color, 0.1);
  border-radius: 6px;

  .error-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .error-text {
    font-size: 12px;
    color: $danger-color;
    word-break: break-all;
  }
}

.json-hint {
  font-size: 11px;
  color: $text-muted;
  text-align: right;
}

// ============ Null 编辑器 ============
.null-editor {
  flex: 1;
}

.null-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid $border-color;
  border-radius: 6px;
  font-size: 14px;
  background: $bg-tertiary;
  color: $text-primary;
  outline: none;
  cursor: pointer;

  &:focus {
    border-color: $accent-color;
  }
}

// ============ 操作按钮 ============
.editor-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-save,
.btn-cancel {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-save {
  background: $success-color;
  color: #1a1a1a;

  &:hover:not(:disabled) {
    background: darken($success-color, 8%);
  }
}

.btn-cancel {
  background: $bg-tertiary;
  border: 1px solid $border-color;
  color: $text-secondary;

  &:hover {
    background: #333;
    color: $text-primary;
  }
}

// ============ JSON 编辑器布局调整 ============
.variable-editor.type-array,
.variable-editor.type-object {
  flex-direction: column;
  align-items: stretch;

  .editor-actions {
    justify-content: flex-end;
    margin-top: 6px;
  }
}
</style>
