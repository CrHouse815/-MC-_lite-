/**
 * MClite v3 - 花名册 Store
 * 增强版：支持新版重构变量结构
 * - 条目直接在花名册下（无 entries 层）
 * - Schema 通过 $schemaRef 引用规章制度
 * - 自动响应后台 MVU 变量变化
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { RosterSchemaParserService } from '../services/RosterSchemaParserService';
import type {
  EntriesMeta,
  FieldDefinition,
  GroupDefinition,
  RosterEntry,
  RosterSchema,
  RosterV2,
  RosterV3,
} from '../types/roster';
import {
  DEFAULT_ROSTER,
  DEFAULT_ROSTER_V3,
  DOCUMENTS_PATH,
  extractEntriesFromV3,
  filterNonMetaKeys,
  getFieldsSorted,
  getGroupsSorted,
  getListFields,
  getSummaryFields,
  isRosterV2,
  isRosterV3,
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

  /**
   * 更新版本号 - 用于强制触发计算属性重新计算
   * 当 MVU 后台数据更新时递增此值
   */
  const updateVersion = ref(0);

  /** 取消 MVU 更新监听的函数 */
  let unsubscribeUpdate: (() => void) | null = null;

  // ========== 内部辅助函数 ==========

  /**
   * 获取原始花名册数据
   */
  const getRawRoster = (): unknown => {
    // 依赖 updateVersion 实现响应式更新
    const _version = updateVersion.value;
    void _version; // 避免 unused variable 警告
    return mvuStore.getVariable(ROSTER_PATH, null);
  };

  /**
   * 获取文档数据
   */
  const getDocuments = (): Record<string, unknown> => {
    const _version = updateVersion.value;
    void _version;
    return mvuStore.getVariable(DOCUMENTS_PATH, {});
  };

  /**
   * 检测当前花名册版本
   */
  const isV3Format = computed(() => {
    const raw = getRawRoster();
    return isRosterV3(raw);
  });

  // ========== 计算属性 ==========

  /** 完整花名册数据（兼容旧版） */
  const roster = computed<RosterV2>(() => {
    const raw = getRawRoster();

    // 如果是旧版格式，直接返回
    if (isRosterV2(raw)) {
      return raw;
    }

    // 如果是新版格式，转换为旧版格式以兼容现有代码
    if (isRosterV3(raw)) {
      const v3 = raw as RosterV3;
      const entries = extractEntriesFromV3(v3);

      // 获取 Schema
      let schema: RosterSchema = DEFAULT_ROSTER.$schema;

      if (v3.$schemaRef) {
        const documents = getDocuments();
        const parsedSchema = RosterSchemaParserService.getSchemaFromRef(documents as any, v3.$schemaRef);
        if (parsedSchema) {
          schema = RosterSchemaParserService.toRosterSchema(parsedSchema);
        }
      }

      return {
        $meta: { extensible: true, version: '2.0' as const },
        $schema: schema,
        entries: { $meta: { extensible: true }, ...entries },
      };
    }

    // 默认返回空花名册
    return DEFAULT_ROSTER;
  });

  /** 新版花名册数据（直接访问） */
  const rosterV3 = computed<RosterV3>(() => {
    const raw = getRawRoster();
    if (isRosterV3(raw)) {
      return raw as RosterV3;
    }
    return DEFAULT_ROSTER_V3;
  });

  /** Schema */
  const schema = computed<RosterSchema>(() => roster.value.$schema);

  /** 所有条目 */
  const entries = computed<Record<string, RosterEntry>>(() => {
    const raw = getRawRoster();

    // 新版格式：条目直接在花名册下
    if (isRosterV3(raw)) {
      return extractEntriesFromV3(raw as RosterV3);
    }

    // 旧版格式：条目在 entries 下
    if (isRosterV2(raw)) {
      const e = (raw as RosterV2).entries || {};
      const result: Record<string, RosterEntry> = {};
      for (const key of filterNonMetaKeys(e as Record<string, unknown>)) {
        const entry = e[key];
        if (entry && typeof entry === 'object' && !('extensible' in entry)) {
          result[key] = entry as RosterEntry;
        }
      }
      return result;
    }

    return {};
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

      // 注册 MVU 更新结束事件监听
      // 当后台变量更新完成时，递增 updateVersion 触发响应式更新
      if (!unsubscribeUpdate) {
        unsubscribeUpdate = mvuStore.onUpdateEnd(() => {
          console.log('[RosterStore] 收到 MVU 更新结束事件，触发刷新');
          updateVersion.value++;
        });
      }

      isInitialized.value = true;
      console.log('[RosterStore] 初始化完成，当前格式:', isV3Format.value ? 'v3' : 'v2');
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败';
    } finally {
      isLoading.value = false;
    }
  };

  const refresh = async () => {
    await mvuStore.refresh();
    // 手动刷新时也递增版本号
    updateVersion.value++;
  };

  /**
   * 销毁 Store，清理事件监听
   */
  const destroy = () => {
    if (unsubscribeUpdate) {
      unsubscribeUpdate();
      unsubscribeUpdate = null;
    }
  };

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

  /**
   * 添加条目（自动适配新旧版本）
   */
  const addEntry = async (entryId: string, data: RosterEntry) => {
    // 新版格式：直接在花名册下添加
    if (isV3Format.value) {
      const path = `${ROSTER_PATH}.${entryId}`;
      return await mvuStore.setVariable(path, data, '添加条目');
    }
    // 旧版格式：在 entries 下添加
    const path = `${ROSTER_PATH}.entries.${entryId}`;
    return await mvuStore.setVariable(path, data, '添加条目');
  };

  /**
   * 更新条目（自动适配新旧版本）
   */
  const updateEntry = async (entryId: string, data: Partial<RosterEntry>) => {
    const current = getEntry(entryId);
    if (!current) return false;

    // 新版格式
    if (isV3Format.value) {
      const path = `${ROSTER_PATH}.${entryId}`;
      return await mvuStore.setVariable(path, { ...current, ...data }, '更新条目');
    }
    // 旧版格式
    const path = `${ROSTER_PATH}.entries.${entryId}`;
    return await mvuStore.setVariable(path, { ...current, ...data }, '更新条目');
  };

  /**
   * 删除条目（自动适配新旧版本）
   */
  const removeEntry = async (entryId: string) => {
    // 新版格式：直接删除花名册下的键
    if (isV3Format.value) {
      const currentRoster = rosterV3.value;
      const newRoster: Record<string, unknown> = {};
      for (const key of Object.keys(currentRoster)) {
        if (key !== entryId) {
          newRoster[key] = currentRoster[key];
        }
      }
      return await mvuStore.setVariable(ROSTER_PATH, newRoster, '删除条目');
    }
    // 旧版格式
    const newEntries: Record<string, RosterEntry | EntriesMeta | undefined> = { ...entries.value };
    delete newEntries[entryId];
    return await mvuStore.setVariable(`${ROSTER_PATH}.entries`, newEntries, '删除条目');
  };

  // ========== Schema 操作（仅旧版支持） ==========

  const addField = async (fieldId: string, field: FieldDefinition) => {
    if (isV3Format.value) {
      console.warn('[RosterStore] 新版格式不支持直接修改 Schema，请修改规章制度');
      return false;
    }
    const path = `${ROSTER_PATH}.$schema.fields.${fieldId}`;
    return await mvuStore.setVariable(path, field, '添加字段');
  };

  const updateSchema = async (updates: Partial<RosterSchema>) => {
    if (isV3Format.value) {
      console.warn('[RosterStore] 新版格式不支持直接修改 Schema，请修改规章制度');
      return false;
    }
    const path = `${ROSTER_PATH}.$schema`;
    return await mvuStore.setVariable(path, { ...schema.value, ...updates }, '更新 Schema');
  };

  return {
    // 状态
    isInitialized,
    isLoading,
    error,
    selectedEntryId,
    updateVersion, // 暴露更新版本号，便于外部监听
    isV3Format, // 暴露版本检测
    // 计算属性
    roster,
    rosterV3,
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
    destroy,
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
