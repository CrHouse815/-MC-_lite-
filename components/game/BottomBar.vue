<!--
  MC房子 - 底部输入栏组件
  职场模拟游戏 - AI交互输入区域
  集成真实AI发送功能
  集成历史输入记录功能
-->
<template>
  <footer class="bottom-bar">
    <!-- 历史记录面板 -->
    <transition name="slide-up">
      <div v-if="showHistoryPanel" class="history-panel">
        <div class="history-header">
          <span class="history-title">📜 历史输入记录</span>
          <span class="history-count">{{ historyCount }} 条</span>
          <div class="history-actions">
            <button v-if="hasHistory" class="history-clear-btn" title="清空历史" @click="handleClearHistory">🗑️</button>
            <button class="history-close-btn" title="关闭" @click="showHistoryPanel = false">✕</button>
          </div>
        </div>

        <!-- 搜索框 -->
        <div class="history-search">
          <input v-model="searchQuery" type="text" class="history-search-input" placeholder="搜索历史记录..." />
        </div>

        <!-- 历史记录列表 -->
        <div class="history-list">
          <div
            v-for="(item, index) in filteredHistory"
            :key="item.timestamp"
            class="history-item"
            :class="{ 'is-active': index === currentIndex }"
            @click="selectHistoryItem(item.content)"
          >
            <span class="history-content">{{ truncateText(item.content, 80) }}</span>
            <span class="history-time">{{ formatTime(item.timestamp) }}</span>
            <button class="history-delete-btn" title="删除" @click.stop="removeHistoryItem(index)">✕</button>
          </div>
          <div v-if="filteredHistory.length === 0" class="history-empty">
            {{ searchQuery ? '未找到匹配的记录' : '暂无历史记录' }}
          </div>
        </div>
      </div>
    </transition>

    <!-- 输入区域 -->
    <div class="input-area">
      <div class="input-container" :class="{ 'is-loading': isLoading, 'has-error': !!error }">
        <!-- 历史记录按钮 -->
        <button
          class="history-toggle-btn"
          :class="{ 'has-history': hasHistory, 'is-active': showHistoryPanel }"
          :title="hasHistory ? `历史记录 (${historyCount})` : '暂无历史记录'"
          @click="toggleHistoryPanel"
        >
          <span class="history-icon">📜</span>
        </button>

        <textarea
          ref="inputRef"
          v-model="inputText"
          class="message-input"
          :placeholder="currentPlaceholder"
          :disabled="isLoading"
          rows="1"
          @keydown="handleKeydown"
          @input="autoResize"
        ></textarea>
        <button
          class="send-btn"
          :class="{ 'is-loading': isLoading }"
          :disabled="!canSend"
          :title="isLoading ? '正在生成...' : '发送消息 (Enter)'"
          @click="handleSend"
        >
          <span v-if="isLoading" class="loading-icon">⏳</span>
          <span v-else class="send-icon">📤</span>
        </button>
      </div>

      <!-- 历史导航提示 -->
      <div v-if="isNavigating" class="navigation-hint">
        <span class="hint-icon">⬆️⬇️</span>
        <span class="hint-text">{{ currentIndex + 1 }}/{{ historyCount }}</span>
        <button class="hint-cancel" title="取消 (Esc)" @click="cancelNavigation">✕</button>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="error-message">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{{ error }}</span>
        <button class="error-dismiss" @click="$emit('clearError')">✕</button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useInputHistory } from '../../composables/useInputHistory';
import { confirmDanger } from '../../composables/useConfirmDialog';

// ============ Props ============
interface Props {
  /** 占位文本 */
  placeholder?: string;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 错误信息 */
  error?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '输入你想说的话或想做的事...',
  isLoading: false,
  error: null,
});

// ============ Emits ============
const emit = defineEmits<{
  (e: 'send', message: string): void;
  (e: 'clearError'): void;
}>();

// ============ 历史记录 Composable ============
const {
  historyList,
  currentIndex,
  historyCount,
  hasHistory,
  isNavigating,
  addToHistory,
  navigateBack,
  navigateForward,
  resetNavigation,
  removeHistoryAt,
  clearHistory,
  searchHistory,
} = useInputHistory();

// ============ 状态 ============
const inputText = ref('');
const inputRef = ref<HTMLTextAreaElement | null>(null);
const showHistoryPanel = ref(false);
const searchQuery = ref('');

// ============ 计算属性 ============

/** 是否可以发送 */
const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !props.isLoading;
});

/** 当前占位文本 */
const currentPlaceholder = computed(() => {
  if (props.isLoading) {
    return 'AI正在思考中，请稍候...';
  }
  if (isNavigating.value) {
    return '使用 ↑↓ 导航历史，Esc 取消';
  }
  return props.placeholder;
});

/** 过滤后的历史记录 */
const filteredHistory = computed(() => {
  if (!searchQuery.value.trim()) {
    return historyList.value;
  }
  return searchHistory(searchQuery.value);
});

// ============ 方法 ============

/**
 * 处理发送
 */
const handleSend = () => {
  if (!canSend.value) return;

  const message = inputText.value.trim();

  // 添加到历史记录
  addToHistory(message);

  // 发送消息
  emit('send', message);
  inputText.value = '';

  // 关闭历史面板
  showHistoryPanel.value = false;

  // 重置高度
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto';
    }
  });
};

/**
 * 处理键盘事件
 */
const handleKeydown = (e: KeyboardEvent) => {
  // Enter 发送，Shift+Enter 换行
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
    return;
  }

  // 上箭头：向前导航历史
  if (e.key === 'ArrowUp') {
    // 只有在光标在第一行时才触发
    if (isAtFirstLine()) {
      const result = navigateBack(inputText.value);
      if (result !== null) {
        e.preventDefault();
        inputText.value = result;
        // 将光标移到末尾
        nextTick(() => {
          if (inputRef.value) {
            inputRef.value.selectionStart = inputRef.value.selectionEnd = inputText.value.length;
          }
        });
      }
    }
  }

  // 下箭头：向后导航历史
  if (e.key === 'ArrowDown') {
    // 只有在光标在最后一行且正在导航时才触发
    if (isNavigating.value && isAtLastLine()) {
      const result = navigateForward();
      if (result !== null) {
        e.preventDefault();
        inputText.value = result;
        nextTick(() => {
          if (inputRef.value) {
            inputRef.value.selectionStart = inputRef.value.selectionEnd = inputText.value.length;
          }
        });
      }
    }
  }

  // Escape：取消导航
  if (e.key === 'Escape') {
    if (isNavigating.value) {
      cancelNavigation();
      e.preventDefault();
    } else if (showHistoryPanel.value) {
      showHistoryPanel.value = false;
      e.preventDefault();
    }
  }
};

/**
 * 检查光标是否在第一行
 */
const isAtFirstLine = (): boolean => {
  if (!inputRef.value) return true;
  const cursorPos = inputRef.value.selectionStart || 0;
  const textBeforeCursor = inputText.value.substring(0, cursorPos);
  return !textBeforeCursor.includes('\n');
};

/**
 * 检查光标是否在最后一行
 */
const isAtLastLine = (): boolean => {
  if (!inputRef.value) return true;
  const cursorPos = inputRef.value.selectionStart || 0;
  const textAfterCursor = inputText.value.substring(cursorPos);
  return !textAfterCursor.includes('\n');
};

/**
 * 取消导航
 */
const cancelNavigation = () => {
  resetNavigation();
  inputText.value = '';
};

/**
 * 自动调整高度
 */
const autoResize = () => {
  if (!inputRef.value) return;

  inputRef.value.style.height = 'auto';
  const scrollHeight = inputRef.value.scrollHeight;
  const maxHeight = 120; // 最大高度
  inputRef.value.style.height = Math.min(scrollHeight, maxHeight) + 'px';
};

/**
 * 聚焦输入框
 */
const focus = () => {
  inputRef.value?.focus();
};

/**
 * 清空输入
 */
const clear = () => {
  inputText.value = '';
  resetNavigation();
  if (inputRef.value) {
    inputRef.value.style.height = 'auto';
  }
};

/**
 * 切换历史面板
 */
const toggleHistoryPanel = () => {
  showHistoryPanel.value = !showHistoryPanel.value;
  if (showHistoryPanel.value) {
    searchQuery.value = '';
  }
};

/**
 * 选择历史记录项
 */
const selectHistoryItem = (content: string) => {
  inputText.value = content;
  showHistoryPanel.value = false;
  resetNavigation();
  focus();
  nextTick(() => {
    autoResize();
  });
};

/**
 * 删除历史记录项
 */
const removeHistoryItem = (index: number) => {
  removeHistoryAt(index);
};

/**
 * 清空历史记录
 */
const handleClearHistory = async () => {
  const confirmed = await confirmDanger('确定要清空所有历史记录吗？', '清空历史');
  if (confirmed) {
    clearHistory();
    searchQuery.value = '';
  }
};

/**
 * 格式化时间
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  // 小于1分钟
  if (diff < 60000) {
    return '刚刚';
  }
  // 小于1小时
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  }
  // 小于24小时
  if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}小时前`;
  }
  // 同一年
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  // 不同年
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
};

/**
 * 截断文本
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// 暴露方法
defineExpose({
  focus,
  clear,
  addToHistory,
  clearHistory,
});

// ============ 生命周期 ============
onMounted(() => {
  // 自动聚焦
  focus();
});

// 监听输入变化，退出导航状态（当用户手动编辑时）
watch(inputText, (newVal, oldVal) => {
  // 如果是用户手动输入（不是导航填充），则退出导航
  if (isNavigating.value && newVal !== oldVal) {
    // 检查是否是导航操作（通过比较内容）
    const currentItem = historyList.value[currentIndex.value];
    if (currentItem && newVal !== currentItem.content) {
      // 用户手动修改了内容，退出导航
      resetNavigation();
    }
  }
});
</script>

<style lang="scss" scoped>
.bottom-bar {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
  position: relative;
  z-index: 50;
}

// ============ 历史记录面板 ============
.history-panel {
  background: var(--bg-color);
  border-bottom: 1px solid var(--border-color);
  max-height: 300px;
  display: flex;
  flex-direction: column;
}

.history-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);

  .history-title {
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--text-color);
  }

  .history-count {
    font-size: var(--font-xs);
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
  }

  .history-actions {
    margin-left: auto;
    display: flex;
    gap: var(--spacing-xs);
  }

  .history-clear-btn,
  .history-close-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-size: 12px;
    color: var(--text-secondary);

    &:hover {
      background: var(--bg-tertiary);
      color: var(--text-color);
    }
  }

  .history-clear-btn:hover {
    color: var(--error-color);
  }
}

.history-search {
  padding: var(--spacing-xs) var(--spacing-md);
  border-bottom: 1px solid var(--border-color);

  .history-search-input {
    width: 100%;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-sm);
    color: var(--text-color);
    font-size: var(--font-xs);
    outline: none;

    &:focus {
      border-color: var(--primary-color);
    }

    &::placeholder {
      color: var(--text-disabled);
    }
  }
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-xs) 0;
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--bg-secondary);

    .history-delete-btn {
      opacity: 1;
    }
  }

  &.is-active {
    background: rgba(var(--primary-color-rgb), 0.1);
    border-left: 3px solid var(--primary-color);
    padding-left: calc(var(--spacing-md) - 3px);
  }

  .history-content {
    flex: 1;
    font-size: var(--font-xs);
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .history-time {
    font-size: 10px;
    color: var(--text-disabled);
    flex-shrink: 0;
  }

  .history-delete-btn {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-size: 10px;
    color: var(--text-secondary);
    opacity: 0;
    transition: all var(--transition-fast);

    &:hover {
      background: rgba(var(--error-color-rgb), 0.1);
      color: var(--error-color);
    }
  }
}

.history-empty {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--text-disabled);
  font-size: var(--font-xs);
}

// ============ 输入区域 ============
.input-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
}

.input-container {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-xs);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  &:focus-within {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.1);
  }

  &.is-loading {
    opacity: 0.7;
    border-color: var(--border-color);
  }

  &.has-error {
    border-color: var(--error-color);
  }
}

// ============ 历史记录按钮 ============
.history-toggle-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;

  .history-icon {
    font-size: 16px;
  }

  &:hover {
    background: var(--bg-secondary);
    border-color: var(--primary-color);
  }

  &.is-active {
    background: rgba(var(--primary-color-rgb), 0.1);
    border-color: var(--primary-color);
  }

  &:not(.has-history) {
    opacity: 0.5;

    &:hover {
      opacity: 0.7;
    }
  }
}

.message-input {
  flex: 1;
  min-height: 36px;
  max-height: 120px;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: transparent;
  border: none;
  color: var(--text-color);
  font-size: var(--font-sm);
  line-height: 1.5;
  resize: none;
  outline: none;

  &::placeholder {
    color: var(--text-disabled);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.send-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;

  .send-icon,
  .loading-icon {
    font-size: 16px;
  }

  &:hover:not(:disabled) {
    background: var(--primary-hover);
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    background: var(--bg-tertiary);
    cursor: not-allowed;
    opacity: 0.6;
  }

  &.is-loading {
    animation: pulse 1.5s infinite;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

// ============ 导航提示 ============
.navigation-hint {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(var(--primary-color-rgb), 0.1);
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  color: var(--primary-color);

  .hint-icon {
    font-size: 12px;
  }

  .hint-text {
    flex: 1;
  }

  .hint-cancel {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: var(--radius-xs);
    cursor: pointer;
    font-size: 10px;
    color: var(--primary-color);

    &:hover {
      background: rgba(var(--primary-color-rgb), 0.2);
    }
  }
}

// ============ 错误消息 ============
.error-message {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: rgba(var(--error-color-rgb), 0.1);
  border-radius: var(--radius-sm);
  color: var(--error-color);
  font-size: var(--font-xs);

  .error-icon {
    flex-shrink: 0;
  }

  .error-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .error-dismiss {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--error-color);
    cursor: pointer;
    border-radius: var(--radius-xs);

    &:hover {
      background: rgba(var(--error-color-rgb), 0.2);
    }
  }
}

// ============ 动画 ============
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(10px);
}

.slide-up-enter-to,
.slide-up-leave-from {
  opacity: 1;
  max-height: 300px;
  transform: translateY(0);
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .bottom-bar {
    flex-direction: column;
  }

  .input-area {
    padding: var(--spacing-sm);
    padding-bottom: calc(var(--spacing-sm) + env(safe-area-inset-bottom, 0px));
  }

  .input-container {
    padding: var(--spacing-sm);
  }

  .message-input {
    font-size: 16px; // 防止iOS自动放大
  }

  .send-btn,
  .history-toggle-btn {
    width: 44px;
    height: 44px;

    .send-icon,
    .loading-icon,
    .history-icon {
      font-size: 18px;
    }
  }

  .history-panel {
    max-height: 250px;
  }
}
</style>
