<template>
  <div class="auto-save-settings">
    <h4 class="settings-title">自动存档设置</h4>

    <!-- 主开关 -->
    <div class="setting-item">
      <div class="setting-info">
        <div class="setting-label">启用自动存档</div>
        <div class="setting-desc">总开关，关闭后将不会自动创建任何存档</div>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" :checked="autoSaveConfig.enabled" @change="toggleAutoSave" />
        <span class="toggle-slider"></span>
      </label>
    </div>

    <!-- AI回复后自动存档 -->
    <div class="setting-item" :class="{ disabled: !autoSaveConfig.enabled }">
      <div class="setting-info">
        <div class="setting-label">AI回复后自动存档</div>
        <div class="setting-desc">每次AI生成回复结束后自动创建存档</div>
      </div>
      <label class="toggle-switch">
        <input
          type="checkbox"
          :checked="autoSaveConfig.saveOnAIResponse"
          :disabled="!autoSaveConfig.enabled"
          @change="toggleSaveOnAIResponse"
        />
        <span class="toggle-slider"></span>
      </label>
    </div>

    <!-- 最大自动存档数量 -->
    <div class="setting-item" :class="{ disabled: !autoSaveConfig.enabled }">
      <div class="setting-info">
        <div class="setting-label">最大自动存档数量</div>
        <div class="setting-desc">超过此数量时会自动删除最旧的自动存档</div>
      </div>
      <div class="setting-control">
        <input
          type="number"
          class="number-input"
          :value="autoSaveConfig.maxAutoSaves"
          :disabled="!autoSaveConfig.enabled"
          min="1"
          max="50"
          @change="handleMaxAutoSavesChange"
        />
        <span class="unit">个</span>
      </div>
    </div>

    <!-- 自动存档前缀 -->
    <div class="setting-item" :class="{ disabled: !autoSaveConfig.enabled }">
      <div class="setting-info">
        <div class="setting-label">自动存档前缀</div>
        <div class="setting-desc">自动存档名称的前缀，便于区分</div>
      </div>
      <div class="setting-control">
        <input
          type="text"
          class="text-input"
          :value="autoSaveConfig.autoSavePrefix"
          :disabled="!autoSaveConfig.enabled"
          placeholder="[自动]"
          @change="handlePrefixChange"
        />
      </div>
    </div>

    <!-- 防抖间隔 -->
    <div class="setting-item" :class="{ disabled: !autoSaveConfig.enabled }">
      <div class="setting-info">
        <div class="setting-label">防抖间隔</div>
        <div class="setting-desc">两次自动存档之间的最小间隔时间</div>
      </div>
      <div class="setting-control">
        <input
          type="number"
          class="number-input"
          :value="autoSaveConfig.debounceMs"
          :disabled="!autoSaveConfig.enabled"
          min="500"
          max="10000"
          step="100"
          @change="handleDebounceChange"
        />
        <span class="unit">毫秒</span>
      </div>
    </div>

    <!-- 重置按钮 -->
    <div class="setting-actions">
      <button class="btn btn-secondary" @click="handleReset">重置为默认值</button>
    </div>

    <!-- 当前状态 -->
    <div class="status-section">
      <h5 class="status-title">当前状态</h5>
      <div class="status-items">
        <div class="status-item">
          <span class="status-label">自动存档:</span>
          <span class="status-value" :class="{ active: autoSaveConfig.enabled }">
            {{ autoSaveConfig.enabled ? '已启用' : '已禁用' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">AI回复存档:</span>
          <span class="status-value" :class="{ active: autoSaveConfig.saveOnAIResponse && autoSaveConfig.enabled }">
            {{ autoSaveConfig.saveOnAIResponse && autoSaveConfig.enabled ? '已启用' : '已禁用' }}
          </span>
        </div>
        <div class="status-item" v-if="lastAutoSave">
          <span class="status-label">最后存档:</span>
          <span class="status-value">{{ lastAutoSave.name }}</span>
        </div>
      </div>
    </div>

    <!-- 说明信息 -->
    <div class="info-section">
      <h5 class="info-title">💡 说明</h5>
      <ul class="info-list">
        <li>自动存档会在每次AI回复结束后自动创建</li>
        <li>自动存档与手动存档分开管理，互不影响</li>
        <li>超出数量限制时，最旧的自动存档会被自动删除</li>
        <li>可以将重要的自动存档转换为手动存档以永久保留</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSave } from '../../composables/useSave';
import { confirmWarning } from '../../composables/useConfirmDialog';

// ========== Composables ==========
const {
  autoSaveConfig,
  lastAutoSave,
  toggleAutoSave,
  toggleSaveOnAIResponse,
  setMaxAutoSaves,
  setAutoSavePrefix,
  updateAutoSaveConfig,
  resetAutoSaveConfig,
} = useSave();

// ========== 方法 ==========

/**
 * 处理最大存档数量变化
 */
const handleMaxAutoSavesChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const value = parseInt(target.value, 10);
  if (!isNaN(value) && value >= 1 && value <= 50) {
    setMaxAutoSaves(value);
  }
};

/**
 * 处理前缀变化
 */
const handlePrefixChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  setAutoSavePrefix(target.value);
};

/**
 * 处理防抖间隔变化
 */
const handleDebounceChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  const value = parseInt(target.value, 10);
  if (!isNaN(value) && value >= 500 && value <= 10000) {
    updateAutoSaveConfig({ debounceMs: value });
  }
};

/**
 * 重置设置
 */
const handleReset = async (): Promise<void> => {
  const confirmed = await confirmWarning('确定要重置所有自动存档设置为默认值吗？', '重置设置');
  if (confirmed) {
    resetAutoSaveConfig();
  }
};
</script>

<style scoped lang="scss">
.auto-save-settings {
  padding: var(--spacing-sm);
}

.settings-title {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-color);
  border-bottom: 1px solid var(--border-light);
  padding-bottom: var(--spacing-sm);
}

// ============ 设置项 ============
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-sm);
  transition: all var(--transition-fast);

  &:hover:not(.disabled) {
    border-color: var(--border-hover);
  }

  &.disabled {
    opacity: 0.5;
    background: var(--bg-tertiary);
  }
}

.setting-info {
  flex: 1;
  margin-right: var(--spacing-md);
}

.setting-label {
  font-size: var(--font-sm);
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: var(--spacing-xs);
}

.setting-desc {
  font-size: var(--font-xs);
  color: var(--text-secondary);
  line-height: 1.5;
}

.setting-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

// ============ 输入框 ============
.number-input,
.text-input {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-color);
  font-size: var(--font-sm);
  transition: all var(--transition-fast);

  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-light);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--bg-tertiary);
  }
}

.number-input {
  width: 80px;
  text-align: center;
}

.text-input {
  width: 120px;
}

.unit {
  font-size: var(--font-xs);
  color: var(--text-secondary);
}

// ============ 开关 ============
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .toggle-slider {
      background: var(--primary-color);

      &::before {
        transform: translateX(22px);
      }
    }

    &:disabled + .toggle-slider {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--bg-tertiary);
  border-radius: 26px;
  transition: all var(--transition-normal);
  border: 1px solid var(--border-color);

  &::before {
    position: absolute;
    content: '';
    height: 20px;
    width: 20px;
    left: 2px;
    bottom: 2px;
    background: white;
    border-radius: 50%;
    transition: all var(--transition-normal);
    box-shadow: var(--shadow-sm);
  }
}

// ============ 操作按钮区 ============
.setting-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-light);
}

// ============ 状态区 ============
.status-section {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
}

.status-title {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-color);
}

.status-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-sm);
}

.status-label {
  color: var(--text-secondary);
}

.status-value {
  color: var(--text-color);
  font-weight: 500;

  &.active {
    color: var(--success-color);
  }
}

// ============ 说明区 ============
.info-section {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--info-light);
  border: 1px solid var(--info-color);
  border-radius: var(--radius-md);
}

.info-title {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--info-color);
}

.info-list {
  margin: 0;
  padding-left: var(--spacing-lg);
  font-size: var(--font-xs);
  color: var(--text-secondary);
  line-height: 1.8;

  li {
    margin-bottom: var(--spacing-xs);
  }
}

// ============ 按钮样式 ============
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-sm);
  font-weight: 500;
  transition: all var(--transition-fast);

  &.btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-color);
    border: 1px solid var(--border-color);

    &:hover {
      background: var(--bg-hover);
      border-color: var(--border-hover);
    }
  }
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .setting-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .setting-info {
    margin-right: 0;
  }

  .setting-control {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
