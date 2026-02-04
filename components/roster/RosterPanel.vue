<!--
  花名册面板 v4
  适配简化变量结构：
  - $schema 内联，fields 为 key→label 扁平映射
  - 条目在 entries 下
  - 无分组/字段类型等复杂 Schema
-->
<template>
  <div class="roster-panel">
    <!-- 顶部头栏 -->
    <div class="panel-header">
      <div class="header-left">
        <span class="panel-icon">👥</span>
        <h2>花名册</h2>
      </div>
      <div class="header-right">
        <span class="entry-count">{{ entryCount }} 人</span>
        <button class="close-btn" title="关闭" @click="$emit('close')">✕</button>
      </div>
    </div>

    <!-- 主体区域 -->
    <div class="panel-main">
      <!-- 左侧分类导航 -->
      <aside class="category-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">分类</span>
        </div>
        <div class="category-list">
          <div
            v-for="(groupEntries, groupName) in entriesByGroup"
            :key="groupName"
            class="category-item"
            :class="{ active: selectedGroup === groupName }"
            @click="selectGroup(groupName)"
          >
            <span class="category-name">{{ groupName }}</span>
            <span class="category-count">{{ groupEntries.length }}</span>
          </div>
        </div>
      </aside>

      <!-- 右侧内容区 -->
      <div class="panel-body">
        <!-- 加载状态 -->
        <div v-if="isLoading" class="state-container loading-state">
          <div class="state-icon">⏳</div>
          <p>加载中...</p>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="state-container error-state">
          <div class="state-icon">⚠️</div>
          <p>{{ error }}</p>
          <button class="retry-btn" @click="refresh">重试</button>
        </div>

        <!-- 空状态 -->
        <div v-else-if="isEmpty" class="state-container empty-state">
          <div class="state-icon">📭</div>
          <p>暂无人员数据</p>
          <p class="empty-hint">数据从 <code>MC.花名册</code> 变量中读取</p>
        </div>

        <!-- 人员列表 -->
        <div v-else class="content-area">
          <!-- 当前分组标题 -->
          <div class="group-header">
            <h3 class="group-title">{{ selectedGroup || '全部人员' }}</h3>
            <span class="group-count">共 {{ currentGroupEntries.length }} 人</span>
          </div>

          <!-- 条目表格 -->
          <div class="entry-table">
            <!-- 表头 -->
            <div class="table-header">
              <div class="col-name">{{ displayFieldLabel }}</div>
              <div v-for="field in summaryFields" :key="field.id" class="col-summary">
                {{ field.label }}
              </div>
              <div class="col-action">操作</div>
            </div>

            <!-- 表格内容 -->
            <div class="table-body">
              <div
                v-for="entry in currentGroupEntries"
                :key="getEntryPrimaryKey(entry)"
                class="table-row"
                :class="{ 'is-expanded': selectedEntryId === getEntryPrimaryKey(entry) }"
              >
                <!-- 主行 -->
                <div class="row-main" @click="toggleEntry(getEntryPrimaryKey(entry))">
                  <div class="col-name">
                    <span class="person-avatar">{{ getAvatarChar(entry) }}</span>
                    <span class="person-name">{{ getEntryDisplayValue(entry) }}</span>
                  </div>
                  <div v-for="field in summaryFields" :key="field.id" class="col-summary">
                    <span class="summary-value">{{ formatFieldValue(entry[field.id]) }}</span>
                  </div>
                  <div class="col-action">
                    <span class="expand-btn">
                      {{ selectedEntryId === getEntryPrimaryKey(entry) ? '收起 ▲' : '详情 ▼' }}
                    </span>
                  </div>
                </div>

                <!-- 展开的详情面板 -->
                <div v-if="selectedEntryId === getEntryPrimaryKey(entry)" class="row-details">
                  <div class="details-content">
                    <div class="field-grid">
                      <div
                        v-for="field in schemaFields"
                        :key="field.id"
                        class="field-item"
                      >
                        <span class="field-label">{{ field.label }}</span>
                        <span class="field-value">{{ formatFieldValue(entry[field.id]) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRosterStore } from '../../stores/rosterStore';
import type { RosterEntry } from '../../types/roster';

defineEmits<{ (e: 'close'): void }>();

const rosterStore = useRosterStore();
const {
  isEmpty,
  entryCount,
  entriesByGroup,
  schemaFields,
  schema,
  selectedEntryId,
  isLoading,
  error,
  updateVersion,
} = storeToRefs(rosterStore);

const { selectEntry, getEntryPrimaryKey, getEntryDisplayValue, refresh, initialize } = rosterStore;

/** 当前选中的分组 */
const selectedGroup = ref<string | null>(null);

/** displayField 的 label */
const displayFieldLabel = computed(() => {
  const displayField = schema.value.displayField;
  return schema.value.fields[displayField] || '姓名';
});

/** 摘要字段：除了 primaryKey 和 displayField 外的前几个字段 */
const summaryFields = computed(() => {
  const pk = schema.value.primaryKey;
  const df = schema.value.displayField;
  return schemaFields.value
    .filter(f => f.id !== pk && f.id !== df)
    .slice(0, 3); // 最多显示 3 个摘要字段
});

watch(updateVersion, (v) => {
  console.log('[RosterPanel] updateVersion:', v, '条目数:', entryCount.value);
}, { immediate: false });

/** 当前分组的人员列表 */
const currentGroupEntries = computed(() => {
  if (!selectedGroup.value) {
    return Object.values(entriesByGroup.value).flat();
  }
  return entriesByGroup.value[selectedGroup.value] || [];
});

const selectGroup = (groupName: string) => {
  selectedGroup.value = selectedGroup.value === groupName ? null : groupName;
};

const toggleEntry = (entryId: string) => {
  selectEntry(selectedEntryId.value === entryId ? null : entryId);
};

const getAvatarChar = (entry: RosterEntry): string => {
  const name = getEntryDisplayValue(entry);
  return name ? name.charAt(0) : '?';
};

const formatFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) return '-';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-';
  return String(value);
};

onMounted(async () => {
  await initialize();
  const groups = Object.keys(entriesByGroup.value);
  if (groups.length > 0) selectedGroup.value = groups[0];
});

onUnmounted(() => {
  console.log('[RosterPanel] 面板已卸载');
});
</script>

<style lang="scss" scoped>
.roster-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
  color: var(--text-color);
}

// ========== 头部栏 ==========
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .panel-icon { font-size: 20px; }

    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color);
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .entry-count {
      font-size: 14px;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      padding: 4px 10px;
      border-radius: 12px;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 8px;
      color: var(--text-secondary);
      border-radius: 4px;
      transition: all 0.2s;

      &:hover {
        background: var(--bg-hover);
        color: var(--text-color);
      }
    }
  }
}

// ========== 主体区域 ==========
.panel-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

// ========== 左侧分类侧栏 ==========
.category-sidebar {
  width: 160px;
  min-width: 160px;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;

  .sidebar-header {
    padding: 12px;
    border-bottom: 1px solid var(--border-color);

    .sidebar-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }

  .category-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .category-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    margin-bottom: 4px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;

    .category-name { font-size: 13px; color: var(--text-color); }
    .category-count {
      font-size: 12px;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      padding: 2px 8px;
      border-radius: 10px;
    }

    &:hover { background: var(--bg-hover); }
    &.active {
      background: var(--primary-light);
      .category-name { color: var(--primary-color); font-weight: 600; }
      .category-count { background: var(--primary-color); color: white; }
    }
  }
}

// ========== 右侧内容区 ==========
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-color);
}

.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  height: 100%;

  .state-icon { font-size: 48px; margin-bottom: 16px; }
  p { margin: 0 0 8px 0; color: var(--text-secondary); font-size: 15px; }

  .empty-hint {
    font-size: 13px;
    color: var(--text-disabled);
    code {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      color: var(--text-color);
    }
  }

  .retry-btn {
    margin-top: 16px;
    padding: 8px 20px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    &:hover { background: var(--primary-hover); }
  }
}

.content-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--primary-color);

  .group-title { margin: 0; font-size: 18px; color: var(--text-color); }
  .group-count { font-size: 14px; color: var(--text-secondary); }
}

// ========== 表格样式 ==========
.entry-table {
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.table-body {
  max-height: 500px;
  overflow-y: auto;
}

.table-row {
  border-bottom: 1px solid var(--border-color);
  &:last-child { border-bottom: none; }
  &.is-expanded { background: var(--bg-tertiary); }
}

.row-main {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;
  &:hover { background: var(--bg-hover); }
}

.col-name {
  flex: 1.5;
  display: flex;
  align-items: center;
  gap: 10px;
}

.col-summary { flex: 1; font-size: 13px; color: var(--text-secondary); }
.col-action { width: 80px; text-align: right; }

.person-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--primary-light);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.person-name { font-size: 14px; font-weight: 500; color: var(--text-color); }

.expand-btn {
  font-size: 12px;
  color: var(--primary-color);
  cursor: pointer;
}

.row-details {
  padding: 16px 16px 16px 58px;
  border-top: 1px solid var(--border-color);
  background: var(--bg-color);
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;

  .field-label {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .field-value {
    font-size: 14px;
    color: var(--text-color);
    word-break: break-word;
  }
}

// ========== 响应式 ==========
@media (max-width: 768px) {
  .panel-main { flex-direction: column; }
  .category-sidebar { width: 100%; min-width: 100%; max-height: 120px; border-right: none; border-bottom: 1px solid var(--border-color); }
  .category-list { display: flex; flex-wrap: wrap; gap: 4px; }
  .field-grid { grid-template-columns: 1fr; }
}
</style>
