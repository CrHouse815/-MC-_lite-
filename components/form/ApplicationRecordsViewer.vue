<!--
  申请记录查看器
  显示当前表单类型的申请记录列表
-->
<template>
  <div class="records-viewer">
    <!-- 头部 -->
    <div class="viewer-header">
      <div class="header-left">
        <span class="viewer-icon">📋</span>
        <h3>申请记录</h3>
        <span class="record-count">{{ records.length }} 条</span>
      </div>
      <div class="header-right">
        <!-- 批量快速通过按钮 -->
        <button
          v-if="pendingCount > 0"
          class="quick-approve-all-btn"
          :disabled="isProcessing"
          title="将所有待审批的申请快速通过"
          @click.stop="handleQuickApproveAll"
        >
          <span class="btn-icon">⚡</span>
          <span class="btn-text">全部通过</span>
          <span class="pending-badge">{{ pendingCount }}</span>
        </button>
        <!-- 批量删除按钮 -->
        <button
          v-if="records.length > 0"
          class="delete-all-btn"
          :disabled="isProcessing"
          title="删除所有申请记录"
          @click.stop="handleDeleteAll"
        >
          <span class="btn-icon">🗑️</span>
          <span class="btn-text">清空记录</span>
        </button>
        <button class="close-btn" title="关闭" @click="$emit('close')">✕</button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-item">
        <label>状态筛选：</label>
        <select v-model="statusFilter" class="filter-select">
          <option value="">全部</option>
          <option value="待审批">待审批</option>
          <option value="审批中">审批中</option>
          <option value="已批准">已批准</option>
          <option value="已拒绝">已拒绝</option>
        </select>
      </div>
      <div class="filter-item search-item">
        <input v-model="searchKeyword" type="text" class="search-input" placeholder="搜索申请编号或内容..." />
        <span class="search-icon">🔍</span>
      </div>
    </div>

    <!-- 记录列表 -->
    <div class="records-list">
      <template v-if="filteredRecords.length > 0">
        <div
          v-for="record in filteredRecords"
          :key="record.appId"
          class="record-card"
          :class="getStatusClass(record.status)"
          @click="toggleExpand(record.appId)"
        >
          <!-- 卡片头部 -->
          <div class="card-header">
            <div class="card-title">
              <span class="app-id">{{ record.appId }}</span>
              <span class="form-type">{{ record.formType }}</span>
            </div>
            <div class="card-status">
              <span class="status-badge" :class="getStatusClass(record.status)">
                {{ getStatusText(record.status) }}
              </span>
            </div>
          </div>

          <!-- 卡片摘要 -->
          <div class="card-summary">
            <div class="summary-row">
              <span class="summary-label">申请人：</span>
              <span class="summary-value">{{ record.applicant }}</span>
              <span v-if="record.details['部门']" class="summary-dept">（{{ record.details['部门'] }}）</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">日期：</span>
              <span class="summary-value">{{ record.date }}</span>
            </div>
          </div>

          <!-- 展开详情 -->
          <div v-if="expandedId === record.appId" class="card-details">
            <div class="details-divider"></div>
            <div v-for="(value, key) in record.details" :key="key" class="detail-row">
              <span class="detail-label">{{ key }}：</span>
              <span class="detail-value">{{ value }}</span>
            </div>
            <div class="detail-row full-summary">
              <span class="detail-label">完整摘要：</span>
              <span class="detail-value">{{ record.summary }}</span>
            </div>

            <!-- 操作按钮 -->
            <div class="card-actions">
              <!-- 快速通过按钮（仅对待审批/审批中的记录显示） -->
              <button
                v-if="isPendingStatus(record.status)"
                class="quick-approve-btn"
                :disabled="isProcessing"
                @click.stop="handleQuickApprove(record.appId)"
              >
                <span class="btn-icon">⚡</span>
                <span>{{ isProcessing ? '处理中...' : '快速通过' }}</span>
              </button>
              <!-- 删除按钮 -->
              <button class="delete-btn" :disabled="isProcessing" @click.stop="handleDelete(record.appId)">
                <span class="btn-icon">🗑️</span>
                <span>{{ isProcessing ? '处理中...' : '删除' }}</span>
              </button>
            </div>
          </div>

          <!-- 展开指示器 -->
          <div class="expand-indicator">
            <span>{{ expandedId === record.appId ? '▲ 收起' : '▼ 展开详情' }}</span>
          </div>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <div class="empty-icon">📭</div>
        <p v-if="records.length === 0">暂无申请记录</p>
        <p v-else>没有符合筛选条件的记录</p>
      </div>
    </div>

    <!-- 操作结果提示 -->
    <Transition name="result-toast">
      <div v-if="resultMessage" class="result-toast" :class="resultMessage.type">
        <span class="toast-icon">{{ resultMessage.type === 'success' ? '✅' : '❌' }}</span>
        <span class="toast-text">{{ resultMessage.text }}</span>
      </div>
    </Transition>

    <!-- 确认对话框 -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFormStore } from '../../stores/formStore';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import ConfirmDialog from '../common/ConfirmDialog.vue';
import type { ApplicationRecord } from '../../types/form';

const props = defineProps<{
  records: ApplicationRecord[];
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const formStore = useFormStore();
const { confirm } = useConfirmDialog();

/** 状态筛选 */
const statusFilter = ref('');

/** 搜索关键词 */
const searchKeyword = ref('');

/** 当前展开的记录ID */
const expandedId = ref<string | null>(null);

/** 是否正在处理操作 */
const isProcessing = ref(false);

/** 兼容旧代码的别名 */
const isApproving = isProcessing;

/** 操作结果提示 */
const resultMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null);

/** 待审批记录数量 */
const pendingCount = computed(() => {
  return props.records.filter(r => isPendingStatus(r.status)).length;
});

/** 判断是否为待审批状态 */
const isPendingStatus = (status: string): boolean => {
  return status.includes('待') || status.includes('审批中');
};

/** 显示结果提示 */
const showResult = (type: 'success' | 'error', text: string) => {
  resultMessage.value = { type, text };
  setTimeout(() => {
    resultMessage.value = null;
  }, 3000);
};

/** 处理单个快速通过 */
const handleQuickApprove = async (appId: string) => {
  if (isProcessing.value) return;

  isProcessing.value = true;
  try {
    const result = await formStore.quickApproveApplication(appId);
    if (result.success) {
      showResult('success', '申请已快速通过');
    } else {
      console.error('快速通过失败:', result.error);
      showResult('error', `快速通过失败: ${result.error}`);
    }
  } finally {
    isProcessing.value = false;
  }
};

/** 处理批量快速通过 */
const handleQuickApproveAll = async () => {
  if (isProcessing.value) return;

  const count = pendingCount.value;
  if (count === 0) return;

  // 使用自定义确认对话框
  const confirmed = await confirm({
    title: '批量快速通过',
    message: `确定要将 ${count} 条待审批的申请全部快速通过吗？\n\n此操作将跳过正常审批流程，直接将所有待审批申请标记为"已批准"。`,
    type: 'warning',
    icon: '⚡',
    confirmText: '全部通过',
    cancelText: '取消',
  });

  if (!confirmed) return;

  isProcessing.value = true;
  try {
    const result = await formStore.quickApproveAllPending();
    if (result.success) {
      showResult('success', `已成功通过 ${result.count} 条申请`);
    } else {
      showResult('error', `操作失败: ${result.error}`);
    }
  } finally {
    isProcessing.value = false;
  }
};

/** 处理单个删除 */
const handleDelete = async (appId: string) => {
  if (isProcessing.value) return;

  // 使用自定义确认对话框
  const confirmed = await confirm({
    title: '删除申请记录',
    message: `确定要删除申请记录 "${appId}" 吗？\n\n此操作不可撤销。`,
    type: 'danger',
    icon: '🗑️',
    confirmText: '确认删除',
    cancelText: '取消',
  });

  if (!confirmed) return;

  isProcessing.value = true;
  try {
    const result = await formStore.deleteApplication(appId);
    if (result.success) {
      showResult('success', '申请记录已删除');
      // 如果删除的是当前展开的记录，收起详情
      if (expandedId.value === appId) {
        expandedId.value = null;
      }
    } else {
      console.error('删除失败:', result.error);
      showResult('error', `删除失败: ${result.error}`);
    }
  } finally {
    isProcessing.value = false;
  }
};

/** 处理批量删除 */
const handleDeleteAll = async () => {
  if (isProcessing.value) return;

  const count = props.records.length;
  if (count === 0) return;

  // 使用自定义确认对话框
  const confirmed = await confirm({
    title: '清空所有记录',
    message: `确定要删除全部 ${count} 条申请记录吗？\n\n⚠️ 此操作不可撤销，所有记录将被永久删除！`,
    type: 'danger',
    icon: '🗑️',
    confirmText: '全部删除',
    cancelText: '取消',
  });

  if (!confirmed) return;

  isProcessing.value = true;
  try {
    const result = await formStore.deleteAllApplications();
    if (result.success) {
      showResult('success', `已删除 ${result.count} 条申请记录`);
      expandedId.value = null;
    } else {
      showResult('error', `操作失败: ${result.error}`);
    }
  } finally {
    isProcessing.value = false;
  }
};

/** 筛选后的记录 */
const filteredRecords = computed(() => {
  let result = props.records;

  // 状态筛选
  if (statusFilter.value) {
    result = result.filter(r => r.status.includes(statusFilter.value));
  }

  // 关键词搜索
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(
      r =>
        r.appId.toLowerCase().includes(keyword) ||
        r.summary.toLowerCase().includes(keyword) ||
        r.applicant.toLowerCase().includes(keyword),
    );
  }

  return result;
});

/** 切换展开状态 */
const toggleExpand = (appId: string) => {
  expandedId.value = expandedId.value === appId ? null : appId;
};

/** 获取状态样式类 */
const getStatusClass = (status: string): string => {
  if (status.includes('已批准') || status.includes('已通过')) return 'status-approved';
  if (status.includes('已拒绝') || status.includes('已驳回')) return 'status-rejected';
  if (status.includes('审批中') || status.includes('待')) return 'status-pending';
  return 'status-default';
};

/** 获取状态显示文本 */
const getStatusText = (status: string): string => {
  if (status.includes('已批准') || status.includes('已通过')) return '✓ 已批准';
  if (status.includes('已拒绝') || status.includes('已驳回')) return '✗ 已拒绝';
  if (status.includes('审批中')) return '⏳ 审批中';
  if (status.includes('待')) return '⏳ 待审批';
  return status;
};
</script>

<style lang="scss" scoped>
.records-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
}

// ========== 头部 ==========
.viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .viewer-icon {
      font-size: 18px;
    }

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color);
    }

    .record-count {
      font-size: 12px;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      padding: 2px 8px;
      border-radius: 10px;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .quick-approve-all-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      .btn-icon {
        font-size: 14px;
      }

      .pending-badge {
        background: rgba(255, 255, 255, 0.3);
        padding: 1px 6px;
        border-radius: 8px;
        font-size: 11px;
      }

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #d97706, #b45309);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .delete-all-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: transparent;
      color: var(--error-color, #ef4444);
      border: 1px solid var(--error-color, #ef4444);
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      .btn-icon {
        font-size: 14px;
      }

      &:hover:not(:disabled) {
        background: var(--error-color, #ef4444);
        color: white;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 4px 8px;
      color: var(--text-secondary);
      border-radius: 4px;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-color);
      }
    }
  }
}

// ========== 筛选栏 ==========
.filter-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);

  .filter-item {
    display: flex;
    align-items: center;
    gap: 8px;

    label {
      font-size: 13px;
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .filter-select {
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-color);
      color: var(--text-color);
      font-size: 13px;
      cursor: pointer;

      &:focus {
        outline: none;
        border-color: var(--primary-color);
      }
    }
  }

  .search-item {
    flex: 1;
    position: relative;

    .search-input {
      width: 100%;
      padding: 6px 10px 6px 30px;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      background: var(--bg-color);
      color: var(--text-color);
      font-size: 13px;

      &::placeholder {
        color: var(--text-disabled);
      }

      &:focus {
        outline: none;
        border-color: var(--primary-color);
      }
    }

    .search-icon {
      position: absolute;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      opacity: 0.5;
    }
  }
}

// ========== 记录列表 ==========
.records-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.record-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--primary-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  &.status-approved {
    border-left: 4px solid var(--success-color, #22c55e);
  }

  &.status-rejected {
    border-left: 4px solid var(--error-color, #ef4444);
  }

  &.status-pending {
    border-left: 4px solid var(--warning-color, #f59e0b);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);

  .card-title {
    display: flex;
    align-items: center;
    gap: 12px;

    .app-id {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color);
      font-family: monospace;
    }

    .form-type {
      font-size: 12px;
      color: var(--text-secondary);
      background: var(--bg-tertiary);
      padding: 2px 8px;
      border-radius: 4px;
    }
  }

  .status-badge {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 12px;
    font-weight: 500;

    &.status-approved {
      background: rgba(34, 197, 94, 0.15);
      color: var(--success-color, #22c55e);
    }

    &.status-rejected {
      background: rgba(239, 68, 68, 0.15);
      color: var(--error-color, #ef4444);
    }

    &.status-pending {
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning-color, #f59e0b);
    }

    &.status-default {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
    }
  }
}

.card-summary {
  padding: 12px 16px;

  .summary-row {
    display: flex;
    align-items: center;
    margin-bottom: 6px;

    &:last-child {
      margin-bottom: 0;
    }

    .summary-label {
      font-size: 13px;
      color: var(--text-secondary);
      min-width: 60px;
    }

    .summary-value {
      font-size: 13px;
      color: var(--text-color);
    }

    .summary-dept {
      font-size: 12px;
      color: var(--text-secondary);
      margin-left: 4px;
    }
  }
}

.card-details {
  padding: 0 16px 12px;

  .details-divider {
    height: 1px;
    background: var(--border-color);
    margin-bottom: 12px;
  }

  .detail-row {
    display: flex;
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }

    .detail-label {
      font-size: 12px;
      color: var(--text-secondary);
      min-width: 80px;
      flex-shrink: 0;
    }

    .detail-value {
      font-size: 12px;
      color: var(--text-color);
      word-break: break-all;
    }

    &.full-summary {
      flex-direction: column;
      gap: 4px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed var(--border-color);

      .detail-value {
        background: var(--bg-tertiary);
        padding: 8px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
        line-height: 1.5;
      }
    }
  }
}

.card-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 8px;

  .quick-approve-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    .btn-icon {
      font-size: 14px;
    }

    &:hover:not(:disabled) {
      background: linear-gradient(135deg, #16a34a, #15803d);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .delete-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--bg-tertiary);
    color: var(--error-color, #ef4444);
    border: 1px solid var(--error-color, #ef4444);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;

    .btn-icon {
      font-size: 14px;
    }

    &:hover:not(:disabled) {
      background: var(--error-color, #ef4444);
      color: white;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.expand-indicator {
  padding: 8px 16px;
  text-align: center;
  border-top: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  border-radius: 0 0 8px 8px;

  span {
    font-size: 12px;
    color: var(--text-secondary);
  }
}

// ========== 空状态 ==========
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--text-secondary);

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  p {
    margin: 0;
    font-size: 14px;
  }
}

// ========== 操作结果提示 ==========
.result-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;

  &.success {
    background: var(--success-color, #22c55e);
    color: white;
  }

  &.error {
    background: var(--error-color, #ef4444);
    color: white;
  }

  .toast-icon {
    font-size: 16px;
  }
}

.result-toast-enter-active,
.result-toast-leave-active {
  transition: all 0.3s ease;
}

.result-toast-enter-from,
.result-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

// ========== 响应式 ==========
@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    align-items: stretch;

    .filter-item {
      width: 100%;

      .filter-select {
        flex: 1;
      }
    }
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
