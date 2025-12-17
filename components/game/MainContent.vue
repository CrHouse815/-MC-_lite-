<!--
  MC房子 - 主内容区域组件
  职场模拟游戏 - 游戏文本显示区域
  参考归墟模式：只显示当前AI回复内容，而非聊天列表
  集成内容块差异化显示系统
-->
<template>
  <main class="main-content">
    <!-- 游戏文本显示区域 -->
    <div class="game-text-container">
      <!-- AI正在思考状态 -->
      <div v-if="isProcessing && !isStreaming" class="processing-state">
        <div class="thinking-panel">
          <div class="thinking-animation">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
          </div>
          <p class="thinking-text">AI正在思考...</p>
        </div>
      </div>

      <!-- 主内容显示 -->
      <div v-else class="content-display" ref="contentRef">
        <!-- 内容头部 -->
        <div class="content-header">
          <div class="content-meta">
            <span class="meta-item" v-if="lastUpdateTime">
              <span class="meta-icon">🕐</span>
              {{ lastUpdateTime }}
            </span>
            <span class="meta-item streaming-badge" v-if="isStreaming">
              <span class="streaming-dot"></span>
              正在生成...
            </span>
          </div>
        </div>

        <!-- 主文本内容 - 使用内容块差异化渲染组件 -->
        <div class="game-text">
          <ContentBlockRenderer
            :content="currentContent"
            :is-streaming="isStreaming"
            :config="contentBlockConfig"
            theme="auto"
            @block-click="handleBlockClick"
            @parsed="handleParsed"
          />
        </div>

        <!-- 变量变化提醒（参考归墟的设计） -->
        <div v-if="variableChanges.length > 0" class="variable-changes">
          <div class="changes-header" @click="showChanges = !showChanges">
            <span class="changes-icon">📊</span>
            <span class="changes-title">变量变化 ({{ variableChanges.length }})</span>
            <span class="changes-toggle">{{ showChanges ? '▼' : '▶' }}</span>
          </div>
          <div v-if="showChanges" class="changes-list">
            <div v-for="(change, index) in variableChanges" :key="index" class="change-item">
              <span class="change-path">{{ change.path }}</span>
              <span class="change-arrow">→</span>
              <span class="change-value">{{ formatValue(change.newValue) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import ContentBlockRenderer from '../common/ContentBlockRenderer.vue';
import type { ContentBlockEvent, ParseResult, RendererConfig } from '../../types/contentBlock';

// ============ Props ============
interface Props {
  /** 当前显示内容 */
  currentContent?: string;
  /** 是否正在处理 */
  isProcessing?: boolean;
  /** 是否正在流式传输 */
  isStreaming?: boolean;
  /** 变量变化列表 */
  variableChanges?: Array<{ path: string; oldValue?: any; newValue: any }>;
  /** 最后更新时间 */
  lastUpdateTime?: string;
}

const props = withDefaults(defineProps<Props>(), {
  currentContent: '',
  isProcessing: false,
  isStreaming: false,
  variableChanges: () => [],
  lastUpdateTime: '',
});

// ============ Refs ============
const contentRef = ref<HTMLElement | null>(null);
const showChanges = ref(false);

// ============ 内容块渲染配置 ============

/** 内容块渲染器配置 */
const contentBlockConfig: Partial<RendererConfig> = {
  enabled: true,
  showIcons: true,
  enableAnimations: true,
};

// ============ 事件处理 ============

/**
 * 处理内容块点击事件
 */
const handleBlockClick = (event: ContentBlockEvent): void => {
  console.log('[MainContent] 内容块被点击:', event.block.type, event.block.displayContent.substring(0, 50));
};

/**
 * 处理解析完成事件
 */
const handleParsed = (result: ParseResult): void => {
  if (result.success) {
    console.log('[MainContent] 内容解析完成:', {
      总块数: result.statistics.totalBlocks,
      各类型: result.statistics.blockCounts,
      耗时: result.statistics.parseTime.toFixed(2) + 'ms',
    });
  }
};

// ============ 方法 ============

/**
 * 滚动到底部
 */
const scrollToBottom = (): void => {
  nextTick(() => {
    if (contentRef.value) {
      contentRef.value.scrollTop = contentRef.value.scrollHeight;
    }
  });
};

/**
 * 格式化值用于显示
 */
const formatValue = (value: any): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// ============ 监听 ============

// 监听内容变化，自动滚动到底部
watch(
  () => props.currentContent,
  () => {
    scrollToBottom();
  },
);

// 暴露方法给父组件
defineExpose({
  scrollToBottom,
});
</script>

<style lang="scss" scoped>
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  background: var(--bg-color);
}

// ============ 游戏文本容器 ============
.game-text-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--spacing-md);
}

// ============ 处理中状态 ============
.processing-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thinking-panel {
  text-align: center;
  padding: var(--spacing-xl);
}

.thinking-animation {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: var(--spacing-md);

  .thinking-dot {
    width: 12px;
    height: 12px;
    background: var(--primary-color);
    border-radius: 50%;
    animation: thinkingPulse 1.4s ease-in-out infinite;

    &:nth-child(1) {
      animation-delay: 0s;
    }
    &:nth-child(2) {
      animation-delay: 0.2s;
    }
    &:nth-child(3) {
      animation-delay: 0.4s;
    }
  }
}

@keyframes thinkingPulse {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.thinking-text {
  font-size: var(--font-md);
  color: var(--text-secondary);
  margin: 0;
}

// ============ 内容显示区 ============
.content-display {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  flex-shrink: 0;
}

.content-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);

  .meta-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-xs);
    color: var(--text-disabled);

    .meta-icon {
      font-size: 12px;
    }
  }

  .streaming-badge {
    color: var(--primary-color);

    .streaming-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      background: var(--primary-color);
      border-radius: 50%;
      animation: streamingBlink 1s ease-in-out infinite;
    }
  }
}

@keyframes streamingBlink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

// ============ 游戏文本 ============
.game-text {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;

  // 内容块渲染器样式
  :deep(.content-block-renderer) {
    font-size: var(--font-md);
    line-height: 1.8;
    color: var(--text-color);
  }
}

// ============ 变量变化 ============
.variable-changes {
  margin-top: auto;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.changes-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
  }

  .changes-icon {
    font-size: 14px;
  }

  .changes-title {
    flex: 1;
    font-size: var(--font-sm);
    font-weight: 500;
    color: var(--text-color);
  }

  .changes-toggle {
    font-size: 10px;
    color: var(--text-disabled);
  }
}

.changes-list {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-color);
  border-top: 1px solid var(--border-color);
}

.change-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  font-size: var(--font-xs);

  .change-path {
    color: var(--text-secondary);
    font-family: monospace;
  }

  .change-arrow {
    color: var(--text-disabled);
  }

  .change-value {
    color: var(--primary-color);
    font-family: monospace;
  }
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .game-text-container {
    padding: var(--spacing-sm);
  }

  .content-header {
    flex-direction: column;
    gap: var(--spacing-sm);
    align-items: flex-start;
  }

  .game-text {
    padding: var(--spacing-md);
  }

  .text-content {
    font-size: var(--font-sm);
  }
}
</style>
