/**
 * MClite v7 - 表单解析服务
 * 适配精简变量结构（递归自相似节点）：
 * - $formMeta 在文档根级别（用文档 key 作为 formId）
 * - $fieldDef 嵌入在递归节点中（与 _t, _s 并列）
 * - 节点只有两种形态：叶子（字符串）或分支（{ _t, _s, $fieldDef }）
 * - 层级体系：章>节>条>款>项>目，key 为中文标题
 * - 字段顺序由文档中的出现顺序决定（深度优先遍历）
 */

import type { FormDefinition, FormFieldDef, FormMeta, ParsedDefinitions, SimpleFieldDef } from '../types/form';

/** 文档容器 */
interface DocumentsContainer {
  $meta?: { extensible?: boolean };
  [key: string]: unknown;
}

/** 用于判断是否为系统/元数据 key */
const SKIP_KEYS = new Set(['$meta', '$formMeta', '$fieldDef', 'title', 'description']);

/**
 * 表单解析服务
 */
export class FormParserService {
  /** 用于生成唯一 fieldId 的计数器 */
  private static fieldCounter = 0;

  /**
   * 解析文档容器，提取所有表单定义
   */
  static parseDocuments(documents: DocumentsContainer): ParsedDefinitions {
    const forms: Record<string, FormDefinition> = {};

    for (const [docId, doc] of Object.entries(documents)) {
      if (docId.startsWith('$') || !doc || typeof doc !== 'object') continue;

      const docObj = doc as Record<string, unknown>;

      // 只处理有 $formMeta 的文档
      if (!docObj.$formMeta) continue;

      const meta = docObj.$formMeta as FormMeta;
      const fields: FormFieldDef[] = [];
      this.fieldCounter = 0;

      // 递归遍历文档节点，收集所有 $fieldDef
      this.collectFieldsRecursive(docObj, fields);

      // 按 formPosition 排序（即出现顺序）
      fields.sort((a, b) => a.formPosition - b.formPosition);

      forms[docId] = {
        meta,
        fields,
        sourceDocId: docId,
      };
    }

    return { forms };
  }

  /**
   * 递归遍历节点树，收集所有 $fieldDef
   * 适配递归自相似节点结构：每个节点要么是字符串（叶子），
   * 要么是 { _t, _s, $fieldDef } 对象（分支）
   */
  private static collectFieldsRecursive(
    node: Record<string, unknown>,
    fields: FormFieldDef[],
  ): void {
    // 1. 先处理当前节点自身的 $fieldDef
    if (node.$fieldDef) {
      const defs = Array.isArray(node.$fieldDef)
        ? (node.$fieldDef as SimpleFieldDef[])
        : [node.$fieldDef as SimpleFieldDef];

      for (const def of defs) {
        this.fieldCounter++;
        const fieldId = def.fieldId || this.generateFieldId(def.label);

        fields.push({
          ...def,
          fieldId,
          formPosition: this.fieldCounter,
        });
      }
    }

    // 2. 如果有 _s（子节点集合），递归遍历 _s 中的子节点
    if (node._s && typeof node._s === 'object') {
      const subNodes = node._s as Record<string, unknown>;
      for (const [key, child] of Object.entries(subNodes)) {
        if (key.startsWith('$')) continue;
        if (child && typeof child === 'object' && !Array.isArray(child)) {
          this.collectFieldsRecursive(child as Record<string, unknown>, fields);
        }
        // 字符串叶子节点没有 $fieldDef，跳过
      }
    }

    // 3. 遍历文档层级key（章>节>条等），这些是直接作为对象属性的
    for (const [key, value] of Object.entries(node)) {
      // 跳过元数据和已处理的特殊字段
      if (SKIP_KEYS.has(key) || key.startsWith('$') || key === '_t' || key === '_s') continue;

      // 如果值是对象（非数组），说明是子层级，继续递归
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        this.collectFieldsRecursive(value as Record<string, unknown>, fields);
      }
      // 字符串值（叶子条款）不含 $fieldDef，跳过
    }
  }

  /**
   * 从 label 生成 fieldId
   */
  private static generateFieldId(label: string): string {
    return `field_${label.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}_${this.fieldCounter}`;
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
    return Object.entries(parsed.forms).map(([docId, form]) => ({
      formId: docId,
      formName: form.meta.formName,
      description: form.meta.description,
    }));
  }
}
