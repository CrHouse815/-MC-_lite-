/**
 * MClite - 表单 Store
 * 管理表单的解析、显示和提交
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

  /** 当前选中的表单ID */
  const currentFormId = ref<string | null>(null);

  /** 表单数据（用户填写的内容） */
  const formData = ref<Record<string, unknown>>({});

  /** 数据版本号 */
  const dataVersion = ref(0);

  /** 取消监听函数 */
  let unsubscribeUpdateEnd: (() => void) | null = null;

  // ========== 计算属性 ==========

  /** 文档容器 */
  const documentsContainer = computed(() => {
    // 依赖版本号触发更新
    const _version = dataVersion.value;
    console.log('[FormStore] 读取文档容器, version:', _version);
    return mvuStore.getVariable(DOCUMENTS_PATH, {});
  });

  /** 解析后的所有定义 */
  const parsedDefinitions = computed<ParsedDefinitions>(() => {
    return FormParserService.parseDocuments(documentsContainer.value as any);
  });

  /** 所有可用的表单列表 */
  const availableForms = computed(() => {
    const forms = parsedDefinitions.value.forms;
    return Object.values(forms).map(form => ({
      formId: form.meta.formId,
      formName: form.meta.formName,
      description: form.meta.description,
      sourceDocId: form.sourceDocId,
    }));
  });

  /** 表单数量 */
  const formCount = computed(() => availableForms.value.length);

  /** 是否没有任何表单 */
  const hasNoForms = computed(() => formCount.value === 0);

  /** 当前有效的表单ID */
  const effectiveFormId = computed<string | null>(() => {
    // 显式依赖 dataVersion 以确保在切换表单时重新计算
    const _version = dataVersion.value;
    const selectedId = currentFormId.value;
    const forms = parsedDefinitions.value.forms;
    const formIds = Object.keys(forms);

    console.log('[FormStore] effectiveFormId 计算:', {
      version: _version,
      currentFormId: selectedId,
      availableFormIds: formIds,
      currentFormExists: selectedId ? !!forms[selectedId] : false,
    });

    // 首先检查当前选中的表单是否存在
    if (selectedId && forms[selectedId]) {
      console.log('[FormStore] effectiveFormId 返回 currentFormId:', selectedId);
      return selectedId;
    }

    // 如果当前选中的表单不存在，尝试 fallback 到第一个可用表单
    if (formIds.length > 0) {
      const fallbackId = formIds[0];
      console.log('[FormStore] effectiveFormId fallback 到:', fallbackId);
      return fallbackId;
    }

    console.log('[FormStore] effectiveFormId 返回 null');
    return null;
  });

  /** 当前选中的表单定义 */
  const currentForm = computed<FormDefinition | null>(() => {
    const formId = effectiveFormId.value;
    if (!formId) return null;
    return parsedDefinitions.value.forms[formId] || null;
  });

  /** 当前表单的字段（已排序） */
  const currentFields = computed<FormFieldDef[]>(() => {
    return currentForm.value?.fields || [];
  });

  /** 当前表单的元数据 */
  const currentFormMeta = computed(() => currentForm.value?.meta || null);

  // ========== Actions ==========

  const initialize = async () => {
    if (isInitialized.value) return;
    try {
      isLoading.value = true;
      if (!mvuStore.isMvuAvailable) await mvuStore.initialize();

      // 注册 MVU 更新事件监听
      if (!unsubscribeUpdateEnd) {
        unsubscribeUpdateEnd = mvuStore.onUpdateEnd(() => {
          console.log('[FormStore] 收到 MVU 更新结束事件，递增 dataVersion');
          dataVersion.value++;
        });
      }

      // 自动选中第一个表单
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

  /** 选择表单 */
  const selectForm = async (formId: string) => {
    console.log('[FormStore] selectForm 被调用:', formId);
    console.log('[FormStore] 当前 currentFormId:', currentFormId.value);
    console.log('[FormStore] 可用表单列表:', Object.keys(parsedDefinitions.value.forms));

    // 如果选择的是同一个表单，直接返回
    if (currentFormId.value === formId) {
      console.log('[FormStore] 选择的是同一个表单，跳过');
      return;
    }

    // 即使表单定义暂时不存在，也先设置 formId（可能是数据还未加载完成）
    const formExists = !!parsedDefinitions.value.forms[formId];
    console.log('[FormStore] 表单是否存在:', formExists, formId);

    // 清空表单数据（在更新 formId 之前）
    formData.value = {};

    // 更新 currentFormId
    currentFormId.value = formId;
    console.log('[FormStore] currentFormId 已更新为:', currentFormId.value);

    // 强制递增版本号以触发响应式更新
    dataVersion.value++;

    // 等待 Vue 更新计算属性链 (effectiveFormId → currentForm → currentFields)
    await nextTick();
    // 再等待一次以确保所有依赖的计算属性都已更新
    await nextTick();

    console.log('[FormStore] nextTick 后 effectiveFormId:', effectiveFormId.value);
    console.log('[FormStore] nextTick 后 currentForm:', currentForm.value?.meta?.formName);
    console.log('[FormStore] nextTick 后 currentFields 数量:', currentFields.value.length);

    // 初始化默认值
    initializeFormData();
  };

  /** 初始化表单数据（填入默认值） */
  const initializeFormData = () => {
    const fields = currentFields.value;
    const data: Record<string, unknown> = {};

    for (const field of fields) {
      // 处理默认值
      if (field.defaultValue !== undefined) {
        if (typeof field.defaultValue === 'string' && field.defaultValue.startsWith('{{')) {
          // 处理模板变量
          if (field.defaultValue === '{{currentDate}}') {
            data[field.fieldId] = new Date().toISOString().split('T')[0];
          }
        } else {
          data[field.fieldId] = field.defaultValue;
        }
      }

      // 处理从变量读取的值
      if (field.source) {
        const value = mvuStore.getVariable(field.source, null);
        if (value !== null) {
          data[field.fieldId] = value;
        }
      }
    }

    formData.value = data;
  };

  /** 自动填写表单数据（从变量系统读取玩家信息等固定内容） */
  const autoFillFormData = () => {
    const fields = currentFields.value;
    const data: Record<string, unknown> = { ...formData.value };

    // 玩家信息路径映射
    const playerInfoMapping: Record<string, string> = {
      applicant_name: 'MC.玩家.姓名',
      applicant_dept: 'MC.玩家.部门',
      applicant_position: 'MC.玩家.职位',
      applicant_age: 'MC.玩家.年龄',
      // 通用映射
      姓名: 'MC.玩家.姓名',
      部门: 'MC.玩家.部门',
      职位: 'MC.玩家.职位',
      年龄: 'MC.玩家.年龄',
    };

    // 日期字段自动填写当前日期
    const dateFields = ['apply_date', 'date', '日期', '申请日期'];

    for (const field of fields) {
      // 1. 检查字段是否有 source 配置（优先使用）
      if (field.source) {
        const value = mvuStore.getVariable(field.source, null);
        if (value !== null && value !== undefined && value !== '') {
          data[field.fieldId] = value;
          continue;
        }
      }

      // 2. 检查是否是玩家信息字段（通过 fieldId 或 label 匹配）
      const mappingKey = playerInfoMapping[field.fieldId]
        ? field.fieldId
        : playerInfoMapping[field.label]
          ? field.label
          : null;
      if (mappingKey) {
        const path = playerInfoMapping[mappingKey];
        const value = mvuStore.getVariable(path, null);
        if (value !== null && value !== undefined && value !== '') {
          data[field.fieldId] = value;
          continue;
        }
      }

      // 3. 检查是否是日期字段
      if (dateFields.includes(field.fieldId) || dateFields.includes(field.label)) {
        if (!data[field.fieldId]) {
          data[field.fieldId] = new Date().toISOString().split('T')[0];
        }
        continue;
      }

      // 4. 处理默认值（如果当前没有值）
      if (data[field.fieldId] === undefined || data[field.fieldId] === null || data[field.fieldId] === '') {
        if (field.defaultValue !== undefined) {
          if (typeof field.defaultValue === 'string' && field.defaultValue.startsWith('{{')) {
            // 处理模板变量
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
    console.log('[FormStore] 自动填写完成:', data);
  };

  /** 更新表单字段值 */
  const updateField = (fieldId: string, value: unknown) => {
    formData.value = { ...formData.value, [fieldId]: value };
  };

  /** 验证表单 */
  const validateForm = (): { valid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};
    const fields = currentFields.value;
    const data = formData.value;

    for (const field of fields) {
      const value = data[field.fieldId];

      // 检查必填
      if (field.required) {
        if (value === undefined || value === null || value === '') {
          errors[field.fieldId] = `${field.label}不能为空`;
          continue;
        }
      }

      // 条件必填
      if (field.conditionalRequired) {
        const rule = field.conditionalRequired;
        const targetValue = data[rule.when.field];
        let conditionMet = false;

        if (rule.when.equals !== undefined) {
          conditionMet = targetValue === rule.when.equals;
        } else if (rule.when.in !== undefined) {
          conditionMet = rule.when.in.includes(targetValue);
        }

        if (conditionMet && rule.required && (value === undefined || value === null || value === '')) {
          errors[field.fieldId] = `${field.label}不能为空`;
          continue;
        }
      }

      // 长度验证
      if (typeof value === 'string') {
        if (field.minLength && value.length < field.minLength) {
          errors[field.fieldId] = `${field.label}至少需要${field.minLength}个字符`;
        }
        if (field.maxLength && value.length > field.maxLength) {
          errors[field.fieldId] = `${field.label}不能超过${field.maxLength}个字符`;
        }
      }

      // 数值范围验证
      if (typeof value === 'number') {
        if (field.min !== undefined && value < field.min) {
          errors[field.fieldId] = `${field.label}不能小于${field.min}`;
        }
        if (field.max !== undefined && value > field.max) {
          errors[field.fieldId] = `${field.label}不能大于${field.max}`;
        }
      }

      // checkbox 必须为 true
      if (field.mustBeTrue && value !== true) {
        errors[field.fieldId] = `请勾选${field.label}`;
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  };

  /** 生成申请编号 */
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

  /** 生成摘要文本 */
  const generateSummaryText = (): string => {
    const meta = currentFormMeta.value;
    if (!meta) return '';

    const data = formData.value;
    const parts: string[] = [];

    // 表单类型标题
    parts.push(`【${meta.formName}】`);

    // 申请人信息
    const applicant = data.applicant_name || '<user>';
    const dept = data.applicant_dept || '';
    parts.push(`申请人：${applicant}${dept ? `（${dept}）` : ''}`);

    // 日期
    if (data.apply_date) {
      parts.push(`日期：${data.apply_date}`);
    }

    // 遍历其他字段
    const fields = currentFields.value;
    for (const field of fields) {
      // 跳过系统字段
      if (field.fieldId.startsWith('applicant') || field.fieldId === 'apply_date') continue;

      const value = data[field.fieldId];
      if (value === undefined || value === null || value === '') continue;

      // 格式化值
      let formattedValue: string;
      if (Array.isArray(value)) {
        if (value.length === 0) continue;
        formattedValue = value
          .map(v => {
            if (typeof v === 'object') {
              // 表格行
              const row = v as Record<string, unknown>;
              return Object.values(row)
                .filter(x => x)
                .join(' ');
            }
            return String(v);
          })
          .join('、');
      } else if (typeof value === 'object') {
        formattedValue = JSON.stringify(value);
      } else {
        formattedValue = String(value);
      }

      parts.push(`${field.label}：${formattedValue}`);
    }

    // 默认状态
    parts.push('状态：待审批');

    return parts.join(' | ');
  };

  /** 提交表单 */
  const submitForm = async (): Promise<{ success: boolean; appId?: string; error?: string }> => {
    const meta = currentFormMeta.value;
    if (!meta) {
      return { success: false, error: '未选择表单' };
    }

    // 验证表单
    const validation = validateForm();
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      return { success: false, error: firstError };
    }

    try {
      // 生成申请编号
      const appId = generateApplicationId();

      // 生成摘要文本
      const summary = generateSummaryText();

      // 写入变量系统
      // 从 targetPath 中提取目标路径（如 MC.申请记录.物资申请）
      const targetPath = meta.targetPath;
      const fullPath = `${targetPath}.${appId}`;

      await mvuStore.setVariable(fullPath, summary, `提交${meta.formName}`);

      console.log('[FormStore] 表单提交成功:', appId, summary);

      // 清空表单
      formData.value = {};

      return { success: true, appId };
    } catch (err) {
      console.error('[FormStore] 表单提交失败:', err);
      return { success: false, error: err instanceof Error ? err.message : '提交失败' };
    }
  };

  /** 检查字段是否应该显示 */
  const shouldShowField = (field: FormFieldDef): boolean => {
    if (!field.showWhen) return true;

    const rule = field.showWhen;
    const targetValue = formData.value[rule.field];

    if (rule.equals !== undefined) {
      return targetValue === rule.equals;
    }
    if (rule.in !== undefined) {
      return rule.in.includes(targetValue);
    }

    return true;
  };

  /** 获取花名册数据（用于选择框） */
  const getRosterEntries = (rosterPath: string): Array<{ id: string; name: string }> => {
    const roster = mvuStore.getVariable(rosterPath, {}) as Record<string, unknown>;
    const entries: Array<{ id: string; name: string }> = [];

    for (const [key, value] of Object.entries(roster)) {
      if (key.startsWith('$') || !value || typeof value !== 'object') continue;
      const entry = value as Record<string, unknown>;
      entries.push({
        id: String(entry.id || key),
        name: String(entry.name || key),
      });
    }

    return entries;
  };

  // ========== 申请记录相关 ==========

  /** 申请记录容器 */
  const applicationsContainer = computed(() => {
    const _version = dataVersion.value;
    return mvuStore.getVariable(APPLICATIONS_PATH, {}) as Record<string, unknown>;
  });

  /** 解析申请记录摘要文本 */
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

    // 解析格式：【表单类型】申请人：xxx（部门）| 日期：xxx | ... | 状态：xxx
    const typeMatch = summary.match(/【(.+?)】/);
    if (typeMatch) {
      record.formType = typeMatch[1];
    }

    // 解析各字段
    const parts = summary.split('|').map(p => p.trim());
    for (const part of parts) {
      if (part.startsWith('申请人：')) {
        const applicantMatch = part.match(/申请人：(.+?)(?:（(.+?)）)?$/);
        if (applicantMatch) {
          record.applicant = applicantMatch[1];
          if (applicantMatch[2]) {
            record.details['部门'] = applicantMatch[2];
          }
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

  /** 获取当前表单类型的申请记录 */
  const getCurrentFormApplications = computed<ApplicationRecord[]>(() => {
    const meta = currentFormMeta.value;
    if (!meta?.targetPath) return [];

    // 从 targetPath 提取类别路径（如 MC.申请记录.物资申请 -> 物资申请）
    const pathParts = meta.targetPath.split('.');
    const categoryKey = pathParts[pathParts.length - 1];

    const categoryData = applicationsContainer.value[categoryKey] as Record<string, unknown> | undefined;
    if (!categoryData) return [];

    const records: ApplicationRecord[] = [];
    for (const [appId, summary] of Object.entries(categoryData)) {
      if (appId.startsWith('$') || typeof summary !== 'string') continue;
      records.push(parseApplicationSummary(appId, summary));
    }

    // 按申请编号倒序排列（最新的在前）
    return records.sort((a, b) => b.appId.localeCompare(a.appId));
  });

  /** 获取所有申请记录 */
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

    // 按申请编号倒序排列
    return records.sort((a, b) => b.appId.localeCompare(a.appId));
  });

  /** 获取申请记录数量 */
  const applicationCount = computed(() => getCurrentFormApplications.value.length);

  /** 获取所有申请记录数量 */
  const totalApplicationCount = computed(() => getAllApplications.value.length);

  /** 快速通过申请 - 将申请状态改为已批准 */
  const quickApproveApplication = async (
    appId: string,
    category?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      // 如果没有提供 category，从当前表单的 targetPath 获取
      let categoryKey = category;
      if (!categoryKey) {
        const meta = currentFormMeta.value;
        if (!meta?.targetPath) {
          return { success: false, error: '无法确定申请类别' };
        }
        const pathParts = meta.targetPath.split('.');
        categoryKey = pathParts[pathParts.length - 1];
      }

      // 获取当前申请记录
      const categoryData = applicationsContainer.value[categoryKey] as Record<string, unknown> | undefined;
      if (!categoryData) {
        return { success: false, error: '找不到申请类别' };
      }

      const currentSummary = categoryData[appId];
      if (typeof currentSummary !== 'string') {
        return { success: false, error: '找不到该申请记录' };
      }

      // 替换状态为已批准
      let newSummary = currentSummary;
      // 匹配各种状态格式并替换
      const statusPatterns = [/状态：[^|]+$/, /状态：[^|]+\|/];

      let replaced = false;
      for (const pattern of statusPatterns) {
        if (pattern.test(newSummary)) {
          newSummary = newSummary.replace(pattern, match => {
            if (match.endsWith('|')) {
              return '状态：已批准（快速通过）|';
            }
            return '状态：已批准（快速通过）';
          });
          replaced = true;
          break;
        }
      }

      if (!replaced) {
        // 如果没有找到状态字段，在末尾添加
        newSummary = newSummary + ' | 状态：已批准（快速通过）';
      }

      // 写入变量系统
      const fullPath = `${APPLICATIONS_PATH}.${categoryKey}.${appId}`;
      await mvuStore.setVariable(fullPath, newSummary, `快速通过申请 ${appId}`);

      console.log('[FormStore] 快速通过申请成功:', appId);

      // 递增版本号以触发更新
      dataVersion.value++;

      return { success: true };
    } catch (err) {
      console.error('[FormStore] 快速通过申请失败:', err);
      return { success: false, error: err instanceof Error ? err.message : '操作失败' };
    }
  };

  /** 批量快速通过所有待审批的申请 */
  const quickApproveAllPending = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    const pendingRecords = getCurrentFormApplications.value.filter(
      r => r.status.includes('待') || r.status.includes('审批中'),
    );

    if (pendingRecords.length === 0) {
      return { success: true, count: 0 };
    }

    let successCount = 0;
    for (const record of pendingRecords) {
      const result = await quickApproveApplication(record.appId);
      if (result.success) {
        successCount++;
      }
    }

    return { success: true, count: successCount };
  };

  /** 删除单个申请记录 */
  const deleteApplication = async (appId: string, category?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 如果没有提供 category，从当前表单的 targetPath 获取
      let categoryKey = category;
      if (!categoryKey) {
        const meta = currentFormMeta.value;
        if (!meta?.targetPath) {
          return { success: false, error: '无法确定申请类别' };
        }
        const pathParts = meta.targetPath.split('.');
        categoryKey = pathParts[pathParts.length - 1];
      }

      // 检查申请记录是否存在
      const categoryData = applicationsContainer.value[categoryKey] as Record<string, unknown> | undefined;
      if (!categoryData || typeof categoryData[appId] !== 'string') {
        return { success: false, error: '找不到该申请记录' };
      }

      // 通过获取整个类别数据，删除该键，然后重新设置来实现删除
      const newCategoryData = { ...categoryData };
      delete newCategoryData[appId];

      // 重新设置整个类别数据
      const categoryPath = `${APPLICATIONS_PATH}.${categoryKey}`;
      await mvuStore.setVariable(categoryPath, newCategoryData, `删除申请记录 ${appId}`);

      console.log('[FormStore] 删除申请记录成功:', appId);

      // 递增版本号以触发更新
      dataVersion.value++;

      return { success: true };
    } catch (err) {
      console.error('[FormStore] 删除申请记录失败:', err);
      return { success: false, error: err instanceof Error ? err.message : '删除失败' };
    }
  };

  /** 批量删除所有申请记录 */
  const deleteAllApplications = async (): Promise<{ success: boolean; count: number; error?: string }> => {
    const records = getCurrentFormApplications.value;

    if (records.length === 0) {
      return { success: true, count: 0 };
    }

    let successCount = 0;
    for (const record of records) {
      const result = await deleteApplication(record.appId);
      if (result.success) {
        successCount++;
      }
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
