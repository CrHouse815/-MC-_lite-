/**
 * MClite v5 - 文档 Store
 * 适配精简变量结构（递归自相似节点设计）：
 * - 文档中章节直接作为key嵌套，没有中间 sections 层
 * - 节点使用 _t/_s 递归结构
 * - 支持多文档管理
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  DocMeta,
  DocNodeValue,
  DocumentEntry,
  DocumentsContainer,
} from '../types/document';
import {
  countNodes,
  DEFAULT_DOCUMENT_ENTRY,
  DEFAULT_DOCUMENTS,
  DOCUMENTS_PATH,
  getChapterEntries,
  getDocumentsSorted,
  isLegacySingleDocument,
  isLegacyStructure,
} from '../types/document';
import { useMvuStore } from './mvuStore';

/**
 * 尝试解析可能被字符串化的文档数据
 * 当MVU框架因为JSON内包含转义引号而错误地将对象存储为字符串时使用
 */
function tryParseStringifiedValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    console.log('[DocumentStore] 成功解析字符串化的文档数据');
    return parsed;
  } catch (e) {
    try {
      const unescaped = value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      if (unescaped !== value) {
        const parsed = JSON.parse(unescaped);
        console.log('[DocumentStore] 成功解析双重转义的文档数据');
        return parsed;
      }
    } catch {
      // 忽略二次尝试的错误
    }

    console.warn('[DocumentStore] 无法解析字符串化的文档数据:', e);
    return value;
  }
}

/**
 * 修复文档容器中可能被字符串化的文档条目
 */
function fixStringifiedDocuments(container: Record<string, unknown>): Record<string, unknown> {
  const fixed: Record<string, unknown> = {};
  let hasStringifiedDocs = false;

  for (const [key, value] of Object.entries(container)) {
    if (key === '$meta') {
      fixed[key] = value;
      continue;
    }

    if (typeof value === 'string') {
      console.warn(`[DocumentStore] 检测到字符串化的文档: "${key}"，尝试修复...`);
      hasStringifiedDocs = true;
      const parsed = tryParseStringifiedValue(value);

      if (parsed && typeof parsed === 'object' && 'title' in (parsed as Record<string, unknown>)) {
        console.log(`[DocumentStore] 文档 "${key}" 修复成功`);
        fixed[key] = parsed;
      } else {
        console.error(`[DocumentStore] 文档 "${key}" 修复失败，保持原值`);
        fixed[key] = value;
      }
    } else {
      fixed[key] = value;
    }
  }

  if (hasStringifiedDocs) {
    console.log('[DocumentStore] 已完成字符串化文档的修复处理');
  }

  return fixed;
}

/**
 * 将旧版文档结构（带 sections/children/title/content/order）转换为新版递归自相似结构
 */
function convertLegacyDocumentEntry(legacy: Record<string, unknown>): DocumentEntry {
  const result: DocumentEntry = {
    title: String(legacy.title || ''),
    description: String(legacy.description || ''),
  };

  if (legacy.$meta) {
    result.$meta = legacy.$meta as DocMeta;
  }
  if (legacy.$formMeta) {
    result.$formMeta = legacy.$formMeta as DocumentEntry['$formMeta'];
  }

  // 递归转换 sections
  if (legacy.sections && typeof legacy.sections === 'object') {
    const sections = legacy.sections as Record<string, unknown>;
    for (const [key, section] of Object.entries(sections)) {
      if (key === '$meta' || key.startsWith('$')) continue;
      if (!section || typeof section !== 'object') continue;
      const s = section as Record<string, unknown>;
      result[key] = convertLegacySectionNode(s);
    }
  }

  return result;
}

/**
 * 递归转换旧版 Section 节点为新版 DocNodeValue
 */
function convertLegacySectionNode(section: Record<string, unknown>): DocNodeValue {
  const content = section.content as string | undefined;
  const children = section.children as Record<string, unknown> | undefined;
  const fieldDef = section.$fieldDef;

  // 判断是否有子节点
  const hasChildNodes = children && typeof children === 'object' &&
    Object.keys(children).filter(k => !k.startsWith('$')).length > 0;

  if (!hasChildNodes && !fieldDef) {
    // 叶子节点：只有 content，直接返回字符串
    return content || '';
  }

  // 分支节点
  const node: Record<string, unknown> = {};
  if (content) {
    node._t = content;
  }
  if (fieldDef) {
    node.$fieldDef = fieldDef;
  }
  if (hasChildNodes) {
    const childEntries: Record<string, DocNodeValue> = {};
    const sortedChildren = Object.entries(children!)
      .filter(([k]) => !k.startsWith('$'))
      .sort(([, a], [, b]) => {
        const aOrder = (a as Record<string, unknown>)?.order as number ?? 999;
        const bOrder = (b as Record<string, unknown>)?.order as number ?? 999;
        return aOrder - bOrder;
      });

    for (const [childKey, childSection] of sortedChildren) {
      if (!childSection || typeof childSection !== 'object') continue;
      childEntries[childKey] = convertLegacySectionNode(childSection as Record<string, unknown>);
    }

    if (Object.keys(childEntries).length > 0) {
      node._s = childEntries;
    }
  }

  return node as DocNodeValue;
}

/**
 * 将旧版文档容器转换为新版格式
 */
function convertLegacyContainer(container: Record<string, unknown>): DocumentsContainer {
  const result: DocumentsContainer = {
    $meta: { extensible: true },
  };

  for (const [key, value] of Object.entries(container)) {
    if (key === '$meta') {
      result.$meta = value as DocMeta;
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    if (typeof entry.title !== 'string') continue;

    result[key] = convertLegacyDocumentEntry(entry);
  }

  return result;
}

export const useDocumentStore = defineStore('document', () => {
  const mvuStore = useMvuStore();

  // ========== 状态 ==========
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /** 当前选中的文档ID */
  const currentDocId = ref<string | null>(null);

  /**
   * 数据版本号 - 用于强制触发计算属性的响应式更新
   */
  const dataVersion = ref(0);

  /** 取消监听函数的引用 */
  let unsubscribeUpdateEnd: (() => void) | null = null;

  // ========== 计算属性 ==========

  /** 完整文档容器（支持多文档） */
  const documentsContainer = computed<DocumentsContainer>(() => {
    const _version = dataVersion.value;

    const rawData = mvuStore.getVariable(DOCUMENTS_PATH, DEFAULT_DOCUMENTS);

    console.log('[DocumentStore] 读取 MC.文档 变量 (version=' + _version + '):', {
      path: DOCUMENTS_PATH,
      rawDataType: typeof rawData,
      rawDataKeys: rawData && typeof rawData === 'object' ? Object.keys(rawData) : [],
      hasData: rawData !== null && rawData !== undefined,
    });

    // 兼容旧版单文档结构
    if (isLegacySingleDocument(rawData)) {
      console.log('[DocumentStore] 检测到旧版单文档结构，进行转换');
      const converted = convertLegacyDocumentEntry(rawData as Record<string, unknown>);
      return {
        $meta: { extensible: true },
        default: converted,
      };
    }

    // 兼容旧版多文档结构（带 sections/children）
    if (rawData && typeof rawData === 'object' && isLegacyStructure(rawData)) {
      console.log('[DocumentStore] 检测到旧版多文档结构，进行转换');
      return convertLegacyContainer(rawData as Record<string, unknown>);
    }

    // 修复字符串化的文档条目
    if (rawData && typeof rawData === 'object') {
      const fixedData = fixStringifiedDocuments(rawData as Record<string, unknown>);
      return fixedData as DocumentsContainer;
    }

    return rawData as DocumentsContainer;
  });

  /** 所有文档列表（排序后） */
  const documentList = computed(() => getDocumentsSorted(documentsContainer.value));

  /** 文档数量 */
  const documentCount = computed(() => documentList.value.length);

  /** 是否没有任何文档 */
  const hasNoDocuments = computed(() => documentCount.value === 0);

  /** 当前有效的文档ID */
  const effectiveDocId = computed<string | null>(() => {
    const selectedId = currentDocId.value;
    if (selectedId) {
      return selectedId;
    }
    const list = documentList.value;
    if (list.length > 0) {
      return list[0].id;
    }
    return null;
  });

  /** 当前选中的文档 */
  const currentDocument = computed<DocumentEntry | null>(() => {
    const docId = effectiveDocId.value;
    if (!docId) return null;

    const container = documentsContainer.value;
    const doc = container[docId];
    if (doc && typeof doc === 'object' && 'title' in doc) {
      return doc as DocumentEntry;
    }
    return null;
  });

  /** 当前文档标题 */
  const title = computed(() => currentDocument.value?.title || '');

  /** 当前文档描述 */
  const description = computed(() => {
    const doc = currentDocument.value;
    if (!doc) return '';
    return (doc.description as string) || '';
  });

  /** 当前文档的章节列表（[key, value] 对数组） */
  const chapterEntries = computed(() => {
    const doc = currentDocument.value;
    if (!doc) return [];
    return getChapterEntries(doc);
  });

  /** 当前文档节点总数 */
  const nodeCount = computed(() => countNodes(chapterEntries.value));

  /** 当前文档是否为空 */
  const isEmpty = computed(() => chapterEntries.value.length === 0);

  // ========== Actions ==========

  const initialize = async () => {
    if (isInitialized.value) return;
    try {
      isLoading.value = true;
      if (!mvuStore.isMvuAvailable) await mvuStore.initialize();

      if (!unsubscribeUpdateEnd) {
        unsubscribeUpdateEnd = mvuStore.onUpdateEnd(() => {
          console.log('[DocumentStore] 收到 MVU 更新结束事件，递增 dataVersion');
          dataVersion.value++;
        });
      }

      // 自动选中第一个文档
      if (documentList.value.length > 0 && !currentDocId.value) {
        currentDocId.value = documentList.value[0].id;
      }

      isInitialized.value = true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败';
    } finally {
      isLoading.value = false;
    }
  };

  const refresh = async () => {
    await mvuStore.refresh();
    dataVersion.value++;
  };

  /** 销毁 store，清理资源 */
  const destroy = () => {
    if (unsubscribeUpdateEnd) {
      unsubscribeUpdateEnd();
      unsubscribeUpdateEnd = null;
    }
  };

  /** 选择文档 */
  const selectDocument = (docId: string) => {
    console.log('[DocumentStore] selectDocument 被调用, docId:', docId);

    let doc = documentsContainer.value[docId];

    // 如果文档是字符串类型，尝试解析
    if (typeof doc === 'string') {
      console.warn('[DocumentStore] 检测到字符串类型的文档，尝试解析...');
      const parsed = tryParseStringifiedValue(doc);
      if (parsed && typeof parsed === 'object' && 'title' in (parsed as Record<string, unknown>)) {
        doc = parsed as DocumentEntry;
      }
    }

    if (doc && typeof doc === 'object' && 'title' in doc) {
      if (currentDocId.value !== docId) {
        currentDocId.value = docId;
        console.log('[DocumentStore] 文档切换完成，新的文档ID:', currentDocId.value);
      }
    } else {
      console.warn('[DocumentStore] 尝试选择不存在的文档:', docId);
    }
  };

  /** 获取实际的当前文档ID */
  const getEffectiveDocId = (): string | null => {
    return effectiveDocId.value;
  };

  // ========== 文档元数据操作 ==========

  const updateTitle = async (newTitle: string) => {
    const docId = getEffectiveDocId();
    if (!docId) return false;
    return await mvuStore.setVariable(`${DOCUMENTS_PATH}.${docId}.title`, newTitle, '更新标题');
  };

  const updateDescription = async (newDescription: string) => {
    const docId = getEffectiveDocId();
    if (!docId) return false;
    return await mvuStore.setVariable(`${DOCUMENTS_PATH}.${docId}.description`, newDescription, '更新描述');
  };

  // ========== 多文档操作 ==========

  /** 添加新文档 */
  const addDocument = async (docId: string, doc: DocumentEntry) => {
    return await mvuStore.setVariable(`${DOCUMENTS_PATH}.${docId}`, doc, '添加文档');
  };

  /** 删除文档 */
  const removeDocument = async (docId: string) => {
    const current = mvuStore.getVariable(DOCUMENTS_PATH, {}) as DocumentsContainer;
    const newDocs: Record<string, DocumentEntry | DocMeta | undefined> = { ...current };
    delete newDocs[docId];

    if (currentDocId.value === docId) {
      const remaining = Object.keys(newDocs).filter(k => k !== '$meta');
      currentDocId.value = remaining.length > 0 ? remaining[0] : null;
    }

    return await mvuStore.setVariable(DOCUMENTS_PATH, newDocs, '删除文档');
  };

  return {
    // 状态
    isInitialized,
    isLoading,
    error,
    currentDocId,
    // 多文档计算属性
    documentsContainer,
    documentList,
    documentCount,
    hasNoDocuments,
    effectiveDocId,
    // 当前文档计算属性
    currentDocument,
    title,
    description,
    chapterEntries,
    nodeCount,
    isEmpty,
    // Actions
    initialize,
    refresh,
    selectDocument,
    getEffectiveDocId,
    // 文档元数据操作
    updateTitle,
    updateDescription,
    // 多文档操作
    addDocument,
    removeDocument,
    // 导出常量供外部使用
    DEFAULT_DOCUMENT_ENTRY,
    // 销毁方法
    destroy,
    // 数据版本号（供调试使用）
    dataVersion,
  };
});
