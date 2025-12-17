<template>
  <div class="context-manager-panel">
    <!-- 标题栏 -->
    <div class="panel-header">
      <h3 class="panel-title">📚 上下文管理</h3>
      <button class="refresh-btn" :disabled="isProcessing" @click="handleRefresh" title="刷新数据">🔄</button>
    </div>

    <!-- 功能启用开关 -->
    <div class="enable-section">
      <div class="enable-row">
        <span class="enable-label">
          上下文管理功能
          <span class="enable-hint">{{ isEnabled ? '（正在管理世界书）' : '（使用外挂世界书）' }}</span>
        </span>
        <label class="switch">
          <input type="checkbox" :checked="isEnabled" @change="handleToggleEnabled" :disabled="isProcessing" />
          <span class="slider"></span>
        </label>
      </div>
      <p class="enable-description" v-if="!isEnabled">⚠️ 功能已禁用，清理和写入操作仅影响本地状态，不会修改世界书。</p>
    </div>

    <!-- 统计信息 -->
    <div class="stats-section">
      <div class="stat-row">
        <span class="stat-label">历史记录数</span>
        <span class="stat-value">{{ statistics.recordCount }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">历史正文数</span>
        <span class="stat-value">{{ statistics.textCount }}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">当前模式</span>
        <span class="stat-value mode-badge" :class="mode">
          {{ mode === 'segmented' ? '分段模式' : '全量模式' }}
        </span>
      </div>
    </div>

    <!-- 分段配置 -->
    <div class="config-section">
      <h4 class="section-title">分段配置</h4>

      <div class="config-item">
        <label class="config-label">
          分段正文数量
          <span class="config-hint">（最近N条完整正文，0=不使用）</span>
        </label>
        <div class="config-input-row">
          <input
            type="number"
            v-model.number="localSegmentCount"
            min="0"
            max="100"
            class="config-input"
            :disabled="isProcessing"
          />
          <button
            class="apply-btn"
            :disabled="isProcessing || localSegmentCount === config.segmentCount"
            @click="applySegmentCount"
          >
            应用
          </button>
        </div>
      </div>

      <div class="config-item">
        <label class="config-label">
          小总结范围
          <span class="config-hint">（从分段正文之后计算M条，0=不使用）</span>
        </label>
        <div class="config-input-row">
          <input
            type="number"
            v-model.number="localSmallSummaryCount"
            min="0"
            max="200"
            class="config-input"
            :disabled="isProcessing"
          />
          <button
            class="apply-btn"
            :disabled="isProcessing || localSmallSummaryCount === config.smallSummaryCount"
            @click="applySmallSummaryCount"
          >
            应用
          </button>
        </div>
      </div>
    </div>

    <!-- 当前分段状态 -->
    <div class="segment-status" v-if="mode === 'segmented'">
      <h4 class="section-title">当前分段状态</h4>
      <div class="segment-stats">
        <div class="segment-stat">
          <span class="segment-label">分段正文</span>
          <span class="segment-value">{{ statistics.segmentCount }} 条</span>
        </div>
        <div class="segment-stat">
          <span class="segment-label">小总结</span>
          <span class="segment-value">{{ statistics.smallSummaryCount }} 条</span>
        </div>
        <div class="segment-stat">
          <span class="segment-label">大总结</span>
          <span class="segment-value">{{ statistics.largeSummaryCount }} 条</span>
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="action-section">
      <button class="action-btn mode-switch" :disabled="isProcessing || !isEnabled" @click="toggleMode">
        {{ mode === 'segmented' ? '切换到全量模式' : '切换到分段模式' }}
      </button>

      <button
        class="action-btn regenerate"
        :disabled="isProcessing || mode !== 'segmented' || !isEnabled"
        @click="handleRegenerate"
        title="手动重新生成分段内容"
      >
        重新生成分段
      </button>

      <button class="action-btn clear danger" :disabled="isProcessing" @click="handleClear">清空所有数据</button>

      <button
        class="action-btn clear-worldbook danger"
        :disabled="isProcessing"
        @click="handleClearWorldbook"
        v-if="!isEnabled"
        title="强制清空世界书条目（即使功能未启用）"
      >
        强制清空世界书
      </button>
    </div>

    <!-- 错误提示 -->
    <div class="error-message" v-if="error">⚠️ {{ error }}</div>

    <!-- 处理中提示 -->
    <div class="processing-overlay" v-if="isProcessing">
      <div class="processing-spinner"></div>
      <span>处理中...</span>
    </div>

    <!-- 最后更新时间 -->
    <div class="last-update" v-if="formattedLastUpdateTime">最后更新: {{ formattedLastUpdateTime }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useContextManager } from '../../composables/useContextManager';
import { confirmDanger, confirmWarning } from '../../composables/useConfirmDialog';

// 使用上下文管理composable
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
  syncState,
  setEnabled,
} = useContextManager();

// 本地编辑状态
const localSegmentCount = ref(3);
const localSmallSummaryCount = ref(25);

// 同步本地状态
watch(
  config,
  newConfig => {
    localSegmentCount.value = newConfig.segmentCount;
    localSmallSummaryCount.value = newConfig.smallSummaryCount;
  },
  { immediate: true },
);

// 刷新数据
const handleRefresh = async () => {
  await refresh();
  syncState();
};

// 应用分段正文数量
const applySegmentCount = async () => {
  await setSegmentCount(localSegmentCount.value);
};

// 应用小总结范围
const applySmallSummaryCount = async () => {
  await setSmallSummaryCount(localSmallSummaryCount.value);
};

// 切换模式
const toggleMode = async () => {
  const newMode = mode.value === 'segmented' ? 'full' : 'segmented';
  await switchMode(newMode);
};

// 重新生成分段
const handleRegenerate = async () => {
  await regenerateSegments();
};

// 清空数据
const handleClear = async () => {
  const message = isEnabled.value
    ? '确定要清空所有历史记录和正文数据吗？此操作不可恢复！'
    : '功能未启用，仅清空本地状态。确定继续吗？';
  const confirmed = await confirmDanger(message, '清空数据');
  if (confirmed) {
    await clearAll(false);
  }
};

// 强制清空世界书
const handleClearWorldbook = async () => {
  const confirmed = await confirmDanger(
    '确定要强制清空世界书中的上下文条目吗？此操作会影响世界书内容，不可恢复！',
    '强制清空世界书',
  );
  if (confirmed) {
    await clearAll(true);
  }
};

// 切换启用状态
const handleToggleEnabled = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const newEnabled = target.checked;

  if (newEnabled) {
    // 启用时提示用户
    const confirmed = await confirmWarning(
      '启用后将由本系统管理世界书条目。如果您使用外挂的世界书来提供上下文，请保持禁用状态。确定启用吗？',
      '启用上下文管理',
    );
    if (confirmed) {
      await setEnabled(true);
    } else {
      // 取消选中
      target.checked = false;
    }
  } else {
    await setEnabled(false);
  }
};

// 挂载时同步状态
onMounted(() => {
  syncState();
});
</script>

<style scoped lang="scss">
.context-manager-panel {
  position: relative;
  padding: 16px;
  background: var(--panel-bg, #1a1a2e);
  border-radius: 8px;
  color: var(--text-color, #e0e0e0);
  font-size: 14px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color, #333);
}

.panel-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.refresh-btn {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: var(--hover-bg, #2a2a4e);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.enable-section {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--section-bg, #16162a);
  border-radius: 6px;
  border: 1px solid var(--border-color, #333);
}

.enable-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.enable-label {
  font-size: 14px;
  font-weight: 500;
}

.enable-hint {
  font-size: 11px;
  color: var(--text-muted, #666);
  margin-left: 4px;
}

.enable-description {
  margin: 8px 0 0 0;
  padding: 8px;
  background: var(--warning-bg, #3a2a1a);
  border-radius: 4px;
  font-size: 12px;
  color: var(--warning-color, #fbbf24);
}

/* Toggle Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--switch-off-bg, #444);
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--success-color, #4ade80);
}

input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.stats-section {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--section-bg, #16162a);
  border-radius: 6px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;

  &:not(:last-child) {
    border-bottom: 1px solid var(--border-color, #2a2a4e);
  }
}

.stat-label {
  color: var(--text-secondary, #888);
}

.stat-value {
  font-weight: 500;
  color: var(--text-primary, #fff);
}

.mode-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;

  &.segmented {
    background: var(--success-bg, #1a4a1a);
    color: var(--success-color, #4ade80);
  }

  &.full {
    background: var(--info-bg, #1a3a4a);
    color: var(--info-color, #60a5fa);
  }
}

.config-section {
  margin-bottom: 16px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #aaa);
}

.config-item {
  margin-bottom: 12px;
}

.config-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
}

.config-hint {
  color: var(--text-muted, #666);
  font-size: 11px;
}

.config-input-row {
  display: flex;
  gap: 8px;
}

.config-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--input-bg, #12121f);
  border: 1px solid var(--border-color, #333);
  border-radius: 4px;
  color: var(--text-color, #e0e0e0);
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: var(--focus-color, #6366f1);
  }

  &:disabled {
    opacity: 0.5;
  }
}

.apply-btn {
  padding: 8px 16px;
  background: var(--primary-bg, #4f46e5);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: var(--primary-hover, #6366f1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.segment-status {
  margin-bottom: 16px;
  padding: 12px;
  background: var(--section-bg, #16162a);
  border-radius: 6px;
}

.segment-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.segment-stat {
  text-align: center;
  padding: 8px;
  background: var(--stat-bg, #1a1a2e);
  border-radius: 4px;
}

.segment-label {
  display: block;
  font-size: 11px;
  color: var(--text-muted, #666);
  margin-bottom: 4px;
}

.segment-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.action-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.action-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.mode-switch {
    background: var(--secondary-bg, #374151);
    color: white;

    &:hover:not(:disabled) {
      background: var(--secondary-hover, #4b5563);
    }
  }

  &.regenerate {
    background: var(--success-bg, #166534);
    color: white;

    &:hover:not(:disabled) {
      background: var(--success-hover, #15803d);
    }
  }

  &.clear.danger,
  &.clear-worldbook.danger {
    background: var(--danger-bg, #7f1d1d);
    color: white;

    &:hover:not(:disabled) {
      background: var(--danger-hover, #991b1b);
    }
  }

  &.clear-worldbook {
    font-size: 12px;
  }
}

.error-message {
  padding: 10px;
  margin-bottom: 12px;
  background: var(--error-bg, #2d1b1b);
  border: 1px solid var(--error-border, #7f1d1d);
  border-radius: 4px;
  color: var(--error-color, #f87171);
  font-size: 13px;
}

.processing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  z-index: 10;
}

.processing-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color, #333);
  border-top-color: var(--primary-color, #6366f1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.last-update {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted, #666);
}
</style>
