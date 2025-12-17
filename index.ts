/**
 * MC房子 - Vue3应用入口
 * 基于SillyTavern酒馆的前端界面项目
 */

import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';

// 导入样式
import './styles/index.scss';

// 导入全局 store 用于初始化
import { useAppStore } from './stores/appStore';

// 创建 Pinia 状态管理
const pinia = createPinia();

// 创建并配置 Vue 应用
const app = createApp(App);

// 使用 Pinia
app.use(pinia);

// 挂载应用
app.mount('#app');

// 初始化全局状态（应用启动后立即初始化）
const appStore = useAppStore();
appStore.initialize();

console.log('[MC房子] 应用已启动');

// 如果 toastr 可用则显示提示
if (typeof toastr !== 'undefined') {
  toastr.success('MC房子系统加载成功');
}

// 卸载时的清理工作
window.addEventListener('pagehide', () => {
  console.log('[MC房子] 应用正在卸载');
  if (typeof toastr !== 'undefined') {
    toastr.info('MC房子系统已卸载');
  }
});
