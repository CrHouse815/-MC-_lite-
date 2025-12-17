/**
 * MC房子 - AI上下文过滤系统类型定义
 * 定义AI交互时的内容过滤规则和输出格式
 *
 * 适配新变量结构特性：
 * - 规章制度：总纲 + Ⅰ-Ⅳ类分类结构
 * - 人事系统：模板定义 + 组织架构 + 人员数据
 * - $meta.template：前端模板定义（需过滤）
 * - 附件/通用字段组：仅前端使用（aiVisible: false）
 */

/**
 * 模板字段定义接口
 * 用于定义数据结构的模板（仅前端使用，AI过滤时会被移除）
 */
export interface TemplateDefinition {
  $meta?: MetaTag;
  [key: string]: any;
}

/**
 * 元数据标记接口
 * 用于标记数据节点的特性
 */
export interface MetaTag {
  /** 是否可扩展 */
  extensible?: boolean;
  /** AI是否可见（默认为true，未声明时视为可见） */
  aiVisible?: boolean;
  /** 节点描述 */
  description?: string;
  /** 数据类型标记 */
  type?: 'table' | 'form' | 'flow' | 'list';
  /** 表单编码（仅form类型） */
  formCode?: string;
  /** 模板定义（仅前端使用，AI过滤时会被移除） */
  template?: TemplateDefinition;
  /** 生成时间（档案库使用） */
  生成时间?: string;
  /** 档案编号 */
  档案编号?: string;
  /** 保密等级 */
  保密等级?: string;
}

/**
 * 过滤规则配置
 */
export interface FilterRuleConfig {
  /** 是否移除$meta字段 */
  removeMeta: boolean;
  /** 是否移除aiVisible=false的节点 */
  removeHiddenNodes: boolean;
  /** 是否简化表格/表单结构 */
  simplifyStructures: boolean;
  /** 是否移除空节点 */
  removeEmptyNodes: boolean;
  /** 需要排除的字段名列表 */
  excludeFields: string[];
  /** 需要保留的字段名列表（优先级高于排除） */
  includeFields: string[];
  /** 最大深度限制（0表示不限制） */
  maxDepth: number;
  /** 数组最大长度（0表示不限制） */
  maxArrayLength: number;
}

/**
 * 预设过滤规则
 */
export type FilterPreset = 'full' | 'standard' | 'compact' | 'minimal';

/**
 * 输出格式类型
 */
export type OutputFormat = 'json' | 'markdown' | 'summary' | 'structured';

/**
 * 输出选项
 */
export interface OutputOptions {
  /** 输出格式 */
  format: OutputFormat;
  /** 是否美化输出 */
  pretty: boolean;
  /** JSON缩进空格数 */
  indent: number;
  /** 是否包含路径注释 */
  includePaths: boolean;
  /** 语言（中文/英文） */
  language: 'zh' | 'en';
}

/**
 * 上下文范围选择器
 */
export interface ContextScope {
  /** 包含的路径模式（支持通配符） */
  includePaths: string[];
  /** 排除的路径模式 */
  excludePaths: string[];
  /** 是否只包含变更的数据 */
  changedOnly: boolean;
  /** 相关性标签（用于智能过滤） */
  relevanceTags: string[];
}

/**
 * 过滤后的数据结构
 */
export interface FilteredData {
  /** 过滤后的数据 */
  data: Record<string, any>;
  /** 原始数据大小（字符数） */
  originalSize: number;
  /** 过滤后大小（字符数） */
  filteredSize: number;
  /** 压缩比 */
  compressionRatio: number;
  /** 被过滤的路径列表 */
  filteredPaths: string[];
  /** 过滤时间戳 */
  timestamp: number;
}

/**
 * 格式化输出结果
 */
export interface FormattedOutput {
  /** 格式化后的内容 */
  content: string;
  /** 输出格式 */
  format: OutputFormat;
  /** Token估算（按4字符≈1token） */
  estimatedTokens: number;
  /** 元数据 */
  metadata: {
    sourceSize: number;
    outputSize: number;
    compressionRatio: number;
    timestamp: number;
  };
}

/**
 * 表格简化配置
 */
export interface TableSimplifyConfig {
  /** 是否将表格转为描述性文本 */
  toDescription: boolean;
  /** 保留的列名 */
  keepColumns: string[];
  /** 最大行数 */
  maxRows: number;
  /** 是否使用紧凑格式 */
  compact: boolean;
}

/**
 * 表单简化配置
 */
export interface FormSimplifyConfig {
  /** 是否只保留必填字段 */
  requiredOnly: boolean;
  /** 是否移除字段类型信息 */
  removeTypeInfo: boolean;
  /** 是否移除选项列表 */
  removeOptions: boolean;
  /** 是否移除条件显示逻辑 */
  removeConditions: boolean;
}

/**
 * 智能过滤选项
 */
export interface SmartFilterOptions {
  /** 当前场景/上下文 */
  currentScene?: string;
  /** 当前话题关键词 */
  topicKeywords?: string[];
  /** 涉及的人物ID列表 */
  involvedCharacters?: string[];
  /** 涉及的制度类型 */
  involvedRegulations?: string[];
  /** 是否启用语义相关性过滤 */
  semanticRelevance?: boolean;
}

/**
 * AI上下文构建选项
 */
export interface AIContextOptions {
  /** 过滤预设 */
  preset?: FilterPreset;
  /** 自定义过滤规则（覆盖预设） */
  customRules?: Partial<FilterRuleConfig>;
  /** 输出选项 */
  output?: Partial<OutputOptions>;
  /** 上下文范围 */
  scope?: Partial<ContextScope>;
  /** 智能过滤选项 */
  smartFilter?: SmartFilterOptions;
  /** 表格简化配置 */
  tableConfig?: Partial<TableSimplifyConfig>;
  /** 表单简化配置 */
  formConfig?: Partial<FormSimplifyConfig>;
}

/**
 * 过滤统计信息
 */
export interface FilterStats {
  /** 处理的节点总数 */
  totalNodes: number;
  /** 保留的节点数 */
  keptNodes: number;
  /** 过滤的节点数 */
  filteredNodes: number;
  /** 简化的结构数 */
  simplifiedStructures: number;
  /** 处理耗时（毫秒） */
  processingTime: number;
}

/**
 * 完整的过滤结果
 */
export interface FilterResult {
  /** 过滤后的数据 */
  filtered: FilteredData;
  /** 格式化输出 */
  output: FormattedOutput;
  /** 统计信息 */
  stats: FilterStats;
}
