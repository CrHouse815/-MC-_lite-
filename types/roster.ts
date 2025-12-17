/**
 * MClite v2 - 花名册类型定义
 * Schema-Driven 可扩展结构
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

// ========== 完整花名册 ==========

export interface RosterV2 {
  $meta: {
    extensible: true;
    version: '2.0';
    description?: string;
  };
  $schema: RosterSchema;
  entries: EntriesContainer;
}

// ========== 常量 ==========

export const ROSTER_PATH = 'MC.花名册';

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

// ========== 辅助函数 ==========

export function isMetaKey(key: string): boolean {
  return key === '$meta';
}

export function filterNonMetaKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter(k => !isMetaKey(k));
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
