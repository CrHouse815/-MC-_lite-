<!--
  递归树节点渲染器
  用于渲染文档的递归结构
-->
<template>
  <div class="tree-node" :class="`depth-${depth}`">
    <!-- 节点标题 -->
    <div class="node-header" @click="toggleExpand">
      <span v-if="hasChildren" class="expand-icon">{{ isExpanded ? '▼' : '▶' }}</span>
      <span v-else class="expand-placeholder"></span>
      <span class="node-title">{{ section.title }}</span>
    </div>

    <!-- 节点内容 -->
    <div v-if="section.content && (isExpanded || !hasChildren)" class="node-content">
      {{ section.content }}
    </div>

    <!-- 子节点（递归） -->
    <div v-if="hasChildren && isExpanded" class="node-children">
      <TreeNodeRenderer
        v-for="child in sortedChildren"
        :key="child.id"
        :section="child"
        :depth="depth + 1"
        :default-expanded="defaultExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Section } from '../../types/document';
import { getSectionsSorted } from '../../types/document';

const props = withDefaults(
  defineProps<{
    section: Section & { id?: string };
    depth?: number;
    defaultExpanded?: boolean;
  }>(),
  {
    depth: 0,
    defaultExpanded: true,
  },
);

const isExpanded = ref(props.defaultExpanded);

const hasChildren = computed(() => {
  if (!props.section.children) return false;
  const keys = Object.keys(props.section.children).filter(k => k !== '$meta');
  return keys.length > 0;
});

const sortedChildren = computed(() => {
  if (!props.section.children) return [];
  return getSectionsSorted(props.section.children);
});

const toggleExpand = () => {
  if (hasChildren.value) {
    isExpanded.value = !isExpanded.value;
  }
};
</script>

<style lang="scss" scoped>
.tree-node {
  margin: 8px 0;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm, 4px);

  &:hover {
    background: var(--bg-hover);
  }
}

.expand-icon,
.expand-placeholder {
  width: 16px;
  font-size: 10px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.node-title {
  font-weight: 600;
  color: var(--text-color);
}

.node-content {
  margin-top: 8px;
  padding-left: 24px;
  color: var(--text-color);
  line-height: 1.8;
  text-align: justify;
  white-space: pre-wrap;
}

.node-children {
  margin-left: 16px;
  padding-left: 8px;
  border-left: 2px solid var(--border-color);
}

// 不同深度的样式
.depth-0 .node-title {
  font-size: 20px;
  color: var(--primary-color);
}

.depth-1 .node-title {
  font-size: 17px;
  color: var(--text-color);
}

.depth-2 .node-title {
  font-size: 15px;
  color: var(--text-color);
}

.depth-3 .node-title {
  font-size: 14px;
  color: var(--text-secondary);
}

.depth-4 .node-title,
.depth-5 .node-title {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
