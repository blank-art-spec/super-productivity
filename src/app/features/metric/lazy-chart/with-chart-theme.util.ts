import type { ChartOptions } from 'chart.js';

export interface ChartThemeColors {
  text: string;
  grid: string;
  font: string;
}

/** Canvas cannot inherit CSS colors. Apply theme defaults without mutating caller options. */
export const withChartTheme = (
  options: ChartOptions,
  colors: ChartThemeColors,
  hasCartesianAxes: boolean,
): ChartOptions => {
  const hasDefaultAxes =
    !options.scales || 'x' in options.scales || 'y' in options.scales;
  const scales =
    hasCartesianAxes && hasDefaultAxes
      ? { x: {}, y: {}, ...options.scales }
      : options.scales;
  return {
    color: colors.text,
    ...options,
    scales: scales
      ? Object.fromEntries(
          Object.entries(scales).map(([id, scale]) => [
            id,
            {
              ...scale,
              ticks: {
                color: colors.text,
                ...scale?.ticks,
                font: scale?.ticks?.font ?? { family: colors.font },
              },
              grid: { color: colors.grid, ...scale?.grid },
            },
          ]),
        )
      : undefined,
    plugins: {
      ...options.plugins,
      legend: {
        ...options.plugins?.legend,
        labels: {
          color: colors.text,
          ...options.plugins?.legend?.labels,
          font: options.plugins?.legend?.labels?.font ?? { family: colors.font },
        },
      },
    },
  };
};
