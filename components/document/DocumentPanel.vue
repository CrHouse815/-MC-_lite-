<!--
  文档面板 v3
  适配精简变量结构的递归自相似节点：
  - 使用 chapterEntries（[key, value] 对数组）渲染文档章节
  - TreeNodeRenderer 接收 nodeKey + nodeValue props
  - 支持多文档切换 + 递归树形渲染 + 可收缩侧栏
-->
<template>
  <div class="document-panel" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
    <!-- 顶部头栏 -->
    <div class="panel-header">
      <h2>📄 文档查看</h2>
      <span class="doc-count">{{ documentCount }} 份文档</span>
      <button class="close-btn" @click="$emit('close')">✕</button>
    </div>

    <div class="panel-main">
      <!-- 左侧文档列表侧栏 -->
      <aside class="document-sidebar" :class="{ collapsed: isSidebarCollapsed }">
        <div class="sidebar-header">
          <span v-if="!isSidebarCollapsed" class="sidebar-title">文档列表</span>
          <button class="toggle-btn" :title="isSidebarCollapsed ? '展开侧栏' : '收起侧栏'" @click="toggleSidebar">
            {{ isSidebarCollapsed ? '▶' : '◀' }}
          </button>
        </div>

        <div v-if="!isSidebarCollapsed && documentCount > 0" class="document-list">
          <div
            v-for="doc in documentList"
            :key="doc.id"
            class="doc-item"
            :class="{ active: isCurrentDoc(doc.id) }"
            role="button"
            tabindex="0"
            @click.stop.prevent="handleSelectDocument(doc.id)"
            @keydown.enter="handleSelectDocument(doc.id)"
          >
            <span class="doc-icon">📖</span>
            <div class="doc-info">
              <span class="doc-title">{{ doc.title || doc.id }}</span>
              <span v-if="doc.description" class="doc-desc">{{ truncateDesc(doc.description) }}</span>
            </div>
          </div>
        </div>

        <div v-if="!isSidebarCollapsed && documentCount === 0" class="sidebar-empty">
          <span>暂无文档</span>
        </div>

        <!-- 收缩状态下的图标列表 -->
        <div v-if="isSidebarCollapsed && documentCount > 0" class="collapsed-list">
          <div
            v-for="doc in documentList"
            :key="doc.id"
            class="collapsed-item"
            :class="{ active: isCurrentDoc(doc.id) }"
            :title="doc.title || doc.id"
            role="button"
            tabindex="0"
            @click.stop.prevent="handleSelectDocument(doc.id)"
            @keydown.enter="handleSelectDocument(doc.id)"
          >
            📖
          </div>
        </div>
      </aside>

      <!-- 右侧文档内容区 -->
      <div class="panel-body">
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-state">
          <p>加载中...</p>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="refresh">重试</button>
        </div>

        <!-- 无文档状态 -->
        <div v-else-if="hasNoDocuments" class="empty-state">
          <p>📭 暂无文档</p>
          <p class="empty-hint">文档数据从 <code>MC.文档</code> 变量中读取</p>
          <p class="empty-hint">AI 会在游戏进程中自动更新文档内容</p>
        </div>

        <!-- 当前文档为空 -->
        <div v-else-if="isEmpty" class="empty-state">
          <p>📝 该文档暂无内容</p>
        </div>

        <!-- 文档内容 -->
        <div v-else class="document-content">
          <div class="current-doc-header">
            <h3 class="current-doc-title">{{ title }}</h3>
            <span class="section-count">{{ chapterCount }} 章</span>
          </div>
          <div v-if="description" class="document-description">{{ description }}</div>

          <TreeNodeRenderer
            v-for="[chapterKey, chapterValue] in chapterEntries"
            :key="chapterKey"
            :node-key="chapterKey"
            :node-value="chapterValue"
            :depth="0"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref, watch } from 'vue';
import { useDocumentStore } from '../../stores/documentStore';
import TreeNodeRenderer from '../common/TreeNodeRenderer.vue';

defineEmits<{ (e: 'close'): void }>();

const documentStore = useDocumentStore();
const {
  // 多文档相关
  documentList,
  documentCount,
  hasNoDocuments,
  currentDocId,
  // 当前文档相关
  isLoading,
  error,
} = storeToRefs(documentStore);

const { refresh, initialize, selectDocument } = documentStore;

// 直接从 store 访问计算属性，确保响应式正确工作
const effectiveDocId = computed(() => documentStore.effectiveDocId);
const title = computed(() => documentStore.title);
const description = computed(() => documentStore.description);
const isEmpty = computed(() => documentStore.isEmpty);
const chapterEntries = computed(() => documentStore.chapterEntries);
const chapterCount = computed(() => chapterEntries.value.length);

/** 侧栏收缩状态 */
const isSidebarCollapsed = ref(false);

/** 切换侧栏收缩状态 */
const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

/** 截断描述文本 */
const truncateDesc = (desc: string, maxLen = 30): string => {
  return desc.length > maxLen ? desc.slice(0, maxLen) + '...' : desc;
};

/** 判断是否为当前选中的文档 */
const isCurrentDoc = (docId: string): boolean => {
  return effectiveDocId.value === docId;
};

/** 处理文档选择 */
const handleSelectDocument = (docId: string) => {
  console.log('[DocumentPanel] 点击选择文档:', docId, '当前有效文档:', effectiveDocId.value);
  console.log('[DocumentPanel] currentDocId.value:', currentDocId.value);
  console.log(
    '[DocumentPanel] 可用文档列表:',
    documentList.value.map(d => d.id),
  );

  // 直接调用 store 的 selectDocument 方法
  selectDocument(docId);

  // 使用 nextTick 确保响应式更新后再打印
  console.log('[DocumentPanel] 选择后 currentDocId:', currentDocId.value);
  console.log('[DocumentPanel] 选择后 effectiveDocId:', effectiveDocId.value);
  console.log('[DocumentPanel] 选择后 title:', title.value);
};

// 调试用：监听响应式变化
watch(currentDocId, (newId, oldId) => {
  console.log('[DocumentPanel] currentDocId 变化:', oldId, '->', newId);
});

watch(effectiveDocId, (newId, oldId) => {
  console.log('[DocumentPanel] effectiveDocId 变化:', oldId, '->', newId);
});

watch(title, (newTitle, oldTitle) => {
  console.log('[DocumentPanel] title 变化:', oldTitle, '->', newTitle);
});

watch(
  chapterEntries,
  newEntries => {
    console.log('[DocumentPanel] chapterEntries 变化, 章节数:', newEntries.length);
  },
  { deep: true },
);

onMounted(() => {
  initialize();
});
</script>

<style lang="scss" scoped>
.document-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow: hidden;
  color: var(--text-color);
}

.panel-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);

  h2 {
    margin: 0;
    font-size: 18px;
    flex: 1;
    color: var(--text-color);
  }

  .doc-count {
    margin-right: 16px;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    padding: 4px 8px;
    color: var(--text-secondary);

    &:hover {
      color: var(--text-color);
    }
  }
}

// ========== 主体区域（侧栏 + 内容） ==========
.panel-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

// ========== 左侧文档列表侧栏 ==========
.document-sidebar {
  width: 220px;
  min-width: 220px;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  transition:
    width 0.25s ease,
    min-width 0.25s ease;

  &.collapsed {
    width: 50px;
    min-width: 50px;
  }
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);

  .sidebar-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-color);
  }

  .toggle-btn {
    background: none;
    border: none;
    font-size: 12px;
    cursor: pointer;
    padding: 4px 6px;
    color: var(--text-secondary);
    border-radius: 4px;
    transition: background 0.2s;

    &:hover {
      background: var(--bg-hover);
      color: var(--text-color);
    }
  }
}

.document-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.doc-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  .doc-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .doc-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .doc-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .doc-desc {
    font-size: 11px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    background: var(--bg-hover);
    border-color: var(--primary-color);
  }

  &.active {
    background: var(--primary-light);
    border-color: var(--primary-color);

    .doc-title {
      color: var(--primary-color);
      font-weight: 600;
    }
  }
}

.sidebar-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}

// ========== 收缩状态下的图标列表 ==========
.collapsed-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.collapsed-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s ease;

  &:hover {
    background: var(--bg-hover);
    border-color: var(--primary-color);
  }

  &.active {
    background: var(--primary-light);
    border-color: var(--primary-color);
  }
}

// ========== 右侧内容区 ==========
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-color);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  color: var(--text-secondary);
  height: 100%;

  button {
    margin-top: 16px;
    padding: 8px 16px;
    background: var(--primary-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;

    &:hover {
      background: var(--primary-hover);
    }
  }

  .empty-hint {
    font-size: 12px;
    margin-top: 8px;
    color: var(--text-disabled);

    code {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      color: var(--text-color);
    }
  }
}

.document-content {
  padding: 8px;
}

.current-doc-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--primary-color);

  .current-doc-title {
    margin: 0;
    font-size: 20px;
    color: var(--text-color);
    flex: 1;
  }

  .section-count {
    font-size: 14px;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    padding: 4px 10px;
    border-radius: 12px;
  }
}

.document-description {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  color: var(--text-secondary);
  line-height: 1.6;
  font-style: italic;
  border-left: 4px solid var(--primary-color);
}

// ========== 响应式适配 ==========
@media (max-width: 768px) {
  .panel-header {
    padding: 10px 12px;

    h2 {
      font-size: 16px;
    }

    .doc-count {
      font-size: 12px;
    }
  }

  .document-sidebar {
    width: 180px;
    min-width: 180px;

    &.collapsed {
      width: 44px;
      min-width: 44px;
    }
  }

  .sidebar-header {
    padding: 8px 10px;

    .sidebar-title {
      font-size: 12px;
    }
  }

  .doc-item {
    padding: 8px 10px;

    .doc-title {
      font-size: 12px;
    }

    .doc-desc {
      font-size: 10px;
    }
  }

  .panel-body {
    padding: 12px;
  }

  .current-doc-header {
    .current-doc-title {
      font-size: 18px;
    }

    .section-count {
      font-size: 12px;
      padding: 3px 8px;
    }
  }
}

@media (max-width: 480px) {
  // 小屏幕下默认收起侧栏
  .document-sidebar {
    width: 44px;
    min-width: 44px;

    &:not(.collapsed) {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 200px;
      min-width: 200px;
      z-index: 10;
      box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
    }
  }

  .panel-main {
    position: relative;
  }

  .collapsed-item {
    width: 32px;
    height: 32px;
    font-size: 14px;
  }
}
</style>
