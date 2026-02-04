/**
 * MClite v4 - 花名册类型定义
 * 适配简化变量结构：
 * - $schema 内联在花名册中，fields 为扁平 key→label 映射
 * - 条目在 entries 子对象下
 * - 不再引用规章制度中的 Schema
 */

// ========== Schema ==========

/** 简化版 Schema - fields 为 key→label 的扁平映射 */
export interface RosterSchema {
  primaryKey: string;
  displayField: string;
  groupByField: string;
  fields: Record<string, string>; // fieldKey → label（如 { "id": "员工编号", "name": "姓名" }）
}

// ========== 条目 ==========

export type RosterEntry = Record<string, unknown>;

// ========== 花名册结构 ==========

export interface RosterMeta {
  extensible: boolean;
}

/** 简化版花名册结构 */
export interface Roster {
  $meta?: RosterMeta;
  $schema?: RosterSchema;
  entries?: {
    $meta?: RosterMeta;
    [entryId: string]: RosterEntry | RosterMeta | undefined;
  };
}

// ========== 常量 ==========

export const ROSTER_PATH = 'MC.花名册';
export const DOCUMENTS_PATH = 'MC.文档';

export const DEFAULT_ROSTER: Roster = {
  $meta: { extensible: true },
};

export const DEFAULT_SCHEMA: RosterSchema = {
  primaryKey: 'id',
  displayField: 'name',
  groupByField: '',
  fields: {},
};

// ========== 辅助函数 ==========

export function isSpecialKey(key: string): boolean {
  return key.startsWith('$');
}

export function filterNonMetaKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter(k => !isSpecialKey(k));
}

/**
 * 从花名册中提取所有条目
 */
export function extractEntries(roster: Roster): Record<string, RosterEntry> {
  const entries: Record<string, RosterEntry> = {};
  const entriesObj = roster.entries;
  if (!entriesObj || typeof entriesObj !== 'object') return entries;

  for (const key of Object.keys(entriesObj)) {
    if (isSpecialKey(key)) continue;
    const value = entriesObj[key];
    if (value && typeof value === 'object' && !('extensible' in value)) {
      entries[key] = value as RosterEntry;
    }
  }
  return entries;
}

/**
 * 获取 Schema 的字段列表（按 key 排列）
 * 返回 { id, label } 数组
 */
export function getSchemaFields(schema: RosterSchema): Array<{ id: string; label: string }> {
  return Object.entries(schema.fields).map(([id, label]) => ({ id, label }));
}

/**
 * 检测是否为有效的花名册
 */
export function isValidRoster(data: unknown): data is Roster {
  if (!data || typeof data !== 'object') return false;
  // 简化版花名册只需要是对象即可
  return true;
}
