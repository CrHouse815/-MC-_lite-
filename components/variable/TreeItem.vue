<!--
  MClite - 树形条目组件
  递归组件，用于展示变量树的每个节点
  支持展开/折叠、编辑、删除等操作
-->
<template>
  <div class="tree-item" :class="{ 'is-expanded': isExpanded, 'is-match': isMatch }">
    <!-- 节点行 -->
    <div
      class="item-row"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
      @click="handleRowClick"
      @mouseenter="showActions = true"
      @mouseleave="showActions = false"
    >
      <!-- 展开/折叠图标 -->
      <span class="toggle-btn" v-if="isExpandable" @click.stop="$emit('toggle', path)">
        <svg v-if="isExpanded" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 9l-7 7-7-7" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
      <span v-else class="toggle-placeholder"></span>

      <!-- 键名 -->
      <span class="item-key" :class="{ 'is-meta': name === '$meta' }">{{ displayName }}</span>

      <!-- 分隔符 -->
      <span class="separator">:</span>

      <!-- 值显示/编辑 -->
      <template v-if="isEditing">
        <div class="inline-editor" @click.stop>
          <input
            v-if="valueType === 'string'"
            ref="editorInput"
            type="text"
            v-model="editValue"
            class="edit-input"
            @keydown.enter="saveEdit"
            @keydown.escape="$emit('cancel')"
          />
          <input
            v-else-if="valueType === 'number'"
            ref="editorInput"
            type="number"
            v-model.number="editValue"
            class="edit-input"
            step="any"
            @keydown.enter="saveEdit"
            @keydown.escape="$emit('cancel')"
          />
          <select
            v-else-if="valueType === 'boolean'"
            ref="editorInput"
            v-model="editValue"
            class="edit-select"
            @change="saveEdit"
          >
            <option :value="true">true</option>
            <option :value="false">false</option>
          </select>
          <div v-else class="edit-actions">
            <button class="btn-edit-save" @click="saveEdit">✓</button>
            <button class="btn-edit-cancel" @click="$emit('cancel')">✗</button>
          </div>
        </div>
      </template>
      <template v-else>
        <span class="item-value" :class="[`type-${valueType}`]" @dblclick.stop="startEdit">
          {{ formattedValue }}
        </span>
      </template>

      <!-- 子节点数量提示 -->
      <span v-if="isExpandable && !isExpanded" class="children-hint">
        {{ childrenHint }}
      </span>

      <!-- 操作按钮 -->
      <div class="item-actions" v-show="showActions && !isEditing">
        <button class="action-btn" @click.stop="$emit('copy-path', path)" title="复制路径">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        </button>
        <button v-if="!isExpandable" class="action-btn" @click.stop="startEdit" title="编辑">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button v-if="isExpandable" class="action-btn" @click.stop="$emit('add-child', path)" title="添加子项">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </button>
        <button class="action-btn action-delete" @click.stop="$emit('delete', path)" title="删除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 子节点 -->
    <div v-if="isExpandable && isExpanded" class="item-children">
      <TreeItem
        v-for="(childValue, childKey) in childEntries"
        :key="childKey"
        :name="String(childKey)"
        :value="childValue"
        :path="getChildPath(childKey)"
        :depth="depth + 1"
        :expanded-paths="expandedPaths"
        :editing-path="editingPath"
        :search-query="searchQuery"
        @toggle="$emit('toggle', $event)"
        @edit="$emit('edit', $event)"
        @save="(p: string, v: any) => $emit('save', p, v)"
        @cancel="$emit('cancel')"
        @delete="$emit('delete', $event)"
        @add-child="$emit('add-child', $event)"
        @copy-path="$emit('copy-path', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';

// ============ Props ============
interface Props {
  name: string;
  value: any;
  path: string;
  depth: number;
  expandedPaths: Set<string>;
  editingPath: string | null;
  searchQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
});

// ============ Emits ============
const emit = defineEmits<{
  (e: 'toggle', path: string): void;
  (e: 'edit', path: string): void;
  (e: 'save', path: string, value: any): void;
  (e: 'cancel'): void;
  (e: 'delete', path: string): void;
  (e: 'add-child', path: string): void;
  (e: 'copy-path', path: string): void;
}>();

// ============ Refs ============
const editorInput = ref<HTMLInputElement | HTMLSelectElement | null>(null);
const showActions = ref(false);
const editValue = ref<any>(null);

// ============ 计算属性 ============

const valueType = computed(() => {
  if (props.value === null) return 'null';
  if (props.value === undefined) return 'undefined';
  if (Array.isArray(props.value)) return 'array';
  return typeof props.value;
});

const isExpandable = computed(() => {
  return valueType.value === 'object' || valueType.value === 'array';
});

const isExpanded = computed(() => {
  return props.expandedPaths.has(props.path);
});

const isEditing = computed(() => {
  return props.editingPath === props.path;
});

const isMatch = computed(() => {
  if (!props.searchQuery) return false;
  const query = props.searchQuery.toLowerCase();
  return (
    props.path.toLowerCase().includes(query) ||
    props.name.toLowerCase().includes(query) ||
    (!isExpandable.value && String(props.value).toLowerCase().includes(query))
  );
});

const displayName = computed(() => {
  // 数组索引显示为 [0], [1] 等
  if (/^\d+$/.test(props.name)) {
    return `[${props.name}]`;
  }
  return props.name;
});

const formattedValue = computed(() => {
  if (props.value === null) return 'null';
  if (props.value === undefined) return 'undefined';

  switch (valueType.value) {
    case 'string': {
      const str = String(props.value);
      const maxLen = 80;
      const display = str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
      return `"${display}"`;
    }
    case 'number':
      return String(props.value);
    case 'boolean':
      return props.value ? 'true' : 'false';
    case 'array':
      return `Array(${props.value.length})`;
    case 'object':
      const keys = Object.keys(props.value);
      return `Object {${keys.length}}`;
    default:
      return String(props.value);
  }
});

const childrenHint = computed(() => {
  if (valueType.value === 'array') {
    return `[${props.value.length}]`;
  }
  if (valueType.value === 'object') {
    return `{${Object.keys(props.value).length}}`;
  }
  return '';
});

const childEntries = computed(() => {
  if (valueType.value === 'array') {
    return props.value;
  }
  if (valueType.value === 'object') {
    return props.value;
  }
  return {};
});

// ============ 方法 ============

function getChildPath(childKey: string | number): string {
  if (valueType.value === 'array') {
    return `${props.path}[${childKey}]`;
  }
  return `${props.path}.${childKey}`;
}

function handleRowClick(): void {
  if (isExpandable.value) {
    emit('toggle', props.path);
  }
}

function startEdit(): void {
  if (isExpandable.value) return;
  editValue.value = props.value;
  emit('edit', props.path);
  nextTick(() => {
    editorInput.value?.focus();
    if (editorInput.value instanceof HTMLInputElement) {
      editorInput.value.select();
    }
  });
}

function saveEdit(): void {
  emit('save', props.path, editValue.value);
}

// 监听编辑状态变化
watch(
  () => props.editingPath,
  newPath => {
    if (newPath === props.path) {
      editValue.value = props.value;
      nextTick(() => {
        editorInput.value?.focus();
        if (editorInput.value instanceof HTMLInputElement) {
          editorInput.value.select();
        }
      });
    }
  },
);
</script>

<style lang="scss" scoped>
$font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;

// 类型颜色 - 日间模式（深色文字，浅色背景）
// 使用更饱和、更深的颜色以提高对比度
$type-string-light: #b35000; // 深橙色
$type-number-light: #2e7d32; // 深绿色
$type-boolean-light: #0d47a1; // 深蓝色
$type-array-light: #7b1fa2; // 深紫色
$type-object-light: #6d5600; // 深黄褐色
$type-null-light: #616161; // 深灰色

// 类型颜色 - 夜间模式（浅色文字，深色背景）
$type-string-dark: #e9a178;
$type-number-dark: #b8d7a3;
$type-boolean-dark: #7eb8da;
$type-array-dark: #c792ea;
$type-object-dark: #dcdcaa;
$type-null-dark: #9e9e9e;

.tree-item {
  // 继承父组件的CSS变量
  font-family: $font-mono;
  font-size: 13px;
  line-height: 1.4;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  padding-right: 16px;
  min-height: 26px;
  cursor: default;
  border-radius: 4px;
  transition: background 0.1s;

  &:hover {
    background: var(--vm-bg-hover, var(--bg-hover, #f0f0f0));
  }
}

.tree-item.is-match > .item-row {
  background: rgba(255, 235, 59, 0.15);
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
  color: var(--vm-text-muted, var(--text-disabled, #9a9996));
  transition: color 0.1s;

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover {
    color: var(--vm-text-primary, var(--text-color, #2e3436));
  }
}

.toggle-placeholder {
  width: 16px;
  flex-shrink: 0;
}

.item-key {
  color: var(--vm-text-primary, var(--text-color, #2e3436));
  font-weight: 500;
  flex-shrink: 0;

  &.is-meta {
    color: var(--vm-text-muted, var(--text-disabled, #9a9996));
    font-style: italic;
  }
}

.separator {
  color: var(--vm-text-muted, var(--text-disabled, #9a9996));
  margin: 0 4px;
  flex-shrink: 0;
}

.item-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  // 日间模式使用深色，夜间模式使用浅色
  &.type-string {
    color: $type-string-light;
  }
  &.type-number {
    color: $type-number-light;
  }
  &.type-boolean {
    color: $type-boolean-light;
  }
  &.type-array {
    color: $type-array-light;
    font-style: italic;
  }
  &.type-object {
    color: $type-object-light;
    font-style: italic;
  }
  &.type-null,
  &.type-undefined {
    color: $type-null-light;
    font-style: italic;
  }
}

// 夜间模式覆盖
:root.dark-theme {
  .item-value {
    &.type-string {
      color: $type-string-dark;
    }
    &.type-number {
      color: $type-number-dark;
    }
    &.type-boolean {
      color: $type-boolean-dark;
    }
    &.type-array {
      color: $type-array-dark;
    }
    &.type-object {
      color: $type-object-dark;
    }
    &.type-null,
    &.type-undefined {
      color: $type-null-dark;
    }
  }
}

.children-hint {
  color: var(--vm-text-muted, var(--text-disabled, #9a9996));
  font-size: 11px;
  margin-left: 4px;
}

// ============ 内联编辑器 ============
.inline-editor {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.edit-input,
.edit-select {
  flex: 1;
  min-width: 120px;
  max-width: 400px;
  padding: 2px 8px;
  background: var(--vm-bg-tertiary, var(--bg-tertiary, #deddda));
  border: 1px solid var(--vm-accent-color, var(--primary-color, #1a5fb4));
  border-radius: 4px;
  font-family: $font-mono;
  font-size: 13px;
  color: var(--vm-text-primary, var(--text-color, #2e3436));
  outline: none;
}

.edit-select {
  cursor: pointer;
}

.edit-actions {
  display: flex;
  gap: 4px;
}

.btn-edit-save,
.btn-edit-cancel {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.1s;
}

.btn-edit-save {
  background: var(--vm-success-color, var(--success-color, #26a269));
  color: white;

  &:hover {
    filter: brightness(0.9);
  }
}

.btn-edit-cancel {
  background: var(--vm-bg-tertiary, var(--bg-tertiary, #deddda));
  color: var(--vm-text-secondary, var(--text-secondary, #5e5c64));

  &:hover {
    background: var(--vm-bg-hover, var(--bg-hover, #f0f0f0));
    color: var(--vm-text-primary, var(--text-color, #2e3436));
  }
}

// ============ 操作按钮 ============
.item-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--vm-text-muted, var(--text-disabled, #9a9996));
  cursor: pointer;
  transition: all 0.1s;

  svg {
    width: 13px;
    height: 13px;
  }

  &:hover {
    background: var(--vm-bg-hover, var(--bg-hover, #f0f0f0));
    color: var(--vm-text-primary, var(--text-color, #2e3436));
  }

  &.action-delete:hover {
    background: rgba(192, 28, 40, 0.15);
    color: var(--vm-danger-color, var(--danger-color, #c01c28));
  }
}

// ============ 子节点 ============
.item-children {
  border-left: 1px solid var(--vm-border-color, var(--border-color, #c0bfbc));
  margin-left: 15px;
}
</style>
