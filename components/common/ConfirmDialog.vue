<!--
  确认对话框组件
  一个风格适配的内部确认面板，替代浏览器原生的 confirm() 函数
  保持沉浸感，不会触发全屏退出
-->
<template>
  <!-- 移除 Teleport，直接在当前容器中渲染，以支持全屏模式 -->
  <Transition name="confirm-dialog">
    <div v-if="state.visible" class="confirm-dialog-overlay" @click.self="handleOverlayClick">
      <div class="confirm-dialog" :class="[`type-${state.type}`]" role="dialog" aria-modal="true">
        <!-- 对话框头部 -->
        <div class="dialog-header">
          <span class="dialog-icon">{{ state.icon }}</span>
          <h3 class="dialog-title">{{ state.title }}</h3>
        </div>

        <!-- 对话框内容 -->
        <div class="dialog-body">
          <p class="dialog-message">{{ state.message }}</p>
        </div>

        <!-- 对话框底部按钮 -->
        <div class="dialog-footer">
          <button v-if="state.showCancel" class="btn btn-cancel" :disabled="state.isProcessing" @click="handleCancel">
            {{ state.cancelText }}
          </button>
          <button
            class="btn btn-confirm"
            :class="[`btn-${state.type}`]"
            :disabled="state.isProcessing"
            @click="handleConfirm"
          >
            <span v-if="state.isProcessing" class="loading-spinner"></span>
            <span>{{ state.confirmText }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useConfirmDialog } from '../../composables/useConfirmDialog';

// 使用确认对话框 composable
const { state, handleConfirm, handleCancel } = useConfirmDialog();

// 点击遮罩层
const handleOverlayClick = () => {
  if (state.showCancel && !state.isProcessing) {
    handleCancel();
  }
};
</script>

<style lang="scss" scoped>
// ============ 遮罩层 ============
.confirm-dialog-overlay {
  // 使用 !important 确保在全屏模式下也能正常显示
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  // 使用比其他模态框更高的 z-index，确保显示在最上层
  z-index: 10010 !important;
  padding: var(--spacing-md, 16px);
}

// ============ 对话框主体 ============
.confirm-dialog {
  background: var(--bg-secondary, #ffffff);
  border-radius: var(--radius-lg, 8px);
  box-shadow: var(--shadow-lg, 0 10px 20px rgba(0, 0, 0, 0.12));
  max-width: 420px;
  width: 100%;
  overflow: hidden;
  animation: dialog-enter 0.2s ease-out;

  // 类型样式变体
  &.type-info {
    --dialog-accent: var(--info-color, #1c71d8);
    --dialog-accent-light: var(--info-light, rgba(28, 113, 216, 0.1));
  }

  &.type-warning {
    --dialog-accent: var(--warning-color, #e5a50a);
    --dialog-accent-light: var(--warning-light, rgba(229, 165, 10, 0.1));
  }

  &.type-danger {
    --dialog-accent: var(--error-color, #c01c28);
    --dialog-accent-light: var(--error-light, rgba(192, 28, 40, 0.1));
  }

  &.type-success {
    --dialog-accent: var(--success-color, #26a269);
    --dialog-accent-light: var(--success-light, rgba(38, 162, 105, 0.1));
  }
}

// ============ 对话框头部 ============
.dialog-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-lg, 24px) var(--spacing-lg, 24px) var(--spacing-sm, 8px);
}

.dialog-icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
}

.dialog-title {
  margin: 0;
  font-size: var(--font-lg, 17px);
  font-weight: 600;
  color: var(--text-color, #2e3436);
}

// ============ 对话框内容 ============
.dialog-body {
  padding: var(--spacing-sm, 8px) var(--spacing-lg, 24px) var(--spacing-lg, 24px);
}

.dialog-message {
  margin: 0;
  font-size: var(--font-md, 15px);
  color: var(--text-secondary, #5e5c64);
  line-height: 1.6;
  word-break: break-word;
}

// ============ 对话框底部 ============
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-md, 16px) var(--spacing-lg, 24px);
  background: var(--bg-tertiary, #f6f5f4);
  border-top: 1px solid var(--border-light, #e5e5e5);
}

// ============ 按钮样式 ============
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs, 4px);
  padding: var(--spacing-sm, 8px) var(--spacing-lg, 24px);
  font-size: var(--font-sm, 13px);
  font-weight: 500;
  border-radius: var(--radius-md, 6px);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast, 0.1s ease);
  min-width: 80px;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-cancel {
  background: var(--bg-color, #f6f5f4);
  color: var(--text-color, #2e3436);
  border: 1px solid var(--border-color, #c0bfbc);

  &:hover:not(:disabled) {
    background: var(--bg-hover, #f0f0f0);
    border-color: var(--border-hover, #9a9996);
  }

  &:active:not(:disabled) {
    background: var(--bg-tertiary, #deddda);
  }
}

.btn-confirm {
  background: var(--dialog-accent, var(--primary-color, #1a5fb4));
  color: white;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  &:active:not(:disabled) {
    filter: brightness(0.95);
  }

  &.btn-info {
    background: var(--info-color, #1c71d8);
  }

  &.btn-warning {
    background: var(--warning-color, #e5a50a);
    color: var(--text-highlight, #000);
  }

  &.btn-danger {
    background: var(--error-color, #c01c28);
  }

  &.btn-success {
    background: var(--success-color, #26a269);
  }
}

// ============ 加载动画 ============
.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// ============ 进入/离开动画 ============
@keyframes dialog-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity 0.2s ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}

.confirm-dialog-enter-active .confirm-dialog {
  animation: dialog-enter 0.2s ease-out;
}

.confirm-dialog-leave-active .confirm-dialog {
  animation: dialog-enter 0.15s ease-in reverse;
}

// ============ 响应式 ============
@media (max-width: 480px) {
  .confirm-dialog {
    max-width: calc(100vw - 32px);
  }

  .dialog-footer {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
  }
}

// ============ 深色主题支持 ============
:root.dark-theme {
  .confirm-dialog {
    background: var(--bg-secondary, #2d2d2d);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  }

  .dialog-title {
    color: var(--text-color, #f5f5f5);
  }

  .dialog-message {
    color: var(--text-secondary, #b0b0b0);
  }

  .dialog-footer {
    background: var(--bg-tertiary, #3d3d3d);
    border-top-color: var(--border-color, #4d4d4d);
  }

  .btn-cancel {
    background: var(--bg-color, #1e1e1e);
    color: var(--text-color, #f5f5f5);
    border-color: var(--border-color, #4d4d4d);

    &:hover:not(:disabled) {
      background: var(--bg-hover, #3d3d3d);
    }
  }
}
</style>
