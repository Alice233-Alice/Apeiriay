import { createPinia, disposePinia } from 'pinia';
import { createApp } from 'vue';
import App from './app.vue';

$(() => {
  let disposed = false;
  let unmount: (() => void) | undefined;
  const frame = window.frameElement as HTMLIFrameElement | null;
  const parentBody = window.parent.document.body;
  const syncMount = () => {
    if (disposed) return;
    // 控制器自有舞台接管后，原生楼层只保留加载器，避免每楼都运行一套 store、事件和图片预加载。
    const shouldMount =
      frame?.dataset.dhlControllerOwned === 'true' || !parentBody.classList.contains('dhl-pseudo-stage-root-active');
    if (!shouldMount) {
      unmount?.();
      unmount = undefined;
      return;
    }
    if (unmount) return;
    const pinia = createPinia();
    const app = createApp(App);
    app.use(pinia);
    app.mount('#app');
    unmount = () => {
      app.unmount();
      disposePinia(pinia);
    };
  };

  const observer = new MutationObserver(syncMount);
  observer.observe(parentBody, { attributes: true, attributeFilter: ['class'] });
  syncMount();

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    unmount?.();
    unmount = undefined;
  };
  window.addEventListener('pagehide', dispose, { once: true });

  console.info('[灯火阑珊·伪同层] 状态栏界面已加载');
});
