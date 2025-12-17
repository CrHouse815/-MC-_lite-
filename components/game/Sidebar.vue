<!--
  MClite - 右侧导航栏组件 (Lite版)
  简化版导航菜单
  移动端适配：支持滑动显示/隐藏
-->
<template>
  <aside class="sidebar" :class="{ 'is-collapsed': isCollapsed, 'is-visible': mobileVisible }">
    <!-- 移动端关闭按钮 -->
    <button class="mobile-close-btn" @click="$emit('close-mobile')" title="关闭菜单">
      <span class="close-icon">✕</span>
    </button>

    <!-- 折叠按钮（仅桌面端显示） -->
    <button class="collapse-btn" @click="toggleCollapse" :title="isCollapsed ? '展开菜单' : '收起菜单'">
      <span class="collapse-icon">{{ isCollapsed ? '◀' : '▶' }}</span>
    </button>

    <!-- 导航菜单 -->
    <nav class="nav-menu">
      <div
        v-for="item in menuItems"
        :key="item.id"
        class="nav-item"
        :class="{
          'is-active': activeMenu === item.id,
          'is-disabled': item.disabled,
        }"
        @click="handleMenuClick(item.id, item.disabled)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span v-if="!isCollapsed" class="nav-label">{{ item.label }}</span>
        <span v-if="!isCollapsed && item.liteTag" class="lite-tag">Lite</span>
      </div>
    </nav>

    <!-- 信息面板区域（展开时显示，桌面端） -->
    <div v-if="!isCollapsed" class="info-panels desktop-only">
      <!-- 设置面板 -->
      <div class="info-panel settings-panel">
        <div class="panel-header">
          <span class="panel-icon">⚙️</span>
          <span class="panel-title">设置</span>
        </div>
        <div class="panel-body">
          <!-- 流式传输开关 -->
          <div class="setting-item">
            <div class="setting-label">
              <span class="setting-icon">📡</span>
              <span class="setting-text">流式传输</span>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" :checked="streamingEnabled" @change="toggleStreaming" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="setting-hint">{{ streamingEnabled ? '实时显示AI回复' : '等待完整回复' }}</div>
        </div>
      </div>

      <!-- Lite版本提示 -->
      <div class="info-panel lite-info-panel">
        <div class="panel-header">
          <span class="panel-icon">💡</span>
          <span class="panel-title">Lite版本</span>
        </div>
        <div class="panel-body">
          <div class="lite-notice">
            <p>当前为MClite简化版</p>
            <p class="lite-detail">部分功能已简化或禁用</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部快捷操作 -->
    <div class="sidebar-footer">
      <!-- 移动端流式传输设置（紧凑版） -->
      <div class="mobile-settings">
        <div class="mobile-setting-item">
          <span class="setting-icon">📡</span>
          <span class="setting-text">流式</span>
          <label class="toggle-switch small">
            <input type="checkbox" :checked="streamingEnabled" @change="toggleStreaming" />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      <div class="divider"></div>
      <!-- 核心功能按钮 -->
      <div class="nav-item footer-item highlight-item" @click="$emit('open-save-manager')">
        <span class="nav-icon">💾</span>
        <span v-if="!isCollapsed" class="nav-label">存档管理</span>
      </div>
      <div class="nav-item footer-item highlight-item" @click="$emit('open-context-manager')">
        <span class="nav-icon">📚</span>
        <span v-if="!isCollapsed" class="nav-label">上下文管理</span>
      </div>
      <div class="nav-item footer-item highlight-item secondary" @click="$emit('open-history-text')">
        <span class="nav-icon">📜</span>
        <span v-if="!isCollapsed" class="nav-label">历史正文</span>
      </div>
      <div class="divider"></div>
      <div class="nav-item footer-item" @click="$emit('open-changelog')">
        <span class="nav-icon">📋</span>
        <span v-if="!isCollapsed" class="nav-label">更新日志</span>
      </div>
      <div class="nav-item footer-item" @click="$emit('open-help')">
        <span class="nav-icon">❓</span>
        <span v-if="!isCollapsed" class="nav-label">帮助说明</span>
      </div>
      <!-- AI过滤测试按钮已隐藏（功能已禁用）
      <div class="nav-item footer-item debug-item" @click="$emit('open-ai-filter')">
        <span class="nav-icon">🔬</span>
        <span v-if="!isCollapsed" class="nav-label">AI过滤测试</span>
      </div>
      -->
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAppStore } from '../../stores/appStore';

// ============ Props ============
interface MenuItem {
  id: string;
  icon: string;
  label: string;
  disabled?: boolean;
  liteTag?: boolean;
}

interface Props {
  /** 当前激活的菜单 */
  activeMenu?: string;
  /** 是否折叠 */
  collapsed?: boolean;
  /** 未读通知数 (Lite版不使用) */
  unreadNotifications?: number;
  /** 移动端可见状态 */
  mobileVisible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  activeMenu: 'workplace',
  collapsed: false,
  unreadNotifications: 0,
  mobileVisible: false,
});

// ============ Emits ============
const emit = defineEmits<{
  (e: 'menu-change', menuId: string): void;
  (e: 'update:collapsed', value: boolean): void;
  (e: 'open-help'): void;
  (e: 'open-ai-filter'): void;
  (e: 'open-save-manager'): void;
  (e: 'open-context-manager'): void;
  (e: 'open-history-text'): void;
  (e: 'open-changelog'): void;
  (e: 'view-notice', id: string): void;
  (e: 'close-mobile'): void;
}>();

// ============ 状态 ============
const isCollapsed = ref(props.collapsed);

// 获取 AppStore
const appStore = useAppStore();

// 流式传输开关状态
const streamingEnabled = computed(() => appStore.streamingEnabled);

/**
 * 切换流式传输
 */
const toggleStreaming = () => {
  appStore.toggleStreaming();
};

// 菜单项配置 (Lite版)
const menuItems = computed<MenuItem[]>(() => [
  {
    id: 'workplace',
    icon: '🖥️',
    label: '我的工位',
  },
  {
    id: 'personnel',
    icon: '👥',
    label: '人事系统',
    liteTag: true,
  },
  {
    id: 'handbook',
    icon: '📖',
    label: '文档查看',
  },
]);

// ============ 方法 ============

/**
 * 切换折叠状态
 */
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
  emit('update:collapsed', isCollapsed.value);
};

/**
 * 处理菜单点击
 */
const handleMenuClick = (menuId: string, disabled?: boolean) => {
  if (disabled) return;
  emit('menu-change', menuId);
  // 移动端点击菜单后自动关闭侧边栏
  if (props.mobileVisible) {
    emit('close-mobile');
  }
};
</script>

<style lang="scss" scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 280px;
  height: 100%;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-color);
  transition:
    width var(--transition-normal),
    transform var(--transition-normal);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;

  &.is-collapsed {
    width: 60px;

    .nav-item {
      justify-content: center;
      padding: var(--spacing-md);
    }
  }
}

// ============ 移动端关闭按钮 ============
.mobile-close-btn {
  display: none;
  position: absolute;
  right: var(--spacing-sm);
  top: var(--spacing-sm);
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  z-index: 11;
  transition: all var(--transition-fast);

  .close-icon {
    font-size: 18px;
    color: var(--text-secondary);
  }

  &:hover {
    background: var(--bg-tertiary);

    .close-icon {
      color: var(--text-color);
    }
  }
}

// ============ 折叠按钮 ============
.collapse-btn {
  position: absolute;
  left: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  cursor: pointer;
  z-index: 10;
  transition: all var(--transition-fast);

  .collapse-icon {
    font-size: 10px;
    color: var(--text-secondary);
  }

  &:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);

    .collapse-icon {
      color: var(--text-color);
    }
  }
}

// ============ 导航菜单 ============
.nav-menu {
  padding: var(--spacing-sm);
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  margin-bottom: var(--spacing-xs);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;

  .nav-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .nav-label {
    font-size: var(--font-sm);
    color: var(--text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .lite-tag {
    margin-left: auto;
    padding: 1px 4px;
    font-size: 9px;
    font-weight: 500;
    background: var(--warning-light);
    color: var(--warning-color);
    border-radius: 3px;
    opacity: 0.8;
  }

  &:hover {
    background: var(--bg-hover);

    .nav-label {
      color: var(--text-highlight);
    }
  }

  &.is-active {
    background: var(--primary-light);
    border-left: 3px solid var(--primary-color);

    .nav-label {
      color: var(--primary-color);
      font-weight: 600;
    }
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// ============ 信息面板区域 ============
.info-panels {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.info-panel {
  background: var(--bg-color);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-light);

  .panel-icon {
    font-size: 14px;
  }

  .panel-title {
    font-size: var(--font-xs);
    font-weight: 600;
    color: var(--text-color);
  }

  .panel-count {
    margin-left: auto;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    background: var(--primary-light);
    color: var(--primary-color);
    font-size: 10px;
    font-weight: 600;
    border-radius: 9px;
  }
}

.panel-body {
  padding: var(--spacing-xs);
  max-height: 150px;
  overflow-y: auto;
}

// ============ 设置面板 ============
.settings-panel {
  .panel-body {
    padding: var(--spacing-sm);
  }
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-xs) 0;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);

  .setting-icon {
    font-size: 14px;
  }

  .setting-text {
    font-size: var(--font-sm);
    color: var(--text-color);
  }
}

.setting-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
  padding-left: 22px;
}

// 开关样式
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
  cursor: pointer;

  input {
    opacity: 0;
    width: 0;
    height: 0;

    &:checked + .toggle-slider {
      background: var(--primary-color);
    }

    &:checked + .toggle-slider::before {
      transform: translateX(20px);
    }
  }

  .toggle-slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-tertiary);
    border-radius: 20px;
    transition: all var(--transition-fast);

    &::before {
      content: '';
      position: absolute;
      left: 2px;
      bottom: 2px;
      width: 16px;
      height: 16px;
      background: white;
      border-radius: 50%;
      transition: all var(--transition-fast);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
  }
}

// ============ Lite版信息面板 ============
.lite-info-panel {
  background: var(--warning-light);
  border: 1px solid var(--warning-color);
}

.lite-notice {
  text-align: center;
  padding: var(--spacing-xs);

  p {
    margin: 0;
    font-size: var(--font-xs);
    color: var(--text-color);

    &.lite-detail {
      font-size: 10px;
      color: var(--text-secondary);
      margin-top: 2px;
    }
  }
}

// ============ 底部区域 ============
.sidebar-footer {
  padding: var(--spacing-sm);
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

// ============ 移动端设置区域（默认隐藏） ============
.mobile-settings {
  display: none;
}

.divider {
  height: 1px;
  background: var(--border-light);
  margin: var(--spacing-xs) 0;
}

.footer-item {
  margin-bottom: var(--spacing-xs);

  &:last-child {
    margin-bottom: 0;
  }

  .nav-label {
    color: var(--text-secondary);
  }

  &:hover .nav-label {
    color: var(--text-color);
  }

  &.highlight-item {
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-xs);

    .nav-label {
      color: var(--primary-color);
      font-weight: 500;
    }

    &:hover {
      background: rgba(99, 102, 241, 0.2);
      border-color: rgba(99, 102, 241, 0.4);
    }

    &.secondary {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.15);

      .nav-label {
        color: #3b82f6;
        font-weight: 500;
      }

      &:hover {
        background: rgba(59, 130, 246, 0.15);
        border-color: rgba(59, 130, 246, 0.3);
      }
    }
  }

  &.debug-item {
    border-top: 1px dashed var(--border-light);
    padding-top: var(--spacing-sm);
    margin-top: var(--spacing-sm);

    .nav-icon {
      opacity: 0.7;
    }

    .nav-label {
      color: var(--text-muted);
      font-size: 11px;
    }

    &:hover {
      .nav-icon {
        opacity: 1;
      }
      .nav-label {
        color: var(--text-secondary);
      }
    }
  }
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    right: 8px;
    top: 50%;
    transform: translateY(-50%) translateX(calc(100% + 16px));
    bottom: auto;
    width: auto;
    min-width: 150px;
    max-width: 200px;
    height: auto;
    max-height: 80vh;
    z-index: 100;
    box-shadow: var(--shadow-lg);
    transition: transform var(--transition-normal);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-xs) 0;

    &.is-visible {
      transform: translateY(-50%) translateX(0);
    }

    // 移动端不使用折叠模式
    &.is-collapsed {
      width: auto;
      min-width: 150px;
      max-width: 200px;

      .nav-item {
        justify-content: flex-start;
        padding: var(--spacing-xs) var(--spacing-sm);
      }

      .nav-label,
      .lite-tag {
        display: inline;
      }
    }
  }

  // 桌面端信息面板 - 移动端隐藏
  .desktop-only {
    display: none !important;
  }

  // 移动端设置区域 - 显示紧凑版设置
  .mobile-settings {
    display: block;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--bg-tertiary);
    border-radius: var(--radius-xs);
    margin: 0 var(--spacing-xs) var(--spacing-xs);
  }

  .mobile-setting-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);

    .setting-icon {
      font-size: 12px;
    }

    .setting-text {
      font-size: 11px;
      color: var(--text-color);
      flex: 1;
    }
  }

  // 小号开关
  .toggle-switch.small {
    width: 32px;
    height: 16px;

    .toggle-slider {
      &::before {
        width: 12px;
        height: 12px;
        left: 2px;
        bottom: 2px;
      }
    }

    input:checked + .toggle-slider::before {
      transform: translateX(16px);
    }
  }

  // 移动端显示关闭按钮
  .mobile-close-btn {
    display: flex;
    position: relative;
    right: auto;
    top: auto;
    width: 28px;
    height: 28px;
    margin: var(--spacing-xs) auto var(--spacing-xs);

    .close-icon {
      font-size: 14px;
    }
  }

  // 隐藏桌面端折叠按钮
  .collapse-btn {
    display: none;
  }

  // 移动端导航菜单调整
  .nav-menu {
    padding: var(--spacing-xs);
    padding-top: 0;
  }

  .nav-item {
    padding: var(--spacing-xs) var(--spacing-sm);
    margin-bottom: 2px;

    .nav-icon {
      font-size: 14px;
    }

    .nav-label {
      font-size: var(--font-xs);
      white-space: nowrap;
    }

    .lite-tag {
      font-size: 8px;
      padding: 1px 3px;
    }
  }

  // 移动端底部按钮调整
  .sidebar-footer {
    padding: var(--spacing-xs);
    border-top: none;
  }

  .footer-item {
    padding: var(--spacing-xs) var(--spacing-sm);
    margin-bottom: 2px;

    .nav-icon {
      font-size: 12px;
    }

    .nav-label {
      font-size: 11px;
      white-space: nowrap;
    }

    &.highlight-item {
      padding: var(--spacing-xs) var(--spacing-sm);

      &.secondary {
        // 历史正文按钮样式保持醒目
        background: rgba(59, 130, 246, 0.12);
        border-color: rgba(59, 130, 246, 0.25);
      }
    }

    &.debug-item {
      padding-top: var(--spacing-xs);
      margin-top: var(--spacing-xs);
    }
  }

  .divider {
    margin: 2px 0;
  }
}

// ============ 竖屏模式额外优化 ============
@media (max-width: 480px) {
  .sidebar {
    right: 4px;
    min-width: 130px;
    max-width: 170px;
    max-height: 75vh;
    border-radius: var(--radius-sm);
  }

  // 移动端设置更紧凑
  .mobile-settings {
    padding: var(--spacing-xs);
    margin: 0 var(--spacing-xs) var(--spacing-xs);
  }

  .mobile-setting-item {
    .setting-icon {
      font-size: 11px;
    }

    .setting-text {
      font-size: 10px;
    }
  }

  .toggle-switch.small {
    width: 28px;
    height: 14px;

    .toggle-slider {
      &::before {
        width: 10px;
        height: 10px;
        left: 2px;
        bottom: 2px;
      }
    }

    input:checked + .toggle-slider::before {
      transform: translateX(14px);
    }
  }

  .nav-item {
    padding: var(--spacing-xs) var(--spacing-xs);

    .nav-icon {
      font-size: 13px;
    }

    .nav-label {
      font-size: 11px;
    }
  }

  .footer-item {
    .nav-icon {
      font-size: 11px;
    }

    .nav-label {
      font-size: 10px;
    }

    &.highlight-item {
      padding: var(--spacing-xs);

      &.secondary {
        // 历史正文按钮保持可见
        .nav-icon {
          font-size: 12px;
        }
      }
    }
  }
}
</style>
