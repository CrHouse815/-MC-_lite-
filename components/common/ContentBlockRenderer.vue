<!--
  MClite - 内容块差异化渲染组件 (简化版)
  
  功能：
  - 直接渲染AI回复内容，不做复杂解析
  - 纯CSS方式差异化显示不同格式的文本
  - 保留原始格式符号，只改变视觉效果（颜色、字体、透明度）
-->
<template>
  <div class="content-renderer" :class="{ 'content-renderer--dark': isDarkTheme }">
    <span class="content-text" v-html="processedContent"></span>
    <span v-if="isStreaming" class="streaming-cursor">▌</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// ============ Props ============
interface Props {
  /** 要渲染的内容 */
  content: string;
  /** 是否正在流式传输 */
  isStreaming?: boolean;
  /** 强制使用的主题 */
  theme?: 'light' | 'dark' | 'auto';
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  isStreaming: false,
  theme: 'auto',
});

// ============ 计算属性 ============

/** 是否为深色主题 */
const isDarkTheme = computed(() => {
  if (props.theme === 'dark') return true;
  if (props.theme === 'light') return false;
  if (typeof document !== 'undefined') {
    return (
      document.documentElement.classList.contains('dark-theme') ||
      document.body.classList.contains('dark-theme') ||
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    );
  }
  return false;
});

/**
 * 处理内容 - 用<span>包裹不同类型的内容块
 *
 * 规则：
 * - 「对话」 → 蓝色
 * - *心理* → 紫色斜体淡化
 * - 【景物】 → 绿色淡化
 * - 【【系统】】 → 红色加粗
 *
 * 注意：使用函数式替换避免$符号被解释为反向引用
 */
const processedContent = computed(() => {
  if (!props.content) return '';

  let result = escapeHtml(props.content);

  // 处理换行
  result = result.replace(/\n/g, '<br>');

  // 1. 先处理【【系统】】(优先级最高，避免被【】匹配)
  result = result.replace(
    /【【([^【】]*)】】/g,
    (_match, content) => `<span class="block-system">【【${content}】】</span>`,
  );

  // 2. 处理【景物】
  result = result.replace(/【([^【】]+)】/g, (_match, content) => `<span class="block-scenery">【${content}】</span>`);

  // 3. 处理「对话」
  result = result.replace(/「([^「」]+)」/g, (_match, content) => `<span class="block-dialogue">「${content}」</span>`);

  // 4. 处理*心理*
  result = result.replace(/\*([^*]+)\*/g, (_match, content) => `<span class="block-thought">*${content}*</span>`);

  return result;
});

/** HTML转义 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  };
  return text.replace(/[&<>"]/g, char => htmlEntities[char] || char);
}

// ============ 暴露 ============
defineExpose({
  isDarkTheme,
});
</script>

<style lang="scss" scoped>
.content-renderer {
  font-size: var(--font-md, 15px);
  line-height: 1.8;
  color: var(--text-color, #1a1a1a);

  &--dark {
    color: var(--text-color, #e8e8e8);
  }
}

.content-text {
  // 对话 - 深蓝色，高对比度
  :deep(.block-dialogue) {
    color: #0d47a1;
    font-weight: 500;
  }

  // 心理 - 深紫色斜体
  :deep(.block-thought) {
    color: #6b21a8;
    font-style: italic;
    opacity: 0.9;
  }

  // 景物 - 深绿色
  :deep(.block-scenery) {
    color: #166534;
    opacity: 0.95;
  }

  // 系统 - 深红色加粗
  :deep(.block-system) {
    color: #b91c1c;
    font-weight: 700;
  }
}

// 深色主题颜色调整 - 高对比度亮色
.content-renderer--dark .content-text {
  :deep(.block-dialogue) {
    color: #93c5fd;
    font-weight: 500;
  }

  :deep(.block-thought) {
    color: #c4b5fd;
    opacity: 0.95;
  }

  :deep(.block-scenery) {
    color: #6ee7b7;
    opacity: 1;
  }

  :deep(.block-system) {
    color: #fca5a5;
    font-weight: 700;
  }
}

// 流式传输光标
.streaming-cursor {
  display: inline-block;
  animation: cursorBlink 1s step-end infinite;
  color: var(--primary-color, #1a5fb4);
  font-weight: bold;
}

.content-renderer--dark .streaming-cursor {
  color: var(--primary-color, #60a5fa);
}

@keyframes cursorBlink {
  0%,
  50% {
    opacity: 1;
  }
  51%,
  100% {
    opacity: 0;
  }
}
</style>
