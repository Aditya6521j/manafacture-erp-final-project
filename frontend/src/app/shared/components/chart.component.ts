import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import {
  BarController, BarElement, CategoryScale, Chart, ChartConfiguration, ChartData, ChartOptions, ChartType,
  DoughnutController, Filler, Legend, LineController, LineElement, LinearScale, PointElement, PolarAreaController,
  RadialLinearScale, ArcElement, Title, Tooltip,
} from 'chart.js';

Chart.register(
  BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, PolarAreaController,
  ArcElement, CategoryScale, LinearScale, RadialLinearScale, Filler, Legend, Title, Tooltip
);

Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.color = '#7A8AA5';

/** Reusable Chart.js wrapper — re-renders whenever the data/type inputs change. */
@Component({
  selector: 'app-chart',
  template: `
    <div class="chart-canvas-wrap" [style.height]="height()">
      <canvas #canvas></canvas>
    </div>
  `,
})
export class ChartComponent implements AfterViewInit, OnDestroy {
  readonly type = input<ChartType>('bar');
  readonly data = input.required<ChartData>();
  readonly options = input<ChartOptions>({});
  readonly height = input('260px');

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;
  private ready = false;

  constructor() {
    effect(() => {
      // Track inputs so the effect re-runs on change
      const type = this.type();
      const data = this.data();
      const options = this.options();
      if (this.ready) this.render(type, data, options);
    });
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.render(this.type(), this.data(), this.options());
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(type: ChartType, data: ChartData, options: ChartOptions): void {
    const base: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'circle', padding: 14 } },
        tooltip: {
          backgroundColor: '#12203F', titleColor: '#fff', bodyColor: '#C8D5E8', padding: 10,
          cornerRadius: 8, titleFont: { size: 12, weight: 600 }, bodyFont: { size: 11.5 }, displayColors: true, boxPadding: 4,
        },
      },
    };

    const merged: ChartOptions = {
      ...base,
      ...options,
      plugins: { ...base.plugins, ...(options.plugins ?? {}) },
      scales: type === 'doughnut' || type === 'pie' || type === 'polarArea' ? undefined : {
        x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#EEF2F8' }, border: { display: false }, beginAtZero: true, ticks: { font: { size: 11 }, precision: 0 } },
        ...(options.scales ?? {}),
      },
    } as ChartOptions;

    const config = { type, data, options: merged } as ChartConfiguration;

    if (this.chart) {
      this.chart.destroy();
    }
    this.chart = new Chart(this.canvasRef().nativeElement, config);
  }
}
