<!--
  MClite - 历史正文查看面板
  用于查看历史正文内容，支持按条目展示和搜索
-->
<template>
  <div class="history-text-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <div class="header-left">
        <span class="panel-icon">📜</span>
        <h2 class="panel-title">历史正文</h2>
        <span v-if="historyTexts.length > 0" class="text-count"> 共 {{ historyTexts.length }} 条 </span>
      </div>
      <div class="header-actions">
        <button class="btn-refresh" @click="refreshData" :disabled="isLoading" title="刷新">🔄</button>
        <button class="btn-close" @click="$emit('close')">✕</button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜索正文内容..."
        @input="handleSearch"
      />
      <span v-if="searchQuery" class="search-result-count"> 找到 {{ filteredTexts.length }} 条 </span>
    </div>

    <!-- 面板主体 -->
    <div class="panel-body">
      <!-- 加载状态 -->
      <div v-if="isLoading" class="state-container loading-state">
        <span class="state-icon loading-spinner">⏳</span>
        <span class="state-text">加载中...</span>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="error" class="state-container error-state">
        <span class="state-icon error-icon">⚠️</span>
        <span class="state-text">{{ error }}</span>
        <button class="btn btn-secondary" @click="refreshData">重新加载</button>
      </div>

      <!-- 空状态 -->
      <div v-else-if="historyTexts.length === 0" class="state-container empty-state">
        <span class="state-icon">📝</span>
        <span class="state-text">暂无历史正文</span>
        <p class="state-hint">历史正文会在游戏进行过程中自动记录</p>
      </div>

      <!-- 搜索无结果 -->
      <div v-else-if="filteredTexts.length === 0" class="state-container empty-state">
        <span class="state-icon">🔍</span>
        <span class="state-text">未找到匹配内容</span>
        <p class="state-hint">尝试使用其他关键词搜索</p>
      </div>

      <!-- 历史正文列表 -->
      <div v-else class="text-list">
        <div
          v-for="(text, index) in filteredTexts"
          :key="text.序号"
          class="text-item"
          :class="{ 'is-expanded': expandedItems.has(text.序号) }"
        >
          <!-- 条目头部 -->
          <div class="text-header" @click="toggleExpand(text.序号)">
            <div class="text-meta">
              <span class="text-number">#{{ text.序号 }}</span>
              <span class="text-preview" v-if="!expandedItems.has(text.序号)">
                {{ getPreview(text.内容) }}
              </span>
            </div>
            <span class="expand-icon">{{ expandedItems.has(text.序号) ? '▼' : '▶' }}</span>
          </div>

          <!-- 条目内容（展开时显示） -->
          <div v-if="expandedItems.has(text.序号)" class="text-content">
            <div class="content-body" v-html="formatContent(text.内容)"></div>
            <div class="content-actions">
              <button class="btn-action" @click="copyContent(text.内容)" title="复制内容">📋 复制</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div class="panel-footer" v-if="historyTexts.length > 0">
      <div class="footer-info">
        <span class="info-text"> 显示 {{ filteredTexts.length }} / {{ historyTexts.length }} 条 </span>
      </div>
      <div class="footer-actions">
        <button class="btn btn-secondary" @click="expandAll">全部展开</button>
        <button class="btn btn-secondary" @click="collapseAll">全部收起</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { HistoryTextEntry } from '../../types/contextManager';
import { WORLDBOOK_ENTRY_NAMES } from '../../types/contextManager';
import { HistoryRecordParser } from '../../services/HistoryRecordParser';
import { worldbookService } from '../../services/WorldbookService';

// ============ Emits ============
defineEmits<{
  (e: 'close'): void;
}>();

// ============ 状态 ============
const isLoading = ref(false);
const error = ref<string | null>(null);
const historyTexts = ref<HistoryTextEntry[]>([]);
const searchQuery = ref('');
const expandedItems = ref<Set<number>>(new Set());

// ============ 计算属性 ============
const filteredTexts = computed(() => {
  if (!searchQuery.value.trim()) {
    return historyTexts.value;
  }
  const query = searchQuery.value.toLowerCase();
  return historyTexts.value.filter(text => text.内容.toLowerCase().includes(query));
});

// ============ 方法 ============

/**
 * 刷新数据
 */
const refreshData = async () => {
  isLoading.value = true;
  error.value = null;

  try {
    // 确保世界书服务已初始化
    await worldbookService.initialize();

    // 从世界书读取历史正文
    const historyTextContent = await worldbookService.getEntryContent(WORLDBOOK_ENTRY_NAMES.HISTORY_TEXT);
    historyTexts.value = HistoryRecordParser.parseHistoryTexts(historyTextContent);

    console.log('[HistoryTextPanel] 已加载', historyTexts.value.length, '条历史正文');
  } catch (err) {
    console.error('[HistoryTextPanel] 加载失败:', err);
    error.value = err instanceof Error ? err.message : '加载历史正文失败';
  } finally {
    isLoading.value = false;
  }
};

/**
 * 处理搜索
 */
const handleSearch = () => {
  // 搜索时收起所有展开的项
  // expandedItems.value.clear();
};

/**
 * 切换展开状态
 */
const toggleExpand = (序号: number) => {
  if (expandedItems.value.has(序号)) {
    expandedItems.value.delete(序号);
  } else {
    expandedItems.value.add(序号);
  }
};

/**
 * 全部展开
 */
const expandAll = () => {
  filteredTexts.value.forEach(text => {
    expandedItems.value.add(text.序号);
  });
};

/**
 * 全部收起
 */
const collapseAll = () => {
  expandedItems.value.clear();
};

/**
 * 获取预览文本
 */
const getPreview = (content: string): string => {
  const maxLength = 60;
  const cleaned = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  return cleaned.substring(0, maxLength) + '...';
};

/**
 * 格式化内容
 */
const formatContent = (content: string): string => {
  // 简单的换行处理
  return content.replace(/\n/g, '<br>');
};

/**
 * 复制内容
 */
const copyContent = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    if (typeof toastr !== 'undefined') {
      toastr.success('已复制到剪贴板');
    }
  } catch (err) {
    console.error('[HistoryTextPanel] 复制失败:', err);
    if (typeof toastr !== 'undefined') {
      toastr.error('复制失败');
    }
  }
};

// ============ 生命周期 ============
onMounted(() => {
  refreshData();
});
</script>

<style lang="scss" scoped>
// ============ 面板主容器 ============
.history-text-panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
}

// ============ 面板头部 ============
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel-icon {
  font-size: 20px;
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.text-count {
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-refresh,
.btn-close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.25);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

// ============ 搜索栏 ============
.search-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--text-color);
  outline: none;
  transition: border-color var(--transition-fast);

  &:focus {
    border-color: var(--primary-color);
  }

  &::placeholder {
    color: var(--text-muted);
  }
}

.search-result-count {
  font-size: var(--font-xs);
  color: var(--text-secondary);
  white-space: nowrap;
}

// ============ 面板主体 ============
.panel-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--bg-tertiary);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 3px;

    &:hover {
      background: var(--border-hover);
    }
  }
}

// ============ 状态容器 ============
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  gap: var(--spacing-md);
}

.state-icon {
  font-size: 48px;
  opacity: 0.4;
}

.state-text {
  font-size: var(--font-md);
  color: var(--text-secondary);
}

.state-hint {
  margin: 0;
  font-size: var(--font-sm);
  color: var(--text-muted);
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.error-icon {
  color: var(--error-color);
}

.error-state .state-text {
  color: var(--error-color);
}

// ============ 历史正文列表 ============
.text-list {
  padding: var(--spacing-sm);
}

.text-item {
  margin-bottom: var(--spacing-sm);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  transition: all var(--transition-fast);

  &:hover {
    border-color: var(--border-hover);
  }

  &.is-expanded {
    border-color: var(--primary-color);
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
  }
}

.text-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
  }
}

.text-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 1;
  min-width: 0;
}

.text-number {
  font-size: var(--font-xs);
  font-weight: 600;
  color: var(--primary-color);
  padding: 2px 6px;
  background: var(--primary-light);
  border-radius: var(--radius-xs);
  flex-shrink: 0;
}

.text-preview {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expand-icon {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.text-content {
  padding: var(--spacing-md);
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.content-body {
  font-size: var(--font-sm);
  line-height: 1.8;
  color: var(--text-color);
  white-space: pre-wrap;
  word-break: break-word;
}

.content-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--border-light);
}

.btn-action {
  padding: 4px 10px;
  font-size: var(--font-xs);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xs);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
    color: var(--text-color);
  }
}

// ============ 底部工具栏 ============
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

.footer-info {
  .info-text {
    font-size: var(--font-xs);
    color: var(--text-muted);
  }
}

.footer-actions {
  display: flex;
  gap: var(--spacing-xs);
}

// ============ 按钮样式 ============
.btn {
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-secondary {
  background: var(--bg-color);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--border-hover);
    color: var(--text-color);
  }
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .history-text-panel {
    border-radius: var(--radius-sm);
  }

  .panel-header {
    padding: 10px 12px;
  }

  .header-left {
    gap: 6px;
  }

  .panel-icon {
    font-size: 16px;
  }

  .panel-title {
    font-size: 14px;
  }

  .text-count {
    padding: 2px 8px;
    font-size: 10px;
  }

  .btn-refresh,
  .btn-close {
    width: 26px;
    height: 26px;
    font-size: 12px;
  }

  .search-bar {
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .search-input {
    padding: 6px 10px;
    font-size: 12px;
  }

  .search-result-count {
    font-size: 10px;
  }

  .text-list {
    padding: var(--spacing-xs);
  }

  .text-item {
    margin-bottom: var(--spacing-xs);
  }

  .text-header {
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .text-number {
    font-size: 10px;
    padding: 1px 4px;
  }

  .text-preview {
    font-size: 11px;
  }

  .text-content {
    padding: var(--spacing-sm);
  }

  .content-body {
    font-size: 12px;
    line-height: 1.6;
  }

  .panel-footer {
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .footer-actions {
    width: 100%;
    justify-content: center;
  }

  .btn {
    padding: 5px 10px;
    font-size: 11px;
  }

  // 状态容器紧凑化
  .state-container {
    padding: 40px 20px;
  }

  .state-icon {
    font-size: 36px;
  }

  .state-text {
    font-size: 13px;
  }
}

// ============ 竖屏模式额外优化 ============
@media (max-width: 480px) {
  .panel-header {
    padding: 8px 10px;
  }

  .header-left {
    gap: 4px;
  }

  .panel-icon {
    font-size: 14px;
  }

  .panel-title {
    font-size: 13px;
  }

  .text-count {
    display: none;
  }

  .header-actions {
    gap: 4px;
  }

  .btn-refresh,
  .btn-close {
    width: 24px;
    height: 24px;
    font-size: 11px;
  }

  .search-bar {
    padding: 4px 8px;
  }

  .search-input {
    padding: 5px 8px;
    font-size: 11px;
  }

  .text-list {
    padding: 4px;
  }

  .text-header {
    padding: 6px 8px;
  }

  .text-meta {
    gap: 4px;
  }

  .text-number {
    font-size: 9px;
  }

  .text-preview {
    font-size: 10px;
  }

  .expand-icon {
    font-size: 8px;
  }

  .text-content {
    padding: 8px;
  }

  .content-body {
    font-size: 11px;
    line-height: 1.5;
  }

  .content-actions {
    margin-top: 8px;
    padding-top: 6px;
  }

  .btn-action {
    padding: 3px 8px;
    font-size: 10px;
  }

  .panel-footer {
    padding: 6px 8px;
  }

  .footer-info .info-text {
    font-size: 10px;
  }

  .footer-actions .btn {
    padding: 4px 8px;
    font-size: 10px;
  }

  .state-container {
    padding: 30px 15px;
  }

  .state-icon {
    font-size: 32px;
  }

  .state-text {
    font-size: 12px;
  }

  .state-hint {
    font-size: 11px;
  }
}
</style>
