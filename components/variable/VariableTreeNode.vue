<!--
  MClite - 变量树节点组件 v2
  递归组件，用于展示变量树的每个节点
  支持展开/折叠、编辑值、编辑字段名、复制、删除等操作
-->
<template>
  <div
    class="tree-node"
    :class="{
      'is-expanded': isExpanded,
      'is-leaf': node.isLeaf,
      'is-editing': isEditingValue || isEditingKey,
      'is-matched': node.matchesSearch,
      [`type-${node.type}`]: true,
    }"
  >
    <!-- 节点内容行 -->
    <div class="node-row" :style="{ paddingLeft: `${node.depth * 20 + 8}px` }">
      <!-- 展开/折叠按钮 -->
      <button v-if="!node.isLeaf" class="btn-toggle" @click.stop="handleToggle">
        <span class="toggle-icon">{{ isExpanded ? '▼' : '▶' }}</span>
      </button>
      <span v-else class="toggle-placeholder"></span>

      <!-- 类型图标 -->
      <span class="type-icon" :title="typeLabel">{{ typeIcon }}</span>

      <!-- 键名编辑/显示 -->
      <template v-if="isEditingKey">
        <input
          ref="keyInputRef"
          v-model="editKeyValue"
          type="text"
          class="key-input"
          @keydown.enter="saveKey"
          @keydown.escape="cancelEdit"
          @blur="saveKey"
        />
      </template>
      <template v-else>
        <span
          class="node-key"
          :class="{ 'is-meta': node.key === '$meta', 'is-editable': canEditKey }"
          @dblclick="startEditKey"
          :title="canEditKey ? '双击编辑字段名' : node.key"
        >
          <span class="key-text" v-html="highlightText(node.key)"></span>
        </span>
      </template>

      <!-- 分隔符和值 -->
      <template v-if="node.isLeaf || !isExpanded">
        <span class="separator">:</span>

        <!-- 值编辑/显示 -->
        <template v-if="isEditingValue">
          <div class="value-editor" @click.stop>
            <VariableEditor
              :value="node.value"
              :type="node.type"
              :path="node.path"
              @save="handleSaveValue"
              @cancel="cancelEdit"
            />
          </div>
        </template>
        <template v-else>
          <span
            class="node-value"
            :class="[`value-${node.type}`]"
            @dblclick.stop="startEditValue"
            :title="node.isLeaf ? '双击编辑值' : ''"
          >
            <span class="value-text" v-html="formatValue(node.value)"></span>
          </span>
        </template>
      </template>

      <!-- 子节点数量提示（折叠时显示） -->
      <span v-if="!node.isLeaf && !isExpanded" class="children-count">
        {{ getChildrenCount() }}
      </span>

      <!-- 操作按钮组 -->
      <div class="node-actions" v-if="!isEditingValue && !isEditingKey">
        <button class="btn-node-action" @click.stop="handleCopyPath" title="复制路径">📋</button>
        <button v-if="node.isLeaf" class="btn-node-action" @click.stop="startEditValue" title="编辑值">✏️</button>
        <button v-if="canEditKey" class="btn-node-action" @click.stop="startEditKey" title="编辑字段名">🏷️</button>
        <button v-if="!node.isLeaf" class="btn-node-action btn-add" @click.stop="handleAddChild" title="添加子项">
          ➕
        </button>
        <button class="btn-node-action btn-delete" @click.stop="handleDelete" title="删除">🗑️</button>
      </div>
    </div>

    <!-- 子节点 -->
    <div v-if="!node.isLeaf && isExpanded && node.children" class="node-children">
      <VariableTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :expanded-paths="expandedPaths"
        :editing-path="editingPath"
        :editing-key-path="editingKeyPath"
        :search-query="searchQuery"
        @toggle="$emit('toggle', $event)"
        @edit-value="$emit('edit-value', $event)"
        @edit-key="$emit('edit-key', $event)"
        @save-value="(path: string, value: any) => $emit('save-value', path, value)"
        @save-key="(oldPath: string, newKey: string) => $emit('save-key', oldPath, newKey)"
        @cancel="$emit('cancel')"
        @copy-path="$emit('copy-path', $event)"
        @delete="$emit('delete', $event)"
        @add-child="$emit('add-child', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import VariableEditor from './VariableEditor.vue';

// ============ Types ============

interface TreeNode {
  path: string;
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null' | 'undefined';
  children?: TreeNode[];
  depth: number;
  isLeaf: boolean;
  matchesSearch?: boolean;
}

// ============ Props ============
interface Props {
  node: TreeNode;
  expandedPaths: Set<string>;
  editingPath: string | null;
  editingKeyPath: string | null;
  searchQuery?: string;
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
});

// ============ Emits ============
const emit = defineEmits<{
  (e: 'toggle', path: string): void;
  (e: 'edit-value', path: string): void;
  (e: 'edit-key', path: string): void;
  (e: 'save-value', path: string, value: any): void;
  (e: 'save-key', oldPath: string, newKey: string): void;
  (e: 'cancel'): void;
  (e: 'copy-path', path: string): void;
  (e: 'delete', path: string): void;
  (e: 'add-child', path: string): void;
}>();

// ============ Refs ============
const keyInputRef = ref<HTMLInputElement | null>(null);
const editKeyValue = ref('');

// ============ 计算属性 ============

const isExpanded = computed(() => props.expandedPaths.has(props.node.path));
const isEditingValue = computed(() => props.editingPath === props.node.path);
const isEditingKey = computed(() => props.editingKeyPath === props.node.path);

// 判断是否可以编辑字段名（数组索引不可编辑）
const canEditKey = computed(() => {
  return !props.node.key.startsWith('[') && !props.node.key.endsWith(']');
});

const typeIcon = computed(() => {
  const icons: Record<string, string> = {
    string: '📝',
    number: '🔢',
    boolean: '✅',
    array: '📋',
    object: '📦',
    null: '⭕',
    undefined: '❓',
  };
  return icons[props.node.type] || '❓';
});

const typeLabel = computed(() => {
  const labels: Record<string, string> = {
    string: '字符串',
    number: '数字',
    boolean: '布尔值',
    array: '数组',
    object: '对象',
    null: '空值',
    undefined: '未定义',
  };
  return labels[props.node.type] || '未知类型';
});

// ============ 方法 ============

function formatValue(value: any): string {
  const type = props.node.type;

  if (value === null) return '<span class="literal">null</span>';
  if (value === undefined) return '<span class="literal">undefined</span>';

  switch (type) {
    case 'string': {
      const strValue = String(value);
      const maxLen = 60;
      const truncated = strValue.length > maxLen ? strValue.substring(0, maxLen) + '...' : strValue;
      const escaped = truncated.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const highlighted = highlightText(escaped);
      return `<span class="string-value">"${highlighted}"</span>`;
    }
    case 'number':
      return `<span class="number-value">${value}</span>`;
    case 'boolean':
      return `<span class="boolean-value">${value ? 'true' : 'false'}</span>`;
    case 'array':
      return `<span class="array-preview">[${(value as any[]).length} 项]</span>`;
    case 'object':
      const keys = Object.keys(value || {});
      return `<span class="object-preview">{${keys.length} 个键}</span>`;
    default:
      return String(value);
  }
}

function highlightText(text: string): string {
  if (!props.searchQuery) return text;
  const query = props.searchQuery.toLowerCase();
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(query);
  if (index === -1) return text;
  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);
  return `${before}<mark class="search-highlight">${match}</mark>${after}`;
}

function getChildrenCount(): string {
  if (!props.node.children) return '';
  const count = props.node.children.length;
  return props.node.type === 'array' ? `[${count}]` : `{${count}}`;
}

function handleToggle(): void {
  emit('toggle', props.node.path);
}

function startEditValue(): void {
  if (props.node.isLeaf) {
    emit('edit-value', props.node.path);
  }
}

function startEditKey(): void {
  if (canEditKey.value) {
    editKeyValue.value = props.node.key;
    emit('edit-key', props.node.path);
    nextTick(() => {
      keyInputRef.value?.focus();
      keyInputRef.value?.select();
    });
  }
}

function handleSaveValue(newValue: any): void {
  emit('save-value', props.node.path, newValue);
}

function saveKey(): void {
  const newKey = editKeyValue.value.trim();
  if (newKey && newKey !== props.node.key) {
    emit('save-key', props.node.path, newKey);
  } else {
    emit('cancel');
  }
}

function cancelEdit(): void {
  emit('cancel');
}

function handleCopyPath(): void {
  emit('copy-path', props.node.path);
}

function handleDelete(): void {
  emit('delete', props.node.path);
}

function handleAddChild(): void {
  emit('add-child', props.node.path);
}

// 监听编辑状态变化，自动聚焦输入框
watch(
  () => props.editingKeyPath,
  newPath => {
    if (newPath === props.node.path) {
      editKeyValue.value = props.node.key;
      nextTick(() => {
        keyInputRef.value?.focus();
        keyInputRef.value?.select();
      });
    }
  },
);
</script>

<style lang="scss" scoped>
.tree-node {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
}

// ============ 节点行 ============
.node-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  min-height: 28px;
  border-radius: 4px;
  cursor: default;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.05);

    .node-actions {
      opacity: 1;
    }
  }
}

// 匹配搜索时的高亮
.tree-node.is-matched > .node-row {
  background: rgba(255, 235, 59, 0.1);
}

// ============ 展开/折叠按钮 ============
.btn-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  color: var(--text-secondary, #888);
  transition: color 0.15s;

  .toggle-icon {
    font-size: 8px;
  }

  &:hover {
    color: var(--text-color, #fff);
  }
}

.toggle-placeholder {
  width: 16px;
  flex-shrink: 0;
}

// ============ 类型图标 ============
.type-icon {
  font-size: 12px;
  flex-shrink: 0;
  opacity: 0.7;
}

// ============ 键名 ============
.node-key {
  flex-shrink: 0;
  color: var(--text-color, #fff);
  font-weight: 500;

  &.is-meta {
    opacity: 0.5;
    font-style: italic;
  }

  &.is-editable {
    cursor: pointer;
    border-radius: 2px;
    padding: 0 2px;
    margin: 0 -2px;
    transition: background 0.15s;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  .key-text {
    :deep(mark.search-highlight) {
      background: rgba(255, 235, 59, 0.5);
      padding: 0 2px;
      border-radius: 2px;
      color: inherit;
    }
  }
}

.key-input {
  flex-shrink: 0;
  width: 150px;
  padding: 2px 6px;
  background: var(--bg-color, #333);
  border: 1px solid var(--primary-color, #007acc);
  border-radius: 4px;
  color: var(--text-color, #fff);
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  outline: none;
}

// ============ 分隔符 ============
.separator {
  color: var(--text-disabled, #666);
  margin: 0 4px;
}

// ============ 值显示 ============
.node-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  border-radius: 2px;
  padding: 0 2px;
  margin: 0 -2px;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .value-text {
    :deep(.string-value) {
      color: #ce9178;
    }

    :deep(.number-value) {
      color: #b5cea8;
    }

    :deep(.boolean-value) {
      color: #569cd6;
    }

    :deep(.literal) {
      color: #569cd6;
      font-style: italic;
    }

    :deep(.array-preview),
    :deep(.object-preview) {
      color: var(--text-secondary, #888);
      font-style: italic;
    }

    :deep(mark.search-highlight) {
      background: rgba(255, 235, 59, 0.5);
      padding: 0 2px;
      border-radius: 2px;
      color: inherit;
    }
  }
}

// ============ 值编辑器容器 ============
.value-editor {
  flex: 1;
  min-width: 200px;
}

// ============ 子节点数量 ============
.children-count {
  color: var(--text-disabled, #666);
  font-size: 11px;
  margin-left: 4px;
}

// ============ 操作按钮 ============
.node-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
  opacity: 0;
  transition: opacity 0.15s;
}

.btn-node-action {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--border-color, #444);
  }

  &.btn-add:hover {
    background: rgba(100, 255, 100, 0.1);
    border-color: #69db7c;
  }

  &.btn-delete:hover {
    background: rgba(255, 100, 100, 0.1);
    border-color: #ff6b6b;
  }
}

// ============ 子节点 ============
.node-children {
  border-left: 1px dashed var(--border-light, #333);
  margin-left: 24px;
}

// ============ 类型样式 ============
.tree-node {
  &.type-object > .node-row .type-icon {
    color: #dcdcaa;
  }

  &.type-array > .node-row .type-icon {
    color: #4ec9b0;
  }

  &.type-string > .node-row .type-icon {
    color: #ce9178;
  }

  &.type-number > .node-row .type-icon {
    color: #b5cea8;
  }

  &.type-boolean > .node-row .type-icon {
    color: #569cd6;
  }

  &.type-null > .node-row .type-icon,
  &.type-undefined > .node-row .type-icon {
    color: var(--text-disabled, #666);
  }
}
</style>
