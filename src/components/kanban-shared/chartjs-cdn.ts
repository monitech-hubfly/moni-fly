/** Chart.js 4 UMD (CDN) — tipagem mínima para uso com `window.Chart`. */
export const CHART_JS_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';

export type ChartJsGlobal = {
  Chart: new (ctx: CanvasRenderingContext2D | HTMLCanvasElement, config: unknown) => { destroy: () => void; update: () => void };
};

export function loadChartJsFromCdn(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const w = window as unknown as { Chart?: ChartJsGlobal['Chart'] };
  if (w.Chart) return Promise.resolve();

  const existing = document.querySelector(`script[data-chartjs-cdn="1"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (w.Chart) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Chart.js CDN')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CHART_JS_CDN_URL;
    s.async = true;
    s.dataset.chartjsCdn = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Chart.js CDN'));
    document.head.appendChild(s);
  });
}

export function getChartConstructor(): ChartJsGlobal['Chart'] | null {
  if (typeof window === 'undefined') return null;
  const C = (window as unknown as { Chart?: ChartJsGlobal['Chart'] }).Chart;
  return C ?? null;
}
