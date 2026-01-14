<!--
  表单面板
  支持从规章制度中解析表单定义并动态渲染
-->
<template>
  <div class="form-panel" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
    <!-- 顶部头栏 -->
    <div class="panel-header">
      <div class="header-left">
        <span class="panel-icon">📝</span>
        <h2>表单申请</h2>
      </div>
      <div class="header-center">
        <!-- 视图切换按钮 -->
        <div class="view-toggle">
          <button class="toggle-btn" :class="{ active: currentView === 'form' }" @click="currentView = 'form'">
            <span class="btn-icon">📝</span>
            <span class="btn-text">填写申请</span>
          </button>
          <button class="toggle-btn" :class="{ active: currentView === 'records' }" @click="currentView = 'records'">
            <span class="btn-icon">📋</span>
            <span class="btn-text">申请记录</span>
            <span v-if="applicationCount > 0" class="record-badge">{{ applicationCount }}</span>
          </button>
        </div>
      </div>
      <div class="header-right">
        <span class="form-count">{{ formCount }} 种表单</span>
        <button class="close-btn" title="关闭" @click="$emit('close')">✕</button>
      </div>
    </div>

    <div class="panel-main">
      <!-- 左侧表单列表侧栏 -->
      <aside class="form-sidebar" :class="{ collapsed: isSidebarCollapsed }">
        <div class="sidebar-header">
          <span v-if="!isSidebarCollapsed" class="sidebar-title">表单列表</span>
          <button class="toggle-btn" :title="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'" @click="toggleSidebar">
            {{ isSidebarCollapsed ? '▶' : '◀' }}
          </button>
        </div>

        <div v-if="!isSidebarCollapsed && formCount > 0" class="form-list">
          <div
            v-for="form in availableForms"
            :key="form.formId"
            class="form-item"
            :class="{ active: isCurrentForm(form.formId) }"
            @click="handleSelectForm(form.formId)"
          >
            <span class="form-icon">📋</span>
            <div class="form-info">
              <span class="form-title">{{ form.formName }}</span>
              <span v-if="form.description" class="form-desc">{{ truncateDesc(form.description) }}</span>
            </div>
          </div>
        </div>

        <div v-if="!isSidebarCollapsed && formCount === 0" class="sidebar-empty">
          <span>暂无表单</span>
        </div>

        <!-- 收缩状态下的图标列表 -->
        <div v-if="isSidebarCollapsed && formCount > 0" class="collapsed-list">
          <div
            v-for="form in availableForms"
            :key="form.formId"
            class="collapsed-item"
            :class="{ active: isCurrentForm(form.formId) }"
            :title="form.formName"
            @click="handleSelectForm(form.formId)"
          >
            📋
          </div>
        </div>
      </aside>

      <!-- 右侧内容区 -->
      <div class="panel-body">
        <!-- 表单填写视图 -->
        <template v-if="currentView === 'form'">
          <!-- 加载状态 -->
          <div v-if="isLoading" class="state-container loading-state">
            <div class="state-icon">⏳</div>
            <p>加载中...</p>
          </div>

          <!-- 错误状态 -->
          <div v-else-if="error" class="state-container error-state">
            <div class="state-icon">⚠️</div>
            <p>{{ error }}</p>
            <button class="retry-btn" @click="refresh">重试</button>
          </div>

          <!-- 无表单状态 -->
          <div v-else-if="hasNoForms" class="state-container empty-state">
            <div class="state-icon">📭</div>
            <p>暂无可用表单</p>
            <p class="empty-hint">表单定义从 <code>MC.文档</code> 中的规章制度解析</p>
            <p class="empty-hint">在规章制度中添加 <code>$formMeta</code> 和 <code>$fieldDef</code> 即可创建表单</p>
          </div>

          <!-- 表单内容 -->
          <div v-else-if="currentForm" :key="effectiveFormId" class="form-content">
            <!-- 表单标题 -->
            <div class="form-header">
              <h3 class="form-title">{{ currentFormMeta?.formName }}</h3>
              <span v-if="currentFormMeta?.description" class="form-description">
                {{ currentFormMeta.description }}
              </span>
            </div>

            <!-- 工作流提示 -->
            <div v-if="currentFormMeta?.workflow" class="workflow-hint">
              <span class="workflow-label">审批流程：</span>
              <span v-for="(step, index) in currentFormMeta.workflow" :key="step.step" class="workflow-step">
                {{ step.name }}
                <span v-if="index < currentFormMeta.workflow.length - 1" class="workflow-arrow">→</span>
              </span>
            </div>

            <!-- 表单字段 -->
            <div class="form-fields">
              <template v-for="field in currentFields" :key="field.fieldId">
                <FormFieldRenderer
                  v-if="shouldShowField(field)"
                  :field="field"
                  :value="formData[field.fieldId]"
                  :error="fieldErrors[field.fieldId]"
                  @update="handleFieldUpdate"
                />
              </template>
            </div>

            <!-- 提交按钮 -->
            <div class="form-actions">
              <button class="reset-btn" :disabled="isSubmitting" @click="handleReset">重置</button>
              <button class="submit-btn" :disabled="isSubmitting" @click="handleSubmit">
                {{ isSubmitting ? '提交中...' : '提交申请' }}
              </button>
            </div>

            <!-- 提交成功提示 -->
            <div v-if="submitSuccess" class="submit-success">
              <span class="success-icon">✅</span>
              <span>申请已提交，编号：{{ lastAppId }}</span>
            </div>
          </div>
        </template>

        <!-- 申请记录视图 -->
        <template v-else-if="currentView === 'records'">
          <ApplicationRecordsViewer :records="getCurrentFormApplications" @close="currentView = 'form'" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref, watch } from 'vue';
import { useFormStore } from '../../stores/formStore';
import FormFieldRenderer from './FormFieldRenderer.vue';
import ApplicationRecordsViewer from './ApplicationRecordsViewer.vue';
import type { FormFieldDef } from '../../types/form';

defineEmits<{ (e: 'close'): void }>();

const formStore = useFormStore();

// 基础状态使用 storeToRefs
const { isLoading, error, formData } = storeToRefs(formStore);

// 计算属性直接从 store 访问，确保响应式正确工作
// 这是解决切换不生效问题的关键！
const availableForms = computed(() => formStore.availableForms);
const formCount = computed(() => formStore.formCount);
const hasNoForms = computed(() => formStore.hasNoForms);
const effectiveFormId = computed(() => formStore.effectiveFormId);
const currentForm = computed(() => formStore.currentForm);
const currentFields = computed(() => formStore.currentFields);
const currentFormMeta = computed(() => formStore.currentFormMeta);
const getCurrentFormApplications = computed(() => formStore.getCurrentFormApplications);
const applicationCount = computed(() => formStore.applicationCount);

const { initialize, refresh, selectForm, updateField, validateForm, submitForm, shouldShowField, initializeFormData } =
  formStore;

/** 当前视图：form（表单填写）或 records（申请记录） */
const currentView = ref<'form' | 'records'>('form');

/** 侧栏收缩状态 */
const isSidebarCollapsed = ref(false);

/** 字段错误信息 */
const fieldErrors = ref<Record<string, string>>({});

/** 是否正在提交 */
const isSubmitting = ref(false);

/** 提交成功状态 */
const submitSuccess = ref(false);

/** 最后一个申请编号 */
const lastAppId = ref<string>('');

/** 切换侧栏收缩状态 */
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

/** 截断描述文本 */
const truncateDesc = (desc: string, maxLen = 30): string => {
  return desc.length > maxLen ? desc.slice(0, maxLen) + '...' : desc;
};

/** 判断是否为当前选中的表单 */
const isCurrentForm = (formId: string): boolean => {
  return effectiveFormId.value === formId;
};

/** 处理表单选择 */
const handleSelectForm = async (formId: string) => {
  console.log('[FormPanel] handleSelectForm 被调用:', formId);
  await selectForm(formId);
  console.log('[FormPanel] selectForm 完成');
  fieldErrors.value = {};
  submitSuccess.value = false;
};

/** 处理字段更新 */
const handleFieldUpdate = (fieldId: string, value: unknown) => {
  updateField(fieldId, value);
  // 清除该字段的错误
  if (fieldErrors.value[fieldId]) {
    const newErrors = { ...fieldErrors.value };
    delete newErrors[fieldId];
    fieldErrors.value = newErrors;
  }
};

/** 处理重置 */
const handleReset = () => {
  initializeFormData();
  fieldErrors.value = {};
  submitSuccess.value = false;
};

/** 处理提交 */
const handleSubmit = async () => {
  isSubmitting.value = true;
  submitSuccess.value = false;

  // 验证表单
  const validation = validateForm();
  if (!validation.valid) {
    fieldErrors.value = validation.errors;
    isSubmitting.value = false;
    return;
  }

  // 提交表单
  const result = await submitForm();
  isSubmitting.value = false;

  if (result.success) {
    submitSuccess.value = true;
    lastAppId.value = result.appId || '';
    fieldErrors.value = {};

    // 5秒后隐藏成功提示
    setTimeout(() => {
      submitSuccess.value = false;
    }, 5000);
  } else if (result.error) {
    // 显示错误
    fieldErrors.value = { _global: result.error };
  }
};

// 监听表单切换，初始化表单数据
watch(effectiveFormId, (newId, oldId) => {
  console.log('[FormPanel] effectiveFormId 变化:', oldId, '->', newId);
  if (newId) {
    initializeFormData();
  }
});

// 调试用：监听响应式变化
watch(currentForm, (newForm, oldForm) => {
  console.log('[FormPanel] currentForm 变化:', oldForm?.meta?.formName, '->', newForm?.meta?.formName);
});

watch(
  currentFields,
  newFields => {
    console.log('[FormPanel] currentFields 变化, 字段数:', newFields.length);
  },
  { deep: true },
);

watch(currentFormMeta, (newMeta, oldMeta) => {
  console.log('[FormPanel] currentFormMeta 变化:', oldMeta?.formName, '->', newMeta?.formName);
});

onMounted(() => {
  initialize();
});
</script>

<style lang="scss" scoped>
.form-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
  color: var(--text-color);
}

// ========== 头部栏 ==========
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .panel-icon {
      font-size: 20px;
    }

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color);
    }
  }

  .header-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .view-toggle {
    display: flex;
    background: var(--bg-secondary);
    border-radius: 8px;
    padding: 4px;
    gap: 4px;

    .toggle-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-secondary);
      transition: all 0.2s ease;

      .btn-icon {
        font-size: 14px;
      }

      .btn-text {
        font-weight: 500;
      }

      .record-badge {
        background: var(--primary-color);
        color: white;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 18px;
        text-align: center;
      }

      &:hover {
        background: var(--bg-hover);
        color: var(--text-color);
      }

      &.active {
        background: var(--primary-color);
        color: white;

        .record-badge {
          background: rgba(255, 255, 255, 0.3);
        }
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .form-count {
      font-size: 14px;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      padding: 4px 10px;
      border-radius: 12px;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 18px;
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

// ========== 主体区域 ==========
.panel-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

// ========== 左侧表单列表侧栏 ==========
.form-sidebar {
  width: 220px;
  min-width: 220px;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition:
    width 0.25s ease,
    min-width 0.25s ease;

  &.collapsed {
    width: 50px;
    min-width: 50px;
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);

  .sidebar-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color);
  }

  .toggle-btn {
    background: none;
    border: none;
    font-size: 12px;
    cursor: pointer;
    padding: 4px 6px;
    color: var(--text-secondary);
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-color);
    }
  }
}

.form-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.form-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  .form-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .form-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .form-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .form-desc {
    font-size: 11px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    background: var(--bg-hover);
    border-color: var(--primary-color);
  }

  &.active {
    background: var(--primary-light);
    border-color: var(--primary-color);

    .form-title {
      color: var(--primary-color);
      font-weight: 600;
    }
  }
}

.sidebar-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}

.collapsed-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.collapsed-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-hover);
    border-color: var(--primary-color);
  }

  &.active {
    background: var(--primary-light);
    border-color: var(--primary-color);
  }
}

// ========== 右侧内容区 ==========
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-color);
}

// ========== 状态容器 ==========
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  height: 100%;

  .state-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  p {
    margin: 0 0 8px 0;
    color: var(--text-secondary);
    font-size: 15px;
  }

  .empty-hint {
    font-size: 13px;
    color: var(--text-disabled);

    code {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      color: var(--text-color);
    }
  }

  .retry-btn {
    margin-top: 16px;
    padding: 8px 20px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;

    &:hover {
      background: var(--primary-hover);
    }
  }
}

// ========== 表单内容 ==========
.form-content {
  max-width: 800px;
  margin: 0 auto;
}

.form-header {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--primary-color);

  .form-title {
    margin: 0 0 8px 0;
    font-size: 20px;
    color: var(--text-color);
  }

  .form-description {
    display: block;
    font-size: 14px;
    color: var(--text-secondary);
  }
}

.workflow-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  margin-bottom: 24px;
  font-size: 13px;

  .workflow-label {
    color: var(--text-secondary);
    font-weight: 500;
  }

  .workflow-step {
    color: var(--text-color);
    background: var(--bg-secondary);
    padding: 4px 10px;
    border-radius: 12px;
  }

  .workflow-arrow {
    color: var(--text-disabled);
    margin: 0 4px;
  }
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);

  .reset-btn {
    padding: 10px 24px;
    background: var(--bg-tertiary);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: var(--bg-hover);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .submit-btn {
    padding: 10px 32px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      background: var(--primary-hover);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.submit-success {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  margin-top: 16px;
  background: var(--success-light, rgba(34, 197, 94, 0.1));
  border: 1px solid var(--success-color, #22c55e);
  border-radius: 8px;
  color: var(--success-color, #22c55e);
  font-size: 14px;

  .success-icon {
    font-size: 18px;
  }
}

// ========== 响应式适配 ==========
@media (max-width: 768px) {
  .panel-header {
    flex-wrap: wrap;
    gap: 8px;

    .header-center {
      order: 3;
      width: 100%;
      justify-content: center;
    }

    .view-toggle {
      width: 100%;

      .toggle-btn {
        flex: 1;
        justify-content: center;
      }
    }
  }

  .form-sidebar {
    width: 180px;
    min-width: 180px;

    &.collapsed {
      width: 44px;
      min-width: 44px;
    }
  }

  .form-content {
    max-width: 100%;
  }

  .form-actions {
    flex-direction: column;

    .reset-btn,
    .submit-btn {
      width: 100%;
    }
  }
}
</style>
