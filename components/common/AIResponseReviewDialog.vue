<!--
  MClite - AI响应审查对话框
  在AI输出结束后显示，让玩家审查AI回复内容
  包含格式检查结果和变量更新预览
  玩家可以确认继续或回退取消
-->
<template>
  <Transition name="review-dialog">
    <div v-if="visible" class="review-dialog-overlay" @click.self="handleOverlayClick">
      <div class="review-dialog" :class="{ 'has-errors': !reviewResult?.passed }">
        <!-- 对话框头部 -->
        <div class="dialog-header">
          <div class="header-left">
            <span class="header-icon">{{ reviewResult?.passed ? '✅' : '⚠️' }}</span>
            <h3 class="header-title">AI输出审查</h3>
          </div>
          <div class="header-status">
            <span class="status-badge" :class="statusClass">
              {{ statusText }}
            </span>
          </div>
        </div>

        <!-- 审查摘要 -->
        <div v-if="reviewResult" class="review-summary">
          <div v-for="(check, index) in reviewResult.tagChecks" :key="index" class="summary-item">
            <span class="tag-icon" :class="getTagStatusClass(check)">
              {{ getTagStatusIcon(check) }}
            </span>
            <span class="tag-name">{{ getTagDisplayName(check.tagName) }}</span>
            <span class="tag-status">{{ getTagStatusText(check) }}</span>
          </div>
        </div>

        <!-- 问题列表 -->
        <div v-if="reviewResult && reviewResult.issues.length > 0" class="issues-section">
          <div class="section-title">
            <span class="section-icon">📋</span>
            <span>问题列表</span>
          </div>
          <div class="issues-list">
            <div
              v-for="(issue, index) in reviewResult.issues"
              :key="index"
              class="issue-item"
              :class="`issue-${issue.level}`"
            >
              <span class="issue-icon">{{ getIssueIcon(issue.level) }}</span>
              <span class="issue-message">{{ issue.message }}</span>
            </div>
          </div>
        </div>

        <!-- 变量更新预览 -->
        <div v-if="reviewResult?.variableCheck?.commands?.length" class="variables-section">
          <div class="section-title">
            <span class="section-icon">📊</span>
            <span>变量更新预览 ({{ reviewResult.variableCheck.commands.length }}条)</span>
          </div>
          <div class="variables-list">
            <div
              v-for="(cmd, index) in reviewResult.variableCheck.commands.slice(0, 10)"
              :key="index"
              class="variable-item"
            >
              <span class="var-path">{{ cmd.path }}</span>
              <span class="var-op">{{ getOperationSymbol(cmd.operation) }}</span>
              <span class="var-value">{{ formatValue(cmd.value) }}</span>
            </div>
            <div v-if="reviewResult.variableCheck.commands.length > 10" class="more-hint">
              ... 还有 {{ reviewResult.variableCheck.commands.length - 10 }} 条
            </div>
          </div>
        </div>

        <!-- AI回复内容预览 -->
        <div class="content-section">
          <div class="section-header">
            <div class="section-title">
              <span class="section-icon">📝</span>
              <span>AI回复内容</span>
            </div>
            <div class="section-actions">
              <button class="btn-toggle" @click="toggleContentView">
                {{ showRawContent ? '显示解析内容' : '显示原始内容' }}
              </button>
            </div>
          </div>
          <div ref="contentPreview" class="content-preview">
            <template v-if="showRawContent">
              <pre class="raw-content">{{ reviewResult?.originalText }}</pre>
            </template>
            <template v-else>
              <div class="parsed-content" v-html="formattedGameText"></div>
            </template>
          </div>
        </div>

        <!-- 对话框底部按钮 -->
        <div class="dialog-footer">
          <button class="btn btn-rollback" :disabled="isProcessing" @click="handleRollback">
            <span class="btn-icon">↩️</span>
            <span>回退取消</span>
          </button>
          <button
            class="btn btn-confirm"
            :class="{ 'btn-warning': !reviewResult?.passed }"
            :disabled="isProcessing"
            @click="handleConfirm"
          >
            <span v-if="isProcessing" class="loading-spinner"></span>
            <span v-else class="btn-icon">{{ reviewResult?.passed ? '✓' : '⚠️' }}</span>
            <span>{{ reviewResult?.passed ? '确认应用' : '强制应用' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { ReviewResult, TagCheckResult, ReviewIssue } from '../../services/AIResponseReviewService';

// ============ Props ============
interface Props {
  /** 是否显示对话框 */
  visible: boolean;
  /** 审查结果 */
  reviewResult: ReviewResult | null;
  /** 是否正在处理 */
  isProcessing?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  reviewResult: null,
  isProcessing: false,
});

// ============ Emits ============
const emit = defineEmits<{
  /** 确认应用 */
  (e: 'confirm'): void;
  /** 回退取消 */
  (e: 'rollback'): void;
  /** 关闭对话框 */
  (e: 'close'): void;
}>();

// ============ 状态 ============

/** 是否显示原始内容 */
const showRawContent = ref(false);

/** 内容预览容器引用 */
const contentPreview = ref<HTMLElement>();

// ============ 计算属性 ============

/** 状态样式类 */
const statusClass = computed(() => {
  if (!props.reviewResult) return 'status-pending';
  return props.reviewResult.passed ? 'status-passed' : 'status-failed';
});

/** 状态文本 */
const statusText = computed(() => {
  if (!props.reviewResult) return '审查中...';
  if (props.reviewResult.passed) {
    const warningCount = props.reviewResult.issues.filter(i => i.level === 'warning').length;
    return warningCount > 0 ? `通过 (${warningCount}警告)` : '通过';
  }
  const errorCount = props.reviewResult.issues.filter(i => i.level === 'error').length;
  return `未通过 (${errorCount}错误)`;
});

/** 格式化后的游戏文本 */
const formattedGameText = computed(() => {
  if (!props.reviewResult?.gameTextContent) {
    return '<p class="empty-hint">未提取到游戏文本内容</p>';
  }
  // 简单的格式化：换行转换为<br>
  return props.reviewResult.gameTextContent
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
});

// ============ 标签状态映射 ============

const TAG_DISPLAY_NAMES: Record<string, string> = {
  thinking: '思考过程',
  gametxt: '游戏文本',
  历史记录: '历史记录',
  UpdateVariable: '变量更新',
};

const getTagDisplayName = (tagName: string): string => {
  return TAG_DISPLAY_NAMES[tagName] || tagName;
};

const getTagStatusClass = (check: TagCheckResult): string => {
  if (!check.exists) return 'tag-missing';
  if (!check.isClosed) return 'tag-error';
  return 'tag-ok';
};

const getTagStatusIcon = (check: TagCheckResult): string => {
  if (!check.exists) return '○';
  if (!check.isClosed) return '✗';
  return '✓';
};

const getTagStatusText = (check: TagCheckResult): string => {
  if (!check.exists) return '未找到';
  if (!check.isClosed) return `未闭合 (${check.openCount}/${check.closeCount})`;
  return '正常';
};

// ============ 问题图标 ============

const getIssueIcon = (level: ReviewIssue['level']): string => {
  switch (level) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    default:
      return '•';
  }
};

// ============ 变量操作符号 ============

const getOperationSymbol = (op: string): string => {
  switch (op) {
    case 'set':
      return '=';
    case 'add':
      return '+=';
    case 'subtract':
      return '-=';
    case 'append':
      return '<<';
    case 'remove':
      return 'DEL';
    default:
      return '?';
  }
};

// ============ 值格式化 ============

const formatValue = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    const maxLen = 30;
    if (value.length > maxLen) {
      return `"${value.substring(0, maxLen)}..."`;
    }
    return `"${value}"`;
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    if (str.length > 30) {
      return str.substring(0, 30) + '...';
    }
    return str;
  }
  return String(value);
};

// ============ 事件处理 ============

const handleConfirm = () => {
  emit('confirm');
};

const handleRollback = () => {
  emit('rollback');
};

const handleOverlayClick = () => {
  // 点击遮罩层不关闭，需要明确选择
};

const toggleContentView = () => {
  showRawContent.value = !showRawContent.value;
};

// ============ 监听器 ============

// 当对话框显示时，滚动内容预览到顶部
watch(
  () => props.visible,
  newVal => {
    if (newVal) {
      showRawContent.value = false;
      nextTick(() => {
        if (contentPreview.value) {
          contentPreview.value.scrollTop = 0;
        }
      });
    }
  },
);
</script>

<style lang="scss" scoped>
// ============ 遮罩层 ============
.review-dialog-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10020 !important;
  padding: var(--spacing-md, 16px);
}

// ============ 对话框主体 ============
.review-dialog {
  background: var(--bg-secondary, #ffffff);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  max-width: 700px;
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: dialog-enter 0.25s ease-out;

  &.has-errors {
    border: 2px solid var(--warning-color, #e5a50a);
  }
}

// ============ 对话框头部 ============
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg, 20px);
  background: var(--bg-tertiary, #f6f5f4);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
}

.header-icon {
  font-size: 24px;
}

.header-title {
  margin: 0;
  font-size: var(--font-lg, 18px);
  font-weight: 600;
  color: var(--text-color, #2e3436);
}

.header-status {
  display: flex;
  align-items: center;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: var(--font-sm, 13px);
  font-weight: 500;

  &.status-passed {
    background: var(--success-light, rgba(38, 162, 105, 0.15));
    color: var(--success-color, #26a269);
  }

  &.status-failed {
    background: var(--warning-light, rgba(229, 165, 10, 0.15));
    color: var(--warning-dark, #b58900);
  }

  &.status-pending {
    background: var(--bg-hover, #e0e0e0);
    color: var(--text-secondary, #666);
  }
}

// ============ 审查摘要 ============
.review-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
  background: var(--bg-color, #fff);
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-tertiary, #f5f5f5);
  border-radius: var(--radius-sm, 4px);
  font-size: var(--font-sm, 13px);
}

.tag-icon {
  font-size: 12px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;

  &.tag-ok {
    background: var(--success-color, #26a269);
    color: white;
  }

  &.tag-missing {
    background: var(--text-disabled, #999);
    color: white;
  }

  &.tag-error {
    background: var(--error-color, #c01c28);
    color: white;
  }
}

.tag-name {
  font-weight: 500;
  color: var(--text-color, #333);
}

.tag-status {
  color: var(--text-secondary, #666);
}

// ============ 问题列表 ============
.issues-section {
  padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
  background: var(--warning-light, rgba(229, 165, 10, 0.08));
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  font-size: var(--font-md, 14px);
  font-weight: 600;
  color: var(--text-color, #333);
  margin-bottom: var(--spacing-sm, 8px);
}

.section-icon {
  font-size: 16px;
}

.issues-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.issue-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-radius: var(--radius-sm, 4px);
  font-size: var(--font-sm, 13px);

  &.issue-error {
    background: var(--error-light, rgba(192, 28, 40, 0.1));
    color: var(--error-color, #c01c28);
  }

  &.issue-warning {
    background: var(--warning-light, rgba(229, 165, 10, 0.1));
    color: var(--warning-dark, #b58900);
  }

  &.issue-info {
    background: var(--info-light, rgba(28, 113, 216, 0.1));
    color: var(--info-color, #1c71d8);
  }
}

.issue-icon {
  flex-shrink: 0;
}

.issue-message {
  line-height: 1.4;
}

// ============ 变量更新预览 ============
.variables-section {
  padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
  background: var(--bg-color, #fff);
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}

.variables-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
}

.variable-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-tertiary, #f5f5f5);
  border-radius: var(--radius-sm, 4px);
  font-family: monospace;
  font-size: var(--font-xs, 12px);
}

.var-path {
  color: var(--primary-color, #6366f1);
  font-weight: 500;
}

.var-op {
  color: var(--text-secondary, #666);
}

.var-value {
  color: var(--success-color, #26a269);
}

.more-hint {
  text-align: center;
  padding: 8px;
  color: var(--text-secondary, #666);
  font-size: var(--font-xs, 12px);
}

// ============ 内容预览 ============
.content-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  overflow: hidden;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
  background: var(--bg-tertiary, #f6f5f4);
  border-bottom: 1px solid var(--border-light, #f0f0f0);
}

.section-actions {
  display: flex;
  gap: var(--spacing-sm, 8px);
}

.btn-toggle {
  padding: 4px 10px;
  font-size: var(--font-xs, 12px);
  background: var(--bg-color, #fff);
  border: 1px solid var(--border-color, #ccc);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--bg-hover, #f0f0f0);
  }
}

.content-preview {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md, 16px) var(--spacing-lg, 20px);
  background: var(--bg-color, #fff);
}

.raw-content {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  font-size: var(--font-sm, 13px);
  line-height: 1.6;
  color: var(--text-color, #333);
}

.parsed-content {
  font-size: var(--font-md, 15px);
  line-height: 1.8;
  color: var(--text-color, #333);

  :deep(.empty-hint) {
    color: var(--text-disabled, #999);
    text-align: center;
    padding: var(--spacing-lg, 20px);
  }
}

// ============ 对话框底部 ============
.dialog-footer {
  display: flex;
  justify-content: space-between;
  gap: var(--spacing-md, 16px);
  padding: var(--spacing-lg, 20px);
  background: var(--bg-tertiary, #f6f5f4);
  border-top: 1px solid var(--border-color, #e0e0e0);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 24px;
  font-size: var(--font-md, 14px);
  font-weight: 500;
  border-radius: var(--radius-md, 6px);
  border: none;
  cursor: pointer;
  transition: all 0.15s;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-icon {
  font-size: 16px;
}

.btn-rollback {
  background: var(--bg-color, #fff);
  color: var(--error-color, #c01c28);
  border: 1px solid var(--error-color, #c01c28);

  &:hover:not(:disabled) {
    background: var(--error-light, rgba(192, 28, 40, 0.1));
  }
}

.btn-confirm {
  background: var(--success-color, #26a269);
  color: white;
  flex: 1;
  max-width: 200px;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  &.btn-warning {
    background: var(--warning-color, #e5a50a);
    color: var(--text-highlight, #000);
  }
}

// ============ 加载动画 ============
.loading-spinner {
  width: 16px;
  height: 16px;
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
    transform: scale(0.95) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.review-dialog-enter-active,
.review-dialog-leave-active {
  transition: opacity 0.2s ease;
}

.review-dialog-enter-from,
.review-dialog-leave-to {
  opacity: 0;
}

.review-dialog-enter-active .review-dialog {
  animation: dialog-enter 0.25s ease-out;
}

.review-dialog-leave-active .review-dialog {
  animation: dialog-enter 0.2s ease-in reverse;
}

// ============ 响应式 ============
@media (max-width: 600px) {
  .review-dialog {
    max-height: 95vh;
    max-width: calc(100vw - 16px);
  }

  .dialog-header {
    flex-direction: column;
    gap: var(--spacing-sm, 8px);
    align-items: flex-start;
  }

  .dialog-footer {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
    max-width: none;
  }

  .review-summary {
    flex-direction: column;
  }
}

// ============ 深色主题支持 ============
:root.dark-theme {
  .review-dialog {
    background: var(--bg-secondary, #2d2d2d);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
  }

  .dialog-header,
  .section-header,
  .dialog-footer {
    background: var(--bg-tertiary, #3d3d3d);
    border-color: var(--border-color, #4d4d4d);
  }

  .header-title,
  .section-title {
    color: var(--text-color, #f5f5f5);
  }

  .content-preview {
    background: var(--bg-color, #1e1e1e);
  }

  .raw-content,
  .parsed-content {
    color: var(--text-color, #e0e0e0);
  }

  .btn-toggle {
    background: var(--bg-color, #1e1e1e);
    border-color: var(--border-color, #4d4d4d);
    color: var(--text-color, #e0e0e0);

    &:hover {
      background: var(--bg-hover, #3d3d3d);
    }
  }

  .btn-rollback {
    background: transparent;
  }
}
</style>
