<!--
  MC房子 - Vue3应用根组件
  基于SillyTavern酒馆的前端界面项目
-->
<template>
  <div id="app-container" ref="appContainer">
    <ErrorBoundary @error="handleError" @retry="handleRetry">
      <Suspense>
        <template #default>
          <GameLayout />
        </template>
        <template #fallback>
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <p class="loading-text">正在加载MC房子...</p>
          </div>
        </template>
      </Suspense>
    </ErrorBoundary>

    <!-- 全局确认对话框 -->
    <ConfirmDialog />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, Suspense } from 'vue';
import GameLayout from './components/game/GameLayout.vue';
import ErrorBoundary from './components/common/ErrorBoundary.vue';
import ConfirmDialog from './components/common/ConfirmDialog.vue';
import { useAppStore } from './stores/appStore';

// 获取应用Store
const appStore = useAppStore();
const appContainer = ref<HTMLElement>();

/**
 * 处理错误
 */
const handleError = (error: Error, info: string) => {
  console.error('[App] 捕获到错误:', error);
  console.error('[App] 组件信息:', info);

  // 可以在这里添加错误上报逻辑
  if (typeof toastr !== 'undefined') {
    toastr.error('应用发生错误，请刷新页面重试');
  }
};

/**
 * 处理重试
 */
const handleRetry = () => {
  console.log('[App] 用户点击重试');
  // 重新初始化应用
  appStore.initialize();
};

/**
 * 应用初始化
 */
onMounted(async () => {
  console.log('[App] MC房子应用已挂载');

  try {
    // 初始化应用状态
    await appStore.initialize();
    console.log('[App] 应用状态初始化完成');
  } catch (error) {
    console.error('[App] 初始化失败:', error);
  }
});

/**
 * 应用卸载清理
 */
onUnmounted(() => {
  console.log('[App] MC房子应用正在卸载');
});
</script>

<style lang="scss" scoped>
#app-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-color);
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: var(--spacing-md);
  background: var(--bg-color);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-text {
  color: var(--text-secondary);
  font-size: var(--font-md);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
