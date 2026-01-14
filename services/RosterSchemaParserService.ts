/**
 * MClite - 花名册 Schema 解析服务
 * 从规章制度中提取花名册的字段和分组定义
 *
 * 新版变量结构中，花名册的 Schema 定义分布在规章制度的各个章节中：
 * - $rosterMeta: 花名册元数据（在文档根级别）
 * - $groupDef: 分组定义（在章节级别）
 * - $fieldDef: 字段定义（在条款级别）
 */

import type {
  FieldDefInDoc,
  GroupDefInDoc,
  GroupDefinition,
  ParsedRosterSchema,
  RosterMetaInDoc,
  RosterSchema,
} from '../types/roster';
import { buildFieldsContainer } from '../types/roster';

/** 节点结构（来自规章制度） */
interface SectionNode {
  title?: string;
  content?: string;
  order?: number;
  $fieldDef?: FieldDefInDoc | FieldDefInDoc[];
  $groupDef?: GroupDefInDoc;
  children?: Record<string, SectionNode>;
}

/** 文档结构 */
interface DocumentNode {
  title?: string;
  description?: string;
  order?: number;
  $rosterMeta?: RosterMetaInDoc;
  sections?: Record<string, SectionNode>;
}

/** 文档容器 */
interface DocumentsContainer {
  $meta?: { extensible?: boolean };
  [key: string]: DocumentNode | { extensible?: boolean } | undefined;
}

/**
 * 花名册 Schema 解析服务
 */
export class RosterSchemaParserService {
  /**
   * 从文档容器中解析所有花名册 Schema 定义
   */
  static parseAllRosterSchemas(documents: DocumentsContainer): Record<string, ParsedRosterSchema> {
    const schemas: Record<string, ParsedRosterSchema> = {};

    // 收集所有字段和分组定义，按 belongsTo 分组
    const fieldsByRoster: Record<string, FieldDefInDoc[]> = {};
    const groupsByRoster: Record<string, GroupDefInDoc[]> = {};
    const metaByRoster: Record<string, { meta: RosterMetaInDoc; sourceDocId: string }> = {};

    // 遍历所有文档
    for (const [docId, doc] of Object.entries(documents)) {
      if (docId === '$meta' || !doc || typeof doc !== 'object') continue;
      if (!('title' in doc)) continue;

      const docNode = doc as DocumentNode;

      // 处理花名册元数据
      if (docNode.$rosterMeta) {
        const meta = docNode.$rosterMeta;
        metaByRoster[meta.rosterId] = { meta, sourceDocId: docId };
      }

      // 遍历节点收集字段和分组定义
      if (docNode.sections) {
        this.traverseSections(docNode.sections, fieldsByRoster, groupsByRoster);
      }
    }

    // 组装完整的 Schema
    for (const [rosterId, { meta, sourceDocId }] of Object.entries(metaByRoster)) {
      schemas[rosterId] = {
        meta,
        fields: (fieldsByRoster[rosterId] || []).sort((a, b) => a.order - b.order),
        groups: (groupsByRoster[rosterId] || []).sort((a, b) => a.order - b.order),
        sourceDocId,
      };
    }

    return schemas;
  }

  /**
   * 递归遍历节点，收集字段和分组定义
   */
  private static traverseSections(
    sections: Record<string, SectionNode>,
    fieldsByRoster: Record<string, FieldDefInDoc[]>,
    groupsByRoster: Record<string, GroupDefInDoc[]>,
  ): void {
    for (const [sectionId, section] of Object.entries(sections)) {
      if (!section || typeof section !== 'object') continue;
      if (sectionId === '$meta') continue;

      // 收集 $groupDef
      if (section.$groupDef) {
        const groupDef = section.$groupDef;
        const belongsTo = groupDef.belongsTo;
        if (!groupsByRoster[belongsTo]) groupsByRoster[belongsTo] = [];
        groupsByRoster[belongsTo].push(groupDef);
      }

      // 收集 $fieldDef
      if (section.$fieldDef) {
        const fieldDefs = Array.isArray(section.$fieldDef) ? section.$fieldDef : [section.$fieldDef];

        for (const def of fieldDefs) {
          if (!def.belongsTo) continue;
          if (!fieldsByRoster[def.belongsTo]) fieldsByRoster[def.belongsTo] = [];
          fieldsByRoster[def.belongsTo].push(def);
        }
      }

      // 递归处理子节点
      if (section.children) {
        this.traverseSections(section.children, fieldsByRoster, groupsByRoster);
      }
    }
  }

  /**
   * 获取指定花名册的 Schema 定义
   */
  static getRosterSchema(documents: DocumentsContainer, rosterId: string): ParsedRosterSchema | null {
    const schemas = this.parseAllRosterSchemas(documents);
    return schemas[rosterId] || null;
  }

  /**
   * 从 $schemaRef 路径获取 Schema
   * @param documents 文档容器
   * @param schemaRef Schema 引用路径，如 "MC.文档.人事档案管理规定"
   */
  static getSchemaFromRef(documents: DocumentsContainer, schemaRef: string): ParsedRosterSchema | null {
    // 解析路径，提取文档 ID
    // 路径格式: MC.文档.文档名称
    const parts = schemaRef.split('.');
    if (parts.length < 3 || parts[0] !== 'MC' || parts[1] !== '文档') {
      console.warn('[RosterSchemaParser] 无效的 schemaRef 路径:', schemaRef);
      return null;
    }

    const docId = parts.slice(2).join('.');
    const doc = documents[docId];

    if (!doc || typeof doc !== 'object' || !('title' in doc)) {
      console.warn('[RosterSchemaParser] 未找到文档:', docId);
      return null;
    }

    const docNode = doc as DocumentNode;

    // 从该文档中提取 Schema
    if (!docNode.$rosterMeta) {
      console.warn('[RosterSchemaParser] 文档中没有 $rosterMeta:', docId);
      return null;
    }

    const meta = docNode.$rosterMeta;
    const fieldsByRoster: Record<string, FieldDefInDoc[]> = {};
    const groupsByRoster: Record<string, GroupDefInDoc[]> = {};

    if (docNode.sections) {
      this.traverseSections(docNode.sections, fieldsByRoster, groupsByRoster);
    }

    return {
      meta,
      fields: (fieldsByRoster[meta.rosterId] || []).sort((a, b) => a.order - b.order),
      groups: (groupsByRoster[meta.rosterId] || []).sort((a, b) => a.order - b.order),
      sourceDocId: docId,
    };
  }

  /**
   * 将 ParsedRosterSchema 转换为 RosterSchema（用于兼容旧版代码）
   */
  static toRosterSchema(parsed: ParsedRosterSchema): RosterSchema {
    // 构建字段容器
    const fields = buildFieldsContainer(parsed.fields);

    // 构建分组容器，并关联字段
    const groups: Record<string, GroupDefinition | { extensible: boolean }> = {
      $meta: { extensible: true },
    };

    // 按分组收集字段
    // 策略：根据字段的 order 范围来确定属于哪个分组
    const sortedGroups = [...parsed.groups].sort((a, b) => a.order - b.order);
    const sortedFields = [...parsed.fields].sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedGroups.length; i++) {
      const group = sortedGroups[i];
      const nextGroup = sortedGroups[i + 1];

      // 确定该分组的字段 order 范围
      const minOrder = group.order;
      const maxOrder = nextGroup ? nextGroup.order : Infinity;

      // 收集在该范围内的字段
      const groupFields = sortedFields.filter(f => f.order >= minOrder && f.order < maxOrder).map(f => f.fieldId);

      groups[group.groupId] = {
        label: group.label,
        order: group.order,
        collapsed: group.collapsed,
        fields: groupFields,
      };
    }

    // 如果有字段不属于任何分组，创建一个默认分组
    const allGroupedFields = new Set(
      Object.values(groups)
        .filter((g): g is GroupDefinition => 'fields' in g)
        .flatMap(g => g.fields),
    );

    const ungroupedFields = sortedFields.filter(f => !allGroupedFields.has(f.fieldId)).map(f => f.fieldId);

    if (ungroupedFields.length > 0) {
      groups['_ungrouped'] = {
        label: '其他信息',
        order: 999,
        collapsed: true,
        fields: ungroupedFields,
      };
    }

    return {
      $meta: { extensible: true },
      primaryKey: parsed.meta.primaryKey,
      displayField: parsed.meta.displayField,
      groupByField: parsed.meta.groupByField || '',
      fields,
      groups: groups as any,
    };
  }
}

export default RosterSchemaParserService;
