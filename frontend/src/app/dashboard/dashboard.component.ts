import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChartData } from 'chart.js';
import { DashboardService } from '../core/services/dashboard.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { DashboardOverview } from '../core/models';
import { StatCardComponent } from '../shared/components/stat-card.component';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { ChartComponent } from '../shared/components/chart.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';

const NAVY = '#12203F';
const STEEL = '#2563A8';
const STEEL_LIGHT = '#7FB1E8';
const GREEN = '#12A150';
const ORANGE = '#E8871E';
const RED = '#D93A3A';
const PURPLE = '#6B4DBA';
const TEAL = '#0E9AA7';

@Component({
  selector: 'app-dashboard',
  imports: [StatCardComponent, PageHeaderComponent, ChartComponent, StatusBadgeComponent, RouterLink, DatePipe, DecimalPipe],
  template: `
    <app-page-header title="Factory Dashboard" [subtitle]="subtitle()">
      <a class="btn btn-outline btn-sm" routerLink="/reports"><i class="bi bi-file-earmark-bar-graph"></i> Reports</a>
      <button class="btn btn-primary btn-sm" (click)="load()" [disabled]="loading()">
        <i class="bi bi-arrow-clockwise" [class.spin]="loading()"></i> Refresh
      </button>
    </app-page-header>

    @if (loading() && !data()) {
      <div class="stat-grid">
        @for (n of [1,2,3,4,5,6,7,8]; track n) {
          <div class="stat-card" style="height:104px"><div class="skeleton" style="height:100%;width:100%"></div></div>
        }
      </div>
      <div class="panel" style="height:320px"><div class="skeleton" style="height:100%"></div></div>
    }

    @if (data(); as d) {
      <!-- Low stock / breakdown alert strip -->
      @if (d.stats.lowStockMaterials > 0 || d.stats.machinesBreakdown > 0) {
        <div class="alert-strip warning">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <div>
            <strong>Attention required:</strong>
            @if (d.stats.lowStockMaterials > 0) { {{ d.stats.lowStockMaterials }} raw material(s) below minimum stock level. }
            @if (d.stats.machinesBreakdown > 0) { {{ d.stats.machinesBreakdown }} machine(s) in breakdown — check maintenance logs. }
            <a routerLink="/notifications" style="font-weight:700;color:#8A5310;text-decoration:underline">View alerts</a>
          </div>
        </div>
      }

      <!-- KPI cards -->
      <div class="stat-grid">
        <app-stat-card label="Total Production Orders" [value]="d.stats.totalProductionOrders" icon="bi-diagram-3" accent="blue"
                       [hint]="d.stats.inProgressOrders + ' currently in progress'" />
        <app-stat-card label="Completed Orders" [value]="d.stats.completedProductionOrders" icon="bi-check2-circle" accent="green"
                       [hint]="completionRate() + '% completion rate'" trend="up" />
        <app-stat-card label="Pending Orders" [value]="d.stats.pendingProductionOrders" icon="bi-hourglass-split" accent="orange"
                       hint="Planned, approved, running or on hold" />
        <app-stat-card label="Products Manufactured" [value]="(d.stats.totalProductsManufactured | number)" icon="bi-box-seam" accent="navy"
                       hint="Units produced across all orders" />
        <app-stat-card label="Defective Products" [value]="(d.stats.defectiveProducts | number)" icon="bi-x-octagon" accent="red"
                       [hint]="d.stats.defectPercentage + '% defect rate'" trend="down" />
        <app-stat-card label="Quality Pass %" [value]="d.stats.qualityPassPercentage + '%'" icon="bi-patch-check" accent="teal"
                       [hint]="'Based on ' + (d.stats.totalInspected | number) + ' inspected units'" />
        <app-stat-card label="Available Raw Materials" [value]="d.stats.availableRawMaterials" icon="bi-boxes" accent="purple"
                       [hint]="d.stats.lowStockMaterials + ' below minimum level'" />
        <app-stat-card label="Active Machines" [value]="d.stats.activeMachines + ' / ' + d.stats.totalMachines" icon="bi-cpu" accent="green"
                       [hint]="d.stats.machinesUnderMaintenance + ' under maintenance'" />
      </div>

      <!-- Charts -->
      <div class="chart-grid" style="margin-bottom:18px">
        <div class="chart-card">
          <div class="ch-head">
            <div><h3>Monthly Production Overview</h3><p>Target vs actual output — last 6 months</p></div>
          </div>
          <app-chart type="bar" [data]="productionChart()" [options]="productionOptions()" height="265px" />
        </div>

        <div class="chart-card">
          <div class="ch-head">
            <div><h3>Product Quality Analysis</h3><p>Inspection results by batch status</p></div>
          </div>
          <app-chart type="doughnut" [data]="qualityChart()" [options]="doughnutOptions()" height="265px" />
        </div>

        <div class="chart-card">
          <div class="ch-head">
            <div><h3>Target vs Actual Production</h3><p>Cumulative achievement trend</p></div>
          </div>
          <app-chart type="line" [data]="targetChart()" [options]="lineOptions()" height="265px" />
        </div>

        <div class="chart-card">
          <div class="ch-head">
            <div><h3>Defect Rate Analysis</h3><p>Defect % against pass % per month</p></div>
          </div>
          <app-chart type="line" [data]="defectRateChart()" [options]="lineOptions()" height="265px" />
        </div>

        <div class="chart-card">
          <div class="ch-head">
            <div><h3>Machine Utilization</h3><p>Utilization % by machine</p></div>
          </div>
          <app-chart type="bar" [data]="machineChart()" [options]="machineOptions()" height="265px" />
        </div>

        <div class="chart-card">
          <div class="ch-head">
            <div><h3>Raw Material Consumption</h3><p>Top consumed materials</p></div>
          </div>
          <app-chart type="bar" [data]="materialChart()" [options]="materialOptions()" height="265px" />
        </div>
      </div>

      <!-- Activity / tasks / alerts -->
      <div style="display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:16px" class="dash-bottom">
        <div class="panel" style="margin:0">
          <div class="panel-head">
            <h3><i class="bi bi-activity"></i> Recent Activity</h3>
            <span class="hint">Live feed</span>
          </div>
          <div class="feed">
            @for (activity of d.activities; track activity.id) {
              <div class="feed-item" [routerLink]="activity.link">
                <div class="feed-icon" [class]="activity.icon">
                  <i class="bi" [class]="activityIcon(activity.icon)"></i>
                </div>
                <div class="feed-body">
                  <div class="feed-title">{{ activity.title }}</div>
                  <div class="feed-detail">{{ activity.detail }}</div>
                </div>
                <div class="feed-time">{{ activity.timestamp | date: 'dd MMM, HH:mm' }}</div>
              </div>
            } @empty {
              <div class="empty-state" style="padding:30px"><i class="bi bi-activity"></i><strong>No activity yet</strong><p>Actions across production and quality will appear here.</p></div>
            }
          </div>
        </div>

        <div class="panel" style="margin:0">
          <div class="panel-head">
            <h3><i class="bi bi-list-task"></i> Pending Tasks</h3>
            <span class="hint">{{ pendingCount() }} open</span>
          </div>
          <div style="padding:6px 0">
            @for (task of d.pendingTasks.production; track task.id) {
              <div class="feed-item" routerLink="/production">
                <div class="feed-icon production"><i class="bi bi-diagram-3"></i></div>
                <div class="feed-body">
                  <div class="feed-title">{{ task.title }}</div>
                  <div class="progress-thin" style="margin-top:5px" [class.red]="task.overdue" [class.green]="task.progress >= 100">
                    <span [style.width.%]="task.progress"></span>
                  </div>
                  <div class="progress-label">{{ task.progress }}% complete · due {{ task.due | date: 'dd MMM' }}</div>
                </div>
                @if (task.overdue) { <app-status-badge status="Delayed" /> }
              </div>
            }
            @for (approval of d.pendingTasks.approvals; track approval.id) {
              <div class="feed-item" routerLink="/quality-control">
                <div class="feed-icon quality"><i class="bi bi-clipboard2-check"></i></div>
                <div class="feed-body">
                  <div class="feed-title">{{ approval.title }}</div>
                  <div class="feed-detail">Awaiting inspection approval</div>
                </div>
                <app-status-badge status="Pending" />
              </div>
            }
            @for (maint of d.pendingTasks.maintenance; track maint.id) {
              <div class="feed-item" routerLink="/machines">
                <div class="feed-icon machine"><i class="bi bi-gear-wide-connected"></i></div>
                <div class="feed-body">
                  <div class="feed-title">{{ maint.title }}</div>
                  <div class="feed-detail">Maintenance due {{ maint.due | date: 'dd MMM' }}</div>
                </div>
              </div>
            }
            @if (pendingCount() === 0) {
              <div class="empty-state" style="padding:30px"><i class="bi bi-check2-all"></i><strong>All clear</strong><p>No pending production tasks.</p></div>
            }
          </div>
        </div>

        <div class="panel" style="margin:0">
          <div class="panel-head">
            <h3><i class="bi bi-bell"></i> Alerts &amp; Notifications</h3>
            <a routerLink="/notifications" class="hint" style="font-weight:600">View all</a>
          </div>
          <div>
            @for (note of d.notifications; track note._id) {
              <div class="notif-item">
                <div class="n-icon" [class]="note.type"><i class="bi" [class]="notificationIcon(note.type)"></i></div>
                <div>
                  <div class="n-title">{{ note.title }}</div>
                  <div class="n-msg">{{ note.message }}</div>
                  <div class="n-meta">{{ note.createdAt | date: 'dd MMM, hh:mm a' }}</div>
                </div>
              </div>
            } @empty {
              <div class="empty-state" style="padding:30px"><i class="bi bi-bell-slash"></i><strong>No alerts</strong><p>Everything looks healthy.</p></div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      @media (max-width: 1200px) {
        .dash-bottom { grid-template-columns: 1fr !important; }
      }
      .spin { animation: spin 0.8s linear infinite; display: inline-block; }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly data = signal<DashboardOverview | null>(null);
  readonly loading = signal(false);

  readonly subtitle = computed(() => {
    const name = this.auth.user()?.name?.split(' ')[0] ?? 'there';
    return `Good to see you, ${name}. Here is the live status of Plant 1 — Line A.`;
  });

  checklist: { completed: number } | null = null;

  readonly completionRate = computed(() => {
    const stats = this.data()?.stats;
    if (!stats?.totalProductionOrders) return 0;
    return Math.round((stats.completedProductionOrders / stats.totalProductionOrders) * 100);
  });

  readonly pendingCount = computed(() => {
    const tasks = this.data()?.pendingTasks;
    if (!tasks) return 0;
    return tasks.production.length + tasks.approvals.length + tasks.maintenance.length;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.dashboard.overview().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Dashboard unavailable', 'Could not load dashboard statistics.');
      },
    });
  }

  /* ------------------------------ chart data ------------------------------ */
  readonly productionChart = computed<ChartData>(() => {
    const points = this.data()?.monthlyProduction ?? [];
    return {
      labels: points.map((p) => p.label),
      datasets: [
        { label: 'Target', data: points.map((p) => p.target), backgroundColor: '#C9DAEE', borderRadius: 5, maxBarThickness: 26 },
        { label: 'Actual', data: points.map((p) => p.actual), backgroundColor: STEEL, borderRadius: 5, maxBarThickness: 26 },
      ],
    };
  });

  readonly productionOptions = computed(() => ({
    plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 9, usePointStyle: true, pointStyle: 'circle' as const, padding: 14 } } },
  }));

  readonly targetChart = computed<ChartData>(() => {
    const points = this.data()?.monthlyProduction ?? [];
    return {
      labels: points.map((p) => p.label),
      datasets: [
        {
          label: 'Actual production',
          data: points.map((p) => p.actual),
          borderColor: GREEN,
          backgroundColor: 'rgba(18,161,80,0.12)',
          fill: true,
          tension: 0.38,
          pointRadius: 3,
          pointBackgroundColor: GREEN,
          borderWidth: 2.4,
        },
        {
          label: 'Target',
          data: points.map((p) => p.target),
          borderColor: STEEL_LIGHT,
          borderDash: [5, 4],
          fill: false,
          tension: 0.38,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    };
  });

  readonly qualityChart = computed<ChartData>(() => {
    const byStatus = this.data()?.quality.byStatus ?? {};
    const labels = ['Passed', 'Failed', 'Rework Required', 'Pending Inspection'];
    const values = labels.map((l) => byStatus[l] ?? 0);
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: [GREEN, RED, ORANGE, '#A9B6CB'],
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    };
  });

  readonly defectRateChart = computed<ChartData>(() => {
    const trend = this.data()?.quality.trend ?? [];
    return {
      labels: trend.map((t) => t.label),
      datasets: [
        {
          label: 'Pass %',
          data: trend.map((t) => t.passPercentage),
          borderColor: GREEN,
          backgroundColor: 'rgba(18,161,80,0.10)',
          fill: true,
          tension: 0.36,
          pointRadius: 3,
          borderWidth: 2.2,
        },
        {
          label: 'Defect %',
          data: trend.map((t) => t.defectPercentage),
          borderColor: RED,
          backgroundColor: 'rgba(217,58,58,0.08)',
          fill: true,
          tension: 0.36,
          pointRadius: 3,
          borderWidth: 2.2,
        },
      ],
    };
  });

  readonly machineChart = computed<ChartData>(() => {
    const machines = this.data()?.machines ?? [];
    return {
      labels: machines.map((m) => m.machineCode),
      datasets: [
        {
          label: 'Utilization %',
          data: machines.map((m) => m.utilizationPercentage),
          backgroundColor: machines.map((m) =>
            m.status === 'Breakdown' ? RED : m.status === 'Under Maintenance' ? PURPLE : m.status === 'Idle' ? '#A9B6CB' : TEAL
          ),
          borderRadius: 5,
          maxBarThickness: 30,
        },
      ],
    };
  });

  readonly machineOptions = computed(() => ({
    plugins: { legend: { display: false } },
    scales: { y: { max: 100, grid: { color: '#EEF2F8' }, border: { display: false } } },
  }));

  readonly materialChart = computed<ChartData>(() => {
    const materials = this.data()?.materials ?? [];
    return {
      labels: materials.map((m) => m.material),
      datasets: [
        {
          label: 'Consumed qty',
          data: materials.map((m) => m.consumed),
          backgroundColor: ORANGE,
          borderRadius: 5,
          maxBarThickness: 22,
        },
      ],
    };
  });

  readonly materialOptions = computed(() => ({
    indexAxis: 'y' as const,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { color: '#EEF2F8' }, border: { display: false } }, y: { grid: { display: false }, border: { display: false } } },
  }));

  readonly lineOptions = computed(() => ({
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 9, usePointStyle: true, pointStyle: 'circle' as const, padding: 14 } },
    },
  }));

  readonly doughnutOptions = computed(() => ({
    cutout: '62%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { boxWidth: 9, usePointStyle: true, pointStyle: 'circle' as const, padding: 12 } },
    },
  }));

  activityIcon(icon: string): string {
    const map: Record<string, string> = { production: 'bi-diagram-3', quality: 'bi-clipboard2-check', defect: 'bi-exclamation-diamond', machine: 'bi-cpu' };
    return map[icon] ?? 'bi-activity';
  }

  notificationIcon(type: string): string {
    const map: Record<string, string> = {
      low_stock: 'bi-box-seam', breakdown: 'bi-tools', quality_failure: 'bi-x-octagon',
      deadline: 'bi-clock-history', delayed: 'bi-alarm', approval: 'bi-patch-check',
      maintenance: 'bi-gear-wide-connected', system: 'bi-info-circle',
    };
    return map[type] ?? 'bi-info-circle';
  }
}
