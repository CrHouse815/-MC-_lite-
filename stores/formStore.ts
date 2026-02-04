/**
 * MClite v7 - 表单 Store
 * 适配精简变量结构（递归自相似节点）：
 * - 表单定义从文档的 $formMeta + $fieldDef 解析
 * - $fieldDef 嵌入在递归节点中（与 _t, _s 并列）
 * - 用文档 key 作为 formId
 * - 花名册条目在 MC.花名册.entries 下
 */

import { defineStore } from 'pinia';
import { computed, nextTick, ref } from 'vue';
import { FormParserService } from '../services/FormParserService';
import type { ApplicationRecord, FormDefinition, FormFieldDef, ParsedDefinitions } from '../types/form';
import { useMvuStore } from './mvuStore';

const DOCUMENTS_PATH = 'MC.文档';
const APPLICATIONS_PATH = 'MC.申请记录';

export const useFormStore = defineStore('form', () => {
  const mvuStore = useMvuStore();

  // ========== 状态 ==========
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const currentFormId = ref<string | null>(null);
  const formData = ref<Record<string, unknown>>({});
  const dataVersion = ref(0);

  let unsubscribeUpdateEnd: (() => void) | null = null;

  // ========== 计算属性 ==========

  const documentsContainer = computed(() => {
    const _version = dataVersion.value;
    return mvuStore.getVariable(DOCUMENTS_PATH, {});
  });

  const parsedDefinitions = computed<ParsedDefinitions>(() => {
    return FormParserService.parseDocuments(documentsContainer.value as any);
  });

  const availableForms = computed(() => {
    const forms = parsedDefinitions.value.forms;
    return Object.entries(forms).map(([docId, form]) => ({
      formId: docId,
      formName: form.meta.formName,
      description: form.meta.description,
      sourceDocId: form.sourceDocId,
    }));
  });

  const formCount = computed(() => availableForms.value.length);
  const hasNoForms = computed(() => formCount.value === 0);

  const effectiveFormId = computed<string | null>(() => {
    const _version = dataVersion.value;
    const selectedId = currentFormId.value;
    const forms = parsedDefinitions.value.forms;
    const formIds = Object.keys(forms);

    if (selectedId && forms[selectedId]) return selectedId;
    if (formIds.length > 0) return formIds[0];
    return null;
  });

  const currentForm = computed<FormDefinition | null>(() => {
    const formId = effectiveFormId.value;
    if (!formId) return null;
    return parsedDefinitions.value.forms[formId] || null;
  });

  const currentFields = computed<FormFieldDef[]>(() => {
    return currentForm.value?.fields || [];
  });

  const currentFormMeta = computed(() => currentForm.value?.meta || null);

  // ========== Actions ==========

  const initialize = async () => {
    if (isInitialized.value) return;
    try {
      isLoading.value = true;
      if (!mvuStore.isMvuAvailable) await mvuStore.initialize();

      if (!unsubscribeUpdateEnd) {
        unsubscribeUpdateEnd = mvuStore.onUpdateEnd(() => {
          dataVersion.value++;
        });
      }

      if (availableForms.value.length > 0 && !currentFormId.value) {
        currentFormId.value = availableForms.value[0].formId;
      }

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败';
    } finally {
      isLoading.value = false;
    }
  };

  const refresh = async () => {
    await mvuStore.refresh();
    dataVersion.value++;
  };

  const destroy = () => {
    if (unsubscribeUpdateEnd) {
      unsubscribeUpdateEnd();
      unsubscribeUpdateEnd = null;
    }
  };

  const selectForm = async (formId: string) => {
    if (currentFormId.value === formId) return;
    formData.value = {};
    currentFormId.value = formId;
    dataVersion.value++;
    await nextTick();
    await nextTick();
    initializeFormData();
  };

  const initializeFormData = () => {
    const fields = currentFields.value;
    const data: Record<string, unknown> = {};

    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        if (typeof field.defaultValue === 'string' && field.defaultValue.startsWith('{{')) {
          if (field.defaultValue === '{{currentDate}}') {
            data[field.fieldId] = new Date().toISOString().split('T')[0];
          }
        } else {
          data[field.fieldId] = field.defaultValue;
        }
      }

      if (field.source) {
        const value = mvuStore.getVariable(field.source, null);
        if (value !== null) {
          data[field.fieldId] = value;
        }
      }
    }

    formData.value = data;
  };

  const autoFillFormData = () => {
    const fields = currentFields.value;
    const data: Record<string, unknown> = { ...formData.value };

    for (const field of fields) {
      // 1. 优先使用 source 路径自动填入（适用于 readonly 和有 source 的字段）
      if (field.source) {
        const value = mvuStore.getVariable(field.source, null);
        if (value !== null && value !== undefined && value !== '') {
          data[field.fieldId] = value;
          continue;
        }
      }

      // 2. 通过 label 推断常见的玩家信息字段
      const labelToPathMap: Record<string, string> = {
        '申请人姓名': 'MC.玩家.姓名',
        '所属部门': 'MC.玩家.部门',
        '职务': 'MC.玩家.职位',
        '职位': 'MC.玩家.职位',
      };

      const inferredPath = labelToPathMap[field.label];
      if (inferredPath && !data[field.fieldId]) {
        const value = mvuStore.getVariable(inferredPath, null);
        if (value !== null && value !== undefined && value !== '') {
          data[field.fieldId] = value;
          continue;
        }
      }

      // 3. 日期字段自动填入当前日期
      if (field.inputType === 'date' || field.inputType === 'datetime') {
        if (!data[field.fieldId]) {
          if (field.defaultValue === '{{currentDate}}') {
            data[field.fieldId] = new Date().toISOString().split('T')[0];
          } else if (field.label.includes('日期') && !field.defaultValue) {
            data[field.fieldId] = new Date().toISOString().split('T')[0];
          }
        }
        continue;
      }

      // 4. 其余字段使用默认值
      if (data[field.fieldId] === undefined || data[field.fieldId] === null || data[field.fieldId] === '') {
        if (field.defaultValue !== undefined) {
          if (typeof field.defaultValue === 'string' && field.defaultValue.startsWith('{{')) {
            if (field.defaultValue === '{{currentDate}}') {
              data[field.fieldId] = new Date().toISOString().split('T')[0];
            }
          } else {
            data[field.fieldId] = field.defaultValue;
          }
        }
      }
    }

    formData.value = data;
  };

  const updateField = (fieldId: string, value: unknown) => {
    formData.value = { ...formData.value, [fieldId]: value };
  };

  const validateForm = (): { valid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};
    const fields = currentFields.value;
    const data = formData.value;

    for (const field of fields) {
      const value = data[field.fieldId];

      if (field.required) {
        if (value === undefined || value === null || value === '') {
          errors[field.fieldId] = `${field.label}不能为空`;
          continue;
        }
      }

      if (field.conditionalRequired) {
        const rule = field.conditionalRequired;
        const targetValue = data[rule.when.field];
        let conditionMet = false;
        if (rule.when.equals !== undefined) conditionMet = targetValue === rule.when.equals;
        else if (rule.when.in !== undefined) conditionMet = rule.when.in.includes(targetValue);

        if (conditionMet && rule.required && (value === undefined || value === null || value === '')) {
          errors[field.fieldId] = `${field.label}不能为空`;
          continue;
        }
      }

      if (typeof value === 'string') {
        if (field.minLength && value.length < field.minLength)
          errors[field.fieldId] = `${field.label}至少需要${field.minLength}个字符`;
        if (field.maxLength && value.length > field.maxLength)
          errors[field.fieldId] = `${field.label}不能超过${field.maxLength}个字符`;
      }

      if (typeof value === 'number') {
        if (field.min !== undefined && value < field.min)
          errors[field.fieldId] = `${field.label}不能小于${field.min}`;
        if (field.max !== undefined && value > field.max)
          errors[field.fieldId] = `${field.label}不能大于${field.max}`;
      }

      if (field.mustBeTrue && value !== true) {
        errors[field.fieldId] = `请勾选${field.label}`;
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  };

  const generateApplicationId = (): string => {
    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const seq = String(Math.floor(Math.random() * 900) + 100);
    return `APP${dateStr}${seq}`;
  };

  const generateSummaryText = (): string => {
    const meta = currentFormMeta.value;
    if (!meta) return '';

    const data = formData.value;
    const parts: string[] = [];

    parts.push(`【${meta.formName}】`);

    // 查找申请人和部门字段（通过 source 路径或 label 匹配）
    const fields = currentFields.value;
    let applicant = '<user>';
    let dept = '';
    let dateValue = '';

    for (const field of fields) {
      const value = data[field.fieldId];
      if (field.source === 'MC.玩家.姓名' || field.label === '申请人姓名') {
        if (value) applicant = String(value);
      } else if (field.source === 'MC.玩家.部门' || field.label === '所属部门') {
        if (value) dept = String(value);
      } else if (field.label === '申请日期' || field.inputType === 'date') {
        if (value && !dateValue) dateValue = String(value);
      }
    }

    parts.push(`申请人：${applicant}${dept ? `（${dept}）` : ''}`);
    if (dateValue) parts.push(`日期：${dateValue}`);

    // 遍历其他非元字段
    for (const field of fields) {
      // 跳过已处理的字段
      if (field.source === 'MC.玩家.姓名' || field.label === '申请人姓名') continue;
      if (field.source === 'MC.玩家.部门' || field.label === '所属部门') continue;
      if (field.label === '申请日期' && dateValue) continue;
      if (field.inputType === 'checkbox' && field.mustBeTrue) continue; // 跳过承诺类字段

      const value = data[field.fieldId];
      if (value === undefined || value === null || value === '' || value === false) continue;

      let formattedValue: string;
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        formattedValue = value
          .map(v => (typeof v === 'object' ? Object.values(v as Record<string, unknown>).filter(x => x).join(' ') : String(v)))
          .join('、');
      } else if (typeof value === 'object') {
        // 表格数据简化显示
        formattedValue = `[${(value as unknown[]).length || 0}条记录]`;
      } else if (typeof value === 'boolean') {
        formattedValue = value ? '是' : '否';
      } else {
        formattedValue = String(value);
      }

      parts.push(`${field.label}：${formattedValue}`);
    }

    parts.push('状态：待审批');
    return parts.join(' | ');
  };

  const submitForm = async (): Promise<{ success: boolean; appId?: string; error?: string }> => {
    const meta = currentFormMeta.value;
    if (!meta) return { success: false, error: '未选择表单' };

    const validation = validateForm();
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      return { success: false, error: firstError };
    }

    try {
      const appId = generateApplicationId();
      const summary = generateSummaryText();
      const targetPath = meta.targetPath;
      const fullPath = `${targetPath}.${appId}`;

      await mvuStore.setVariable(fullPath, summary, `提交${meta.formName}`);
      formData.value = {};
      return { success: true, appId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '提交失败' };
    }
  };

  const shouldShowField = (field: FormFieldDef): boolean => {
    if (!field.showWhen) return true;
    const rule = field.showWhen;
    const targetValue = formData.value[rule.field];
    if (rule.equals !== undefined) return targetValue === rule.equals;
    if (rule.in !== undefined) return rule.in.includes(targetValue);
    return true;
  };

  const getRosterEntries = (rosterPath: string): Array<{ id: string; name: string }> => {
    const roster = mvuStore.getVariable(rosterPath, {}) as Record<string, unknown>;
    const entries: Array<{ id: string; name: string }> = [];

    // 从 $schema 获取 primaryKey 和 displayField 配置
    const schema = roster.$schema as Record<string, unknown> | undefined;
    const primaryKeyField = String(schema?.primaryKey || 'id');
    const displayField = String(schema?.displayField || 'name');

    // 精简版结构：条目在 roster.entries 下
    const entriesObj = (roster.entries || roster) as Record<string, unknown>;
    for (const [key, value] of Object.entries(entriesObj)) {
      if (key.startsWith('$') || !value || typeof value !== 'object') continue;
      const entry = value as Record<string, unknown>;
      entries.push({
        id: String(entry[primaryKeyField] || key),
        name: String(entry[displayField] || key),
      });
    }

    return entries;
  };

  // ========== 申请记录相关 ==========

  const applicationsContainer = computed(() => {
    const _version = dataVersion.value;
    return mvuStore.getVariable(APPLICATIONS_PATH, {}) as Record<string, unknown>;
  });

  const parseApplicationSummary = (appId: string, summary: string): ApplicationRecord => {
    const record: ApplicationRecord = {
      appId,
      summary,
      formType: '',
      applicant: '',
      date: '',
      status: '待审批',
      details: {},
    };

    const typeMatch = summary.match(/【(.+?)】/);
    if (typeMatch) record.formType = typeMatch[1];

    const parts = summary.split('|').map(p => p.trim());
    for (const part of parts) {
      if (part.startsWith('申请人：')) {
        const m = part.match(/申请人：(.+?)(?:（(.+?)）)?$/);
        if (m) {
          record.applicant = m[1];
          if (m[2]) record.details['部门'] = m[2];
        }
      } else if (part.startsWith('日期：')) {
        record.date = part.replace('日期：', '');
      } else if (part.startsWith('状态：')) {
        record.status = part.replace('状态：', '');
      } else if (part.includes('：')) {
        const [key, value] = part.split('：');
        if (key && value && !key.startsWith('【')) {
          record.details[key] = value;
        }
      }
    }

    return record;
  };

  const getCurrentFormApplications = computed<ApplicationRecord[]>(() => {
    const meta = currentFormMeta.value;
    if (!meta?.targetPath) return [];

    const pathParts = meta.targetPath.split('.');
    const categoryKey = pathParts[pathParts.length - 1];
    const categoryData = applicationsContainer.value[categoryKey] as Record<string, unknown> | undefined;
    if (!categoryData) return [];

    const records: ApplicationRecord[] = [];
    for (const [appId, summary] of Object.entries(categoryData)) {
      if (appId.startsWith('$') || typeof summary !== 'string') continue;
      records.push(parseApplicationSummary(appId, summary));
    }

    return records.sort((a, b) => b.appId.localeCompare(a.appId));
  });

  const getAllApplications = computed<ApplicationRecord[]>(() => {
    const container = applicationsContainer.value;
    const records: ApplicationRecord[] = [];

    for (const [category, categoryData] of Object.entries(container)) {
      if (category.startsWith('$') || !categoryData || typeof categoryData !== 'object') continue;
      for (const [appId, summary] of Object.entries(categoryData as Record<string, unknown>)) {
        if (appId.startsWith('$') || typeof summary !== 'string') continue;
        records.push(parseApplicationSummary(appId, summary));
      }
    }

    return records.sort((a, b) => b.appId.localeCompare(a.appId));
  });

  const applicationCount = computed(() => getCurrentFormApplications.value.length);
  const totalApplicationCount = computed(() => getAllApplications.value.length);

  const quickApproveApplication = async (
    appId: string,
    category?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      let categoryKey = category;
      if (!categoryKey) {
        const meta = currentFormMeta.value;
        if (!meta?.targetPath) return { success: false, error: '无法确定申请类别' };
        const pathParts = meta.targetPath.split('.');
        categoryKey = pathParts[pathParts.length - 1];
      }

      const categoryData = applicationsContainer.value[categoryKey] as Record<string, unknown> | undefined;
      if (!categoryData) return { success: false, error: '找不到申请类别' };

      const currentSummary = categoryData[appId];
      if (typeof currentSummary !== 'string') return { success: false, error: '找不到该申请记录' };

      let newSummary = currentSummary;
      const statusPatterns = [/状态：[^|]+$/, /状态：[^|]+\|/];
      let replaced = false;
      for (const pattern of statusPatterns) {
        if (pattern.test(newSummary)) {
          newSummary = newSummary.replace(pattern, match =>
            match.endsWith('|') ? '状态：已批准（快速通过）|' : '状态：已批准（快速通过）',
          );
          replaced = true;
          break;
        }
      }
      if (!replaced) newSummary += ' | 状态：已批准（快速通过）';

      const fullPath = `${APPLICATIONS_PATH}.${categoryKey}.${appId}`;
      await mvuStore.setVariable(fullPath, newSummary, `快速通过申请 ${appId}`);
      dataVersion.value++;
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '操作失败' };
    }
  };

  const quickApproveAllPending = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    const pendingRecords = getCurrentFormApplications.value.filter(
      r => r.status.includes('待') || r.status.includes('审批中'),
    );
    if (pendingRecords.length === 0) return { success: true, count: 0 };

    let successCount = 0;
    for (const record of pendingRecords) {
      const result = await quickApproveApplication(record.appId);
      if (result.success) successCount++;
    }
    return { success: true, count: successCount };
  };

  const deleteApplication = async (appId: string, category?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      let categoryKey = category;
      if (!categoryKey) {
        const meta = currentFormMeta.value;
        if (!meta?.targetPath) return { success: false, error: '无法确定申请类别' };
        const pathParts = meta.targetPath.split('.');
        categoryKey = pathParts[pathParts.length - 1];
      }

      const categoryData = applicationsContainer.value[categoryKey] as Record<string, unknown> | undefined;
      if (!categoryData || typeof categoryData[appId] !== 'string')
        return { success: false, error: '找不到该申请记录' };

      const newCategoryData = { ...categoryData };
      delete newCategoryData[appId];

      const categoryPath = `${APPLICATIONS_PATH}.${categoryKey}`;
      await mvuStore.setVariable(categoryPath, newCategoryData, `删除申请记录 ${appId}`);
      dataVersion.value++;
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : '删除失败' };
    }
  };

  const deleteAllApplications = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    const records = getCurrentFormApplications.value;
    if (records.length === 0) return { success: true, count: 0 };

    let successCount = 0;
    for (const record of records) {
      const result = await deleteApplication(record.appId);
      if (result.success) successCount++;
    }
    return { success: true, count: successCount };
  };

  return {
    // 状态
    isInitialized,
    isLoading,
    error,
    currentFormId,
    formData,
    dataVersion,
    // 计算属性
    availableForms,
    formCount,
    hasNoForms,
    effectiveFormId,
    currentForm,
    currentFields,
    currentFormMeta,
    // 申请记录相关
    getCurrentFormApplications,
    getAllApplications,
    applicationCount,
    totalApplicationCount,
    // Actions
    initialize,
    refresh,
    destroy,
    selectForm,
    initializeFormData,
    autoFillFormData,
    updateField,
    validateForm,
    submitForm,
    shouldShowField,
    getRosterEntries,
    quickApproveApplication,
    quickApproveAllPending,
    deleteApplication,
    deleteAllApplications,
  };
});
