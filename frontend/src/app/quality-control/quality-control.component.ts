import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { QualityService } from '../core/services/quality.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { ConfirmService } from '../shared/components/confirm.service';
import { QualityInspection } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';
import { PaginationComponent } from '../shared/components/pagination.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';
import { ModalComponent } from '../shared/components/modal.component';
import { InspectionFormComponent } from './inspection-form.component';

@Component({
  selector: 'app-quality-control',
  imports: [
    FormsModule, DatePipe, DecimalPipe, PercentPipe, PageHeaderComponent, StatusBadgeComponent,
    PaginationComponent, EmptyStateComponent, ModalComponent, InspectionFormComponent,
  ],
  template: `
    <app-page-header title="Quality Control" subtitle="Batch inspections, measured parameters and pass / reject decisions">
      @if (auth.can('quality:create')) {
        <button class="btn btn-primary btn-sm" (click)="openCreate()"><i class="bi bi-clipboard2-plus"></i> New Inspection</button>
      }
    </app-page-header>

    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
      <div class="stat-card" style="--accent:#2563A8;--accent-soft:#E8F0FA">
        <div class="sc-top"><div><div class="sc-label">Inspections</div><div class="sc-value">{{ stats().inspections }}</div></div><div class="sc-icon"><i class="bi bi-clipboard2-check"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#12203F;--accent-soft:#E7ECF5">
        <div class="sc-top"><div><div class="sc-label">Units inspected</div><div class="sc-value">{{ stats().inspected | number }}</div></div><div class="sc-icon"><i class="bi bi-box-seam"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#12A150;--accent-soft:#E6F7ED">
        <div class="sc-top"><div><div class="sc-label">Quality pass %</div><div class="sc-value">{{ stats().qualityPassPercentage }}%</div></div><div class="sc-icon"><i class="bi bi-patch-check"></i></div></div>
        <div class="sc-hint">{{ stats().passed | number }} units passed</div>
      </div>
      <div class="stat-card" style="--accent:#D93A3A;--accent-soft:#FDECEC">
        <div class="sc-top"><div><div class="sc-label">Defect %</div><div class="sc-value">{{ stats().defectPercentage }}%</div></div><div class="sc-icon"><i class="bi bi-x-octagon"></i></div></div>
        <div class="sc-hint">{{ stats().rejected | number }} units rejected</div>
      </div>
      <div class="stat-card" style="--accent:#E8871E;--accent-soft:#FDF1E3">
        <div class="sc-top"><div><div class="sc-label">Pending approval</div><div class="sc-value">{{ stats().byStatus['Pending Inspection'] || 0 }}</div></div><div class="sc-icon"><i class="bi bi-hourglass-split"></i></div></div>
      </div>
    </div>

    <div class="panel">
      <div class="toolbar">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input class="form-control" placeholder="Search inspection no, batch, product…" [(ngModel)]="filters.search" (ngModelChange)="onSearch()" />
        </div>
        <select class="form-select" [(ngModel)]="filters.status" (ngModelChange)="load(1)">
          <option value="all">All results</option>
          <option value="Passed">Passed</option>
          <option value="Failed">Failed</option>
          <option value="Rework Required">Rework Required</option>
          <option value="Pending Inspection">Pending Inspection</option>
        </select>
        <input type="date" class="form-control" style="width:auto;height:38px;min-height:38px" [(ngModel)]="filters.from" (ngModelChange)="load(1)" title="From date" />
        <input type="date" class="form-control" style="width:auto;height:38px;min-height:38px" [(ngModel)]="filters.to" (ngModelChange)="load(1)" title="To date" />
        <div class="toolbar-spacer"></div>
        <button class="btn btn-outline btn-sm" (click)="load(page())"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
      </div>

      <div class="table-shell">
        <table class="erp-table">
          <thead>
            <tr><th>Inspection</th><th>Product / Batch</th><th>Inspector</th><th>Inspected</th><th>Passed</th><th>Pass %</th><th>Result</th><th>Date</th><th style="text-align:right">Actions</th></tr>
          </thead>
          <tbody>
            @for (inspection of inspections(); track inspection._id) {
              <tr>
                <td><span class="cell-mono">{{ inspection.inspectionNumber }}</span><span class="cell-sub">{{ inspection.qualityStandard }}</span></td>
                <td>
                  <span class="cell-strong">{{ inspection.productName }}</span>
                  <span class="cell-sub">Batch {{ inspection.batchNumber }}</span>
                </td>
                <td>{{ inspection.inspectorName || '—' }}</td>
                <td>{{ inspection.inspectedQuantity | number }}</td>
                <td><strong style="color:#0C7B3D">{{ inspection.passedQuantity | number }}</strong></td>
                <td style="min-width:120px">
                  <div class="progress-thin" [class.green]="inspection.qualityPassPercentage >= 95" [class.orange]="inspection.qualityPassPercentage < 95">
                    <span [style.width.%]="inspection.qualityPassPercentage"></span>
                  </div>
                  <div class="progress-label">{{ inspection.qualityPassPercentage }}%</div>
                </td>
                <td><app-status-badge [status]="inspection.status" /></td>
                <td>{{ inspection.inspectionDate | date: 'dd MMM yy' }}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-outline btn-icon" title="View report" (click)="openDetail(inspection)"><i class="bi bi-eye"></i></button>
                    @if (auth.can('quality:update')) {
                      <button class="btn btn-outline btn-icon" title="Edit" (click)="openEdit(inspection)"><i class="bi bi-pencil"></i></button>
                    }
                    @if (auth.can('quality:approve') && inspection.status === 'Pending Inspection') {
                      <button class="btn btn-success btn-icon" title="Approve batch" (click)="decide(inspection, 'Passed')"><i class="bi bi-check2"></i></button>
                      <button class="btn btn-danger btn-icon" title="Reject batch" (click)="decide(inspection, 'Failed')"><i class="bi bi-x-lg"></i></button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="9"><app-empty-state icon="bi-clipboard2-x" title="No inspections found" message="Record an inspection to start tracking batch quality." /></td></tr>
            }
          </tbody>
        </table>
      </div>
      <app-pagination [page]="page()" [limit]="limit()" [total]="total()" [pagesTotal]="pages()" (pageChange)="load($event)" (limitChange)="onLimit($event)" />
    </div>

    <!-- Inspection detail -->
    <app-modal [open]="detailOpen()" size="lg" icon="bi-clipboard2-data" [title]="selected()?.inspectionNumber ?? ''"
               [subtitle]="(selected()?.productName ?? '') + ' · Batch ' + (selected()?.batchNumber ?? '')" (closed)="detailOpen.set(false)">
      @if (selected(); as inspection) {
        <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:16px">
          <div class="stat-card" style="padding:12px 14px"><div class="sc-label">Inspected</div><div class="sc-value" style="font-size:19px">{{ inspection.inspectedQuantity }}</div></div>
          <div class="stat-card" style="padding:12px 14px"><div class="sc-label">Passed</div><div class="sc-value" style="font-size:19px;color:#12A150">{{ inspection.passedQuantity }}</div></div>
          <div class="stat-card" style="padding:12px 14px"><div class="sc-label">Rejected</div><div class="sc-value" style="font-size:19px;color:#D93A3A">{{ inspection.rejectedQuantity }}</div></div>
          <div class="stat-card" style="padding:12px 14px"><div class="sc-label">Pass %</div><div class="sc-value" style="font-size:19px">{{ inspection.qualityPassPercentage }}%</div></div>
          <div class="stat-card" style="padding:12px 14px"><div class="sc-label">Defect %</div><div class="sc-value" style="font-size:19px">{{ inspection.defectPercentage }}%</div></div>
        </div>

        <div class="kv-grid" style="margin-bottom:16px">
          <div class="kv-item"><label>Order</label><div>{{ inspection.orderNumber }}</div></div>
          <div class="kv-item"><label>Inspector</label><div>{{ inspection.inspectorName }}</div></div>
          <div class="kv-item"><label>Standard</label><div>{{ inspection.qualityStandard }}</div></div>
          <div class="kv-item"><label>Inspection date</label><div>{{ inspection.inspectionDate | date: 'dd MMM yyyy' }}</div></div>
          <div class="kv-item"><label>Result</label><div><app-status-badge [status]="inspection.status" /></div></div>
          <div class="kv-item"><label>Approved by</label><div>{{ approvedBy(inspection) }}</div></div>
        </div>

        <div class="table-shell" style="border:1px solid #E2E8F2;border-radius:11px">
          <table class="erp-table">
            <thead><tr><th>Parameter</th><th>Standard</th><th>Limits</th><th>Measured</th><th>Unit</th><th>Result</th></tr></thead>
            <tbody>
              @for (parameter of inspection.parameters; track $index) {
                <tr>
                  <td class="cell-strong">{{ parameter.name }}</td>
                  <td>{{ parameter.standardValue ?? '—' }}</td>
                  <td>{{ parameter.minLimit }} – {{ parameter.maxLimit }}</td>
                  <td><strong>{{ parameter.actualValue }}</strong></td>
                  <td>{{ parameter.unit || '—' }}</td>
                  <td>
                    @if (inRange(parameter)) {
                      <span class="badge-status b-completed">Pass</span>
                    } @else {
                      <span class="badge-status b-failed">Fail</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6"><div class="empty-state" style="padding:20px"><strong>No parameters recorded</strong></div></td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (inspection.remarks) {
          <p style="font-size:12.8px;color:#5A6B87;margin-top:14px"><strong>Remarks:</strong> {{ inspection.remarks }}</p>
        }
      }
      <div modalFooter>
        <button class="btn btn-outline" (click)="detailOpen.set(false)">Close</button>
        @if (auth.can('quality:approve') && selected()?.status === 'Pending Inspection') {
          <button class="btn btn-warning" (click)="decide(selected()!, 'Rework Required')"><i class="bi bi-arrow-repeat"></i> Rework required</button>
          <button class="btn btn-danger" (click)="decide(selected()!, 'Failed')"><i class="bi bi-x-lg"></i> Reject batch</button>
          <button class="btn btn-success" (click)="decide(selected()!, 'Passed')"><i class="bi bi-check2"></i> Approve batch</button>
        }
        @if (auth.can('quality:update')) {
          <button class="btn btn-outline" style="color:#D93A3A" (click)="remove(selected()!)"><i class="bi bi-trash3"></i> Delete</button>
        }
      </div>
    </app-modal>

    <app-inspection-form [open]="formOpen()" [inspection]="editing()" (closed)="formOpen.set(false)" (saved)="afterSave()" />
  `,
})
export class QualityControlComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly quality = inject(QualityService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly inspections = signal<QualityInspection[]>([]);
  readonly stats = signal({
    inspections: 0, inspected: 0, passed: 0, rejected: 0, qualityPassPercentage: 0, defectPercentage: 0,
    byStatus: {} as Record<string, number>,
  });

  readonly page = signal(1);
  readonly limit = signal(10);
  readonly total = signal(0);
  readonly pages = signal(1);

  readonly formOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly editing = signal<QualityInspection | null>(null);
  readonly selected = signal<QualityInspection | null>(null);

  filters = { search: '', status: 'all', from: '', to: '' };
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.load(1);
    this.loadStats();
  }

  loadStats(): void {
    this.quality.stats().subscribe({ next: (stats) => this.stats.set(stats) });
  }

  load(page = this.page()): void {
    this.page.set(page);
    this.quality
      .list({
        page,
        limit: this.limit(),
        search: this.filters.search || undefined,
        status: this.filters.status,
        from: this.filters.from || undefined,
        to: this.filters.to || undefined,
        sortBy: 'inspectionDate',
        sortOrder: 'desc',
      })
      .subscribe({
        next: (res) => {
          this.inspections.set(res.data);
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

  openEdit(inspection: QualityInspection): void {
    this.editing.set(inspection);
    this.formOpen.set(true);
  }

  openDetail(inspection: QualityInspection): void {
    this.selected.set(inspection);
    this.detailOpen.set(true);
  }

  afterSave(): void {
    this.load(this.page());
    this.loadStats();
  }

  decide(inspection: QualityInspection, decision: 'Passed' | 'Failed' | 'Rework Required'): void {
    this.quality.decide(inspection._id, decision).subscribe({
      next: (res) => {
        this.toast.success('Decision recorded', res.message);
        this.detailOpen.set(false);
        this.load(this.page());
        this.loadStats();
      },
    });
  }

  async remove(inspection: QualityInspection): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${inspection.inspectionNumber}?`,
      message: 'The inspection record and its measured values will be permanently removed.',
      confirmLabel: 'Delete inspection',
      danger: true,
    });
    if (!confirmed) return;
    this.quality.remove(inspection._id).subscribe({
      next: (res) => {
        this.toast.success('Inspection deleted', res.message);
        this.detailOpen.set(false);
        this.load(this.page());
        this.loadStats();
      },
    });
  }

  inRange(parameter: { actualValue: number | null; minLimit: number | null; maxLimit: number | null }): boolean {
    if (parameter.actualValue === null || parameter.minLimit === null || parameter.maxLimit === null) return false;
    return parameter.actualValue >= parameter.minLimit && parameter.actualValue <= parameter.maxLimit;
  }

  approvedBy(inspection: QualityInspection): string {
    const approver = inspection.approvedBy;
    if (typeof approver === 'object' && approver) return approver.name;
    return inspection.approvedAt ? 'Recorded' : 'Not approved yet';
  }
}
