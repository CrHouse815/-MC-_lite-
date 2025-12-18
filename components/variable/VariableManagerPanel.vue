<!--
  MClite - 变量管理器面板组件 v4
  全新设计：条目式树状结构布局
  特点：
  - 递归树形结构，清晰展示变量层级关系
  - 支持展开/折叠，一眼看到整体结构
  - 类似IDE的JSON树视图
-->
<template>
  <div class="variable-manager-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <div class="header-left">
        <span class="header-title">变量管理器</span>
        <span class="status-dot" :class="{ connected: isMvuAvailable }"></span>
      </div>
      <div class="header-actions">
        <button class="btn-text" @click="showAddDialog" title="在根级添加变量">
          <span class="btn-icon">+</span>
          <span class="btn-label">新增</span>
        </button>
        <button class="btn-icon-only" @click="expandAll" title="展开全部">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16M4 12h16M4 20h16" />
            <path d="M9 8l3-3 3 3M9 16l3 3 3-3" />
          </svg>
        </button>
        <button class="btn-icon-only" @click="collapseAll" title="折叠全部">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 4h16M4 12h16M4 20h16" />
            <path d="M9 4l3 3 3-3M9 20l3-3 3 3" />
          </svg>
        </button>
        <button class="btn-icon-only" @click="refreshData" :disabled="isLoading" :class="{ loading: isLoading }">
          <svg class="icon-refresh" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
        </button>
        <button class="btn-icon-only btn-close" @click="$emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <!-- 搜索框 -->
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input v-model="searchQuery" type="text" placeholder="搜索变量路径或值..." class="search-input" />
        <button v-if="searchQuery" class="btn-clear" @click="searchQuery = ''">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 显示选项 -->
      <div class="view-options">
        <label class="option-toggle">
          <input type="checkbox" v-model="showMeta" />
          <span>显示 $meta</span>
        </label>
      </div>
    </div>

    <!-- 主内容区 - 树形视图 -->
    <div class="main-content" ref="treeContainerRef">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="state-container">
        <div class="loading-spinner"></div>
        <span class="state-text">正在加载...</span>
      </div>

      <!-- 空数据状态 -->
      <div v-else-if="!statData || Object.keys(statData).length === 0" class="state-container">
        <svg class="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9h6M9 13h6M9 17h4" />
        </svg>
        <span class="state-text">暂无变量数据</span>
        <button class="btn-primary" @click="refreshData">刷新</button>
      </div>

      <!-- 树形视图 -->
      <div v-else class="tree-view">
        <div class="tree-root">
          <TreeItem
            v-for="(value, key) in filteredData"
            :key="String(key)"
            :name="String(key)"
            :value="value"
            :path="String(key)"
            :depth="0"
            :expanded-paths="expandedPaths"
            :editing-path="editingPath"
            :search-query="searchQuery"
            @toggle="toggleExpand"
            @edit="startEdit"
            @save="handleSave"
            @cancel="cancelEdit"
            @delete="handleDelete"
            @add-child="handleAddChild"
            @copy-path="handleCopyPath"
          />
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="status-bar">
      <span class="stat-item">共 {{ totalLeaves }} 个叶子节点</span>
      <span class="stat-item" v-if="expandedPaths.size > 0">已展开 {{ expandedPaths.size }} 项</span>
      <span class="stat-item" v-if="lastRefreshTime">更新于 {{ lastRefreshTime }}</span>
    </div>

    <!-- 添加变量对话框 -->
    <div v-if="showAddDialogVisible" class="modal-overlay" @click.self="closeAddDialog">
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>{{ addDialogParentPath ? '添加子变量' : '添加新变量' }}</h3>
          <button class="btn-close-modal" @click="closeAddDialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">变量名称</label>
            <div class="path-input-group">
              <span v-if="addDialogParentPath" class="path-prefix">{{ addDialogParentPath }}.</span>
              <input
                v-model="newVariableName"
                type="text"
                placeholder="输入变量名..."
                class="form-input"
                @keydown.enter="confirmAddVariable"
              />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">类型</label>
            <div class="type-selector">
              <button
                v-for="t in variableTypes"
                :key="t.value"
                class="type-option"
                :class="{ active: newVariableType === t.value, [`type-${t.value}`]: true }"
                @click="newVariableType = t.value"
              >
                <span class="type-icon">{{ t.icon }}</span>
                <span class="type-name">{{ t.label }}</span>
              </button>
            </div>
          </div>
          <div
            class="form-group"
            v-if="newVariableType !== 'object' && newVariableType !== 'array' && newVariableType !== 'null'"
          >
            <label class="form-label">初始值</label>
            <input
              v-if="newVariableType === 'string'"
              v-model="newVariableValue"
              type="text"
              placeholder="输入字符串值..."
              class="form-input"
            />
            <input
              v-else-if="newVariableType === 'number'"
              v-model.number="newVariableValue"
              type="number"
              step="any"
              placeholder="输入数字..."
              class="form-input"
            />
            <div v-else-if="newVariableType === 'boolean'" class="boolean-toggle">
              <button class="bool-btn" :class="{ active: newVariableValue === true }" @click="newVariableValue = true">
                true
              </button>
              <button
                class="bool-btn"
                :class="{ active: newVariableValue === false }"
                @click="newVariableValue = false"
              >
                false
              </button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="closeAddDialog">取消</button>
          <button class="btn-primary" @click="confirmAddVariable" :disabled="!newVariableName.trim()">添加</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMvuStore } from '../../stores/mvuStore';
import TreeItem from './TreeItem.vue';

// ============ Types ============

interface VariableType {
  value: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  label: string;
  icon: string;
}

// ============ Emits ============
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'variable-updated', path: string, value: any): void;
}>();

// ============ Store ============
const mvuStore = useMvuStore();

// ============ Refs ============
const treeContainerRef = ref<HTMLElement | null>(null);

// ============ 状态 ============
const searchQuery = ref('');
const showMeta = ref(false);
const expandedPaths = ref<Set<string>>(new Set());
const editingPath = ref<string | null>(null);
const isLoading = ref(false);
const lastRefreshTime = ref('');

// 添加对话框状态
const showAddDialogVisible = ref(false);
const addDialogParentPath = ref<string | null>(null);
const newVariableName = ref('');
const newVariableType = ref<'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'>('string');
const newVariableValue = ref<any>('');

// 变量类型选项
const variableTypes: VariableType[] = [
  { value: 'string', label: '字符串', icon: 'T' },
  { value: 'number', label: '数字', icon: '#' },
  { value: 'boolean', label: '布尔', icon: '?' },
  { value: 'object', label: '对象', icon: '{}' },
  { value: 'array', label: '数组', icon: '[]' },
  { value: 'null', label: '空值', icon: 'ø' },
];

// ============ 计算属性 ============

const isMvuAvailable = computed(() => mvuStore.isMvuAvailable);
const statData = computed(() => mvuStore.statData);

// 过滤数据（隐藏$meta或搜索）
const filteredData = computed(() => {
  if (!statData.value) return {};

  const filterObject = (obj: any, parentPath: string = ''): any => {
    if (obj === null || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item, index) => filterObject(item, `${parentPath}[${index}]`));
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // 过滤 $meta
      if (!showMeta.value && key === '$meta') continue;

      const currentPath = parentPath ? `${parentPath}.${key}` : key;

      // 搜索过滤
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        const pathMatch = currentPath.toLowerCase().includes(query);
        const valueMatch =
          typeof value !== 'object' || value === null
            ? String(value).toLowerCase().includes(query)
            : JSON.stringify(value).toLowerCase().includes(query);

        if (!pathMatch && !valueMatch) {
          // 检查子节点是否匹配
          if (typeof value === 'object' && value !== null) {
            const filteredChild = filterObject(value, currentPath);
            if (Object.keys(filteredChild).length > 0 || (Array.isArray(filteredChild) && filteredChild.length > 0)) {
              result[key] = filteredChild;
              // 自动展开搜索结果
              expandedPaths.value.add(currentPath);
            }
          }
          continue;
        } else {
          // 自动展开搜索匹配的路径
          const pathParts = currentPath.split('.');
          let accPath = '';
          for (const part of pathParts) {
            accPath = accPath ? `${accPath}.${part}` : part;
            expandedPaths.value.add(accPath);
          }
        }
      }

      result[key] = typeof value === 'object' && value !== null ? filterObject(value, currentPath) : value;
    }
    return result;
  };

  return filterObject(statData.value);
});

// 统计叶子节点数量
const totalLeaves = computed(() => {
  const countLeaves = (obj: any): number => {
    if (obj === null || typeof obj !== 'object') return 1;
    let count = 0;
    const values = Array.isArray(obj) ? obj : Object.values(obj);
    for (const value of values) {
      if (typeof value === 'object' && value !== null) {
        count += countLeaves(value);
      } else {
        count++;
      }
    }
    return count;
  };
  return statData.value ? countLeaves(statData.value) : 0;
});

// ============ 方法 ============

function toggleExpand(path: string): void {
  if (expandedPaths.value.has(path)) {
    expandedPaths.value.delete(path);
  } else {
    expandedPaths.value.add(path);
  }
}

function expandAll(): void {
  const collectPaths = (obj: any, parentPath: string = ''): void => {
    if (obj === null || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const path = `${parentPath}[${index}]`;
        if (typeof item === 'object' && item !== null) {
          expandedPaths.value.add(path);
          collectPaths(item, path);
        }
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        if (!showMeta.value && key === '$meta') continue;
        const path = parentPath ? `${parentPath}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
          expandedPaths.value.add(path);
          collectPaths(value, path);
        }
      }
    }
  };

  if (statData.value) {
    collectPaths(statData.value);
  }
}

function collapseAll(): void {
  expandedPaths.value.clear();
}

async function refreshData(): Promise<void> {
  isLoading.value = true;
  try {
    await mvuStore.refresh();
    lastRefreshTime.value = new Date().toLocaleTimeString();
  } catch (err) {
    console.error('[VariableManager] 刷新失败:', err);
  } finally {
    isLoading.value = false;
  }
}

function startEdit(path: string): void {
  editingPath.value = path;
}

async function handleSave(path: string, newValue: any): Promise<void> {
  try {
    const success = await mvuStore.setVariable(path, newValue, '变量管理器编辑');
    if (success) {
      emit('variable-updated', path, newValue);
      await refreshData();
    }
  } catch (err) {
    console.error('[VariableManager] 保存失败:', err);
  } finally {
    editingPath.value = null;
  }
}

function cancelEdit(): void {
  editingPath.value = null;
}

async function handleDelete(path: string): Promise<void> {
  if (!confirm(`确定要删除变量 "${path}" 吗？`)) return;
  try {
    const success = await mvuStore.setVariable(path, undefined, '变量管理器删除');
    if (success) {
      await refreshData();
    }
  } catch (err) {
    console.error('[VariableManager] 删除失败:', err);
  }
}

function handleAddChild(parentPath: string): void {
  addDialogParentPath.value = parentPath;
  newVariableName.value = '';
  newVariableType.value = 'string';
  newVariableValue.value = '';
  showAddDialogVisible.value = true;
}

async function handleCopyPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
  } catch (err) {
    console.error('[VariableManager] 复制失败:', err);
  }
}

function showAddDialog(): void {
  addDialogParentPath.value = null;
  newVariableName.value = '';
  newVariableType.value = 'string';
  newVariableValue.value = '';
  showAddDialogVisible.value = true;
}

function closeAddDialog(): void {
  showAddDialogVisible.value = false;
  addDialogParentPath.value = null;
}

async function confirmAddVariable(): Promise<void> {
  if (!newVariableName.value.trim()) return;

  const fullPath = addDialogParentPath.value
    ? `${addDialogParentPath.value}.${newVariableName.value.trim()}`
    : newVariableName.value.trim();

  let value: any;
  switch (newVariableType.value) {
    case 'string':
      value = newVariableValue.value || '';
      break;
    case 'number':
      value = typeof newVariableValue.value === 'number' ? newVariableValue.value : 0;
      break;
    case 'boolean':
      value = newVariableValue.value === true;
      break;
    case 'object':
      value = {};
      break;
    case 'array':
      value = [];
      break;
    case 'null':
      value = null;
      break;
  }

  try {
    const success = await mvuStore.setVariable(fullPath, value, '变量管理器新增');
    if (success) {
      emit('variable-updated', fullPath, value);
      // 展开父路径
      if (addDialogParentPath.value) {
        expandedPaths.value.add(addDialogParentPath.value);
      }
      await refreshData();
      closeAddDialog();
    }
  } catch (err) {
    console.error('[VariableManager] 添加失败:', err);
  }
}

// ============ 生命周期 ============

onMounted(async () => {
  if (!statData.value || Object.keys(statData.value).length === 0) {
    await refreshData();
  } else {
    lastRefreshTime.value = new Date().toLocaleTimeString();
  }

  // 默认展开第一层
  if (statData.value) {
    for (const key of Object.keys(statData.value)) {
      if (!showMeta.value && key === '$meta') continue;
      expandedPaths.value.add(key);
    }
  }
});
</script>

<style lang="scss" scoped>
// ============ 基础变量（使用CSS变量支持主题切换）============
$font-family:
  -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
$font-mono: 'SF Mono', 'Fira Code', 'Consolas', monospace;

// 类型颜色 - 日间模式（深色文字，浅色背景）
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

// ============ 面板容器 ============
.variable-manager-panel {
  // 定义组件内的CSS变量（支持日间/夜间模式）
  --vm-bg-primary: var(--bg-color, #f6f5f4);
  --vm-bg-secondary: var(--bg-secondary, #ffffff);
  --vm-bg-tertiary: var(--bg-tertiary, #deddda);
  --vm-bg-hover: var(--bg-hover, #f0f0f0);
  --vm-border-color: var(--border-color, #c0bfbc);
  --vm-border-light: var(--border-light, #e5e5e5);
  --vm-text-primary: var(--text-color, #2e3436);
  --vm-text-secondary: var(--text-secondary, #5e5c64);
  --vm-text-muted: var(--text-disabled, #9a9996);
  --vm-accent-color: var(--primary-color, #1a5fb4);
  --vm-accent-hover: var(--primary-hover, #3584e4);
  --vm-success-color: var(--success-color, #26a269);
  --vm-danger-color: var(--danger-color, #c01c28);

  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--vm-bg-primary);
  font-family: $font-family;
  font-size: 14px;
  color: var(--vm-text-primary);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

// ============ 面板头部 ============
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--vm-bg-secondary);
  border-bottom: 1px solid var(--vm-border-color);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vm-danger-color);

  &.connected {
    background: var(--vm-success-color);
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-text {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--vm-accent-color);
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--vm-accent-hover);
  }

  .btn-icon {
    font-size: 16px;
    font-weight: 600;
  }
}

.btn-icon-only {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--vm-border-color);
  border-radius: 6px;
  color: var(--vm-text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  svg {
    width: 18px;
    height: 18px;
  }

  &:hover {
    background: var(--vm-bg-hover);
    color: var(--vm-text-primary);
    border-color: var(--vm-border-light);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.loading .icon-refresh {
    animation: spin 1s linear infinite;
  }

  &.btn-close:hover {
    background: rgba(192, 28, 40, 0.15);
    border-color: var(--vm-danger-color);
    color: var(--vm-danger-color);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// ============ 工具栏 ============
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--vm-bg-secondary);
  border-bottom: 1px solid var(--vm-border-color);
  flex-shrink: 0;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--vm-bg-tertiary);
  border: 1px solid var(--vm-border-color);
  border-radius: 8px;
  transition: border-color 0.15s;

  &:focus-within {
    border-color: var(--vm-accent-color);
  }

  .search-icon {
    width: 16px;
    height: 16px;
    color: var(--vm-text-muted);
    flex-shrink: 0;
  }

  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    font-size: 14px;
    color: var(--vm-text-primary);
    outline: none;

    &::placeholder {
      color: var(--vm-text-muted);
    }
  }

  .btn-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: transparent;
    border: none;
    color: var(--vm-text-muted);
    cursor: pointer;
    padding: 0;

    svg {
      width: 14px;
      height: 14px;
    }

    &:hover {
      color: var(--vm-text-primary);
    }
  }
}

.view-options {
  display: flex;
  align-items: center;
}

.option-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vm-text-secondary);
  cursor: pointer;

  input[type='checkbox'] {
    width: 14px;
    height: 14px;
    accent-color: var(--vm-accent-color);
  }

  &:hover {
    color: var(--vm-text-primary);
  }
}

// ============ 主内容区 ============
.main-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--vm-border-color);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

// ============ 状态容器 ============
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 16px;
}

.state-icon {
  width: 64px;
  height: 64px;
  color: var(--vm-text-muted);
}

.state-text {
  font-size: 15px;
  color: var(--vm-text-secondary);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--vm-border-color);
  border-top-color: var(--vm-accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

// ============ 树形视图 ============
.tree-view {
  padding: 8px 0;
}

.tree-root {
  font-family: $font-mono;
  font-size: 13px;
  line-height: 1.6;
}

// ============ 状态栏 ============
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--vm-bg-secondary);
  border-top: 1px solid var(--vm-border-color);
  flex-shrink: 0;
}

.stat-item {
  font-size: 12px;
  color: var(--vm-text-muted);
}

// ============ 模态框 ============
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-dialog {
  background: var(--vm-bg-primary);
  border: 1px solid var(--vm-border-color);
  border-radius: 12px;
  width: 420px;
  max-width: calc(100% - 32px);
  box-shadow: var(--shadow-lg, 0 20px 60px rgba(0, 0, 0, 0.4));
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--vm-border-color);

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }
}

.btn-close-modal {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--vm-text-secondary);
  cursor: pointer;

  svg {
    width: 16px;
    height: 16px;
  }
  &:hover {
    background: var(--vm-bg-hover);
    color: var(--vm-text-primary);
  }
}

.modal-body {
  padding: 20px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--vm-border-color);
}

.form-group {
  margin-bottom: 20px;
  &:last-child {
    margin-bottom: 0;
  }
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vm-text-secondary);
}

.path-input-group {
  display: flex;
  align-items: center;
  gap: 4px;

  .path-prefix {
    font-family: $font-mono;
    font-size: 13px;
    color: var(--vm-text-muted);
    white-space: nowrap;
  }
}

.form-input {
  flex: 1;
  width: 100%;
  padding: 10px 12px;
  background: var(--vm-bg-tertiary);
  border: 1px solid var(--vm-border-color);
  border-radius: 8px;
  font-size: 14px;
  color: var(--vm-text-primary);
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--vm-accent-color);
  }
  &::placeholder {
    color: var(--vm-text-muted);
  }
}

.type-selector {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.type-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: var(--vm-bg-tertiary);
  border: 1px solid var(--vm-border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;

  .type-icon {
    font-family: $font-mono;
    font-size: 16px;
    font-weight: 600;
  }
  .type-name {
    font-size: 11px;
    color: var(--vm-text-secondary);
  }

  &:hover {
    background: var(--vm-bg-hover);
    border-color: var(--vm-border-light);
  }

  &.active {
    border-width: 2px;
    &.type-string {
      border-color: $type-string-light;
      .type-icon {
        color: $type-string-light;
      }
    }
    &.type-number {
      border-color: $type-number-light;
      .type-icon {
        color: $type-number-light;
      }
    }
    &.type-boolean {
      border-color: $type-boolean-light;
      .type-icon {
        color: $type-boolean-light;
      }
    }
    &.type-object {
      border-color: $type-object-light;
      .type-icon {
        color: $type-object-light;
      }
    }
    &.type-array {
      border-color: $type-array-light;
      .type-icon {
        color: $type-array-light;
      }
    }
    &.type-null {
      border-color: $type-null-light;
      .type-icon {
        color: $type-null-light;
      }
    }
  }
}

.boolean-toggle {
  display: flex;
  gap: 10px;
}

.bool-btn {
  flex: 1;
  padding: 10px;
  background: var(--vm-bg-tertiary);
  border: 1px solid var(--vm-border-color);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vm-text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--vm-bg-hover);
    border-color: var(--vm-border-light);
  }
  &.active {
    background: rgba(13, 71, 161, 0.15);
    border-color: $type-boolean-light;
    color: $type-boolean-light;
  }
}

.btn-primary {
  padding: 10px 20px;
  background: var(--vm-accent-color);
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: var(--vm-accent-hover);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-secondary {
  padding: 10px 20px;
  background: transparent;
  border: 1px solid var(--vm-border-color);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vm-text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--vm-bg-hover);
    color: var(--vm-text-primary);
  }
}
</style>
