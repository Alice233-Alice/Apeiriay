import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
import { Schema } from '../灯火阑珊/schema';
import { installExtraAnalysisPromptGuard } from './extra-analysis-prompt';
import { installMvuCommandCompatibility } from './guard';

$(() => {
  let stopCompatibility: () => void = () => undefined;
  let stopPromptGuard: () => void = () => undefined;

  errorCatched(async () => {
    await waitGlobalInitialized('Mvu');
    registerMvuSchema(Schema);
    stopCompatibility = installMvuCommandCompatibility();
    stopPromptGuard = installExtraAnalysisPromptGuard();
    console.info('[灯火阑珊] MVU 变量结构与命令兼容已注册');
    toastr.success('MVU 变量结构已成功注册', '灯火阑珊');
  })();

  $(window).on('pagehide', () => {
    stopCompatibility();
    stopPromptGuard();
  });
});
