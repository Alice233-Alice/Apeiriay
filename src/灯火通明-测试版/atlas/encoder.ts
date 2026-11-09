/** Encode display textures in a worker. Canvas encoding on the window thread
 * waits for idle tasks in Chromium, including OffscreenCanvas.convertToBlob. */
export function createAtlasEncoder() {
  let worker: Worker | undefined;
  let url: string | undefined;
  let failed = false;
  let disposed = false;
  let serial = 0;
  const jobs = new Map<number, { resolve: (blob: Blob) => void; reject: (error: Error) => void }>();
  const stop = () => {
    worker?.terminate();
    worker = undefined;
    if (url) URL.revokeObjectURL(url);
    url = undefined;
    for (const job of jobs.values()) job.reject(new Error('Atlas encoder stopped'));
    jobs.clear();
  };
  const start = () => {
    if (worker) return worker;
    if (failed || disposed) throw new Error('Atlas encoder unavailable');
    try {
      url = URL.createObjectURL(
        new Blob(
          [
            `
        self.onmessage = async ({ data: { id, bitmap } }) => {
          let canvas;
          try {
            canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            canvas.getContext('2d').drawImage(bitmap, 0, 0);
            bitmap.close();
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            self.postMessage({ id, blob });
          } catch (error) {
            bitmap.close();
            self.postMessage({ id, error: String(error) });
          } finally {
            if (canvas) canvas.width = canvas.height = 1;
          }
        };
      `,
          ],
          { type: 'text/javascript' },
        ),
      );
      worker = new Worker(url);
      worker.onmessage = ({ data }: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
        const job = jobs.get(data.id);
        jobs.delete(data.id);
        if (!job) return;
        if (data.blob) job.resolve(data.blob);
        else job.reject(new Error(data.error || 'Atlas encoding failed'));
      };
      worker.onerror = () => {
        failed = true;
        stop();
      };
      return worker;
    } catch (error) {
      failed = true;
      stop();
      throw error;
    }
  };
  return {
    encode(canvas: OffscreenCanvas): Promise<Blob> {
      return new Promise((resolve, reject) => {
        const encoder = start();
        const id = ++serial;
        const bitmap = canvas.transferToImageBitmap();
        jobs.set(id, { resolve, reject });
        try {
          encoder.postMessage({ id, bitmap }, [bitmap]);
        } catch (error) {
          bitmap.close();
          jobs.delete(id);
          reject(error);
        }
      });
    },
    dispose() {
      disposed = true;
      stop();
    },
  };
}
