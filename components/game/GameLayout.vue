<!--
  MClite - 游戏主布局组件 (Lite版)
  简化版 - 导航栏在右侧
  布局：顶部栏 - [主内容区 | 右侧导航] - 底部栏
  移动端适配：侧边栏默认收起，通过浮动按钮展开
-->
<template>
  <div class="game-layout" :class="{ 'is-fullscreen': isFullscreen, 'sidebar-open': mobileSidebarVisible }">
    <!-- 顶部状态栏 -->
    <TopBar
      :connection-status="connectionStatus"
      :is-fullscreen="isFullscreen"
      :is-dark-theme="isDarkTheme"
      :game-date="gameDate"
      :game-period="gamePeriod"
      :game-location="gameLocation"
      @toggle-fullscreen="toggleFullscreen"
      @toggle-theme="toggleTheme"
      @open-changelog="showChangelog = true"
    />

    <!-- 中间区域：主内容 + 右侧导航 -->
    <div class="main-area">
      <!-- 主内容区（游戏文本显示区域） -->
      <MainContent
        ref="mainContentRef"
        :current-content="aiCurrentContent"
        :is-processing="aiIsProcessing"
        :is-streaming="aiIsStreaming"
        :variable-changes="aiVariableChanges"
        :last-update-time="aiLastUpdateTime"
      />

      <!-- 右侧导航栏 -->
      <Sidebar
        ref="sidebarRef"
        :active-menu="currentView"
        :collapsed="sidebarCollapsed"
        :mobile-visible="mobileSidebarVisible"
        @menu-change="handleMenuChange"
        @update:collapsed="sidebarCollapsed = $event"
        @open-help="showHelp = true"
        @open-ai-filter="showAIFilterPanel = true"
        @open-save-manager="showSaveManager = true"
        @open-context-manager="showContextManager = true"
        @open-history-text="showHistoryText = true"
        @open-changelog="showChangelog = true"
        @close-mobile="mobileSidebarVisible = false"
      />

      <!-- 移动端侧边栏遮罩 -->
      <div
        v-if="mobileSidebarVisible && isMobileView"
        class="sidebar-overlay"
        @click="mobileSidebarVisible = false"
      ></div>
    </div>

    <!-- 移动端浮动菜单按钮 -->
    <button
      v-if="isMobileView && !mobileSidebarVisible"
      class="mobile-menu-fab"
      @click="mobileSidebarVisible = true"
      title="打开菜单"
    >
      <span class="fab-icon">☰</span>
    </button>

    <!-- 底部输入栏 -->
    <BottomBar
      ref="bottomBarRef"
      :is-loading="aiIsProcessing"
      :error="aiError"
      @send="handleSendMessage"
      @clear-error="handleClearError"
    />

    <!-- AI上下文过滤测试面板（已禁用）
    <Teleport to="body">
      <div v-if="showAIFilterPanel" class="modal-overlay fullscreen-modal" @click.self="showAIFilterPanel = false">
        <div class="modal ai-filter-modal">
          <AIContextFilterPanel @close="showAIFilterPanel = false" />
        </div>
      </div>
    </Teleport>
    -->

    <!-- 帮助弹窗 -->
    <Teleport to="body">
      <div v-if="showHelp" class="modal-overlay fullscreen-modal help-overlay" @click.self="showHelp = false">
        <div class="modal help-modal">
          <div class="modal-header">
            <h3>❓ 帮助说明</h3>
            <button class="btn-close" @click="showHelp = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="help-section">
              <h4>📝 如何开新档？</h4>
              <ol class="help-steps">
                <li>打开<strong>上下文面板</strong>，点击"清空所有"按钮，清理世界书内容</li>
                <li>开启<strong>新聊天</strong></li>
                <li>打开<strong>存档管理面板</strong> - 设置 - 修改<strong>[自动存档]前缀</strong></li>
                <li>正常游玩即可</li>
              </ol>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" @click="showHelp = false">我知道了</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 存档管理面板 -->
    <Teleport to="body">
      <div
        v-if="showSaveManager"
        class="modal-overlay fullscreen-modal save-manager-overlay"
        @click.self="showSaveManager = false"
      >
        <div class="modal save-manager-modal">
          <SaveManager
            @close="showSaveManager = false"
            @save-loaded="handleSaveLoaded"
            @save-created="handleSaveCreated"
          />
        </div>
      </div>
    </Teleport>

    <!-- 上下文管理面板 -->
    <Teleport to="body">
      <div
        v-if="showContextManager"
        class="modal-overlay fullscreen-modal context-manager-overlay"
        @click.self="showContextManager = false"
      >
        <div class="modal context-manager-modal">
          <ContextManagerPanel @close="showContextManager = false" />
        </div>
      </div>
    </Teleport>

    <!-- 历史正文面板 - 模态框方式 -->
    <Teleport to="body">
      <div
        v-if="showHistoryText"
        class="modal-overlay fullscreen-modal history-text-overlay"
        @click.self="showHistoryText = false"
      >
        <div class="modal history-text-modal">
          <HistoryTextPanel @close="showHistoryText = false" />
        </div>
      </div>
    </Teleport>

    <!-- MClite v2 花名册面板 -->
    <Teleport to="body">
      <div v-if="showRoster" class="modal-overlay fullscreen-modal roster-overlay" @click.self="showRoster = false">
        <div class="modal roster-modal">
          <RosterPanel @close="showRoster = false" />
        </div>
      </div>
    </Teleport>

    <!-- MClite v2 文档面板 -->
    <Teleport to="body">
      <div
        v-if="showDocument"
        class="modal-overlay fullscreen-modal document-overlay"
        @click.self="showDocument = false"
      >
        <div class="modal document-modal">
          <DocumentPanel @close="showDocument = false" />
        </div>
      </div>
    </Teleport>

    <!-- 更新日志面板 -->
    <Teleport to="body">
      <div
        v-if="showChangelog"
        class="modal-overlay fullscreen-modal changelog-overlay"
        @click.self="showChangelog = false"
      >
        <div class="modal changelog-modal">
          <ChangelogPanel @close="showChangelog = false" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import TopBar from './TopBar.vue';
import MainContent from './MainContent.vue';
import BottomBar from './BottomBar.vue';
import Sidebar from './Sidebar.vue';
// MClite v2 面板（Schema-Driven）
import RosterPanel from '../roster/RosterPanel.vue';
import DocumentPanel from '../document/DocumentPanel.vue';
import HistoryTextPanel from '../history/HistoryTextPanel.vue';
import ChangelogPanel from '../common/ChangelogPanel.vue';
// AI过滤面板已禁用
// import AIContextFilterPanel from '../debug/AIContextFilterPanel.vue';
import SaveManager from '../save/SaveManager.vue';
import ContextManagerPanel from '../debug/ContextManagerPanel.vue';
import { useAIInteraction } from '../../composables/useAIInteraction';
import { useSave } from '../../composables/useSave';
import { useMVU } from '../../composables/useMVU';

// ============ AI交互 ============
const {
  currentContent: aiCurrentContent,
  isProcessing: aiIsProcessing,
  isStreaming: aiIsStreaming,
  error: aiError,
  lastUpdateTime: aiLastUpdateTime,
  variableChanges: aiVariableChanges,
  sendMessageToAI,
} = useAIInteraction();

// ============ 存档管理 ============
const { quickSave, quickLoad } = useSave();

// ============ MVU变量读取（增强版自动刷新） ============
const { statData, isMvuAvailable, getVariable, refresh: refreshMvu, updateVersion, onUpdate, forceRefresh } = useMVU();

/** 游戏日期（从MVU变量读取，自动响应变量更新） */
const gameDate = computed(() => {
  // 依赖 updateVersion 实现自动刷新
  updateVersion.value;
  const date = getVariable('MC.系统.当前时间.日期', '');
  return date;
});

/** 游戏时段（从MVU变量读取，自动响应变量更新） */
const gamePeriod = computed(() => {
  updateVersion.value;
  const period = getVariable('MC.系统.当前时间.时段', '');
  return period;
});

/** 当前地点（从MVU变量读取，自动响应变量更新） */
const gameLocation = computed(() => {
  updateVersion.value;
  const location = getVariable('MC.系统.当前地点', '');
  return location;
});

// 监听MVU数据变化，自动刷新UI
watch(
  [statData, updateVersion],
  ([newData, version]) => {
    if (newData) {
      console.log('[GameLayout] MVU数据更新 (v' + version + '):', {
        日期: getVariable('MC.系统.当前时间.日期', ''),
        时段: getVariable('MC.系统.当前时间.时段', ''),
        地点: getVariable('MC.系统.当前地点', ''),
      });
    }
  },
  { deep: false, immediate: false },
);

// ============ 状态定义 ============

// 全屏状态
const isFullscreen = ref(false);

// 移动端侧边栏可见状态
const mobileSidebarVisible = ref(false);

// 是否为移动端视图
const isMobileView = ref(false);

// 连接状态
const connectionStatus = ref<'connected' | 'connecting' | 'disconnected'>('connected');

// 侧边栏折叠状态
const sidebarCollapsed = ref(false);

// 当前视图
const currentView = ref('workplace');

// 弹窗显示状态
const showHelp = ref(false);
// AI过滤面板已禁用
const showAIFilterPanel = ref(false); // 保留变量但不再使用
const showSaveManager = ref(false);
const showContextManager = ref(false);
const showHistoryText = ref(false);
// MClite v2 面板
const showRoster = ref(false);
const showDocument = ref(false);
const showChangelog = ref(false);

// 主题状态
const isDarkTheme = ref(false);

// ============ 方法定义 ============

/**
 * 切换全屏模式
 */
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen?.();
    isFullscreen.value = false;
  }
};

/**
 * 监听全屏变化
 */
const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;
};

/**
 * 处理菜单切换
 */
const handleMenuChange = (menuId: string) => {
  // 文档面板使用模态框显示
  if (menuId === 'handbook') {
    showDocument.value = true;
    return;
  }
  // 花名册面板使用模态框显示
  if (menuId === 'personnel') {
    showRoster.value = true;
    return;
  }
  currentView.value = menuId;
  console.log('[GameLayout] 切换到视图:', menuId);
};

/**
 * 处理发送消息 - 使用真实AI交互
 */
const handleSendMessage = async (message: string) => {
  console.log('[GameLayout] 发送消息给AI:', message);

  try {
    await sendMessageToAI(message);
  } catch (error) {
    console.error('[GameLayout] AI交互错误:', error);
    if (typeof toastr !== 'undefined') {
      toastr.error('发送消息失败，请重试');
    }
  }
};

/**
 * 清除AI错误
 */
const handleClearError = () => {
  console.log('[GameLayout] 清除AI错误');
};

/**
 * 切换主题
 */
const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value;

  if (isDarkTheme.value) {
    document.documentElement.classList.add('dark-theme');
  } else {
    document.documentElement.classList.remove('dark-theme');
  }

  console.log('[GameLayout] 主题切换:', isDarkTheme.value ? '深色' : '浅色');
};

/**
 * 保存游戏（快速保存）
 */
const handleSaveGame = async () => {
  console.log('[GameLayout] 快速保存游戏');
  try {
    const success = await quickSave();
    if (success) {
      if (typeof toastr !== 'undefined') {
        toastr.success('游戏已保存');
      }
    } else {
      if (typeof toastr !== 'undefined') {
        toastr.error('保存失败');
      }
    }
  } catch (error) {
    console.error('[GameLayout] 保存失败:', error);
    if (typeof toastr !== 'undefined') {
      toastr.error('保存失败');
    }
  }
};

/**
 * 读取游戏（快速加载）
 */
const handleLoadGame = async () => {
  console.log('[GameLayout] 快速加载游戏');
  try {
    const success = await quickLoad();
    if (success) {
      if (typeof toastr !== 'undefined') {
        toastr.success('游戏已加载');
      }
    } else {
      if (typeof toastr !== 'undefined') {
        toastr.info('没有可加载的存档');
      }
    }
  } catch (error) {
    console.error('[GameLayout] 加载失败:', error);
    if (typeof toastr !== 'undefined') {
      toastr.error('加载失败');
    }
  }
};

/**
 * 处理存档加载完成
 */
const handleSaveLoaded = (id: string) => {
  console.log('[GameLayout] 存档已加载:', id);
  showSaveManager.value = false;
  if (typeof toastr !== 'undefined') {
    toastr.success('存档已加载');
  }
};

/**
 * 处理存档创建完成
 */
const handleSaveCreated = (id: string) => {
  console.log('[GameLayout] 存档已创建:', id);
  if (typeof toastr !== 'undefined') {
    toastr.success('存档已创建');
  }
};

// ============ 移动端检测 ============

/**
 * 检查是否为移动端视图
 */
const checkMobileView = () => {
  isMobileView.value = window.innerWidth <= 768;
  // 切换到桌面端时关闭移动端侧边栏
  if (!isMobileView.value) {
    mobileSidebarVisible.value = false;
  }
};

/**
 * 处理窗口大小变化
 */
const handleResize = () => {
  checkMobileView();
};

// ============ 生命周期 ============

onMounted(() => {
  console.log('[GameLayout] MClite布局已加载');
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  window.addEventListener('resize', handleResize);
  // 初始检查
  checkMobileView();

  // 输出MVU状态
  console.log('[GameLayout] MVU可用状态:', isMvuAvailable.value);
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  window.removeEventListener('resize', handleResize);
});
</script>

<style lang="scss" scoped>
// ============ 占位面板 ============
.placeholder-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color);
}

.placeholder-content {
  text-align: center;
  padding: var(--spacing-xl);

  .placeholder-icon {
    font-size: 48px;
    margin-bottom: var(--spacing-md);
  }

  h3 {
    margin: 0 0 var(--spacing-sm);
    color: var(--text-color);
    font-size: var(--font-lg);
  }

  p {
    margin: 0 0 var(--spacing-lg);
    color: var(--text-secondary);
    font-size: var(--font-sm);
  }
}

.game-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg-color);
  overflow: hidden;

  &.is-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
  }
}

// ============ 主区域 ============
.main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

// ============ 模态框样式 ============
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  box-shadow: var(--shadow-lg);
  animation: slideUp 0.3s ease;
  display: flex;
  flex-direction: column;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;

  h3 {
    margin: 0;
    font-size: var(--font-lg);
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
}

.btn-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--font-lg);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);

  &:hover {
    background: var(--bg-hover);
    color: var(--text-color);
  }
}

.modal-body {
  padding: var(--spacing-lg);
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--border-color);
  flex-shrink: 0;
}

// ============ 帮助弹窗 ============
.help-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 10004 !important; // 比其他面板更高

  .help-modal {
    width: 90%;
    max-width: 480px;
    max-height: 60vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }
}

.help-modal {
  max-width: 480px;
}

.help-steps {
  margin: 0;
  padding-left: var(--spacing-lg);
  counter-reset: step-counter;

  li {
    font-size: var(--font-sm);
    color: var(--text-color);
    line-height: 1.8;
    margin-bottom: var(--spacing-sm);
    padding-left: var(--spacing-xs);

    &:last-child {
      margin-bottom: 0;
    }

    strong {
      color: var(--primary-color);
      font-weight: 600;
    }
  }
}

.help-section {
  margin-bottom: var(--spacing-lg);

  &:last-child {
    margin-bottom: 0;
  }

  h4 {
    margin: 0 0 var(--spacing-sm);
    font-size: var(--font-md);
    color: var(--text-color);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  p {
    margin: 0;
    font-size: var(--font-sm);
    color: var(--text-secondary);
    line-height: 1.6;
  }

  ul {
    margin: 0;
    padding-left: var(--spacing-lg);

    li {
      font-size: var(--font-sm);
      color: var(--text-secondary);
      line-height: 1.8;

      strong {
        color: var(--text-color);
      }
    }
  }
}

// ============ 按钮样式 ============
.btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  border: none;
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.btn-primary {
  background: var(--primary-color);
  color: white;

  &:hover:not(:disabled) {
    background: var(--primary-hover);
  }

  &:active:not(:disabled) {
    background: var(--primary-active);
  }
}

.btn-secondary {
  background: var(--bg-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }
}

// ============ AI过滤面板全屏模态框 ============
.fullscreen-modal {
  padding: var(--spacing-lg);
  z-index: 10000 !important;

  .ai-filter-modal {
    width: 100%;
    max-width: 1400px;
    height: 90vh;
    max-height: none;
    display: flex;
    flex-direction: column;
  }
}

// ============ 上下文管理面板 - 全屏兼容 ============
.context-manager-overlay {
  // 确保在全屏模式下也能显示
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 10001 !important; // 比fullscreen-modal更高

  .context-manager-modal {
    width: 90%;
    max-width: 520px;
    max-height: 85vh;
    height: auto;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);

    .modal-body {
      padding: 0;
    }
  }
}

// ============ 存档管理面板 ============
.save-manager-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 10002 !important;

  .save-manager-modal {
    width: 90%;
    max-width: 600px;
    max-height: 85vh;
    height: 80vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }
}

// ============ 历史正文面板 ============
.history-text-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 10005 !important;
  padding: var(--spacing-md);

  .history-text-modal {
    width: 100%;
    max-width: 700px;
    max-height: 85vh;
    height: 80vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }
}

// ============ MClite v2 花名册面板 ============
.roster-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 10006 !important;
  padding: var(--spacing-md);

  .roster-modal {
    width: 100%;
    max-width: 800px;
    max-height: 85vh;
    height: 80vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }
}

// ============ MClite v2 文档面板 ============
.document-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 10007 !important;
  padding: var(--spacing-md);

  .document-modal {
    width: 100%;
    max-width: 800px;
    max-height: 85vh;
    height: 80vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }
}

// ============ 更新日志面板 ============
.changelog-overlay {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  z-index: 10008 !important;
  padding: var(--spacing-md);

  .changelog-modal {
    width: 100%;
    max-width: 700px;
    max-height: 85vh;
    height: 80vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }
}

// ============ 自动存档提示 ============
.auto-save-indicator {
  position: fixed;
  bottom: 80px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--success-color, #4caf50);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.3s ease;
  z-index: 9998;

  &.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .icon {
    font-size: 16px;
  }

  .text {
    font-size: 12px;
    color: var(--text-secondary);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

// ============ 移动端侧边栏遮罩 ============
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 99;
  animation: fadeIn 0.2s ease;
}

// ============ 移动端浮动菜单按钮 ============
.mobile-menu-fab {
  position: fixed;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--primary-color);
  color: white;
  border: none;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
  cursor: pointer;
  z-index: 98;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);

  .fab-icon {
    font-size: 18px;
    line-height: 1;
  }

  &:hover {
    transform: translateY(-50%) scale(1.05);
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.5);
  }

  &:active {
    transform: translateY(-50%) scale(0.95);
  }
}

// 竖屏模式下浮动按钮更小
@media (max-width: 480px) {
  .mobile-menu-fab {
    width: 36px;
    height: 36px;
    right: 8px;

    .fab-icon {
      font-size: 16px;
    }
  }
}

// ============ 响应式 ============
@media (max-width: 768px) {
  .main-area {
    position: relative;
  }

  .modal {
    width: 95%;
    max-height: 90vh;
  }

  .fullscreen-modal {
    padding: var(--spacing-sm);

    .ai-filter-modal {
      height: 95vh;
    }
  }

  .save-manager-overlay {
    .save-manager-modal {
      width: 95%;
      height: 90vh;
      max-height: 90vh;
    }
  }

  // 历史正文面板移动端适配
  .history-text-overlay {
    padding: var(--spacing-sm);

    .history-text-modal {
      width: 100%;
      height: 85vh;
      max-height: 90vh;
      border-radius: var(--radius-sm);
    }
  }

  .auto-save-indicator {
    bottom: 100px;
    right: 10px;
    left: 10px;

    .text {
      max-width: none;
    }
  }

  // 侧边栏打开时调整浮动按钮
  .game-layout.sidebar-open {
    .mobile-menu-fab {
      opacity: 0;
      pointer-events: none;
    }
  }
}

// ============ 竖屏模式额外优化 ============
@media (max-width: 480px) {
  .history-text-overlay {
    padding: var(--spacing-xs);

    .history-text-modal {
      height: 90vh;
      max-height: 95vh;
      border-radius: var(--radius-xs);
    }
  }

  .save-manager-overlay {
    padding: var(--spacing-xs);

    .save-manager-modal {
      width: 100%;
      height: 92vh;
      max-height: 95vh;
    }
  }

  .context-manager-overlay {
    padding: var(--spacing-xs);

    .context-manager-modal {
      width: 100%;
      max-height: 90vh;
    }
  }

  .help-overlay {
    padding: var(--spacing-xs);

    .help-modal {
      width: 100%;
      max-height: 80vh;
    }
  }
}
</style>
