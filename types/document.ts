/**
 * MClite v5 - 文档类型定义
 * 适配精简变量结构（递归自相似节点设计）：
 * - 文档节点采用递归自相似结构：叶子是字符串，分支是 { _t, _s, $fieldDef } 对象
 * - 章节key本身就是标题（如 "第一章 总则"、"第一条"、"一"）
 * - 没有中间 sections 包装层，章节直接作为文档条目的key
 * - 没有 order 字段，按key的自然顺序排列
 * - $formMeta 在文档根级别
 * - $fieldDef 在分支节点中与 _t、_s 并列
 */

import type { FormMeta, SimpleFieldDef } from './form';

// ========== 元数据类型 ==========

export interface DocMeta {
  extensible: boolean;
}

// ========== 递归自相似节点 ==========

/**
 * 文档节点值：叶子是字符串，分支是 DocBranchNode 对象
 * 每个节点只有两种形态：
 * - 叶子节点: 纯字符串
 * - 分支节点: { _t?: string, _s?: DocNodeChildren, $fieldDef?: ... }
 */
export type DocNodeValue = string | DocBranchNode;

/**
 * 分支节点：包含正文(_t)和/或子节点集合(_s)
 */
export interface DocBranchNode {
  /** 正文内容 */
  _t?: string;
  /** 子节点集合（key为编号，值为 DocNodeValue） */
  _s?: DocNodeChildren;
  /** 表单字段定义（单个或数组） */
  $fieldDef?: SimpleFieldDef | SimpleFieldDef[];
}

/**
 * 子节点集合：key为编号/标题，值为递归的 DocNodeValue
 */
export interface DocNodeChildren {
  [key: string]: DocNodeValue;
}

// ========== 单个文档条目 ==========

/**
 * 文档条目：包含标题、描述、可选的表单元数据，以及直接嵌套的章节
 * 章节直接以key嵌套在文档条目中（如 "第一章 总则": {...}）
 * 没有中间的 sections 包装层
 */
export interface DocumentEntry {
  $meta?: DocMeta;
  title: string;
  description?: string;
  /** 表单元数据（如果该文档定义了表单） */
  $formMeta?: FormMeta;
  /** 章节内容：key为章节标题，值为递归节点 */
  [chapterKey: string]: DocNodeValue | DocMeta | FormMeta | string | undefined;
}

// ========== 文档容器（支持多文档） ==========

export interface DocumentsContainer {
  $meta?: DocMeta;
  [docId: string]: DocumentEntry | DocMeta | undefined;
}

// ========== 常量 ==========

export const DOCUMENTS_PATH = 'MC.文档';

/** 默认文档容器 */
export const DEFAULT_DOCUMENTS: DocumentsContainer = {
  $meta: {
    extensible: true,
  },
};

/** 默认单个文档 */
export const DEFAULT_DOCUMENT_ENTRY: DocumentEntry = {
  title: '',
  description: '',
};

// ========== 辅助函数 ==========

/** 判断key是否为特殊key（以$开头的元数据key） */
export function isSpecialKey(key: string): boolean {
  return key.startsWith('$');
}

/** 判断key是否为文档的内置属性（非章节内容） */
export function isDocumentBuiltinKey(key: string): boolean {
  return key === 'title' || key === 'description' || isSpecialKey(key);
}

/** 过滤出非特殊key */
export function filterContentKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter(k => !isDocumentBuiltinKey(k));
}

/** 判断节点值是否为叶子节点（纯字符串） */
export function isLeafNode(value: DocNodeValue): value is string {
  return typeof value === 'string';
}

/** 判断节点值是否为分支节点（对象） */
export function isBranchNode(value: DocNodeValue): value is DocBranchNode {
  return typeof value === 'object' && value !== null;
}

/**
 * 获取分支节点的子节点列表
 * 返回 [key, value] 对数组，按key的自然顺序
 */
export function getChildEntries(node: DocBranchNode): Array<[string, DocNodeValue]> {
  if (!node._s) return [];
  return Object.entries(node._s);
}

/**
 * 判断分支节点是否有子节点
 */
export function hasChildren(node: DocBranchNode): boolean {
  if (!node._s) return false;
  return Object.keys(node._s).length > 0;
}

/**
 * 获取文档条目中的章节列表（排除内置属性）
 * 返回 [key, value] 对数组
 */
export function getChapterEntries(doc: DocumentEntry): Array<[string, DocNodeValue]> {
  const entries: Array<[string, DocNodeValue]> = [];
  for (const key of Object.keys(doc)) {
    if (isDocumentBuiltinKey(key)) continue;
    const value = doc[key];
    if (typeof value === 'string' || (typeof value === 'object' && value !== null && !('extensible' in value) && !('formName' in value))) {
      entries.push([key, value as DocNodeValue]);
    }
  }
  return entries;
}

/**
 * 递归统计文档中所有节点的数量
 */
export function countNodes(entries: Array<[string, DocNodeValue]>): number {
  let count = 0;
  for (const [, value] of entries) {
    count++;
    if (isBranchNode(value) && value._s) {
      count += countNodes(Object.entries(value._s));
    }
  }
  return count;
}

/** 获取排序后的文档列表 */
export function getDocumentsSorted(docs: DocumentsContainer): Array<{ id: string } & DocumentEntry> {
  return Object.keys(docs)
    .filter(k => !isSpecialKey(k))
    .map(id => {
      const doc = docs[id] as DocumentEntry;
      return { id, ...doc };
    })
    .filter(d => typeof d.title === 'string');
}

/** 判断是否为旧版结构（兼容处理） */
export function isLegacyStructure(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  // 旧版有 sections 属性，新版没有
  // 旧版的文档条目中有 sections 对象
  for (const key of Object.keys(obj)) {
    if (key === '$meta') continue;
    const entry = obj[key];
    if (entry && typeof entry === 'object' && 'sections' in (entry as Record<string, unknown>)) {
      return true;
    }
  }
  return false;
}

/** 判断是否为旧版单文档结构（兼容处理） */
export function isLegacySingleDocument(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.title === 'string' && typeof obj.sections === 'object' && obj.sections !== null && !obj.$meta;
}
