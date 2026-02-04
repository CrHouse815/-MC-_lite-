/**
 * MClite v4 - 花名册 Schema 解析服务（已废弃）
 * 简化版变量结构中 Schema 内联在花名册的 $schema 中，不再需要从规章制度解析。
 * 保留此文件以避免其他可能的引用报错。
 */

/** @deprecated 简化版不再需要此服务 */
export class RosterSchemaParserService {
  /** @deprecated */
  static parseAllRosterSchemas(_documents: unknown): Record<string, unknown> {
    console.warn('[RosterSchemaParserService] 已废弃：简化版 Schema 内联在花名册中');
    return {};
  }

  /** @deprecated */
  static getSchemaFromRef(_documents: unknown, _schemaRef: string): null {
    console.warn('[RosterSchemaParserService] 已废弃：简化版 Schema 内联在花名册中');
    return null;
  }

  /** @deprecated */
  static toRosterSchema(_parsed: unknown): null {
    console.warn('[RosterSchemaParserService] 已废弃：简化版 Schema 内联在花名册中');
    return null;
  }
}

export default RosterSchemaParserService;
