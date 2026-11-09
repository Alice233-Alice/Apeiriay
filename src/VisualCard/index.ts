import { createApp } from 'vue';
import { teleportStyle } from '../util/script';
import App from './App.vue';
import './index.html'; // 引入 html 以便被打包

$(() => {
    // 注入样式到主页面
    teleportStyle();

    // 挂载 Vue 应用
    const app = createApp(App);
    app.mount('#app');
});