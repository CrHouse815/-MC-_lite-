/**
 * MClite v2 - 文档 Store
 * 支持多文档管理，兼容旧版单文档结构
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  DocumentEntry,
  DocumentsContainer,
  DocumentsMeta,
  Section,
  SectionsContainer,
  SectionsMeta,
} from '../types/document';
import {
  convertLegacyToMultiDoc,
  DEFAULT_DOCUMENT_ENTRY,
  DEFAULT_DOCUMENTS,
  DOCUMENTS_PATH,
  flattenSections,
  getDocumentsSorted,
  getSectionsSorted,
  isLegacySingleDocument,
} from '../types/document';
import { useMvuStore } from './mvuStore';

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
   * 当 MVU 数据更新时递增此值，从而让依赖它的计算属性重新计算
   */
  const dataVersion = ref(0);

  /** 取消监听函数的引用 */
  let unsubscribeUpdateEnd: (() => void) | null = null;

  // ========== 计算属性 ==========

  /** 完整文档容器（支持多文档） */
  const documentsContainer = computed<DocumentsContainer>(() => {
    // 依赖 dataVersion，当版本号变化时触发重新计算
    // 这是一个技巧：通过读取 dataVersion.value 来建立响应式依赖
    const _version = dataVersion.value;

    const rawData = mvuStore.getVariable(DOCUMENTS_PATH, DEFAULT_DOCUMENTS);

    // 调试日志：帮助确认数据读取情况
    console.log('[DocumentStore] 读取 MC.文档 变量 (version=' + _version + '):', {
      path: DOCUMENTS_PATH,
      rawDataType: typeof rawData,
      rawDataKeys: rawData && typeof rawData === 'object' ? Object.keys(rawData) : [],
      hasData: rawData !== null && rawData !== undefined,
    });

    // 兼容旧版单文档结构
    if (isLegacySingleDocument(rawData)) {
      console.log('[DocumentStore] 检测到旧版单文档结构，进行转换');
      return convertLegacyToMultiDoc(rawData);
    }

    return rawData as DocumentsContainer;
  });

  /** 所有文档列表（排序后） */
  const documentList = computed(() => getDocumentsSorted(documentsContainer.value));

  /** 文档数量 */
  const documentCount = computed(() => documentList.value.length);

  /** 是否没有任何文档 */
  const hasNoDocuments = computed(() => documentCount.value === 0);

  /** 当前有效的文档ID（处理自动选择逻辑） */
  const effectiveDocId = computed<string | null>(() => {
    // 显式依赖 currentDocId.value，确保响应式更新
    const selectedId = currentDocId.value;
    console.log('[DocumentStore] effectiveDocId 计算被触发, currentDocId:', selectedId);

    // 如果已选择文档，直接返回（简化逻辑，不再检查文档是否存在）
    // 这样可以确保响应式更新正常工作
    if (selectedId) {
      console.log('[DocumentStore] effectiveDocId 计算: 使用选中的文档', selectedId);
      return selectedId;
    }

    // 否则使用第一个文档
    const list = documentList.value;
    if (list.length > 0) {
      console.log('[DocumentStore] effectiveDocId 计算: 使用默认文档', list[0].id);
      return list[0].id;
    }
    return null;
  });

  /** 当前选中的文档 */
  const currentDocument = computed<DocumentEntry | null>(() => {
    // 显式依赖 effectiveDocId.value
    const docId = effectiveDocId.value;
    console.log('[DocumentStore] currentDocument 计算, docId:', docId);

    if (!docId) {
      return null;
    }

    const container = documentsContainer.value;
    const doc = container[docId];
    if (doc && typeof doc === 'object' && 'title' in doc) {
      console.log('[DocumentStore] currentDocument 找到文档:', (doc as DocumentEntry).title);
      return doc as DocumentEntry;
    }
    console.log('[DocumentStore] currentDocument 未找到文档');
    return null;
  });

  /** 当前文档标题 */
  const title = computed(() => currentDocument.value?.title || '');

  /** 当前文档描述 */
  const description = computed(() => currentDocument.value?.description || '');

  /** 当前文档的顶级节点 */
  const sections = computed(() => currentDocument.value?.sections || { $meta: { extensible: true } });

  /** 当前文档顶级节点（排序后） */
  const sectionsSorted = computed(() => getSectionsSorted(sections.value));

  /** 当前文档节点总数 */
  const sectionCount = computed(() => flattenSections(sections.value).length);

  /** 当前文档是否为空 */
  const isEmpty = computed(() => sectionCount.value === 0);

  /** 当前文档扁平化的所有节点（带深度） */
  const flatSections = computed(() => flattenSections(sections.value));

  // ========== Actions ==========

  const initialize = async () => {
    if (isInitialized.value) return;
    try {
      isLoading.value = true;
      if (!mvuStore.isMvuAvailable) await mvuStore.initialize();

      // 注册 MVU 更新结束事件监听
      // 当后台变量更新时，递增 dataVersion 以触发计算属性重新计算
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
    // 手动刷新时也递增版本号
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
    console.log('[DocumentStore] 当前 currentDocId:', currentDocId.value);
    console.log('[DocumentStore] documentsContainer keys:', Object.keys(documentsContainer.value));

    // 检查文档是否存在（排除 $meta）
    const doc = documentsContainer.value[docId];
    console.log('[DocumentStore] 查找到的文档:', doc ? '存在' : '不存在', doc);

    if (doc && typeof doc === 'object' && 'title' in doc) {
      console.log('[DocumentStore] 切换到文档:', docId, '当前文档ID:', currentDocId.value);

      // 确保更新触发响应式
      if (currentDocId.value !== docId) {
        currentDocId.value = docId;
        console.log('[DocumentStore] 文档切换完成，新的文档ID:', currentDocId.value);
        console.log('[DocumentStore] effectiveDocId 应该更新为:', effectiveDocId.value);
        console.log('[DocumentStore] currentDocument title:', currentDocument.value?.title);
      } else {
        console.log('[DocumentStore] 文档ID未变化，跳过更新');
      }
    } else {
      console.warn('[DocumentStore] 尝试选择不存在的文档:', docId, '可用文档:', Object.keys(documentsContainer.value));
      console.warn('[DocumentStore] doc 内容:', JSON.stringify(doc));
    }
  };

  /** 获取实际的当前文档ID（处理自动选择逻辑） - 使用响应式计算属性版本 */
  const getEffectiveDocId = (): string | null => {
    return effectiveDocId.value;
  };

  // ========== 节点操作 ==========

  const getSection = (sectionId: string): Section | undefined => {
    const section = sections.value[sectionId];
    return section && typeof section === 'object' && 'title' in section ? (section as Section) : undefined;
  };

  const getSectionChildren = (section: Section): Array<{ id: string } & Section> => {
    if (!section.children) return [];
    return getSectionsSorted(section.children);
  };

  const addSection = async (sectionId: string, section: Section, parentPath?: string) => {
    const docId = getEffectiveDocId();
    if (!docId) return false;

    const path = parentPath
      ? `${DOCUMENTS_PATH}.${docId}.sections.${parentPath}.children.${sectionId}`
      : `${DOCUMENTS_PATH}.${docId}.sections.${sectionId}`;
    return await mvuStore.setVariable(path, section, '添加节点');
  };

  const updateSection = async (sectionId: string, updates: Partial<Section>, parentPath?: string) => {
    const current = getSection(sectionId);
    if (!current) return false;

    const docId = getEffectiveDocId();
    if (!docId) return false;

    const path = parentPath
      ? `${DOCUMENTS_PATH}.${docId}.sections.${parentPath}.children.${sectionId}`
      : `${DOCUMENTS_PATH}.${docId}.sections.${sectionId}`;
    return await mvuStore.setVariable(path, { ...current, ...updates }, '更新节点');
  };

  const removeSection = async (sectionId: string, parentPath?: string) => {
    const docId = getEffectiveDocId();
    if (!docId) return false;

    const basePath = parentPath
      ? `${DOCUMENTS_PATH}.${docId}.sections.${parentPath}.children`
      : `${DOCUMENTS_PATH}.${docId}.sections`;
    const current = mvuStore.getVariable(basePath, {}) as SectionsContainer;
    const newSections: Record<string, Section | SectionsMeta | undefined> = { ...current };
    delete newSections[sectionId];
    return await mvuStore.setVariable(basePath, newSections, '删除节点');
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
    const newDocs: Record<string, DocumentEntry | DocumentsMeta | undefined> = { ...current };
    delete newDocs[docId];

    // 如果删除的是当前选中的文档，切换到其他文档
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
    sections,
    sectionsSorted,
    sectionCount,
    isEmpty,
    flatSections,
    // Actions
    initialize,
    refresh,
    selectDocument,
    getEffectiveDocId,
    // 节点操作
    getSection,
    getSectionChildren,
    addSection,
    updateSection,
    removeSection,
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
