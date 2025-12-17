<!--
  花名册面板 v2
  Schema-Driven 自动渲染
  支持夜间模式适配 & 规整布局
-->
<template>
  <div class="roster-panel">
    <!-- 顶部头栏 -->
    <div class="panel-header">
      <div class="header-left">
        <span class="panel-icon">👥</span>
        <h2>{{ roster.$meta?.description || '花名册' }}</h2>
      </div>
      <div class="header-right">
        <span class="entry-count">{{ entryCount }} 人</span>
        <button class="close-btn" @click="$emit('close')" title="关闭">✕</button>
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
              <div class="col-name">姓名</div>
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
                    <span class="summary-value">{{ formatFieldValue(entry[field.id], field) }}</span>
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
                    <div v-for="group in groupsSorted" :key="group.id" class="detail-section">
                      <h4 class="section-title">{{ group.label }}</h4>
                      <div class="field-grid">
                        <SchemaFieldRenderer
                          v-for="field in getFieldsForGroup(group.id)"
                          :key="field.id"
                          :field="field"
                          :value="entry[field.id]"
                        />
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
import SchemaFieldRenderer from '../common/SchemaFieldRenderer.vue';
import type { FieldDefinition } from '../../types/roster';

defineEmits<{ (e: 'close'): void }>();

const rosterStore = useRosterStore();
const {
  roster,
  isEmpty,
  entryCount,
  entriesByGroup,
  groupsSorted,
  summaryFields,
  selectedEntryId,
  isLoading,
  error,
  updateVersion,
} = storeToRefs(rosterStore);

const { selectEntry, getEntryPrimaryKey, getEntryDisplayValue, getFieldsForGroup, refresh, initialize, destroy } =
  rosterStore;

/** 当前选中的分组 */
const selectedGroup = ref<string | null>(null);

// 监听 updateVersion 变化，用于调试和确保响应式更新
watch(
  updateVersion,
  newVersion => {
    console.log('[RosterPanel] updateVersion 变化:', newVersion, '当前条目数:', entryCount.value);
  },
  { immediate: false },
);

/** 当前分组的人员列表 */
const currentGroupEntries = computed(() => {
  if (!selectedGroup.value) {
    // 返回所有人员
    return Object.values(entriesByGroup.value).flat();
  }
  return entriesByGroup.value[selectedGroup.value] || [];
});

/** 选择分组 */
const selectGroup = (groupName: string) => {
  if (selectedGroup.value === groupName) {
    selectedGroup.value = null; // 取消选择
  } else {
    selectedGroup.value = groupName;
  }
};

/** 切换条目展开状态 */
const toggleEntry = (entryId: string) => {
  if (selectedEntryId.value === entryId) {
    selectEntry(null);
  } else {
    selectEntry(entryId);
  }
};

/** 获取头像字符（取姓名第一个字） */
const getAvatarChar = (entry: Record<string, unknown>): string => {
  const name = getEntryDisplayValue(entry);
  return name ? name.charAt(0) : '?';
};

/** 格式化字段值 */
const formatFieldValue = (value: unknown, field: FieldDefinition): string => {
  if (value === null || value === undefined) return '-';
  if (field.type === 'tags' && Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : '-';
  }
  return String(value);
};

onMounted(() => {
  initialize();
  // 默认选中第一个分组
  const groups = Object.keys(entriesByGroup.value);
  if (groups.length > 0) {
    selectedGroup.value = groups[0];
  }
  console.log('[RosterPanel] 面板已挂载，初始条目数:', entryCount.value);
});

onUnmounted(() => {
  // 组件卸载时不销毁 store（因为可能被其他组件使用）
  // 但可以在这里记录日志
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

    .panel-icon {
      font-size: 20px;
    }

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

// ========== 主体区域（侧栏 + 内容） ==========
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
    background: transparent;

    .category-name {
      font-size: 13px;
      color: var(--text-color);
    }

    .category-count {
      font-size: 12px;
      color: var(--text-secondary);
      background: var(--bg-secondary);
      padding: 2px 8px;
      border-radius: 10px;
    }

    &:hover {
      background: var(--bg-hover);
    }

    &.active {
      background: var(--primary-light);

      .category-name {
        color: var(--primary-color);
        font-weight: 600;
      }

      .category-count {
        background: var(--primary-color);
        color: white;
      }
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

// ========== 状态容器 ==========
.state-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  height: 100%;

  .state-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  p {
    margin: 0 0 8px 0;
    color: var(--text-secondary);
    font-size: 15px;
  }

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
    font-size: 14px;
    transition: background 0.2s;

    &:hover {
      background: var(--primary-hover);
    }
  }
}

// ========== 内容区域 ==========
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

  .group-title {
    margin: 0;
    font-size: 18px;
    color: var(--text-color);
  }

  .group-count {
    font-size: 14px;
    color: var(--text-secondary);
  }
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
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.table-body {
  max-height: calc(100vh - 320px);
  overflow-y: auto;
}

.table-row {
  border-bottom: 1px solid var(--border-color);

  &:last-child {
    border-bottom: none;
  }

  &.is-expanded {
    background: var(--bg-color);
  }
}

.row-main {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-hover);
  }
}

.col-name {
  flex: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 150px;

  .person-avatar {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--primary-light);
    color: var(--primary-color);
    border-radius: 50%;
    font-size: 14px;
    font-weight: 600;
  }

  .person-name {
    font-weight: 500;
    color: var(--text-color);
  }
}

.col-summary {
  flex: 1;
  min-width: 100px;

  .summary-value {
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.col-action {
  width: 80px;
  text-align: right;

  .expand-btn {
    font-size: 12px;
    color: var(--primary-color);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

// ========== 详情面板 ==========
.row-details {
  padding: 0 16px 16px 16px;
}

.details-content {
  background: var(--bg-tertiary);
  border-radius: 8px;
  padding: 16px;
}

.detail-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  .section-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--primary-color);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color);
  }
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px 16px;
}

// ========== 响应式适配 ==========
@media (max-width: 768px) {
  .panel-main {
    flex-direction: column;
  }

  .category-sidebar {
    width: 100%;
    min-width: auto;
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid var(--border-color);

    .sidebar-header {
      display: none;
    }

    .category-list {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      padding: 8px;
      gap: 8px;
    }

    .category-item {
      flex-shrink: 0;
      margin-bottom: 0;
    }
  }

  .table-header {
    display: none;
  }

  .row-main {
    flex-wrap: wrap;
    gap: 8px;
  }

  .col-name {
    flex: 1 1 100%;
  }

  .col-summary {
    flex: 0 0 auto;
  }

  .col-action {
    flex: 0 0 auto;
    width: auto;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
