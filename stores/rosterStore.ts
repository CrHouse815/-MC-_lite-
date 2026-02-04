/**
 * MClite v4 - 花名册 Store
 * 适配简化变量结构：
 * - $schema 内联在花名册中，fields 为扁平 key→label 映射
 * - 条目在 entries 子对象下
 * - 自动响应后台 MVU 变量变化
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Roster, RosterEntry, RosterSchema } from '../types/roster';
import {
  DEFAULT_ROSTER,
  DEFAULT_SCHEMA,
  extractEntries,
  getSchemaFields,
  ROSTER_PATH
} from '../types/roster';
import { useMvuStore } from './mvuStore';

export const useRosterStore = defineStore('roster', () => {
  const mvuStore = useMvuStore();

  // ========== 状态 ==========
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const selectedEntryId = ref<string | null>(null);
  const updateVersion = ref(0);

  let unsubscribeUpdate: (() => void) | null = null;

  // ========== 内部辅助 ==========

  const getRawRoster = (): unknown => {
    const _version = updateVersion.value;
    void _version;
    return mvuStore.getVariable(ROSTER_PATH, null);
  };

  // ========== 计算属性 ==========

  /** 花名册数据 */
  const roster = computed<Roster>(() => {
    const raw = getRawRoster();
    if (!raw || typeof raw !== 'object') return DEFAULT_ROSTER;
    return raw as Roster;
  });

  /** Schema */
  const schema = computed<RosterSchema>(() => {
    return roster.value.$schema || DEFAULT_SCHEMA;
  });

  /** Schema 字段列表 */
  const schemaFields = computed(() => getSchemaFields(schema.value));

  /** 所有条目 */
  const entries = computed<Record<string, RosterEntry>>(() => {
    return extractEntries(roster.value);
  });

  /** 条目数组 */
  const entriesArray = computed(() => Object.values(entries.value));

  /** 条目数量 */
  const entryCount = computed(() => entriesArray.value.length);

  /** 是否为空 */
  const isEmpty = computed(() => entryCount.value === 0);

  /** 按 groupByField 分组的条目 */
  const entriesByGroup = computed(() => {
    const groupByField = schema.value.groupByField;
    if (!groupByField) return { '全部': entriesArray.value };

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

      if (!unsubscribeUpdate) {
        unsubscribeUpdate = mvuStore.onUpdateEnd(() => {
          console.log('[RosterStore] 收到 MVU 更新结束事件，触发刷新');
          updateVersion.value++;
        });
      }

      isInitialized.value = true;
      console.log('[RosterStore] 初始化完成，当前条目数:', entryCount.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败';
    } finally {
      isLoading.value = false;
    }
  };

  const refresh = async () => {
    await mvuStore.refresh();
    updateVersion.value++;
  };

  const destroy = () => {
    if (unsubscribeUpdate) {
      unsubscribeUpdate();
      unsubscribeUpdate = null;
    }
  };

  const selectEntry = (entryId: string | null) => {
    selectedEntryId.value = entryId;
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
    const currentEntries = { ...entries.value };
    delete currentEntries[entryId];
    return await mvuStore.setVariable(`${ROSTER_PATH}.entries`, currentEntries, '删除条目');
  };

  return {
    // 状态
    isInitialized,
    isLoading,
    error,
    selectedEntryId,
    updateVersion,
    // 计算属性
    roster,
    schema,
    schemaFields,
    entries,
    entriesArray,
    entryCount,
    isEmpty,
    entriesByGroup,
    groupNames,
    selectedEntry,
    // Actions
    initialize,
    refresh,
    destroy,
    selectEntry,
    getEntry,
    getEntryDisplayValue,
    getEntryPrimaryKey,
    addEntry,
    updateEntry,
    removeEntry,
  };
});
