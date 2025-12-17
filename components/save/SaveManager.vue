<template>
  <div class="save-manager">
    <!-- 顶部标题栏 -->
    <div class="save-header">
      <h3 class="save-title">
        <span class="icon">💾</span>
        存档管理
      </h3>
      <div class="header-actions">
        <button class="btn btn-icon" @click="refreshList" :disabled="isProcessing" title="刷新">
          <span :class="{ spinning: isProcessing }">🔄</span>
        </button>
        <button class="btn btn-icon" @click="$emit('close')" title="关闭">✖</button>
      </div>
    </div>

    <!-- 存档统计 -->
    <div class="save-stats">
      <div class="stat-item">
        <span class="stat-label">总计</span>
        <span class="stat-value">{{ saveStats.total }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">手动</span>
        <span class="stat-value">{{ saveStats.manual }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">自动</span>
        <span class="stat-value">{{ saveStats.auto }}</span>
      </div>
    </div>

    <!-- 标签页切换 -->
    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: activeTab === 'manual' }" @click="activeTab = 'manual'">
        手动存档 ({{ manualSaveList.length }})
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'auto' }" @click="activeTab = 'auto'">
        自动存档 ({{ autoSaveList.length }})
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'settings' }" @click="activeTab = 'settings'">
        设置
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="save-content">
      <!-- 手动存档列表 -->
      <div v-if="activeTab === 'manual'" class="save-list-container">
        <!-- 创建新存档 -->
        <div class="create-save-section">
          <input
            v-model="newSaveName"
            type="text"
            class="save-name-input"
            placeholder="输入存档名称..."
            @keyup.enter="handleCreateSave"
          />
          <button class="btn btn-primary" @click="handleCreateSave" :disabled="isProcessing || !newSaveName.trim()">
            创建存档
          </button>
        </div>

        <!-- 存档列表 -->
        <div class="save-list" v-if="manualSaveList.length > 0">
          <div
            v-for="save in manualSaveList"
            :key="save.id"
            class="save-item"
            :class="{ active: currentSave?.id === save.id }"
          >
            <div class="save-info">
              <div class="save-name">{{ save.name }}</div>
              <div class="save-time">
                <span>创建: {{ formatTime(save.createdAt) }}</span>
                <span>更新: {{ formatTime(save.updatedAt) }}</span>
              </div>
            </div>
            <div class="save-actions">
              <button
                class="btn btn-sm btn-primary"
                @click="handleLoadSave(save.id)"
                :disabled="isProcessing"
                title="读取"
              >
                📂
              </button>
              <button
                class="btn btn-sm btn-secondary"
                @click="handleUpdateSave(save.id)"
                :disabled="isProcessing"
                title="覆盖"
              >
                💾
              </button>
              <button
                class="btn btn-sm btn-secondary"
                @click="handleDownloadSave(save.id)"
                :disabled="isProcessing"
                title="导出"
              >
                📤
              </button>
              <button
                class="btn btn-sm btn-danger"
                @click="handleDeleteSave(save.id, save.name)"
                :disabled="isProcessing"
                title="删除"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>暂无手动存档</p>
          <p class="hint">在上方输入名称创建新存档</p>
        </div>
      </div>

      <!-- 自动存档列表 -->
      <div v-else-if="activeTab === 'auto'" class="save-list-container">
        <!-- 自动存档操作 -->
        <div class="auto-save-actions">
          <button class="btn btn-secondary" @click="handleTriggerAutoSave" :disabled="isProcessing">
            立即自动存档
          </button>
          <button
            class="btn btn-danger"
            @click="handleClearAutoSaves"
            :disabled="isProcessing || autoSaveList.length === 0"
          >
            清空自动存档
          </button>
        </div>

        <!-- 自动存档列表 -->
        <div class="save-list" v-if="autoSaveList.length > 0">
          <div v-for="save in autoSaveList" :key="save.id" class="save-item auto-save">
            <div class="save-info">
              <div class="save-name">
                <span class="auto-badge">自动</span>
                {{ save.name }}
              </div>
              <div class="save-time">
                <span>{{ formatTime(save.updatedAt) }}</span>
                <span v-if="save.saveSource" class="save-source"> 来源: {{ getSourceLabel(save.saveSource) }} </span>
              </div>
            </div>
            <div class="save-actions">
              <button
                class="btn btn-sm btn-primary"
                @click="handleLoadSave(save.id)"
                :disabled="isProcessing"
                title="读取"
              >
                📂
              </button>
              <button
                class="btn btn-sm btn-secondary"
                @click="handleConvertToManual(save.id)"
                :disabled="isProcessing"
                title="转为手动存档"
              >
                📌
              </button>
              <button
                class="btn btn-sm btn-danger"
                @click="handleDeleteSave(save.id, save.name)"
                :disabled="isProcessing"
                title="删除"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>暂无自动存档</p>
          <p class="hint">AI回复结束后会自动创建存档</p>
        </div>
      </div>

      <!-- 设置面板 -->
      <div v-else-if="activeTab === 'settings'" class="settings-container">
        <AutoSaveSettings />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="save-footer">
      <div class="footer-left">
        <button class="btn btn-secondary" @click="handleQuickSave" :disabled="isProcessing">快速保存</button>
        <button class="btn btn-secondary" @click="handleQuickLoad" :disabled="isProcessing || !hasSaves">
          快速加载
        </button>
      </div>
      <div class="footer-right">
        <label class="import-btn btn btn-secondary">
          导入存档
          <input type="file" accept=".json" @change="handleImportSave" hidden />
        </label>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
      <button class="btn-close" @click="clearError">×</button>
    </div>

    <!-- 确认对话框 -->
    <div v-if="showConfirmDialog" class="confirm-overlay" @click.self="cancelConfirm">
      <div class="confirm-dialog">
        <div class="confirm-title">{{ confirmTitle }}</div>
        <div class="confirm-message">{{ confirmMessage }}</div>
        <div class="confirm-actions">
          <button class="btn btn-secondary" @click="cancelConfirm">取消</button>
          <button class="btn btn-danger" @click="executeConfirm">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSave } from '../../composables/useSave';
import AutoSaveSettings from './AutoSaveSettings.vue';

// ========== Emits ==========
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save-loaded', id: string): void;
  (e: 'save-created', id: string): void;
}>();

// ========== Composables ==========
const {
  isProcessing,
  error,
  saveList,
  currentSave,
  saveStats,
  manualSaveList,
  autoSaveList,
  hasSaves,
  refreshList,
  refreshStats,
  createSave,
  updateSave,
  loadSave,
  deleteSave,
  quickSave,
  quickLoad,
  downloadSave,
  uploadSave,
  triggerAutoSave,
  clearAllAutoSaves,
  convertAutoSaveToManual,
} = useSave();

// ========== 状态 ==========
const activeTab = ref<'manual' | 'auto' | 'settings'>('manual');
const newSaveName = ref('');
const showConfirmDialog = ref(false);
const confirmTitle = ref('');
const confirmMessage = ref('');
let confirmCallback: (() => void) | null = null;

// ========== 方法 ==========

/**
 * 格式化时间
 */
const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 获取来源标签
 */
const getSourceLabel = (source: string): string => {
  const labels: Record<string, string> = {
    manual: '手动',
    auto: '自动',
    ai_response: 'AI回复',
  };
  return labels[source] || source;
};

/**
 * 清除错误
 */
const clearError = (): void => {
  // 通过重新赋值清除
};

/**
 * 显示确认对话框
 */
const showConfirm = (title: string, message: string, callback: () => void): void => {
  confirmTitle.value = title;
  confirmMessage.value = message;
  confirmCallback = callback;
  showConfirmDialog.value = true;
};

/**
 * 取消确认
 */
const cancelConfirm = (): void => {
  showConfirmDialog.value = false;
  confirmCallback = null;
};

/**
 * 执行确认
 */
const executeConfirm = (): void => {
  if (confirmCallback) {
    confirmCallback();
  }
  showConfirmDialog.value = false;
  confirmCallback = null;
};

/**
 * 创建存档
 */
const handleCreateSave = async (): Promise<void> => {
  if (!newSaveName.value.trim()) return;

  const save = await createSave(newSaveName.value.trim());
  if (save) {
    newSaveName.value = '';
    emit('save-created', save.id);
  }
};

/**
 * 读取存档
 */
const handleLoadSave = async (id: string): Promise<void> => {
  showConfirm('读取存档', '确定要读取此存档吗？当前未保存的进度将丢失。', async () => {
    const success = await loadSave(id);
    if (success) {
      emit('save-loaded', id);
    }
  });
};

/**
 * 覆盖存档
 */
const handleUpdateSave = async (id: string): Promise<void> => {
  showConfirm('覆盖存档', '确定要覆盖此存档吗？原有数据将被替换。', async () => {
    await updateSave(id);
  });
};

/**
 * 删除存档
 */
const handleDeleteSave = (id: string, name: string): void => {
  showConfirm('删除存档', `确定要删除存档"${name}"吗？此操作不可撤销。`, async () => {
    await deleteSave(id);
  });
};

/**
 * 下载存档
 */
const handleDownloadSave = async (id: string): Promise<void> => {
  await downloadSave(id);
};

/**
 * 导入存档
 */
const handleImportSave = async (event: Event): Promise<void> => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  await uploadSave(file);
  target.value = ''; // 重置input
};

/**
 * 快速保存
 */
const handleQuickSave = async (): Promise<void> => {
  await quickSave();
};

/**
 * 快速加载
 */
const handleQuickLoad = async (): Promise<void> => {
  showConfirm('快速加载', '确定要加载最近的存档吗？当前未保存的进度将丢失。', async () => {
    await quickLoad();
  });
};

/**
 * 触发自动存档
 */
const handleTriggerAutoSave = async (): Promise<void> => {
  await triggerAutoSave();
};

/**
 * 清空自动存档
 */
const handleClearAutoSaves = (): void => {
  showConfirm('清空自动存档', '确定要删除所有自动存档吗？此操作不可撤销。', async () => {
    await clearAllAutoSaves();
  });
};

/**
 * 转换为手动存档
 */
const handleConvertToManual = async (id: string): Promise<void> => {
  showConfirm('转为手动存档', '确定要将此自动存档转为手动存档吗？', async () => {
    await convertAutoSaveToManual(id);
  });
};
</script>

<style scoped lang="scss">
.save-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  color: var(--text-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

// ============ 头部 ============
.save-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.save-title {
  margin: 0;
  font-size: var(--font-lg);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--text-color);

  .icon {
    font-size: var(--font-xl);
  }
}

.header-actions {
  display: flex;
  gap: var(--spacing-xs);
}

// ============ 统计信息 ============
.save-stats {
  display: flex;
  gap: var(--spacing-lg);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-color);
  border-bottom: 1px solid var(--border-light);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  .stat-label {
    font-size: var(--font-xs);
    color: var(--text-secondary);
  }

  .stat-value {
    font-size: var(--font-lg);
    font-weight: 600;
    color: var(--primary-color);
  }
}

// ============ 标签栏 ============
.tab-bar {
  display: flex;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-color);
  }

  &.active {
    color: var(--primary-color);
    border-bottom-color: var(--primary-color);
    background: var(--primary-light);
    font-weight: 500;
  }
}

// ============ 内容区 ============
.save-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  background: var(--bg-color);
}

.save-list-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

// ============ 创建存档 ============
.create-save-section {
  display: flex;
  gap: var(--spacing-sm);
}

.save-name-input {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-color);
  font-size: var(--font-sm);
  transition: border-color var(--transition-fast);

  &:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--primary-light);
  }

  &::placeholder {
    color: var(--text-disabled);
  }
}

// ============ 自动存档操作 ============
.auto-save-actions {
  display: flex;
  gap: var(--spacing-sm);
}

// ============ 存档列表 ============
.save-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.save-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);

  &:hover {
    border-color: var(--primary-color);
    box-shadow: var(--shadow-sm);
  }

  &.active {
    border-color: var(--primary-color);
    background: var(--primary-light);
  }

  &.auto-save {
    border-left: 3px solid var(--warning-color);
  }
}

.save-info {
  flex: 1;
  min-width: 0;
}

.save-name {
  font-weight: 500;
  font-size: var(--font-sm);
  margin-bottom: var(--spacing-xs);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--text-color);
}

.auto-badge {
  font-size: 10px;
  padding: 2px 6px;
  background: var(--warning-color);
  color: var(--text-highlight);
  border-radius: var(--radius-xs);
  font-weight: 500;
}

.save-time {
  font-size: var(--font-xs);
  color: var(--text-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.save-source {
  color: var(--primary-color);
}

.save-actions {
  display: flex;
  gap: var(--spacing-xs);
}

// ============ 空状态 ============
.empty-state {
  text-align: center;
  padding: var(--spacing-xxl) var(--spacing-lg);
  color: var(--text-secondary);

  p {
    margin: 0;
  }

  .hint {
    font-size: var(--font-xs);
    margin-top: var(--spacing-sm);
    color: var(--text-disabled);
  }
}

// ============ 设置容器 ============
.settings-container {
  // AutoSaveSettings 组件会填充这个区域
}

// ============ 底部操作栏 ============
.save-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
}

.footer-left,
.footer-right {
  display: flex;
  gap: var(--spacing-sm);
}

.import-btn {
  cursor: pointer;
}

// ============ 错误消息 ============
.error-message {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--error-light);
  color: var(--error-color);
  border-top: 1px solid var(--error-color);
  font-size: var(--font-sm);
}

.btn-close {
  background: none;
  border: none;
  color: inherit;
  font-size: var(--font-lg);
  cursor: pointer;
  padding: var(--spacing-xs);
  border-radius: var(--radius-xs);
  transition: background var(--transition-fast);

  &:hover {
    background: rgba(0, 0, 0, 0.1);
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

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.btn-primary {
    background: var(--primary-color);
    color: white;

    &:hover:not(:disabled) {
      background: var(--primary-hover);
    }

    &:active:not(:disabled) {
      background: var(--primary-active);
    }
  }

  &.btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-color);
    border: 1px solid var(--border-color);

    &:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: var(--border-hover);
    }
  }

  &.btn-danger {
    background: var(--error-color);
    color: white;

    &:hover:not(:disabled) {
      background: var(--error-hover);
    }
  }

  &.btn-sm {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-xs);
  }

  &.btn-icon {
    padding: var(--spacing-xs) var(--spacing-sm);
    background: transparent;
    color: var(--text-secondary);

    &:hover:not(:disabled) {
      background: var(--bg-hover);
      color: var(--text-color);
    }
  }
}

.spinning {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

// ============ 确认对话框 ============
.confirm-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: var(--z-modal);
}

.confirm-dialog {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  min-width: 300px;
  max-width: 400px;
  box-shadow: var(--shadow-lg);
}

.confirm-title {
  font-size: var(--font-lg);
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
  color: var(--text-color);
}

.confirm-message {
  color: var(--text-secondary);
  margin-bottom: var(--spacing-lg);
  line-height: 1.6;
  font-size: var(--font-sm);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .save-stats {
    justify-content: space-around;
  }

  .save-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .save-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .save-footer {
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .footer-left,
  .footer-right {
    width: 100%;
    justify-content: center;
  }
}
</style>
