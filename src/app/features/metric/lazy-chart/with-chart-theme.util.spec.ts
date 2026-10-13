import type { ChartOptions } from 'chart.js';
import { withChartTheme } from './with-chart-theme.util';

describe('withChartTheme', () => {
  const colors = { text: '#eeeeee', grid: '#333333', font: 'system-ui' };

  it('themes labels and both axes while keeping caller options immutable', () => {
    const options: ChartOptions = {
      scales: { y: { ticks: { precision: 0 } }, x: { grid: { display: false } } },
      plugins: { legend: { display: false } },
    };
    const before = JSON.stringify(options);
    const result = withChartTheme(options, colors, true);
    expect(result.scales?.['y']?.ticks?.color).toBe(colors.text);
    expect(result.scales?.['y']?.ticks).toEqual(
      jasmine.objectContaining({ precision: 0 }),
    );
    expect(result.scales?.['x']?.grid?.color).toBe(colors.grid);
    expect(result.scales?.['x']?.grid?.display).toBeFalse();
    expect(result.plugins?.legend?.display).toBeFalse();
    expect(result.plugins?.legend?.labels?.color).toBe(colors.text);
    expect(JSON.stringify(options)).toBe(before);
  });

  it('preserves explicit colors, custom axes and callbacks', () => {
    const onClick = jasmine.createSpy('onClick');
    const tickFont = jasmine.createSpy('tickFont').and.returnValue({ size: 16 });
    const options: ChartOptions = {
      onClick,
      scales: {
        custom: { ticks: { color: 'red', font: tickFont }, grid: { color: 'blue' } },
      },
      plugins: { legend: { labels: { color: 'green' } } },
    };
    const result = withChartTheme(options, colors, true);
    expect(result.scales?.['custom']?.ticks?.color).toBe('red');
    expect(result.scales?.['custom']?.grid?.color).toBe('blue');
    expect(result.scales?.['x']).toBeUndefined();
    expect(result.plugins?.legend?.labels?.color).toBe('green');
    expect(result.onClick).toBe(onClick);
    expect(result.scales?.['custom']?.ticks?.font).toBe(tickFont);
  });

  it('adds axes only for cartesian charts and updates defaults on a theme change', () => {
    expect(withChartTheme({}, colors, false).scales).toBeUndefined();
    expect(withChartTheme({}, colors, true).scales?.['x']?.ticks?.color).toBe(
      colors.text,
    );
    const light = { ...colors, text: '#222222', grid: '#dddddd' };
    expect(withChartTheme({}, light, true).scales?.['y']?.grid?.color).toBe(light.grid);
  });
});
