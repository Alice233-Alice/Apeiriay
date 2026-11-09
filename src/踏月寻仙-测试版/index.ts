import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './app.vue';
import { bootstrapMvuGuard } from './components/MvuGuardBootstrap';
import { bootstrapUpdateVariableDisplayGuard } from './components/UpdateVariableDisplayGuard';

$(() => {
  bootstrapMvuGuard();
  bootstrapUpdateVariableDisplayGuard();

  const pinia = createPinia();
  const app = createApp(App);

  app.use(pinia);
  app.mount('#app');

  console.info('[踏月寻仙] 状态栏界面已加载');
});

