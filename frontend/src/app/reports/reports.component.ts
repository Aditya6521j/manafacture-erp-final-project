import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ReportService } from '../core/services/report.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { ReportData } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';

interface ReportCard {
  key: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
}

@Component({
  selector: 'app-reports',
  imports: [FormsModule, DatePipe, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Reports & Analytics" subtitle="Generate production, quality, inventory and workforce reports — download as Excel or PDF">
      <button class="btn btn-outline btn-sm" (click)="preview()" [disabled]="loading()">
        <i class="bi bi-eye"></i> Preview
      </button>
      @if (auth.can('report:download')) {
        <button class="btn btn-success btn-sm" (click)="download('xlsx')" [disabled]="downloading()">
          <i class="bi bi-file-earmark-excel"></i> Excel
        </button>
        <button class="btn btn-danger btn-sm" (click)="download('pdf')" [disabled]="downloading()">
          <i class="bi bi-file-earmark-pdf"></i> PDF
        </button>
      }
    </app-page-header>

    <div class="panel">
      <div class="panel-head">
        <h3><i class="bi bi-funnel"></i> Report configuration</h3>
        <span class="hint">Choose a report type and date range</span>
      </div>
      <div class="panel-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-bottom:18px">
          @for (card of reportCards; track card.key) {
            <div (click)="select(card.key)"
                 style="border:1px solid #E2E8F2;border-radius:12px;padding:12px 14px;cursor:pointer;transition:all .16s;display:flex;gap:11px;align-items:flex-start"
                 [style.background]="selected() === card.key ? '#F2F7FD' : '#fff'"
                 [style.borderColor]="selected() === card.key ? '#9CC1E8' : '#E2E8F2'"
                 [style.boxShadow]="selected() === card.key ? '0 4px 14px rgba(37,99,168,.12)' : 'none'">
              <div style="width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:0 0 34px"
                   [style.background]="card.accent + '18'" [style.color]="card.accent">
                <i class="bi" [class]="card.icon"></i>
              </div>
              <div>
                <div style="font-size:13px;font-weight:700;color:#101A2E">{{ card.title }}</div>
                <div style="font-size:11.6px;color:#7A8AA5;line-height:1.4">{{ card.description }}</div>
              </div>
            </div>
          }
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div>
            <label class="form-label">From date</label>
            <input type="date" class="form-control" [(ngModel)]="from" style="width:auto" />
          </div>
          <div>
            <label class="form-label">To date</label>
            <input type="date" class="form-control" [(ngModel)]="to" style="width:auto" />
          </div>
          <button class="btn btn-soft btn-sm" (click)="setRange(7)">Last 7 days</button>
          <button class="btn btn-soft btn-sm" (click)="setRange(30)">Last 30 days</button>
          <button class="btn btn-soft btn-sm" (click)="setRange(90)">Last quarter</button>
          <button class="btn btn-soft btn-sm" (click)="clearRange()">All time</button>
          <div class="toolbar-spacer"></div>
          <button class="btn btn-primary" (click)="preview()" [disabled]="loading()">
            @if (loading()) { <span class="spinner"></span> <span>Generating…</span> } @else { <i class="bi bi-play-fill"></i> <span>Generate report</span> }
          </button>
        </div>
      </div>
    </div>

    @if (report(); as data) {
      <div class="panel">
        <div class="panel-head">
          <h3><i class="bi bi-table"></i> {{ data.title }}</h3>
          <span class="hint">Generated {{ data.generatedAt | date: 'dd MMM yyyy, HH:mm' }}</span>
        </div>

        <div class="panel-body" style="border-bottom:1px solid #EDF1F8">
          <div class="d-flex gap-2" style="flex-wrap:wrap">
            @for (item of data.summary; track item.label) {
              <div style="background:#F7F9FD;border:1px solid #E2E8F2;border-radius:10px;padding:9px 14px;min-width:130px">
                <div style="font-size:10.4px;text-transform:uppercase;letter-spacing:.08em;color:#7A8AA5;font-weight:800">{{ item.label }}</div>
                <div style="font-size:17px;font-weight:800;color:#12203F">{{ item.value }}</div>
              </div>
            }
          </div>
        </div>

        <div class="table-shell" style="max-height:520px;overflow-y:auto">
          <table class="erp-table">
            <thead>
              <tr>@for (column of data.columns; track column.key) { <th>{{ column.header }}</th> }</tr>
            </thead>
            <tbody>
              @for (row of data.rows; track $index) {
                <tr>@for (column of data.columns; track column.key) { <td>{{ cell(row, column.key) }}</td> }</tr>
              } @empty {
                <tr><td [attr.colspan]="data.columns.length">
                  <app-empty-state icon="bi-inbox" title="No records in this period" message="Try widening the date range." />
                </td></tr>
              }
            </tbody>
          </table>
        </div>

        <div class="pagination-bar">
          <div class="meta">{{ data.rows.length }} row(s) · {{ data.from || 'All time' }} → {{ data.to || 'Today' }}</div>
          <div class="d-flex gap-2">
            @if (auth.can('report:download')) {
              <button class="btn btn-success btn-sm" (click)="download('xlsx')"><i class="bi bi-file-earmark-excel"></i> Download Excel</button>
              <button class="btn btn-danger btn-sm" (click)="download('pdf')"><i class="bi bi-file-earmark-pdf"></i> Download PDF</button>
            }
          </div>
        </div>
      </div>
    } @else if (!loading()) {
      <div class="panel"><div class="panel-body">
        <app-empty-state icon="bi-graph-up-arrow" title="No report generated yet"
                         message="Pick a report type above and click Generate report to preview the data." />
      </div></div>
    }
  `,
})
export class ReportsComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly reports = inject(ReportService);
  private readonly toast = inject(ToastService);

  readonly report = signal<ReportData | null>(null);
  readonly loading = signal(false);
  readonly downloading = signal(false);
  readonly selected = signal('production-efficiency');

  from = '';
  to = '';

  readonly reportCards: ReportCard[] = [
    { key: 'daily-production', title: 'Daily Production', description: 'Order wise output for the selected day', icon: 'bi-calendar-day', accent: '#2563A8' },
    { key: 'weekly-production', title: 'Weekly Production', description: 'Weekly production volume and completion', icon: 'bi-calendar-week', accent: '#0E9AA7' },
    { key: 'monthly-production', title: 'Monthly Production', description: 'Monthly target vs achieved output', icon: 'bi-calendar-month', accent: '#12203F' },
    { key: 'production-efficiency', title: 'Production Efficiency', description: 'Planned vs produced with efficiency %', icon: 'bi-speedometer', accent: '#12A150' },
    { key: 'quality-inspection', title: 'Quality Inspection', description: 'Inspection results, pass % and rejects', icon: 'bi-clipboard2-check', accent: '#0E9AA7' },
    { key: 'defect-analysis', title: 'Defect Analysis', description: 'Defect categories, severity and rework', icon: 'bi-exclamation-diamond', accent: '#D93A3A' },
    { key: 'material-consumption', title: 'Raw Material Consumption', description: 'Stock, consumption and reorder status', icon: 'bi-boxes', accent: '#E8871E' },
    { key: 'machine-utilization', title: 'Machine Utilization', description: 'Operating hours and utilization %', icon: 'bi-cpu', accent: '#6B4DBA' },
    { key: 'employee-performance', title: 'Employee Performance', description: 'Tasks completed and performance scores', icon: 'bi-people', accent: '#2563A8' },
  ];

  ngOnInit(): void {
    this.preview();
  }

  select(key: string): void {
    this.selected.set(key);
    this.preview();
  }

  setRange(days: number): void {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    this.from = from.toISOString().slice(0, 10);
    this.to = to.toISOString().slice(0, 10);
    this.preview();
  }

  clearRange(): void {
    this.from = '';
    this.to = '';
    this.preview();
  }

  preview(): void {
    this.loading.set(true);
    this.reports.preview(this.selected(), { from: this.from || undefined, to: this.to || undefined }).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  download(format: 'xlsx' | 'pdf'): void {
    this.downloading.set(true);
    this.reports.download(this.selected(), format, { from: this.from || undefined, to: this.to || undefined }).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        const stamp = new Date().toISOString().slice(0, 10);
        this.reports.saveBlob(blob, `${this.selected()}-report-${stamp}.${format}`);
        this.toast.success('Report downloaded', `${format.toUpperCase()} file saved to your device.`);
      },
      error: () => this.downloading.set(false),
    });
  }

  cell(row: Record<string, unknown>, key: string): string {
    const value = row[key];
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  }
}
