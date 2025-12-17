<!--
  MClite - 上下文管理面板组件
  提供上下文分段管理和配置功能
-->
<template>
  <div class="context-manager-panel">
    <!-- 头部 -->
    <div class="panel-header">
      <h3>📚 上下文管理</h3>
      <button class="btn-close" @click="$emit('close')">✕</button>
    </div>

    <!-- 内容 -->
    <div class="panel-body">
      <!-- 功能启用开关 -->
      <div class="enable-section">
        <div class="section-title">⚡ 功能开关</div>
        <div class="enable-row">
          <span class="enable-label">上下文管理功能</span>
          <label class="toggle-switch">
            <input type="checkbox" :checked="isEnabled" @change="handleToggleEnabled" :disabled="isProcessing" />
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="enable-status" :class="{ enabled: isEnabled, disabled: !isEnabled }">
          {{ isEnabled ? '✅ 已启用 - 正在管理世界书' : '⚠️ 已禁用 - 使用外挂世界书' }}
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="stats-section">
        <div class="section-title">📊 统计信息</div>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">历史记录</span>
            <span class="stat-value">{{ statistics.recordCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">历史正文</span>
            <span class="stat-value">{{ statistics.textCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">分段正文</span>
            <span class="stat-value">{{ statistics.segmentCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">小总结</span>
            <span class="stat-value">{{ statistics.smallSummaryCount }}</span>
          </div>
        </div>
        <div class="last-update" v-if="formattedLastUpdateTime">最后更新: {{ formattedLastUpdateTime }}</div>
      </div>

      <!-- 模式切换 -->
      <div class="mode-section">
        <div class="section-title">🎛️ 模式配置</div>
        <div class="mode-selector">
          <label class="mode-option" :class="{ active: mode === 'segmented', disabled: !isEnabled }">
            <input type="radio" v-model="mode" value="segmented" @change="handleModeChange" :disabled="!isEnabled" />
            <span>分段模式</span>
          </label>
          <label class="mode-option" :class="{ active: mode === 'full', disabled: !isEnabled }">
            <input type="radio" v-model="mode" value="full" @change="handleModeChange" :disabled="!isEnabled" />
            <span>完整模式</span>
          </label>
        </div>
      </div>

      <!-- 配置选项 -->
      <div class="config-section">
        <div class="section-title">⚙️ 分段配置</div>
        <div class="config-item">
          <label>分段正文数量</label>
          <div class="config-control">
            <input type="number" v-model.number="localConfig.segmentCount" min="0" max="20" class="config-input" />
            <button class="btn-apply" @click="applySegmentCount" :disabled="isProcessing">应用</button>
          </div>
          <span class="config-hint">设为0则不使用分段正文</span>
        </div>
        <div class="config-item">
          <label>小总结范围</label>
          <div class="config-control">
            <input
              type="number"
              v-model.number="localConfig.smallSummaryCount"
              min="0"
              max="100"
              class="config-input"
            />
            <button class="btn-apply" @click="applySmallSummaryCount" :disabled="isProcessing">应用</button>
          </div>
          <span class="config-hint">设为0则不使用小总结</span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions-section">
        <div class="section-title">🔧 操作</div>
        <div class="action-buttons">
          <button class="btn btn-primary" @click="handleRefresh" :disabled="isProcessing">
            <span v-if="isProcessing">处理中...</span>
            <span v-else>🔄 刷新数据</span>
          </button>
          <button class="btn btn-secondary" @click="handleRegenerate" :disabled="isProcessing || !isEnabled">
            🔀 重新分段
          </button>
          <button class="btn btn-danger" @click="handleClearAll" :disabled="isProcessing">🗑️ 清空所有</button>
          <button
            class="btn btn-danger-outline"
            @click="handleClearWorldbook"
            :disabled="isProcessing"
            v-if="!isEnabled"
          >
            🗑️ 强制清空世界书
          </button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="error-message">⚠️ {{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue';
import { useContextManager } from '../../composables/useContextManager';
import { confirmDanger, confirmWarning } from '../../composables/useConfirmDialog';

// ============ Emits ============
defineEmits<{
  (e: 'close'): void;
}>();

// ============ 使用Composable ============
const {
  isProcessing,
  error,
  mode,
  config,
  statistics,
  formattedLastUpdateTime,
  isEnabled,
  refresh,
  setSegmentCount,
  setSmallSummaryCount,
  switchMode,
  regenerateSegments,
  clearAll,
  setEnabled,
} = useContextManager();

// ============ 本地状态 ============
const localConfig = reactive({
  segmentCount: 3,
  smallSummaryCount: 25,
});

// ============ 方法 ============

/**
 * 刷新数据
 */
const handleRefresh = async () => {
  await refresh();
  if (typeof toastr !== 'undefined') {
    toastr.success('数据已刷新');
  }
};

/**
 * 应用分段数量
 */
const applySegmentCount = async () => {
  const success = await setSegmentCount(localConfig.segmentCount);
  if (success && typeof toastr !== 'undefined') {
    toastr.success('分段数量已更新');
  }
};

/**
 * 应用小总结范围
 */
const applySmallSummaryCount = async () => {
  const success = await setSmallSummaryCount(localConfig.smallSummaryCount);
  if (success && typeof toastr !== 'undefined') {
    toastr.success('小总结范围已更新');
  }
};

/**
 * 切换模式
 */
const handleModeChange = async () => {
  const success = await switchMode(mode.value);
  if (success && typeof toastr !== 'undefined') {
    toastr.success(`已切换到${mode.value === 'segmented' ? '分段' : '完整'}模式`);
  }
};

/**
 * 重新生成分段
 */
const handleRegenerate = async () => {
  const success = await regenerateSegments();
  if (success && typeof toastr !== 'undefined') {
    toastr.success('分段已重新生成');
  }
};

/**
 * 清空所有
 */
const handleClearAll = async () => {
  const message = isEnabled.value
    ? '确定要清空所有上下文数据吗？此操作不可恢复。'
    : '功能未启用，仅清空本地状态。确定继续吗？';
  const confirmed = await confirmDanger(message, '清空数据');
  if (!confirmed) {
    return;
  }
  const success = await clearAll(false);
  if (success && typeof toastr !== 'undefined') {
    toastr.success('数据已清空');
  }
};

/**
 * 强制清空世界书
 */
const handleClearWorldbook = async () => {
  const confirmed = await confirmDanger(
    '确定要强制清空世界书中的上下文条目吗？此操作会影响世界书内容，不可恢复！',
    '强制清空世界书',
  );
  if (!confirmed) {
    return;
  }
  const success = await clearAll(true);
  if (success && typeof toastr !== 'undefined') {
    toastr.success('世界书条目已清空');
  }
};

/**
 * 切换启用状态
 */
const handleToggleEnabled = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const newEnabled = target.checked;

  if (newEnabled) {
    const confirmed = await confirmWarning(
      '启用后将由本系统管理世界书条目。如果您使用外挂的世界书来提供上下文，请保持禁用状态。确定启用吗？',
      '启用上下文管理',
    );
    if (confirmed) {
      const success = await setEnabled(true);
      if (success && typeof toastr !== 'undefined') {
        toastr.success('上下文管理已启用');
      }
    } else {
      target.checked = false;
    }
  } else {
    const success = await setEnabled(false);
    if (success && typeof toastr !== 'undefined') {
      toastr.info('上下文管理已禁用');
    }
  }
};

// ============ 生命周期 ============
onMounted(() => {
  // 同步配置
  localConfig.segmentCount = config.value.segmentCount;
  localConfig.smallSummaryCount = config.value.smallSummaryCount;
});
</script>

<style lang="scss" scoped>
.context-manager-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  color: var(--text-color);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: var(--font-lg);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
}

.btn-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--font-lg);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-color);
  }
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.section-title {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: var(--spacing-sm);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

// ============ 统计信息 ============
.stats-section {
  background: var(--bg-color);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-secondary);
  border-radius: var(--radius-xs);

  .stat-label {
    font-size: var(--font-xs);
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: var(--font-sm);
    font-weight: 600;
    color: var(--primary-color);
  }
}

.last-update {
  margin-top: var(--spacing-sm);
  font-size: 10px;
  color: var(--text-muted);
  text-align: right;
}

// ============ 功能启用开关 ============
.enable-section {
  background: var(--bg-color);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
}

.enable-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--spacing-sm);
}

.enable-label {
  font-size: var(--font-sm);
  color: var(--text-color);
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 22px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-tertiary, #555);
  transition: 0.3s;
  border-radius: 22px;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .toggle-slider {
  background-color: var(--success-color, #4ade80);
}

input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

input:checked + .toggle-slider:before {
  transform: translateX(22px);
}

.enable-status {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-xs);
  font-size: var(--font-xs);
  text-align: center;

  &.enabled {
    background: rgba(74, 222, 128, 0.1);
    color: var(--success-color, #4ade80);
  }

  &.disabled {
    background: rgba(251, 191, 36, 0.1);
    color: var(--warning-color, #fbbf24);
  }
}

// ============ 模式选择 ============
.mode-section {
  background: var(--bg-color);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
}

.mode-selector {
  display: flex;
  gap: var(--spacing-sm);
}

.mode-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-sm);

  input {
    display: none;
  }

  &:hover:not(.disabled) {
    border-color: var(--primary-color);
  }

  &.active {
    background: var(--primary-light);
    border-color: var(--primary-color);
    color: var(--primary-color);
    font-weight: 500;
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// ============ 配置选项 ============
.config-section {
  background: var(--bg-color);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
}

.config-item {
  margin-bottom: var(--spacing-md);

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    font-size: var(--font-sm);
    color: var(--text-color);
    margin-bottom: var(--spacing-xs);
  }
}

.config-control {
  display: flex;
  gap: var(--spacing-xs);
}

.config-input {
  flex: 1;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-color);
  font-size: var(--font-sm);

  &:focus {
    outline: none;
    border-color: var(--primary-color);
  }
}

.btn-apply {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-xs);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.config-hint {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-muted);
}

// ============ 操作按钮 ============
.actions-section {
  background: var(--bg-color);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: var(--spacing-md);
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: var(--primary-color);
  color: white;

  &:hover:not(:disabled) {
    background: var(--primary-hover);
  }
}

.btn-secondary {
  background: var(--bg-secondary);
  color: var(--text-color);
  border: 1px solid var(--border-color);

  &:hover:not(:disabled) {
    background: var(--bg-hover);
  }
}

.btn-danger {
  background: var(--error-color);
  color: white;

  &:hover:not(:disabled) {
    opacity: 0.9;
  }
}

.btn-danger-outline {
  background: transparent;
  color: var(--error-color);
  border: 1px solid var(--error-color);

  &:hover:not(:disabled) {
    background: rgba(244, 67, 54, 0.1);
  }
}

// ============ 错误提示 ============
.error-message {
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid var(--error-color);
  border-radius: var(--radius-sm);
  color: var(--error-color);
  font-size: var(--font-sm);
}
</style>
