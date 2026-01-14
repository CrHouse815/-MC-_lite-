/**
 * MClite - 表单系统类型定义
 * 支持从规章制度中解析表单定义
 */

// ========== 表单元数据 ==========

/** 工作流步骤 */
export interface WorkflowStep {
  step: number;
  name: string;
  handler: string;
  canReject?: boolean;
}

/** 表单元数据（嵌入在规章制度中） */
export interface FormMeta {
  formId: string;
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
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
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

/** 表单字段定义（嵌入在规章制度条款中） */
export interface FormFieldDef {
  belongsTo: string;
  fieldId: string;
  label: string;
  formPosition: number;
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

// ========== 花名册Schema定义 ==========

/** 花名册元数据 */
export interface RosterMeta {
  rosterId: string;
  targetPath: string;
  primaryKey: string;
  displayField: string;
  groupByField?: string;
}

/** 花名册分组定义 */
export interface RosterGroupDef {
  belongsTo: string;
  groupId: string;
  label: string;
  order: number;
  collapsed?: boolean;
}

/** 花名册字段定义 */
export interface RosterFieldDef {
  belongsTo: string;
  fieldId: string;
  label: string;
  type: 'string' | 'number' | 'text' | 'enum' | 'tags' | 'boolean';
  description?: string;
  showInList?: boolean;
  showInSummary?: boolean;
  order: number;
  options?: string[];
  default?: unknown;
}

// ========== 解析结果 ==========

/** 表单定义（从规章制度解析出的完整表单） */
export interface FormDefinition {
  meta: FormMeta;
  fields: FormFieldDef[];
  sourceDocId: string;
}

/** 花名册Schema定义（从规章制度解析出的完整Schema） */
export interface RosterSchemaDefinition {
  meta: RosterMeta;
  fields: RosterFieldDef[];
  groups: RosterGroupDef[];
  sourceDocId: string;
}

/** 所有表单和花名册定义的集合 */
export interface ParsedDefinitions {
  forms: Record<string, FormDefinition>;
  rosters: Record<string, RosterSchemaDefinition>;
}

// ========== 表单数据 ==========

/** 表单提交数据 */
export interface FormSubmitData {
  formId: string;
  data: Record<string, unknown>;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

/** 申请记录（从摘要文本解析） */
export interface ApplicationRecord {
  /** 申请编号 */
  appId: string;
  /** 原始摘要文本 */
  summary: string;
  /** 表单类型（如"物资领用申请"） */
  formType: string;
  /** 申请人 */
  applicant: string;
  /** 申请日期 */
  date: string;
  /** 状态 */
  status: string;
  /** 其他详细字段 */
  details: Record<string, string>;
}

// ========== 常量 ==========

export const DOCUMENTS_PATH = 'MC.文档';
export const APPLICATIONS_PATH = 'MC.申请记录';
