/**
 * 确认对话框 Composable
 * 提供一个全局的确认对话框管理器，替代浏览器原生的 confirm() 函数
 * 避免全屏模式下的弹出问题，保持沉浸感
 */

import { reactive, readonly } from 'vue';

// ============ 类型定义 ============

/**
 * 确认对话框配置选项
 */
export interface ConfirmDialogOptions {
  /** 对话框标题 */
  title?: string;
  /** 对话框消息内容 */
  message: string;
  /** 确认按钮文字 */
  confirmText?: string;
  /** 取消按钮文字 */
  cancelText?: string;
  /** 对话框类型，影响样式 */
  type?: 'info' | 'warning' | 'danger' | 'success';
  /** 图标 */
  icon?: string;
  /** 是否显示取消按钮 */
  showCancel?: boolean;
  /** 确认前的自定义验证函数 */
  beforeConfirm?: () => boolean | Promise<boolean>;
}

/**
 * 确认对话框状态
 */
interface ConfirmDialogState {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  type: 'info' | 'warning' | 'danger' | 'success';
  icon: string;
  showCancel: boolean;
  isProcessing: boolean;
}

// ============ 全局状态 ============

const state = reactive<ConfirmDialogState>({
  visible: false,
  title: '确认',
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  type: 'info',
  icon: '❓',
  showCancel: true,
  isProcessing: false,
});

// Promise 解析器
let resolvePromise: ((value: boolean) => void) | null = null;
let beforeConfirmFn: (() => boolean | Promise<boolean>) | null = null;

// ============ 默认图标映射 ============

const defaultIcons: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  danger: '🗑️',
  success: '✅',
};

// ============ 方法 ============

/**
 * 显示确认对话框
 * @param options 对话框配置选项
 * @returns Promise<boolean> 用户选择结果
 */
const confirm = (options: ConfirmDialogOptions | string): Promise<boolean> => {
  return new Promise(resolve => {
    // 支持简单的字符串消息
    const opts: ConfirmDialogOptions = typeof options === 'string' ? { message: options } : options;

    // 设置状态
    state.title = opts.title || '确认';
    state.message = opts.message;
    state.confirmText = opts.confirmText || '确认';
    state.cancelText = opts.cancelText || '取消';
    state.type = opts.type || 'info';
    state.icon = opts.icon || defaultIcons[opts.type || 'info'] || '❓';
    state.showCancel = opts.showCancel !== false;
    state.isProcessing = false;
    state.visible = true;

    // 保存 Promise 解析器和验证函数
    resolvePromise = resolve;
    beforeConfirmFn = opts.beforeConfirm || null;
  });
};

/**
 * 处理确认
 */
const handleConfirm = async (): Promise<void> => {
  if (state.isProcessing) return;

  // 如果有验证函数，先执行验证
  if (beforeConfirmFn) {
    state.isProcessing = true;
    try {
      const result = await beforeConfirmFn();
      if (!result) {
        state.isProcessing = false;
        return;
      }
    } catch (error) {
      console.error('[ConfirmDialog] beforeConfirm error:', error);
      state.isProcessing = false;
      return;
    }
  }

  state.visible = false;
  state.isProcessing = false;
  if (resolvePromise) {
    resolvePromise(true);
    resolvePromise = null;
  }
  beforeConfirmFn = null;
};

/**
 * 处理取消
 */
const handleCancel = (): void => {
  if (state.isProcessing) return;

  state.visible = false;
  if (resolvePromise) {
    resolvePromise(false);
    resolvePromise = null;
  }
  beforeConfirmFn = null;
};

/**
 * 快捷方法：显示危险操作确认框
 */
const confirmDanger = (message: string, title: string = '危险操作'): Promise<boolean> => {
  return confirm({
    title,
    message,
    type: 'danger',
    confirmText: '确认删除',
    cancelText: '取消',
    icon: '🗑️',
  });
};

/**
 * 快捷方法：显示警告确认框
 */
const confirmWarning = (message: string, title: string = '警告'): Promise<boolean> => {
  return confirm({
    title,
    message,
    type: 'warning',
    confirmText: '继续',
    cancelText: '取消',
    icon: '⚠️',
  });
};

/**
 * 快捷方法：显示信息确认框
 */
const confirmInfo = (message: string, title: string = '提示'): Promise<boolean> => {
  return confirm({
    title,
    message,
    type: 'info',
    confirmText: '知道了',
    showCancel: false,
    icon: 'ℹ️',
  });
};

// ============ Composable 导出 ============

/**
 * 使用确认对话框
 */
export function useConfirmDialog() {
  return {
    // 状态（只读）
    state: readonly(state),

    // 方法
    confirm,
    confirmDanger,
    confirmWarning,
    confirmInfo,
    handleConfirm,
    handleCancel,
  };
}

// 导出默认 confirm 函数供外部直接使用
export { confirm, confirmDanger, confirmInfo, confirmWarning };
