import type { Chart, Plugin } from 'chart.js';

export type DataLabelsPluginOptions = {
  /** Text color for labels on bars */
  isDark?: boolean;
  /** Skip drawing labels (boolean) or by dataset index (fn). */
  skipDataset?: boolean | ((datasetIndex: number) => boolean);
};

declare module 'chart.js' {
  interface PluginOptionsByType<TType> {
    dataLabels?: DataLabelsPluginOptions;
  }
}

/**
 * Reusable Chart.js plugin: numeric/value labels on bar endpoints.
 * Register once globally or per-chart via options.plugins.dataLabels
 */
export function createDataLabelsPlugin(defaults: DataLabelsPluginOptions = {}): Plugin {
  return {
    id: 'dataLabels',
    afterDatasetsDraw(chart: Chart) {
      const opts = (chart.options.plugins as { dataLabels?: DataLabelsPluginOptions } | undefined)?.dataLabels;
      const isDark = opts?.isDark ?? defaults.isDark ?? false;
      const skipDataset = opts?.skipDataset ?? defaults.skipDataset;

      const { ctx } = chart;
      chart.data.datasets.forEach((ds, di) => {
        const shouldSkip =
          typeof skipDataset === 'function'
            ? skipDataset(di)
            : Boolean(skipDataset);
        if (shouldSkip) return;
        const meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        meta.data.forEach((bar, i) => {
          const raw = ds.data[i];
          let val: number | null = typeof raw === 'number' ? raw : null;
          if (Array.isArray(raw) && raw.length >= 2) {
            const lo = Number(raw[0]);
            const hi = Number(raw[1]);
            if (Number.isFinite(lo) && Number.isFinite(hi)) val = hi - lo;
          }
          if (val == null || Number.isNaN(val)) return;
          if (val === 0 && (ds as { skipZeroLabels?: boolean }).skipZeroLabels) return;

          ctx.save();
          ctx.fillStyle = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.65)';
          ctx.font = '500 10px sans-serif';
          const isHorizontal = chart.options.indexAxis === 'y';
          const fmt = (ds as { dataLabelFormat?: (v: number, i: number) => string }).dataLabelFormat;
          const text = String(fmt ? fmt(val, i) : val);
          if (isHorizontal) {
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            const x = (bar as { x: number }).x + 5;
            const y = (bar as { y: number }).y;
            ctx.fillText(text, x, y);
          } else {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            const x = (bar as { x: number }).x;
            const y = (bar as { y: number }).y - 4;
            ctx.fillText(text, x, y);
          }
          ctx.restore();
        });
      });
    },
  };
}

export const dataLabelsPlugin = createDataLabelsPlugin({ isDark: false });
