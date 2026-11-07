import { useEffect, useRef } from 'react';
import {
  BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/** Read a theme token, so charts follow the light/dark tokens like everything else. */
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const SERIES = ['--color-accent', '--color-neutral'];

function buildOptions({ horizontal, legend, stacked, tooltipLabel }) {
  const ink = token('--color-muted');
  const category = { ticks: { color: ink }, grid: { display: false }, border: { color: token('--color-neutral') }, stacked };
  const value = {
    beginAtZero: true,
    ticks: { color: ink, precision: 0 },
    grid: { color: token('--grid'), lineWidth: 1 },
    border: { display: false },
    stacked
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: {
        display: !!legend,
        position: 'bottom',
        labels: { color: ink, usePointStyle: true, pointStyle: 'rect', boxWidth: 10 }
      },
      tooltip: {
        backgroundColor: token('--color-surface'),
        titleColor: ink,
        bodyColor: token('--color-fg'),
        borderColor: token('--color-line'),
        borderWidth: 1,
        padding: 10,
        boxPadding: 4,
        callbacks: tooltipLabel ? { label: tooltipLabel } : undefined
      }
    },
    scales: horizontal ? { y: category, x: value } : { x: category, y: value }
  };
}

const DATASET_BASE = { borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24, borderColor: 'transparent' };

/**
 * @param datasets {Array<{label?, data, color|colors}>} colours are token names.
 */
export function BarChart({ labels, datasets, horizontal, legend, stacked, tooltipLabel, height = 260, ariaLabel }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    const chart = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels,
        datasets: datasets.map((d) => ({
          ...DATASET_BASE,
          label: d.label,
          data: d.data,
          backgroundColor: d.colors ? d.colors.map(token) : token(d.color || '--color-accent'),
          ...(stacked ? { borderColor: token('--color-surface'), borderWidth: 2 } : null)
        }))
      },
      options: buildOptions({ horizontal, legend, stacked, tooltipLabel })
    });
    chartRef.current = chart;
    return () => chart.destroy();
    // Rebuilding on every change keeps colours in step with the theme; these charts are small.
  }, [labels, datasets, horizontal, legend, stacked, tooltipLabel]);

  return (
    <div className="relative" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
}
