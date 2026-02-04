/**
 * MClite v7 - 表单系统类型定义
 * 适配精简变量结构（递归自相似节点）：
 * - $formMeta 在文档根级别，无 formId（用文档 key 作为 ID）
 * - $fieldDef 嵌入在递归节点中（与 _t, _s 并列）
 * - 字段顺序由深度优先遍历顺序决定
 * - 支持 table、showWhen、conditionalRequired 等高级类型
 */

// ========== 表单元数据 ==========

/** 工作流步骤 */
export interface WorkflowStep {
  step: number;
  name: string;
  handler: string;
  canReject?: boolean;
}

/** 表单元数据（文档级别的 $formMeta） */
export interface FormMeta {
  formName: string;
  description?: string;
  targetPath: string;
  workflow?: WorkflowStep[];
  validDays?: number;
}

// ========== 字段定义 ==========

/** 表单字段选项 */
export interface FormFieldOption {
  value: string;
  label: string;
  requiresApproval?: boolean;
  requiresReason?: boolean;
}

/** 表格列定义 */
export interface TableColumn {
  columnId?: string;
  key?: string;
  label: string;
  type: string;
  width?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  defaultValue?: unknown;
}

/** 条件显示规则 */
export interface ShowWhenRule {
  field: string;
  equals?: unknown;
  in?: unknown[];
}

/** 条件必填规则 */
export interface ConditionalRequiredRule {
  when: ShowWhenRule;
  required?: boolean;
  minLength?: number;
}

/**
 * 简化版表单字段定义（来自 section 的 $fieldDef）
 * 注意：无 belongsTo、无 formPosition、fieldId 可选
 */
export interface SimpleFieldDef {
  fieldId?: string;
  label: string;
  inputType:
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'datetime'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'readonly'
    | 'table';
  required?: boolean;
  defaultValue?: unknown;
  source?: string;
  sourceType?: 'roster' | 'variable';
  sourcePath?: string;
  displayField?: string;
  multiple?: boolean;
  options?: FormFieldOption[] | string[];
  placeholder?: string;
  helpText?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  columns?: TableColumn[];
  minRows?: number;
  maxRows?: number;
  checkboxLabel?: string;
  mustBeTrue?: boolean;
  showWhen?: ShowWhenRule;
  conditionalRequired?: ConditionalRequiredRule;
}

/**
 * 解析后的表单字段（带自动生成的 fieldId 和排序位置）
 */
export interface FormFieldDef extends SimpleFieldDef {
  fieldId: string;
  formPosition: number;
}

// ========== 解析结果 ==========

/** 表单定义（从文档解析出的完整表单） */
export interface FormDefinition {
  meta: FormMeta;
  fields: FormFieldDef[];
  sourceDocId: string;
}

/** 所有表单定义的集合 */
export interface ParsedDefinitions {
  forms: Record<string, FormDefinition>;
}

// ========== 表单数据 ==========

/** 申请记录（从摘要文本解析） */
export interface ApplicationRecord {
  appId: string;
  summary: string;
  formType: string;
  applicant: string;
  date: string;
  status: string;
  details: Record<string, string>;
}

// ========== 常量 ==========

export const DOCUMENTS_PATH = 'MC.文档';
export const APPLICATIONS_PATH = 'MC.申请记录';
