<!--
  MClite - 变量变化面板组件
  显示AI回复结束后发生变化的变量列表
  支持展开/收起、类型颜色区分、旧值新值对比
-->
<template>
  <div class="variable-changes-panel" :class="{ expanded: isExpanded, collapsed: !isExpanded }">
    <!-- 面板头部 - 始终可见 -->
    <div class="panel-header" @click="toggleExpand">
      <div class="header-left">
        <span class="header-icon">📊</span>
        <span class="header-title">变量变化</span>
        <span class="changes-count" v-if="changes.length > 0">{{ changes.length }}</span>
      </div>
      <div class="header-right">
        <span class="toggle-icon">{{ isExpanded ? '▼' : '▶' }}</span>
      </div>
    </div>

    <!-- 面板内容 - 展开时显示 -->
    <Transition name="expand">
      <div v-if="isExpanded" class="panel-content">
        <!-- 无变化提示 -->
        <div v-if="changes.length === 0" class="no-changes">
          <span class="empty-icon">📭</span>
          <span class="empty-text">本次回复无变量更新</span>
        </div>

        <!-- 变量变化列表 -->
        <div v-else class="changes-list">
          <div v-for="(change, index) in changes" :key="index" class="change-item" :class="getChangeTypeClass(change)">
            <!-- 变量路径 -->
            <div class="change-path">
              <span class="path-icon">{{ getChangeIcon(change) }}</span>
              <span class="path-text" :title="change.path">{{ formatPath(change.path) }}</span>
            </div>

            <!-- 值变化 -->
            <div class="change-values">
              <!-- 旧值（如果有） -->
              <template v-if="hasOldValue(change)">
                <span class="old-value" :title="formatValueFull(change.oldValue)">
                  {{ formatValue(change.oldValue) }}
                </span>
                <span class="arrow">→</span>
              </template>
              <!-- 新值 -->
              <span class="new-value" :title="formatValueFull(change.newValue)">
                {{ formatValue(change.newValue) }}
              </span>
            </div>

            <!-- 注释（如果有） -->
            <div v-if="change.comment" class="change-comment">
              <span class="comment-icon">💬</span>
              <span class="comment-text">{{ change.comment }}</span>
            </div>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <div class="panel-footer" v-if="changes.length > 0">
          <button class="btn-clear" @click.stop="handleClear" title="清空变化记录">
            <span class="btn-icon">🗑️</span>
            清空
          </button>
          <button class="btn-copy" @click.stop="handleCopy" title="复制变化记录">
            <span class="btn-icon">📋</span>
            复制
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

/**
 * 变量变化记录类型
 */
interface VariableChange {
  path: string;
  oldValue?: any;
  newValue: any;
  comment?: string;
}

// ============ Props ============
interface Props {
  /** 变量变化列表 */
  changes?: VariableChange[];
  /** 默认展开状态 */
  defaultExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  changes: () => [],
  defaultExpanded: false,
});

// ============ Emits ============
const emit = defineEmits<{
  /** 清空变化记录 */
  (e: 'clear'): void;
  /** 复制变化记录 */
  (e: 'copy', content: string): void;
}>();

// ============ 状态 ============

/** 是否展开 */
const isExpanded = ref(props.defaultExpanded);

// ============ 方法 ============

/**
 * 切换展开状态
 */
const toggleExpand = () => {
  isExpanded.value = !isExpanded.value;
};

/**
 * 判断是否有旧值
 */
const hasOldValue = (change: VariableChange): boolean => {
  return change.oldValue !== undefined && change.oldValue !== null;
};

/**
 * 获取变化类型的CSS类名
 */
const getChangeTypeClass = (change: VariableChange): string => {
  if (!hasOldValue(change)) {
    return 'change-new'; // 新增
  }

  const oldType = typeof change.oldValue;
  const newType = typeof change.newValue;

  if (oldType === 'number' && newType === 'number') {
    if (change.newValue > change.oldValue) {
      return 'change-increase'; // 数值增加
    } else if (change.newValue < change.oldValue) {
      return 'change-decrease'; // 数值减少
    }
  }

  return 'change-modify'; // 普通修改
};

/**
 * 获取变化图标
 */
const getChangeIcon = (change: VariableChange): string => {
  if (!hasOldValue(change)) {
    return '✨'; // 新增
  }

  const oldType = typeof change.oldValue;
  const newType = typeof change.newValue;

  if (oldType === 'number' && newType === 'number') {
    if (change.newValue > change.oldValue) {
      return '📈'; // 增加
    } else if (change.newValue < change.oldValue) {
      return '📉'; // 减少
    }
  }

  return '✏️'; // 修改
};

/**
 * 格式化路径显示（截断过长路径）
 */
const formatPath = (path: string): string => {
  const maxLength = 30;
  if (path.length <= maxLength) {
    return path;
  }

  // 保留开头和结尾
  const parts = path.split('.');
  if (parts.length <= 2) {
    return path.substring(0, maxLength - 3) + '...';
  }

  // 显示第一个和最后两个部分
  return `${parts[0]}...${parts.slice(-2).join('.')}`;
};

/**
 * 格式化值用于显示（简短版）
 */
const formatValue = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  const type = typeof value;

  if (type === 'string') {
    const maxLength = 20;
    if (value.length > maxLength) {
      return `"${value.substring(0, maxLength)}..."`;
    }
    return `"${value}"`;
  }

  if (type === 'number') {
    return String(value);
  }

  if (type === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (Array.isArray(value)) {
    return `[${value.length}项]`;
  }

  if (type === 'object') {
    const keys = Object.keys(value);
    return `{${keys.length}键}`;
  }

  return String(value);
};

/**
 * 格式化值用于完整显示（tooltip）
 */
const formatValueFull = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

/**
 * 处理清空操作
 */
const handleClear = () => {
  emit('clear');
};

/**
 * 处理复制操作
 */
const handleCopy = () => {
  const content = props.changes
    .map(change => {
      let line = `${change.path}: `;
      if (hasOldValue(change)) {
        line += `${formatValueFull(change.oldValue)} → `;
      }
      line += formatValueFull(change.newValue);
      if (change.comment) {
        line += ` // ${change.comment}`;
      }
      return line;
    })
    .join('\n');

  emit('copy', content);

  // 尝试复制到剪贴板
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        console.log('[VariableChangesPanel] 已复制到剪贴板');
      })
      .catch(err => {
        console.error('[VariableChangesPanel] 复制失败:', err);
      });
  }
};

// ============ 暴露方法 ============
defineExpose({
  /** 展开面板 */
  expand: () => {
    isExpanded.value = true;
  },
  /** 收起面板 */
  collapse: () => {
    isExpanded.value = false;
  },
  /** 切换展开状态 */
  toggle: toggleExpand,
});
</script>

<style lang="scss" scoped>
.variable-changes-panel {
  background: var(--bg-tertiary, #f5f5f5);
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: var(--radius-md, 8px);
  overflow: hidden;
  transition: all var(--transition-normal, 0.3s) ease;

  &.expanded {
    box-shadow: var(--shadow-sm, 0 2px 4px rgba(0, 0, 0, 0.1));
  }
}

// ============ 面板头部 ============
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast, 0.15s);

  &:hover {
    background: var(--bg-hover, rgba(0, 0, 0, 0.05));
  }
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}

.header-icon {
  font-size: 14px;
}

.header-title {
  font-size: var(--font-sm, 14px);
  font-weight: 500;
  color: var(--text-color, #333);
}

.changes-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--primary-color, #6366f1);
  color: white;
  font-size: var(--font-xs, 12px);
  font-weight: 600;
  border-radius: 10px;
}

.header-right {
  display: flex;
  align-items: center;
}

.toggle-icon {
  font-size: 10px;
  color: var(--text-secondary, #666);
  transition: transform var(--transition-fast, 0.15s);
}

// ============ 面板内容 ============
.panel-content {
  border-top: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-color, #fff);
}

// ============ 无变化提示 ============
.no-changes {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-lg, 16px);
  gap: var(--spacing-xs, 4px);

  .empty-icon {
    font-size: 24px;
    opacity: 0.5;
  }

  .empty-text {
    font-size: var(--font-sm, 14px);
    color: var(--text-disabled, #999);
  }
}

// ============ 变化列表 ============
.changes-list {
  max-height: 300px;
  overflow-y: auto;
  padding: var(--spacing-sm, 8px);
}

.change-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 4px);
  padding: var(--spacing-sm, 8px);
  border-radius: var(--radius-sm, 4px);
  margin-bottom: var(--spacing-xs, 4px);
  background: var(--bg-secondary, #fafafa);
  border-left: 3px solid transparent;
  transition: all var(--transition-fast, 0.15s);

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    background: var(--bg-hover, #f0f0f0);
  }

  // 新增变量 - 绿色
  &.change-new {
    border-left-color: var(--success-color, #4caf50);
    background: rgba(76, 175, 80, 0.05);

    .path-icon {
      color: var(--success-color, #4caf50);
    }
  }

  // 数值增加 - 蓝色
  &.change-increase {
    border-left-color: var(--info-color, #2196f3);
    background: rgba(33, 150, 243, 0.05);

    .path-icon {
      color: var(--info-color, #2196f3);
    }
  }

  // 数值减少 - 橙色
  &.change-decrease {
    border-left-color: var(--warning-color, #ff9800);
    background: rgba(255, 152, 0, 0.05);

    .path-icon {
      color: var(--warning-color, #ff9800);
    }
  }

  // 普通修改 - 紫色
  &.change-modify {
    border-left-color: var(--primary-color, #6366f1);
    background: rgba(99, 102, 241, 0.05);

    .path-icon {
      color: var(--primary-color, #6366f1);
    }
  }
}

.change-path {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);

  .path-icon {
    font-size: 12px;
  }

  .path-text {
    font-size: var(--font-xs, 12px);
    font-family: monospace;
    color: var(--text-secondary, #666);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.change-values {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  padding-left: var(--spacing-md, 12px);

  .old-value {
    font-size: var(--font-sm, 14px);
    font-family: monospace;
    color: var(--text-disabled, #999);
    text-decoration: line-through;
  }

  .arrow {
    font-size: var(--font-xs, 12px);
    color: var(--text-disabled, #999);
  }

  .new-value {
    font-size: var(--font-sm, 14px);
    font-family: monospace;
    color: var(--text-color, #333);
    font-weight: 500;
  }
}

.change-comment {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  padding-left: var(--spacing-md, 12px);

  .comment-icon {
    font-size: 10px;
    opacity: 0.7;
  }

  .comment-text {
    font-size: var(--font-xs, 12px);
    color: var(--text-secondary, #666);
    font-style: italic;
  }
}

// ============ 底部操作栏 ============
.panel-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px) var(--spacing-md, 12px);
  border-top: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-tertiary, #f5f5f5);
}

.btn-clear,
.btn-copy {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs, 4px);
  padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  font-size: var(--font-xs, 12px);
  color: var(--text-secondary, #666);
  background: transparent;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  transition: all var(--transition-fast, 0.15s);

  &:hover {
    background: var(--bg-hover, #f0f0f0);
    color: var(--text-color, #333);
    border-color: var(--border-hover, #ccc);
  }

  .btn-icon {
    font-size: 10px;
  }
}

// ============ 展开动画 ============
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 400px;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .changes-list {
    max-height: 200px;
  }

  .change-item {
    padding: var(--spacing-xs, 4px) var(--spacing-sm, 8px);
  }

  .change-values {
    flex-wrap: wrap;
  }
}
</style>
