/**
 * MClite - 表单解析服务
 * 从规章制度中提取表单定义和花名册Schema定义
 *
 * 支持新版重构变量结构：
 * - $rosterMeta: 花名册元数据（在文档根级别）
 * - $formMeta: 表单元数据（在文档根级别）
 * - $groupDef: 分组定义（在章节级别，带 belongsTo 标识）
 * - $fieldDef: 字段定义（在条款级别，带 belongsTo 标识）
 */

import type {
  FormDefinition,
  FormFieldDef,
  FormMeta,
  ParsedDefinitions,
  RosterFieldDef,
  RosterGroupDef,
  RosterMeta,
  RosterSchemaDefinition,
} from '../types/form';

/** 节点结构（来自规章制度） */
interface SectionNode {
  title?: string;
  content?: string;
  order?: number;
  $formMeta?: FormMeta;
  $fieldDef?: FormFieldDef | FormFieldDef[] | RosterFieldDef | RosterFieldDef[];
  $groupDef?: RosterGroupDef;
  children?: Record<string, SectionNode>;
}

/** 文档结构 */
interface DocumentNode {
  title?: string;
  description?: string;
  order?: number;
  $formMeta?: FormMeta;
  $rosterMeta?: RosterMeta;
  sections?: Record<string, SectionNode>;
}

/** 文档容器 */
interface DocumentsContainer {
  $meta?: { extensible?: boolean };
  [key: string]: DocumentNode | { extensible?: boolean } | undefined;
}

/**
 * 表单解析服务
 * 遍历规章制度，收集所有 $fieldDef 和 $groupDef，按 belongsTo 分组
 */
export class FormParserService {
  /**
   * 解析文档容器，提取所有表单和花名册定义
   */
  static parseDocuments(documents: DocumentsContainer): ParsedDefinitions {
    const forms: Record<string, FormDefinition> = {};
    const rosters: Record<string, RosterSchemaDefinition> = {};

    // 收集所有字段定义，按 belongsTo 分组
    const formFields: Record<string, FormFieldDef[]> = {};
    const rosterFields: Record<string, RosterFieldDef[]> = {};
    const rosterGroups: Record<string, RosterGroupDef[]> = {};

    // 遍历所有文档
    for (const [docId, doc] of Object.entries(documents)) {
      if (docId === '$meta' || !doc || typeof doc !== 'object') continue;
      if (!('title' in doc)) continue;

      const docNode = doc as DocumentNode;

      // 处理文档根级别的表单元数据
      if (docNode.$formMeta) {
        const meta = docNode.$formMeta;
        forms[meta.formId] = {
          meta,
          fields: [],
          sourceDocId: docId,
        };
      }

      // 处理花名册元数据
      if (docNode.$rosterMeta) {
        const meta = docNode.$rosterMeta;
        rosters[meta.rosterId] = {
          meta,
          fields: [],
          groups: [],
          sourceDocId: docId,
        };
      }

      // 遍历节点收集字段定义和 section 级别的表单元数据
      if (docNode.sections) {
        this.traverseSections(docNode.sections, formFields, rosterFields, rosterGroups, forms, docId);
      }
    }

    // 将收集的字段分配到对应的表单/花名册
    for (const [belongsTo, fields] of Object.entries(formFields)) {
      if (forms[belongsTo]) {
        forms[belongsTo].fields = fields.sort((a, b) => a.formPosition - b.formPosition);
      }
    }

    for (const [belongsTo, fields] of Object.entries(rosterFields)) {
      if (rosters[belongsTo]) {
        rosters[belongsTo].fields = fields.sort((a, b) => a.order - b.order);
      } else {
        // 如果花名册还没有被创建（没有 $rosterMeta），自动创建一个
        rosters[belongsTo] = {
          meta: {
            rosterId: belongsTo,
            targetPath: `MC.${belongsTo}`,
            primaryKey: 'id',
            displayField: 'name',
          },
          fields: fields.sort((a, b) => a.order - b.order),
          groups: [],
          sourceDocId: '',
        };
      }
    }

    for (const [belongsTo, groups] of Object.entries(rosterGroups)) {
      if (rosters[belongsTo]) {
        rosters[belongsTo].groups = groups.sort((a, b) => a.order - b.order);
      }
    }

    return { forms, rosters };
  }

  /**
   * 递归遍历节点，收集字段定义和 section 级别的表单元数据
   */
  private static traverseSections(
    sections: Record<string, SectionNode>,
    formFields: Record<string, FormFieldDef[]>,
    rosterFields: Record<string, RosterFieldDef[]>,
    rosterGroups: Record<string, RosterGroupDef[]>,
    forms?: Record<string, FormDefinition>,
    docId?: string,
  ): void {
    for (const [, section] of Object.entries(sections)) {
      if (!section || typeof section !== 'object') continue;
      if ('extensible' in section) continue; // 跳过 $meta

      // 收集 section 级别的 $formMeta（支持一个文档定义多个表单）
      if (section.$formMeta && forms) {
        const meta = section.$formMeta;
        if (!forms[meta.formId]) {
          forms[meta.formId] = {
            meta,
            fields: [],
            sourceDocId: docId || '',
          };
        }
      }

      // 收集 $groupDef
      if (section.$groupDef) {
        const groupDef = section.$groupDef;
        const belongsTo = groupDef.belongsTo;
        if (!rosterGroups[belongsTo]) rosterGroups[belongsTo] = [];
        rosterGroups[belongsTo].push(groupDef);
      }

      // 收集 $fieldDef
      if (section.$fieldDef) {
        const fieldDefs = Array.isArray(section.$fieldDef) ? section.$fieldDef : [section.$fieldDef];

        for (const def of fieldDefs) {
          if (!def.belongsTo) continue;

          // 判断是表单字段还是花名册字段
          if ('formPosition' in def) {
            // 表单字段
            const formDef = def as FormFieldDef;
            if (!formFields[formDef.belongsTo]) formFields[formDef.belongsTo] = [];
            formFields[formDef.belongsTo].push(formDef);
          } else if ('order' in def) {
            // 花名册字段
            const rosterDef = def as RosterFieldDef;
            if (!rosterFields[rosterDef.belongsTo]) rosterFields[rosterDef.belongsTo] = [];
            rosterFields[rosterDef.belongsTo].push(rosterDef);
          }
        }
      }

      // 递归处理子节点
      if (section.children) {
        this.traverseSections(section.children, formFields, rosterFields, rosterGroups, forms, docId);
      }
    }
  }

  /**
   * 获取指定表单的定义
   */
  static getFormDefinition(documents: DocumentsContainer, formId: string): FormDefinition | null {
    const parsed = this.parseDocuments(documents);
    return parsed.forms[formId] || null;
  }

  /**
   * 获取所有可用的表单列表
   */
  static getAvailableForms(
    documents: DocumentsContainer,
  ): Array<{ formId: string; formName: string; description?: string }> {
    const parsed = this.parseDocuments(documents);
    return Object.values(parsed.forms).map(form => ({
      formId: form.meta.formId,
      formName: form.meta.formName,
      description: form.meta.description,
    }));
  }

  /**
   * 获取指定花名册的Schema定义
   */
  static getRosterSchemaDefinition(documents: DocumentsContainer, rosterId: string): RosterSchemaDefinition | null {
    const parsed = this.parseDocuments(documents);
    return parsed.rosters[rosterId] || null;
  }

  /**
   * 从 $schemaRef 路径获取花名册 Schema
   * @param documents 文档容器
   * @param schemaRef Schema 引用路径，如 "MC.文档.人事档案管理规定"
   */
  static getRosterSchemaFromRef(documents: DocumentsContainer, schemaRef: string): RosterSchemaDefinition | null {
    // 解析路径，提取文档 ID
    // 路径格式: MC.文档.文档名称
    const parts = schemaRef.split('.');
    if (parts.length < 3 || parts[0] !== 'MC' || parts[1] !== '文档') {
      console.warn('[FormParserService] 无效的 schemaRef 路径:', schemaRef);
      return null;
    }

    const docId = parts.slice(2).join('.');
    const doc = documents[docId];

    if (!doc || typeof doc !== 'object' || !('title' in doc)) {
      console.warn('[FormParserService] 未找到文档:', docId);
      return null;
    }

    const docNode = doc as DocumentNode;

    // 从该文档中提取 Schema
    const rosterFields: Record<string, RosterFieldDef[]> = {};
    const rosterGroups: Record<string, RosterGroupDef[]> = {};

    if (docNode.sections) {
      this.traverseSections(docNode.sections, {}, rosterFields, rosterGroups, undefined, undefined);
    }

    // 获取花名册元数据
    const meta = docNode.$rosterMeta;
    if (!meta) {
      // 如果没有 $rosterMeta，尝试从收集的字段中推断
      const rosterIds = Object.keys(rosterFields);
      if (rosterIds.length === 0) {
        console.warn('[FormParserService] 文档中没有花名册定义:', docId);
        return null;
      }

      const rosterId = rosterIds[0];
      return {
        meta: {
          rosterId,
          targetPath: `MC.${rosterId}`,
          primaryKey: 'id',
          displayField: 'name',
        },
        fields: (rosterFields[rosterId] || []).sort((a, b) => a.order - b.order),
        groups: (rosterGroups[rosterId] || []).sort((a, b) => a.order - b.order),
        sourceDocId: docId,
      };
    }

    return {
      meta,
      fields: (rosterFields[meta.rosterId] || []).sort((a, b) => a.order - b.order),
      groups: (rosterGroups[meta.rosterId] || []).sort((a, b) => a.order - b.order),
      sourceDocId: docId,
    };
  }

  /**
   * 获取所有可用的花名册列表
   */
  static getAvailableRosters(
    documents: DocumentsContainer,
  ): Array<{ rosterId: string; targetPath: string; displayField: string }> {
    const parsed = this.parseDocuments(documents);
    return Object.values(parsed.rosters).map(roster => ({
      rosterId: roster.meta.rosterId,
      targetPath: roster.meta.targetPath,
      displayField: roster.meta.displayField,
    }));
  }
}

export default FormParserService;
