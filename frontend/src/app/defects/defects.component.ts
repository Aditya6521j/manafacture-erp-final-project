import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ChartData } from 'chart.js';
import { DefectService } from '../core/services/defect.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { ConfirmService } from '../shared/components/confirm.service';
import { DefectRecord } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';
import { PaginationComponent } from '../shared/components/pagination.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';
import { ChartComponent } from '../shared/components/chart.component';
import { DefectFormComponent } from './defect-form.component';

const RED = '#D93A3A';
const ORANGE = '#E8871E';
const STEEL = '#2563A8';
const PURPLE = '#6B4DBA';
const TEAL = '#0E9AA7';
const NAVY = '#12203F';

@Component({
  selector: 'app-defects',
  imports: [FormsModule, DatePipe, DecimalPipe, PageHeaderComponent, StatusBadgeComponent, PaginationComponent, EmptyStateComponent, ChartComponent, DefectFormComponent],
  template: `
    <app-page-header title="Defect Management" subtitle="Record rejections, drive corrective actions and analyse defect trends">
      @if (auth.can('defect:create')) {
        <button class="btn btn-primary btn-sm" (click)="openCreate()"><i class="bi bi-plus-lg"></i> Report Defect</button>
      }
    </app-page-header>

    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
      <div class="stat-card" style="--accent:#D93A3A;--accent-soft:#FDECEC">
        <div class="sc-top"><div><div class="sc-label">Defect records</div><div class="sc-value">{{ stats().total }}</div></div><div class="sc-icon"><i class="bi bi-exclamation-diamond"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#E8871E;--accent-soft:#FDF1E3">
        <div class="sc-top"><div><div class="sc-label">Defective units</div><div class="sc-value">{{ stats().totalQuantity | number }}</div></div><div class="sc-icon"><i class="bi bi-box-seam"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#6B4DBA;--accent-soft:#F0EBFB">
        <div class="sc-top"><div><div class="sc-label">In rework</div><div class="sc-value">{{ reworkUnits() | number }}</div></div><div class="sc-icon"><i class="bi bi-arrow-repeat"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#12A150;--accent-soft:#E6F7ED">
        <div class="sc-top"><div><div class="sc-label">Top category</div><div class="sc-value" style="font-size:16px">{{ topCategory() }}</div></div><div class="sc-icon"><i class="bi bi-bar-chart"></i></div></div>
      </div>
    </div>

    <div class="panel">
      <div class="tabs-line">
        <div class="tab-item" [class.active]="tab() === 'register'" (click)="tab.set('register')"><i class="bi bi-list-ul"></i> Defect register</div>
        <div class="tab-item" [class.active]="tab() === 'analytics'" (click)="tab.set('analytics')"><i class="bi bi-pie-chart"></i> Defect analysis</div>
      </div>

      @if (tab() === 'register') {
        <div class="toolbar">
          <div class="search-box">
            <i class="bi bi-search"></i>
            <input class="form-control" placeholder="Search defect no, product, batch…" [(ngModel)]="filters.search" (ngModelChange)="onSearch()" />
          </div>
          <select class="form-select" [(ngModel)]="filters.defectCategory" (ngModelChange)="load(1)">
            <option value="all">All categories</option>
            @for (category of categories; track category) { <option [value]="category">{{ category }}</option> }
          </select>
          <select class="form-select" [(ngModel)]="filters.severity" (ngModelChange)="load(1)">
            <option value="all">All severities</option>
            @for (severity of severities; track severity) { <option [value]="severity">{{ severity }}</option> }
          </select>
          <select class="form-select" [(ngModel)]="filters.status" (ngModelChange)="load(1)">
            <option value="all">All statuses</option>
            @for (status of recordStatuses; track status) { <option [value]="status">{{ status }}</option> }
          </select>
          <div class="toolbar-spacer"></div>
          <button class="btn btn-outline btn-sm" (click)="load(page())"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
        </div>

        <div class="table-shell">
          <table class="erp-table">
            <thead>
              <tr><th>Defect</th><th>Product / Batch</th><th>Category</th><th>Severity</th><th>Qty</th><th>Department</th><th>Rework</th><th>Status</th><th>Detected</th><th style="text-align:right">Actions</th></tr>
            </thead>
            <tbody>
              @for (defect of defects(); track defect._id) {
                <tr>
                  <td><span class="cell-mono">{{ defect.defectNumber }}</span><span class="cell-sub">{{ defect.reportedByName }}</span></td>
                  <td><span class="cell-strong">{{ defect.productName || '—' }}</span><span class="cell-sub">{{ defect.orderNumber || 'No order' }} · {{ defect.batchNumber }}</span></td>
                  <td><span class="b-chip">{{ defect.defectCategory }}</span></td>
                  <td><app-status-badge [status]="defect.severity" /></td>
                  <td><strong>{{ defect.quantity }}</strong></td>
                  <td>{{ departmentName(defect) }}</td>
                  <td><span class="b-chip">{{ defect.reworkStatus }}</span></td>
                  <td><app-status-badge [status]="defect.status" /></td>
                  <td>{{ defect.detectedDate | date: 'dd MMM yy' }}</td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-outline btn-icon" (click)="openDetail(defect)" title="Details"><i class="bi bi-eye"></i></button>
                      @if (auth.can('defect:update')) {
                        <button class="btn btn-outline btn-icon" (click)="openEdit(defect)" title="Edit"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-outline btn-icon" style="color:#D93A3A" (click)="remove(defect)" title="Delete"><i class="bi bi-trash3"></i></button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="10"><app-empty-state icon="bi-shield-check" title="No defect records" message="Excellent — no defects logged for the current filters." /></td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="page()" [limit]="limit()" [total]="total()" [pagesTotal]="pages()" (pageChange)="load($event)" (limitChange)="onLimit($event)" />
      }

      @if (tab() === 'analytics') {
        <div class="panel-body">
          <div class="chart-grid">
            <div class="chart-card">
              <div class="ch-head"><div><h3>Defects by category</h3><p>Rejected quantity per defect category</p></div></div>
              <app-chart type="bar" [data]="categoryChart()" [options]="barOptions()" height="250px" />
            </div>
            <div class="chart-card">
              <div class="ch-head"><div><h3>Severity split</h3><p>Minor / Major / Critical distribution</p></div></div>
              <app-chart type="doughnut" [data]="severityChart()" [options]="doughnutOptions()" height="250px" />
            </div>
            <div class="chart-card">
              <div class="ch-head"><div><h3>Monthly defect trend</h3><p>Defective units detected per month</p></div></div>
              <app-chart type="line" [data]="trendChart()" [options]="lineOptions()" height="250px" />
            </div>
            <div class="chart-card">
              <div class="ch-head"><div><h3>Rework disposition</h3><p>How defective units were dispositioned</p></div></div>
              <app-chart type="polarArea" [data]="reworkChart()" [options]="polarOptions()" height="250px" />
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Detail drawer -->
    @if (detail(); as defect) {
      <div class="modal-backdrop-c" (click)="detail.set(null)">
        <div class="modal-panel" style="max-width:620px" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <h3><i class="bi bi-exclamation-diamond" style="color:#D93A3A"></i> {{ defect.defectNumber }}</h3>
              <div class="sub">{{ defect.productName }} · {{ defect.defectCategory }}</div>
            </div>
            <button class="btn-ghost" style="border:none;background:none;cursor:pointer" (click)="detail.set(null)"><i class="bi bi-x-lg"></i></button>
          </div>
          <div class="modal-body">
            <div class="kv-grid" style="margin-bottom:14px">
              <div class="kv-item"><label>Severity</label><div><app-status-badge [status]="defect.severity" /></div></div>
              <div class="kv-item"><label>Quantity</label><div>{{ defect.quantity }} units</div></div>
              <div class="kv-item"><label>Rework status</label><div>{{ defect.reworkStatus }}</div></div>
              <div class="kv-item"><label>Record status</label><div><app-status-badge [status]="defect.status" /></div></div>
              <div class="kv-item"><label>Order</label><div>{{ defect.orderNumber || '—' }}</div></div>
              <div class="kv-item"><label>Batch</label><div>{{ defect.batchNumber || '—' }}</div></div>
              <div class="kv-item"><label>Department</label><div>{{ departmentName(defect) }}</div></div>
              <div class="kv-item"><label>Detected</label><div>{{ defect.detectedDate | date: 'dd MMM yyyy' }}</div></div>
            </div>
            <div style="margin-bottom:12px">
              <label class="form-label">Description</label>
              <p style="font-size:13px;color:#243455;margin:0">{{ defect.description }}</p>
            </div>
            @if (defect.rootCause) {
              <div style="margin-bottom:12px"><label class="form-label">Root cause</label><p style="font-size:13px;margin:0">{{ defect.rootCause }}</p></div>
            }
            @if (defect.correctiveAction) {
              <div style="margin-bottom:12px"><label class="form-label">Corrective action</label><p style="font-size:13px;margin:0">{{ defect.correctiveAction }}</p></div>
            }
            @if (defect.images?.length) {
              <div>
                <label class="form-label">Defect images</label>
                <div class="d-flex gap-2" style="flex-wrap:wrap">
                  @for (image of defect.images; track image) {
                    <img [src]="image" alt="Defect evidence" style="width:92px;height:92px;object-fit:cover;border-radius:10px;border:1px solid #E2E8F2" />
                  }
                </div>
              </div>
            }
          </div>
          <div class="modal-foot">
            <button class="btn btn-outline" (click)="detail.set(null)">Close</button>
            @if (auth.can('defect:update')) {
              <button class="btn btn-primary" (click)="openEdit(defect); detail.set(null)"><i class="bi bi-pencil"></i> Edit record</button>
            }
          </div>
        </div>
      </div>
    }

    <app-defect-form [open]="formOpen()" [defect]="editing()" (closed)="formOpen.set(false)" (saved)="afterSave()" />
  `,
})
export class DefectsComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly defectsApi = inject(DefectService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly tab = signal<'register' | 'analytics'>('register');
  readonly defects = signal<DefectRecord[]>([]);
  readonly detail = signal<DefectRecord | null>(null);
  readonly formOpen = signal(false);
  readonly editing = signal<DefectRecord | null>(null);

  readonly stats = signal({
    total: 0,
    totalQuantity: 0,
    byCategory: [] as { category: string; quantity: number; incidents: number }[],
    bySeverity: [] as { severity: string; quantity: number }[],
    byRework: [] as { status: string; quantity: number }[],
    byMonth: [] as { year: number; month: number; quantity: number; incidents: number }[],
  });

  readonly page = signal(1);
  readonly limit = signal(10);
  readonly total = signal(0);
  readonly pages = signal(1);

  readonly categories = ['Dimensional Defect', 'Surface Defect', 'Material Defect', 'Assembly Defect', 'Functional Defect', 'Packaging Defect'];
  readonly severities = ['Minor', 'Major', 'Critical'];
  readonly recordStatuses = ['Open', 'Under Analysis', 'In Progress', 'Closed'];
  filters = { search: '', defectCategory: 'all', severity: 'all', status: 'all' };
  private timer?: ReturnType<typeof setTimeout>;

  readonly reworkUnits = computed(() => this.stats().byRework.filter((r) => ['In Rework', 'Pending'].includes(r.status)).reduce((s, r) => s + r.quantity, 0));
  readonly topCategory = computed(() => this.stats().byCategory[0]?.category ?? '—');

  ngOnInit(): void {
    this.load(1);
    this.loadStats();
  }

  loadStats(): void {
    this.defectsApi.stats().subscribe({ next: (stats) => this.stats.set(stats) });
  }

  load(page = this.page()): void {
    this.page.set(page);
    this.defectsApi
      .list({
        page,
        limit: this.limit(),
        search: this.filters.search || undefined,
        defectCategory: this.filters.defectCategory,
        severity: this.filters.severity,
        status: this.filters.status,
      })
      .subscribe({
        next: (res) => {
          this.defects.set(res.data);
          this.total.set(res.meta?.total ?? 0);
          this.pages.set(res.meta?.pages ?? 1);
        },
      });
  }

  onSearch(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(1), 330);
  }

  onLimit(limit: number): void {
    this.limit.set(limit);
    this.load(1);
  }

  openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openDetail(defect: DefectRecord): void {
    this.detail.set(defect);
  }

  openEdit(defect: DefectRecord): void {
    this.editing.set(defect);
    this.formOpen.set(true);
  }

  afterSave(): void {
    this.load(this.page());
    this.loadStats();
  }

  async remove(defect: DefectRecord): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${defect.defectNumber}?`,
      message: 'This removes the defect record and its corrective action history.',
      confirmLabel: 'Delete record',
      danger: true,
    });
    if (!confirmed) return;
    this.defectsApi.remove(defect._id).subscribe({
      next: (res) => {
        this.toast.success('Defect deleted', res.message);
        this.load(this.page());
        this.loadStats();
      },
    });
  }

  departmentName(defect: DefectRecord): string {
    return typeof defect.responsibleDepartment === 'object' && defect.responsibleDepartment ? defect.responsibleDepartment.name : '—';
  }

  /* ---------------------------- analytics charts ---------------------------- */
  readonly categoryChart = computed<ChartData>(() => {
    const rows = this.stats().byCategory;
    return {
      labels: rows.map((r) => r.category.replace(' Defect', '')),
      datasets: [{ label: 'Defective units', data: rows.map((r) => r.quantity), backgroundColor: [RED, ORANGE, PURPLE, STEEL, TEAL, NAVY], borderRadius: 6, maxBarThickness: 34 }],
    };
  });

  readonly severityChart = computed<ChartData>(() => {
    const rows = this.stats().bySeverity;
    return {
      labels: rows.map((r) => r.severity),
      datasets: [{ data: rows.map((r) => r.quantity), backgroundColor: ['#A9B6CB', ORANGE, RED], borderWidth: 0 }],
    };
  });

  readonly trendChart = computed<ChartData>(() => {
    const rows = this.stats().byMonth;
    const labels = rows.map((r) => `${String(r.month).padStart(2, '0')}/${String(r.year).slice(2)}`);
    return {
      labels,
      datasets: [{
        label: 'Defective units', data: rows.map((r) => r.quantity), borderColor: RED,
        backgroundColor: 'rgba(217,58,58,0.10)', fill: true, tension: 0.36, pointRadius: 3, borderWidth: 2.2,
      }],
    };
  });

  readonly reworkChart = computed<ChartData>(() => {
    const rows = this.stats().byRework;
    return {
      labels: rows.map((r) => r.status),
      datasets: [{ data: rows.map((r) => r.quantity), backgroundColor: [ORANGE, PURPLE, '#12A150', RED, '#A9B6CB'], borderWidth: 0 }],
    };
  });

  readonly barOptions = computed(() => ({ plugins: { legend: { display: false } } }));
  readonly lineOptions = computed(() => ({ plugins: { legend: { display: false } } }));
  readonly doughnutOptions = computed(() => ({ cutout: '60%', plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 9, usePointStyle: true, pointStyle: 'circle' as const, padding: 12 } } } }));
  readonly polarOptions = computed(() => ({ plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 9, usePointStyle: true, pointStyle: 'circle' as const, padding: 10 } } } }));
}
