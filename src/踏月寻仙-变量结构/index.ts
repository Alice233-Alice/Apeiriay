import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
import { Schema } from '../灯火阑珊/schema';
import { installExtraAnalysisPromptGuard } from '../灯火阑珊-变量结构/extra-analysis-prompt';
import { installMvuCommandCompatibility } from '../灯火阑珊-变量结构/guard';

$(() => {
  let stopCompatibility: () => void = () => undefined;
  let stopPromptGuard: () => void = () => undefined;

  errorCatched(async () => {
    await waitGlobalInitialized('Mvu');
    registerMvuSchema(Schema);
    stopCompatibility = installMvuCommandCompatibility();
    stopPromptGuard = installExtraAnalysisPromptGuard();
    console.warn('[灯火阑珊] 正通过旧文件名加载；已转接变量结构与命令兼容');
  })();

  $(window).on('pagehide', () => {
    stopCompatibility();
    stopPromptGuard();
  });
});
