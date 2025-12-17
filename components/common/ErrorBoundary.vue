<!--
  MC房子 - 错误边界组件
  捕获子组件的错误并显示友好的错误信息
-->
<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h3 class="error-title">出现了一些问题</h3>
      <p class="error-message">{{ errorMessage }}</p>
      <div class="error-actions">
        <button class="btn btn-primary" @click="handleRetry">重试</button>
        <button class="btn btn-secondary" @click="handleDismiss">忽略</button>
      </div>
      <details v-if="errorDetails" class="error-details">
        <summary>查看详细信息</summary>
        <pre>{{ errorDetails }}</pre>
      </details>
    </div>
  </div>
  <slot v-else></slot>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';

// Props
interface Props {
  /** 是否显示详细错误信息 */
  showDetails?: boolean;
  /** 自定义错误消息 */
  fallbackMessage?: string;
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: true,
  fallbackMessage: '组件加载时发生错误，请稍后重试。',
});

// Emits
const emit = defineEmits<{
  (e: 'error', error: Error, info: string): void;
  (e: 'retry'): void;
  (e: 'dismiss'): void;
}>();

// 状态
const hasError = ref(false);
const errorMessage = ref('');
const errorDetails = ref('');

/**
 * 捕获错误
 */
onErrorCaptured((error: Error, instance, info: string) => {
  hasError.value = true;
  errorMessage.value = error.message || props.fallbackMessage;

  if (props.showDetails) {
    errorDetails.value = `
错误类型: ${error.name}
错误信息: ${error.message}
组件信息: ${info}
堆栈信息:
${error.stack || '无堆栈信息'}
    `.trim();
  }

  // 记录错误日志
  console.error('[ErrorBoundary] 捕获到错误:', error);
  console.error('[ErrorBoundary] 组件信息:', info);

  // 发出错误事件
  emit('error', error, info);

  // 阻止错误继续传播
  return false;
});

/**
 * 重试操作
 */
const handleRetry = () => {
  hasError.value = false;
  errorMessage.value = '';
  errorDetails.value = '';
  emit('retry');
};

/**
 * 忽略错误
 */
const handleDismiss = () => {
  hasError.value = false;
  errorMessage.value = '';
  errorDetails.value = '';
  emit('dismiss');
};

/**
 * 手动重置错误状态
 */
const reset = () => {
  hasError.value = false;
  errorMessage.value = '';
  errorDetails.value = '';
};

// 暴露方法供父组件调用
defineExpose({
  reset,
  hasError,
});
</script>

<style lang="scss" scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: var(--spacing-lg);
}

.error-content {
  max-width: 500px;
  text-align: center;
  padding: var(--spacing-xl);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.error-icon {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
}

.error-title {
  margin: 0 0 var(--spacing-sm);
  color: var(--text-color);
  font-size: var(--font-lg);
  font-weight: 600;
}

.error-message {
  margin: 0 0 var(--spacing-lg);
  color: var(--text-secondary);
  font-size: var(--font-sm);
  line-height: 1.5;
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.error-details {
  text-align: left;
  margin-top: var(--spacing-md);

  summary {
    cursor: pointer;
    color: var(--text-secondary);
    font-size: var(--font-xs);
    padding: var(--spacing-sm);

    &:hover {
      color: var(--text-color);
    }
  }

  pre {
    margin-top: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    font-size: var(--font-xs);
    color: var(--text-secondary);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
  }
}
</style>
