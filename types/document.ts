/**
 * MClite v2 - 文档类型定义
 * 递归树形结构，支持多文档管理
 */

// ========== 元数据类型 ==========

export interface SectionsMeta {
  extensible: boolean;
  template?: Partial<Section>;
}

export interface DocumentsMeta {
  extensible: boolean;
  version: '2.0';
  description?: string;
  template?: Partial<DocumentEntry>;
}

// ========== 节点 ==========

export interface Section {
  title: string;
  content: string;
  order: number;
  children?: SectionsContainer;
}

/** Sections 容器类型 - 使用交叉类型处理 $meta 和动态字段 */
export type SectionsContainer = {
  $meta?: SectionsMeta;
} & {
  [childId: string]: Section | SectionsMeta | undefined;
};

// ========== 单个文档条目 ==========

export interface DocumentEntry {
  title: string;
  description: string;
  order?: number;
  sections: SectionsContainer;
}

// ========== 文档容器（支持多文档） ==========

export interface DocumentsContainer {
  $meta: DocumentsMeta;
  [docId: string]: DocumentEntry | DocumentsMeta;
}

// ========== 兼容旧版单文档结构 ==========

export interface DocumentV2 {
  $meta: {
    extensible: true;
    version: '2.0';
    description?: string;
  };
  title: string;
  description: string;
  sections: SectionsContainer;
}

// ========== 常量 ==========

export const DOCUMENTS_PATH = 'MC.文档';

/** 默认文档容器 */
export const DEFAULT_DOCUMENTS: DocumentsContainer = {
  $meta: {
    extensible: true,
    version: '2.0',
    description: '多文档管理容器',
  },
};

/** 默认单个文档（用于创建新文档） */
export const DEFAULT_DOCUMENT_ENTRY: DocumentEntry = {
  title: '',
  description: '',
  order: 0,
  sections: { $meta: { extensible: true } },
};

// ========== 辅助函数 ==========

export function isMetaKey(key: string): boolean {
  return key === '$meta';
}

export function filterNonMetaKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter(k => !isMetaKey(k));
}

export function getSectionsSorted(sections: SectionsContainer): Array<{ id: string } & Section> {
  return filterNonMetaKeys(sections as Record<string, unknown>)
    .map(id => ({ id, ...(sections[id] as Section) }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function flattenSections(
  sections: SectionsContainer,
  depth = 0,
): Array<{ id: string; depth: number } & Section> {
  const result: Array<{ id: string; depth: number } & Section> = [];

  for (const item of getSectionsSorted(sections)) {
    result.push({ ...item, depth });
    if (item.children) {
      result.push(...flattenSections(item.children, depth + 1));
    }
  }

  return result;
}

/** 获取排序后的文档列表 */
export function getDocumentsSorted(docs: DocumentsContainer): Array<{ id: string } & DocumentEntry> {
  return filterNonMetaKeys(docs as unknown as Record<string, unknown>)
    .map(id => ({ id, ...(docs[id] as DocumentEntry) }))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/** 判断是否为旧版单文档结构（兼容处理） */
export function isLegacySingleDocument(data: unknown): data is DocumentV2 {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.title === 'string' && typeof obj.sections === 'object' && obj.sections !== null;
}

/** 将旧版单文档转换为多文档容器 */
export function convertLegacyToMultiDoc(legacy: DocumentV2): DocumentsContainer {
  return {
    $meta: {
      extensible: true,
      version: '2.0',
      description: '从旧版转换的文档容器',
    },
    default: {
      title: legacy.title,
      description: legacy.description,
      order: 0,
      sections: legacy.sections,
    },
  };
}
