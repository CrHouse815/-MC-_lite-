/**
 * MClite v3 - 花名册类型定义
 * 支持新版重构变量结构：
 * - 条目直接在花名册下（无 entries 层）
 * - Schema 通过 $schemaRef 引用规章制度
 * - 字段和分组定义分布在规章制度的各个章节中
 */

// ========== 字段类型 ==========

export type FieldType = 'string' | 'number' | 'text' | 'enum' | 'tags' | 'boolean';

export interface FieldDefinition {
  label: string;
  type: FieldType;
  description?: string;
  showInList?: boolean;
  showInSummary?: boolean;
  order?: number;
  options?: string[];
  default?: unknown;
}

export interface GroupDefinition {
  label: string;
  order: number;
  collapsed?: boolean;
  fields: string[];
}

// ========== Schema ==========

/** 元数据类型 */
export interface FieldsMeta {
  extensible: boolean;
  template?: Partial<FieldDefinition>;
}

export interface GroupsMeta {
  extensible: boolean;
  template?: Partial<GroupDefinition>;
}

export interface EntriesMeta {
  extensible: boolean;
}

/** Fields 容器类型 - 使用交叉类型处理 $meta 和动态字段 */
export type FieldsContainer = {
  $meta?: FieldsMeta;
} & {
  [fieldId: string]: FieldDefinition | FieldsMeta | undefined;
};

/** Groups 容器类型 */
export type GroupsContainer = {
  $meta?: GroupsMeta;
} & {
  [groupId: string]: GroupDefinition | GroupsMeta | undefined;
};

/** Entries 容器类型 */
export type EntriesContainer = {
  $meta?: EntriesMeta;
} & {
  [entryId: string]: RosterEntry | EntriesMeta | undefined;
};

export interface RosterSchema {
  $meta?: { extensible: boolean };
  primaryKey: string;
  displayField: string;
  groupByField: string;
  fields: FieldsContainer;
  groups: GroupsContainer;
}

// ========== 条目 ==========

export type RosterEntry = Record<string, unknown>;

// ========== 旧版花名册结构（v2，带 entries 层） ==========

export interface RosterV2 {
  $meta: {
    extensible: true;
    version: '2.0';
    description?: string;
  };
  $schema: RosterSchema;
  entries: EntriesContainer;
}

// ========== 新版花名册结构（v3，条目直接在花名册下） ==========

/** 新版花名册元数据 */
export interface RosterV3Meta {
  extensible: boolean;
}

/** 新版花名册结构 - 条目直接在花名册下 */
export interface RosterV3 {
  $meta?: RosterV3Meta;
  /** 引用规章制度中的 Schema 定义 */
  $schemaRef?: string;
  /** 条目直接作为花名册的属性 */
  [entryId: string]: RosterEntry | RosterV3Meta | string | undefined;
}

// ========== 规章制度中的 Schema 定义 ==========

/** 花名册元数据（嵌入在规章制度中） */
export interface RosterMetaInDoc {
  rosterId: string;
  targetPath: string;
  primaryKey: string;
  displayField: string;
  groupByField?: string;
}

/** 分组定义（嵌入在规章制度章节中） */
export interface GroupDefInDoc {
  belongsTo: string;
  groupId: string;
  label: string;
  order: number;
  collapsed?: boolean;
}

/** 字段定义（嵌入在规章制度条款中） */
export interface FieldDefInDoc {
  belongsTo: string;
  fieldId: string;
  label: string;
  type: FieldType;
  description?: string;
  showInList?: boolean;
  showInSummary?: boolean;
  order: number;
  options?: string[];
  default?: unknown;
}

/** 从规章制度解析出的完整 Schema */
export interface ParsedRosterSchema {
  meta: RosterMetaInDoc;
  fields: FieldDefInDoc[];
  groups: GroupDefInDoc[];
  sourceDocId: string;
}

// ========== 常量 ==========

export const ROSTER_PATH = 'MC.花名册';
export const DOCUMENTS_PATH = 'MC.文档';

export const DEFAULT_ROSTER: RosterV2 = {
  $meta: { extensible: true, version: '2.0' },
  $schema: {
    primaryKey: '',
    displayField: '',
    groupByField: '',
    fields: { $meta: { extensible: true } },
    groups: { $meta: { extensible: true } },
  },
  entries: { $meta: { extensible: true } },
};

/** 默认的新版花名册 */
export const DEFAULT_ROSTER_V3: RosterV3 = {
  $meta: { extensible: true },
};

// ========== 辅助函数 ==========

export function isMetaKey(key: string): boolean {
  return key === '$meta' || key === '$schemaRef';
}

export function isSpecialKey(key: string): boolean {
  return key.startsWith('$');
}

export function filterNonMetaKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter(k => !isSpecialKey(k));
}

export function getFieldsSorted(schema: RosterSchema): Array<{ id: string } & FieldDefinition> {
  return filterNonMetaKeys(schema.fields)
    .map(id => ({ id, ...(schema.fields[id] as FieldDefinition) }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function getGroupsSorted(schema: RosterSchema): Array<{ id: string } & GroupDefinition> {
  return filterNonMetaKeys(schema.groups)
    .map(id => ({ id, ...(schema.groups[id] as GroupDefinition) }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function getListFields(schema: RosterSchema): Array<{ id: string } & FieldDefinition> {
  return getFieldsSorted(schema).filter(f => f.showInList);
}

export function getSummaryFields(schema: RosterSchema): Array<{ id: string } & FieldDefinition> {
  return getFieldsSorted(schema).filter(f => f.showInSummary);
}

// ========== 新版辅助函数 ==========

/**
 * 从新版花名册中提取所有条目
 * 过滤掉 $meta、$schemaRef 等特殊键
 */
export function extractEntriesFromV3(roster: RosterV3): Record<string, RosterEntry> {
  const entries: Record<string, RosterEntry> = {};
  for (const key of Object.keys(roster)) {
    if (isSpecialKey(key)) continue;
    const value = roster[key];
    if (value && typeof value === 'object' && !('extensible' in value)) {
      entries[key] = value as RosterEntry;
    }
  }
  return entries;
}

/**
 * 从 FieldDefInDoc 数组构建 FieldsContainer
 */
export function buildFieldsContainer(fields: FieldDefInDoc[]): FieldsContainer {
  const container: FieldsContainer = { $meta: { extensible: true } };
  for (const field of fields) {
    container[field.fieldId] = {
      label: field.label,
      type: field.type,
      description: field.description,
      showInList: field.showInList,
      showInSummary: field.showInSummary,
      order: field.order,
      options: field.options,
      default: field.default,
    };
  }
  return container;
}

/**
 * 从 GroupDefInDoc 数组构建 GroupsContainer
 * 需要同时传入字段定义来确定每个分组包含哪些字段
 */
export function buildGroupsContainer(groups: GroupDefInDoc[], fields: FieldDefInDoc[]): GroupsContainer {
  const container: GroupsContainer = { $meta: { extensible: true } };

  // 按分组 ID 收集字段
  const fieldsByGroup: Record<string, string[]> = {};
  for (const field of fields) {
    // 字段没有直接的 groupId，需要根据 order 范围推断
    // 或者在解析时就建立关联
  }

  for (const group of groups) {
    // 收集属于该分组的字段（根据 order 范围）
    const groupFields = fields
      .filter(f => {
        // 简单策略：根据字段的 order 和分组的 order 关系来判断
        // 实际上需要在解析时就建立关联
        return true; // 暂时返回所有字段
      })
      .map(f => f.fieldId);

    container[group.groupId] = {
      label: group.label,
      order: group.order,
      collapsed: group.collapsed,
      fields: groupFields,
    };
  }
  return container;
}

/**
 * 从 ParsedRosterSchema 构建 RosterSchema
 */
export function buildRosterSchema(parsed: ParsedRosterSchema): RosterSchema {
  return {
    $meta: { extensible: true },
    primaryKey: parsed.meta.primaryKey,
    displayField: parsed.meta.displayField,
    groupByField: parsed.meta.groupByField || '',
    fields: buildFieldsContainer(parsed.fields),
    groups: buildGroupsContainer(parsed.groups, parsed.fields),
  };
}

/**
 * 检测花名册是新版（v3）还是旧版（v2）
 */
export function isRosterV3(roster: unknown): roster is RosterV3 {
  if (!roster || typeof roster !== 'object') return false;
  const r = roster as Record<string, unknown>;
  // 新版特征：有 $schemaRef 或没有 entries 层
  return '$schemaRef' in r || !('entries' in r && '$schema' in r);
}

/**
 * 检测花名册是旧版（v2）
 */
export function isRosterV2(roster: unknown): roster is RosterV2 {
  if (!roster || typeof roster !== 'object') return false;
  const r = roster as Record<string, unknown>;
  // 旧版特征：有 $schema 和 entries
  return '$schema' in r && 'entries' in r;
}
