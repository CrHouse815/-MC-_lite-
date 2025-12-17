/**
 * MClite v2 - 花名册 Store
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  EntriesMeta,
  FieldDefinition,
  GroupDefinition,
  RosterEntry,
  RosterSchema,
  RosterV2,
} from '../types/roster';
import {
  DEFAULT_ROSTER,
  filterNonMetaKeys,
  getFieldsSorted,
  getGroupsSorted,
  getListFields,
  getSummaryFields,
  ROSTER_PATH,
} from '../types/roster';
import { useMvuStore } from './mvuStore';

export const useRosterStore = defineStore('roster', () => {
  const mvuStore = useMvuStore();

  // ========== 状态 ==========
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const selectedEntryId = ref<string | null>(null);

  // ========== 计算属性 ==========

  /** 完整花名册数据 */
  const roster = computed<RosterV2>(() => {
    const data = mvuStore.getVariable(ROSTER_PATH, DEFAULT_ROSTER);
    return data as RosterV2;
  });

  /** Schema */
  const schema = computed<RosterSchema>(() => roster.value.$schema);

  /** 所有条目 */
  const entries = computed<Record<string, RosterEntry>>(() => {
    const e = roster.value.entries || {};
    const result: Record<string, RosterEntry> = {};
    for (const key of filterNonMetaKeys(e as Record<string, unknown>)) {
      const entry = e[key];
      // 排除元数据类型
      if (entry && typeof entry === 'object' && !('extensible' in entry)) {
        result[key] = entry as RosterEntry;
      }
    }
    return result;
  });

  /** 条目数组 */
  const entriesArray = computed(() => Object.values(entries.value));

  /** 条目数量 */
  const entryCount = computed(() => entriesArray.value.length);

  /** 是否为空 */
  const isEmpty = computed(() => entryCount.value === 0);

  /** 排序后的字段定义 */
  const fieldsSorted = computed(() => getFieldsSorted(schema.value));

  /** 排序后的分组定义 */
  const groupsSorted = computed(() => getGroupsSorted(schema.value));

  /** 列表显示字段 */
  const listFields = computed(() => getListFields(schema.value));

  /** 摘要显示字段 */
  const summaryFields = computed(() => getSummaryFields(schema.value));

  /** 按 groupByField 分组的条目 */
  const entriesByGroup = computed(() => {
    const groupByField = schema.value.groupByField;
    if (!groupByField) return { 全部: entriesArray.value };

    const groups: Record<string, RosterEntry[]> = {};
    for (const entry of entriesArray.value) {
      const groupValue = String(entry[groupByField] || '未分组');
      if (!groups[groupValue]) groups[groupValue] = [];
      groups[groupValue].push(entry);
    }
    return groups;
  });

  /** 分组名列表 */
  const groupNames = computed(() => Object.keys(entriesByGroup.value));

  /** 当前选中的条目 */
  const selectedEntry = computed(() => (selectedEntryId.value ? entries.value[selectedEntryId.value] : null));

  // ========== Actions ==========

  const initialize = async () => {
    if (isInitialized.value) return;
    try {
      isLoading.value = true;
      if (!mvuStore.isMvuAvailable) await mvuStore.initialize();
      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败';
    } finally {
      isLoading.value = false;
    }
  };

  const refresh = async () => await mvuStore.refresh();

  const selectEntry = (entryId: string | null) => {
    selectedEntryId.value = entryId;
  };

  // ========== 字段操作 ==========

  const getField = (fieldId: string): FieldDefinition | undefined => {
    const field = schema.value.fields[fieldId];
    return field && typeof field === 'object' && 'label' in field ? (field as FieldDefinition) : undefined;
  };

  const getGroup = (groupId: string): GroupDefinition | undefined => {
    const group = schema.value.groups[groupId];
    return group && typeof group === 'object' && 'label' in group ? (group as GroupDefinition) : undefined;
  };

  const getFieldsForGroup = (groupId: string): Array<{ id: string } & FieldDefinition> => {
    const group = getGroup(groupId);
    if (!group) return [];
    return group.fields
      .map(fieldId => {
        const field = getField(fieldId);
        return field ? { id: fieldId, ...field } : null;
      })
      .filter((f): f is { id: string } & FieldDefinition => f !== null);
  };

  // ========== 条目操作 ==========

  const getEntry = (entryId: string) => entries.value[entryId];

  const getEntryDisplayValue = (entry: RosterEntry): string => {
    const displayField = schema.value.displayField;
    return displayField ? String(entry[displayField] || '') : '';
  };

  const getEntryPrimaryKey = (entry: RosterEntry): string => {
    const primaryKey = schema.value.primaryKey;
    return primaryKey ? String(entry[primaryKey] || '') : '';
  };

  const addEntry = async (entryId: string, data: RosterEntry) => {
    const path = `${ROSTER_PATH}.entries.${entryId}`;
    return await mvuStore.setVariable(path, data, '添加条目');
  };

  const updateEntry = async (entryId: string, data: Partial<RosterEntry>) => {
    const current = getEntry(entryId);
    if (!current) return false;
    const path = `${ROSTER_PATH}.entries.${entryId}`;
    return await mvuStore.setVariable(path, { ...current, ...data }, '更新条目');
  };

  const removeEntry = async (entryId: string) => {
    const newEntries: Record<string, RosterEntry | EntriesMeta | undefined> = { ...entries.value };
    delete newEntries[entryId];
    return await mvuStore.setVariable(`${ROSTER_PATH}.entries`, newEntries, '删除条目');
  };

  // ========== Schema 操作 ==========

  const addField = async (fieldId: string, field: FieldDefinition) => {
    const path = `${ROSTER_PATH}.$schema.fields.${fieldId}`;
    return await mvuStore.setVariable(path, field, '添加字段');
  };

  const updateSchema = async (updates: Partial<RosterSchema>) => {
    const path = `${ROSTER_PATH}.$schema`;
    return await mvuStore.setVariable(path, { ...schema.value, ...updates }, '更新 Schema');
  };

  return {
    // 状态
    isInitialized,
    isLoading,
    error,
    selectedEntryId,
    // 计算属性
    roster,
    schema,
    entries,
    entriesArray,
    entryCount,
    isEmpty,
    fieldsSorted,
    groupsSorted,
    listFields,
    summaryFields,
    entriesByGroup,
    groupNames,
    selectedEntry,
    // Actions
    initialize,
    refresh,
    selectEntry,
    getField,
    getGroup,
    getFieldsForGroup,
    getEntry,
    getEntryDisplayValue,
    getEntryPrimaryKey,
    addEntry,
    updateEntry,
    removeEntry,
    addField,
    updateSchema,
  };
});
