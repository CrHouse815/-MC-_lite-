<!--
  递归树节点渲染器 v3
  适配精简变量结构的递归自相似节点，支持三种节点形态：
  1. 叶子节点：纯字符串，直接显示内容
  2. 分支节点（_t/_s 结构）：显示 _t 正文，递归渲染 _s 子节点
  3. 裸对象节点（无 _t/_s 的普通对象）：将对象的非特殊key直接当作子节点递归渲染
     这种情况出现在精简变量结构中，章节直接嵌套而不使用 _t/_s 包装，例如：
     "第一章 总则": { "第一节 概述": { "第一条": "..." } }
-->
<template>
  <div class="tree-node" :class="`depth-${depth}`">
    <!-- 节点标题行 -->
    <div class="node-header" @click="toggleExpand">
      <span v-if="hasChildren" class="expand-icon">{{ isExpanded ? '▼' : '▶' }}</span>
      <span v-else class="expand-placeholder"></span>
      <span class="node-title">{{ nodeKey }}</span>
      <!-- 叶子节点的内容直接跟在标题后面（如果内容不长） -->
      <span v-if="isLeaf && leafContent.length <= inlineMaxLength" class="node-inline-content">
        {{ leafContent }}
      </span>
    </div>

    <!-- 叶子节点的长内容（单独一行） -->
    <div v-if="isLeaf && leafContent.length > inlineMaxLength" class="node-content">
      {{ leafContent }}
    </div>

    <!-- 分支节点的正文 (_t) -->
    <div v-if="branchText && (isExpanded || !hasChildren)" class="node-content">
      {{ branchText }}
    </div>

    <!-- 子节点（递归渲染） -->
    <div v-if="hasChildren && isExpanded" class="node-children">
      <TreeNodeRenderer
        v-for="[childKey, childValue] in childEntries"
        :key="childKey"
        :node-key="childKey"
        :node-value="childValue"
        :depth="depth + 1"
        :default-expanded="defaultExpanded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { DocNodeValue, DocBranchNode } from '../../types/document';
import { isLeafNode, isBranchNode, isDocumentBuiltinKey } from '../../types/document';

const props = withDefaults(
  defineProps<{
    /** 节点的key（标题/编号，如 "第一章 总则"、"一"、"1"） */
    nodeKey: string;
    /** 节点的值（字符串叶子、{_t, _s} 分支、或裸对象节点） */
    nodeValue: DocNodeValue;
    /** 嵌套深度 */
    depth?: number;
    /** 默认是否展开 */
    defaultExpanded?: boolean;
  }>(),
  {
    depth: 0,
    defaultExpanded: true,
  },
);

/** 内联显示的最大字符数 */
const inlineMaxLength = 80;

const isExpanded = ref(props.defaultExpanded);

/** 是否为叶子节点（纯字符串） */
const isLeaf = computed(() => isLeafNode(props.nodeValue));

/** 叶子节点的内容文本 */
const leafContent = computed(() => {
  if (isLeafNode(props.nodeValue)) {
    return props.nodeValue;
  }
  return '';
});

/**
 * 判断是否为标准分支节点（含 _t 或 _s）
 * 标准分支节点使用 _t/_s 结构
 */
const isStandardBranch = computed(() => {
  if (!isBranchNode(props.nodeValue)) return false;
  const obj = props.nodeValue as Record<string, unknown>;
  return '_t' in obj || '_s' in obj;
});

/**
 * 判断是否为裸对象节点（无 _t/_s 的普通对象）
 * 裸对象节点是精简变量结构中章节直接嵌套的形式
 */
const isNakedObject = computed(() => {
  if (!isBranchNode(props.nodeValue)) return false;
  return !isStandardBranch.value;
});

/** 分支节点对象（仅标准分支） */
const branchNode = computed<DocBranchNode | null>(() => {
  if (isStandardBranch.value) {
    return props.nodeValue as DocBranchNode;
  }
  return null;
});

/** 分支节点的正文 (_t) */
const branchText = computed(() => {
  return branchNode.value?._t || '';
});

/** 是否有子节点（标准分支的 _s 或裸对象的非特殊key） */
const hasChildren = computed(() => {
  // 标准分支节点：检查 _s
  if (branchNode.value?._s) {
    return Object.keys(branchNode.value._s).length > 0;
  }
  // 裸对象节点：检查非特殊key
  if (isNakedObject.value) {
    const obj = props.nodeValue as Record<string, unknown>;
    return Object.keys(obj).filter(k => !isDocumentBuiltinKey(k)).length > 0;
  }
  return false;
});

/** 子节点列表 [key, value] 对 */
const childEntries = computed<Array<[string, DocNodeValue]>>(() => {
  // 标准分支节点：从 _s 取子节点
  if (branchNode.value?._s) {
    return Object.entries(branchNode.value._s);
  }
  // 裸对象节点：从对象本身取非特殊key
  if (isNakedObject.value) {
    const obj = props.nodeValue as Record<string, unknown>;
    return Object.entries(obj)
      .filter(([k]) => !isDocumentBuiltinKey(k))
      .map(([k, v]) => [k, v as DocNodeValue]);
  }
  return [];
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
  align-items: flex-start;
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
  margin-top: 4px;
}

.node-title {
  font-weight: 600;
  color: var(--text-color);
  flex-shrink: 0;
}

.node-inline-content {
  color: var(--text-color);
  font-weight: normal;
  line-height: 1.6;
}

.node-content {
  margin-top: 4px;
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
.depth-0 > .node-header > .node-title {
  font-size: 20px;
  color: var(--primary-color);
}

.depth-1 > .node-header > .node-title {
  font-size: 17px;
  color: var(--text-color);
}

.depth-2 > .node-header > .node-title {
  font-size: 15px;
  color: var(--text-color);
}

.depth-3 > .node-header > .node-title {
  font-size: 14px;
  color: var(--text-secondary);
}

.depth-4 > .node-header > .node-title,
.depth-5 > .node-header > .node-title {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
