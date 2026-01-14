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
   *
   * 字段分组策略：
   * 1. 将字段按 order 值分成若干"簇"（相邻字段 order 差值 > 5 则视为不同簇）
   * 2. 将每个簇分配给 order 值最接近的分组
   */
  static toRosterSchema(parsed: ParsedRosterSchema): RosterSchema {
    // 构建字段容器
    const fields = buildFieldsContainer(parsed.fields);

    // 构建分组容器，并关联字段
    const groups: Record<string, GroupDefinition | { extensible: boolean }> = {
      $meta: { extensible: true },
    };

    const sortedGroups = [...parsed.groups].sort((a, b) => a.order - b.order);
    const sortedFields = [...parsed.fields].sort((a, b) => a.order - b.order);

    // 如果没有分组定义，将所有字段放入默认分组
    if (sortedGroups.length === 0) {
      groups['_default'] = {
        label: '基本信息',
        order: 0,
        collapsed: false,
        fields: sortedFields.map(f => f.fieldId),
      };
    } else {
      // 策略：将字段分成"簇"，然后分配给最近的分组
      // 簇的定义：相邻字段 order 差值 > 5 则视为不同簇
      const fieldClusters: Array<{ fields: FieldDefInDoc[]; avgOrder: number }> = [];
      let currentCluster: FieldDefInDoc[] = [];

      for (let i = 0; i < sortedFields.length; i++) {
        const field = sortedFields[i];
        const prevField = sortedFields[i - 1];

        if (prevField && field.order - prevField.order > 5) {
          // 开始新簇
          if (currentCluster.length > 0) {
            const avgOrder = currentCluster.reduce((sum, f) => sum + f.order, 0) / currentCluster.length;
            fieldClusters.push({ fields: [...currentCluster], avgOrder });
          }
          currentCluster = [field];
        } else {
          currentCluster.push(field);
        }
      }

      // 添加最后一个簇
      if (currentCluster.length > 0) {
        const avgOrder = currentCluster.reduce((sum, f) => sum + f.order, 0) / currentCluster.length;
        fieldClusters.push({ fields: [...currentCluster], avgOrder });
      }

      // 将每个簇分配给最近的分组
      const groupFieldsMap: Record<string, string[]> = {};
      for (const group of sortedGroups) {
        groupFieldsMap[group.groupId] = [];
      }

      for (const cluster of fieldClusters) {
        // 找到 order 值最接近的分组
        let closestGroup = sortedGroups[0];
        let minDistance = Math.abs(cluster.avgOrder - closestGroup.order);

        for (const group of sortedGroups) {
          const distance = Math.abs(cluster.avgOrder - group.order);
          if (distance < minDistance) {
            minDistance = distance;
            closestGroup = group;
          }
        }

        // 将簇中的字段添加到该分组
        groupFieldsMap[closestGroup.groupId].push(...cluster.fields.map(f => f.fieldId));
      }

      // 构建分组
      for (const group of sortedGroups) {
        groups[group.groupId] = {
          label: group.label,
          order: group.order,
          collapsed: group.collapsed,
          fields: groupFieldsMap[group.groupId],
        };
      }
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
