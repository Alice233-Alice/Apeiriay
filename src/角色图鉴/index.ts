import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './app.vue';

$(() => {
    const pinia = createPinia();
    const app = createApp(App);

    app.use(pinia);
    app.mount('#app');

    console.info('[角色图鉴] 界面已加载');
});