/**
 * MC房子 - 数据库结构类型定义
 * 基于统一变量结构.json
 * 定义国家特别事务管理局第七执行处数据库的完整结构
 */

// ============ 元数据接口（本地定义，不再从regulation导入） ============

/**
 * 元数据接口
 */
export interface MetaInfo {
  extensible?: boolean;
  description?: string;
  aiVisible?: boolean;
  template?: Record<string, any>;
}

// ============ 通用字段组定义 ============

/**
 * 表单字段定义（简化版）
 */
export interface FormField {
  键: string;
  类型: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'checkbox' | 'radio';
  必填?: boolean;
  默认值?: string;
  选项?: string[];
}

/**
 * 通用字段组
 */
export interface CommonFieldGroup {
  $meta?: MetaInfo;
  组名称: string;
  字段: FormField[];
}

/**
 * 申请人信息字段组
 */
export interface ApplicantInfoGroup extends CommonFieldGroup {
  组名称: '申请人信息';
}

/**
 * 通用字段组定义集合
 */
export interface CommonFieldGroupDefinitions {
  $meta?: MetaInfo;
  申请人信息?: ApplicantInfoGroup;
  [groupName: string]: CommonFieldGroup | MetaInfo | undefined;
}

// ============ 申请表记录 ============

/**
 * 审批记录（数据库格式，中文字段）
 */
export interface DBApprovalRecord {
  审批人: string;
  审批时间: string;
  审批意见: string;
  审批结果: '通过' | '驳回' | '退回修改' | '转交';
}

/**
 * 审批状态（数据库格式，中文字段）
 */
export interface DBApprovalStatus {
  状态: '待提交' | '审批中' | '已通过' | '已驳回' | '已撤回';
  当前环节: string;
  审批记录: DBApprovalRecord[];
}

/**
 * 申请表记录
 */
export interface ApplicationRecord {
  $meta?: MetaInfo;
  编号: string;
  来源制度: string;
  表单类型: string;
  申请人信息: {
    $meta?: MetaInfo;
    姓名?: string;
    工号?: string;
    所属科室?: string;
    职级?: string;
    联系方式?: string;
    申请日期?: string;
    [key: string]: any;
  };
  表单数据: Record<string, any>;
  审批状态: DBApprovalStatus;
  备注: string;
  [key: string]: any;
}

/**
 * 申请表记录集合
 */
export interface ApplicationRecords {
  $meta?: MetaInfo;
  [applicationId: string]: ApplicationRecord | MetaInfo | undefined;
}

// ============ 人员名册 ============

/**
 * 人员状态
 */
export type PersonnelStatus = '在职' | '休假' | '出差' | '停职' | '离职';

/**
 * 人员信息
 */
export interface PersonnelRecord {
  工号: string;
  姓名: string;
  性别: '男' | '女';
  所属科室: string;
  职级: string;
  入职日期: string;
  联系方式: string;
  状态: PersonnelStatus;
  [key: string]: any;
}

/**
 * 人员名册集合
 */
export interface PersonnelRoster {
  $meta?: MetaInfo;
  [employeeId: string]: PersonnelRecord | MetaInfo | undefined;
}

// ============ 科室列表 ============

/**
 * 科室信息
 */
export interface DepartmentRecord {
  科室编码: string;
  科室名称: string;
  科室职责: string;
  负责人: string;
  [key: string]: any;
}

/**
 * 科室列表集合
 */
export interface DepartmentList {
  $meta?: MetaInfo;
  [deptId: string]: DepartmentRecord | MetaInfo | undefined;
}

// ============ 顶层数据库结构 ============

/**
 * 数据库元数据
 */
export interface DatabaseMeta extends MetaInfo {
  extensible: true;
  description: string;
  version: string;
}

/**
 * 国家特别事务管理局第七执行处数据库
 * 完整的顶层数据结构
 */
export interface SAMU7Database {
  /** 数据库元数据 */
  $meta?: DatabaseMeta;

  /** 员工守则 */
  员工守则?: string[];

  /** 通用字段组定义（仅前端使用） */
  通用字段组定义?: CommonFieldGroupDefinitions;

  /** 实际提交的申请记录 */
  申请表记录?: ApplicationRecords;

  /** 在编人员信息 */
  人员名册?: PersonnelRoster;

  /** 组织架构 */
  科室列表?: DepartmentList;

  /** 当前游戏时间 */
  当前游戏时间?: string;

  /** 当前场景 */
  当前场景?: string;

  /** 其他扩展字段 */
  [key: string]: any;
}

// ============ 辅助函数 ============

/**
 * 创建空的数据库结构
 */
export function createEmptyDatabase(): SAMU7Database {
  return {
    $meta: {
      extensible: true,
      description: '国家特别事务管理局第七执行处数据库',
      version: '1.0',
    },
    员工守则: [],
    通用字段组定义: {
      $meta: {
        extensible: true,
        aiVisible: false,
        description: '可被各制度附件表单引用的通用字段组，仅前端使用',
      },
    },
    申请表记录: {
      $meta: {
        extensible: true,
        aiVisible: true,
        description: '实际提交的申请记录，按来源制度分类存储',
      },
    },
    人员名册: {
      $meta: {
        extensible: true,
        aiVisible: true,
        description: '在编人员信息',
      },
    },
    科室列表: {
      $meta: {
        extensible: true,
        aiVisible: true,
        description: '组织架构',
      },
    },
    当前游戏时间: '',
    当前场景: '',
  };
}

/**
 * 数据库路径常量
 */
export const DATABASE_PATHS = {
  /** 员工守则 */
  HANDBOOK: '员工守则',
  /** 通用字段组定义 */
  COMMON_FIELD_GROUPS: '通用字段组定义',
  /** 申请表记录 */
  APPLICATION_RECORDS: '申请表记录',
  /** 人员名册 */
  PERSONNEL_ROSTER: '人员名册',
  /** 科室列表 */
  DEPARTMENT_LIST: '科室列表',
  /** 当前游戏时间 */
  GAME_TIME: '当前游戏时间',
  /** 当前场景 */
  CURRENT_SCENE: '当前场景',
} as const;

/**
 * 从数据库获取人员列表
 */
export function getPersonnelList(db: SAMU7Database): PersonnelRecord[] {
  const roster = db.人员名册;
  if (!roster) return [];

  return Object.entries(roster)
    .filter(([key]) => key !== '$meta')
    .map(([, record]) => record as PersonnelRecord)
    .filter((record): record is PersonnelRecord => !!record && typeof record === 'object' && '工号' in record);
}

/**
 * 从数据库获取科室列表
 */
export function getDepartmentList(db: SAMU7Database): DepartmentRecord[] {
  const deptList = db.科室列表;
  if (!deptList) return [];

  return Object.entries(deptList)
    .filter(([key]) => key !== '$meta')
    .map(([, record]) => record as DepartmentRecord)
    .filter((record): record is DepartmentRecord => !!record && typeof record === 'object' && '科室编码' in record);
}

/**
 * 从数据库获取申请记录列表
 */
export function getApplicationList(db: SAMU7Database): ApplicationRecord[] {
  const records = db.申请表记录;
  if (!records) return [];

  return Object.entries(records)
    .filter(([key]) => key !== '$meta')
    .map(([, record]) => record as ApplicationRecord)
    .filter((record): record is ApplicationRecord => !!record && typeof record === 'object' && '编号' in record);
}
