<!--
  MC房子 - 主内容区域组件
  职场模拟游戏 - 游戏文本显示区域
  参考归墟模式：只显示当前AI回复内容，而非聊天列表
  集成内容块差异化显示系统
  集成变量变化面板 - 显示AI回复后的变量更新
  集成自定义开局面板 - 当内容为空时显示开局设定界面
-->
<template>
  <main class="main-content">
    <!-- 自定义开局面板 - 当内容为空时显示 -->
    <GameStartPanel v-if="showGameStartPanel" @start="handleGameStart" @cancel="handleGameStartCancel" />

    <!-- 游戏文本显示区域 - 有内容时显示 -->
    <div v-else class="game-text-container">
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
      <div v-else ref="contentRef" class="content-display">
        <!-- 内容头部 -->
        <div class="content-header">
          <div class="content-meta">
            <span v-if="lastUpdateTime" class="meta-item">
              <span class="meta-icon">🕐</span>
              {{ lastUpdateTime }}
            </span>
            <span v-if="isStreaming" class="meta-item streaming-badge">
              <span class="streaming-dot"></span>
              正在生成...
            </span>
          </div>
          <!-- 版本徽章 -->
          <div class="version-badge" title="MClite v0.8.1">
            <span class="version-tag">MClite v0.8.1</span>
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

        <!-- 变量变化面板（增强版） -->
        <VariableChangesPanel
          ref="variableChangesPanelRef"
          :changes="variableChanges"
          :default-expanded="shouldAutoExpandChanges"
          @clear="handleClearChanges"
          @copy="handleCopyChanges"
        />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import ContentBlockRenderer from '../common/ContentBlockRenderer.vue';
import VariableChangesPanel from '../common/VariableChangesPanel.vue';
import GameStartPanel from './GameStartPanel.vue';
import type { ContentBlockEvent, ParseResult, RendererConfig } from '../../types/contentBlock';

// ============ Types ============

/** 变量变化记录（与 useAIInteraction 中的 VariableChange 保持一致） */
interface VariableChange {
  path: string;
  oldValue?: any;
  newValue: any;
  comment?: string;
}

// ============ Props ============
interface Props {
  /** 当前显示内容 */
  currentContent?: string;
  /** 是否正在处理 */
  isProcessing?: boolean;
  /** 是否正在流式传输 */
  isStreaming?: boolean;
  /** 变量变化列表 */
  variableChanges?: VariableChange[];
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

// ============ Emits ============
const emit = defineEmits<{
  /** 开始游戏，发送开局提示词 */
  (e: 'game-start', prompt: string): void;
}>();

// ============ Refs ============
const contentRef = ref<HTMLElement | null>(null);
const variableChangesPanelRef = ref<InstanceType<typeof VariableChangesPanel> | null>(null);

// ============ 计算属性 ============

/** 是否应该自动展开变量变化面板（有变化时自动展开） */
const shouldAutoExpandChanges = computed(() => props.variableChanges.length > 0);

/** 是否显示开局面板（当内容为空且不在处理中时） */
const showGameStartPanel = computed(() => {
  // 如果正在处理或流式传输，不显示开局面板
  if (props.isProcessing || props.isStreaming) return false;
  // 如果内容为空，显示开局面板
  return !props.currentContent || props.currentContent.trim() === '';
});

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
 * 处理清空变量变化记录
 */
const handleClearChanges = (): void => {
  console.log('[MainContent] 清空变量变化记录');
  // 通知父组件清空变量变化（如果需要）
};

/**
 * 处理复制变量变化记录
 */
const handleCopyChanges = (content: string): void => {
  console.log('[MainContent] 复制变量变化记录:', content.substring(0, 100));
};

/**
 * 处理开始游戏
 */
const handleGameStart = (prompt: string): void => {
  console.log('[MainContent] 开始游戏，提示词长度:', prompt.length);
  emit('game-start', prompt);
};

/**
 * 处理取消开局
 */
const handleGameStartCancel = (): void => {
  console.log('[MainContent] 取消开局');
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
  /** 展开变量变化面板 */
  expandChangesPanel: () => variableChangesPanelRef.value?.expand(),
  /** 收起变量变化面板 */
  collapseChangesPanel: () => variableChangesPanelRef.value?.collapse(),
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

// 版本徽章
.version-badge {
  .version-tag {
    display: inline-block;
    padding: 2px 8px;
    font-size: 10px;
    font-family: monospace;
    font-weight: 500;
    color: var(--text-disabled);
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 3px;
    white-space: nowrap;
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

// ============ 变量变化面板 ============
:deep(.variable-changes-panel) {
  margin-top: auto;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .game-text-container {
    padding: var(--spacing-sm);
  }

  .content-header {
    // 保持 row 方向和两端对齐，确保时间和版本号分居两头
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .content-meta {
    gap: var(--spacing-sm);

    .meta-item {
      font-size: 11px;
    }
  }

  .version-badge {
    .version-tag {
      padding: 1px 6px;
      font-size: 9px;
    }
  }

  .game-text {
    padding: var(--spacing-md);
  }

  .text-content {
    font-size: var(--font-sm);
  }
}
</style>
