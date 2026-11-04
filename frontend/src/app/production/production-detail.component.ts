import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductionService } from '../core/services/production.service';
import { QualityService } from '../core/services/quality.service';
import { DefectService } from '../core/services/defect.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { DefectRecord, ProductionOrder, QualityInspection } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';

@Component({
  selector: 'app-production-detail',
  imports: [RouterLink, DatePipe, DecimalPipe, PercentPipe, PageHeaderComponent, StatusBadgeComponent, EmptyStateComponent],
  template: `
    @if (order(); as o) {
      <app-page-header [title]="o.orderNumber" [subtitle]="o.productName + ' · ' + o.productCode">
        <a class="btn btn-outline btn-sm" routerLink="/production"><i class="bi bi-arrow-left"></i> Back to orders</a>
        @if (auth.can('production:update')) {
          <button class="btn btn-primary btn-sm" (click)="advance('In Progress')" [disabled]="o.status === 'In Progress' || processing()">
            <i class="bi bi-play-fill"></i> Start production
          </button>
        }
      </app-page-header>

      <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <div class="stat-card">
          <div class="sc-label">Status</div>
          <div style="margin-top:8px"><app-status-badge [status]="o.status" /></div>
          @if (o.isDelayed) { <div class="sc-hint" style="color:#B22828"><i class="bi bi-alarm"></i> Past due date</div> }
        </div>
        <div class="stat-card">
          <div class="sc-label">Progress</div>
          <div class="sc-value" style="font-size:22px">{{ o.progressPercentage ?? 0 }}%</div>
          <div class="progress-thin" style="margin-top:6px"><span [style.width.%]="o.progressPercentage ?? 0"></span></div>
        </div>
        <div class="stat-card"><div class="sc-label">Planned</div><div class="sc-value" style="font-size:22px">{{ o.quantity | number }}</div><div class="sc-hint">{{ o.unit }} to manufacture</div></div>
        <div class="stat-card"><div class="sc-label">Produced</div><div class="sc-value" style="font-size:22px;color:#12A150">{{ o.producedQuantity | number }}</div></div>
        <div class="stat-card"><div class="sc-label">Rejected</div><div class="sc-value" style="font-size:22px;color:#D93A3A">{{ o.rejectedQuantity | number }}</div></div>
        <div class="stat-card"><div class="sc-label">Priority</div><div style="margin-top:8px"><span class="badge-status" [class]="'b-' + o.priority.toLowerCase()">{{ o.priority }}</span></div></div>
      </div>

      <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px" class="detail-grid">
        <div>
          <div class="panel">
            <div class="panel-head"><h3><i class="bi bi-info-circle"></i> Order details</h3></div>
            <div class="panel-body">
              <div class="kv-grid">
                <div class="kv-item"><label>Order number</label><div>{{ o.orderNumber }}</div></div>
                <div class="kv-item"><label>Product</label><div>{{ o.productName }}</div></div>
                <div class="kv-item"><label>Production manager</label><div>{{ managerName(o) }}</div></div>
                <div class="kv-item"><label>Department</label><div>{{ departmentName(o) }}</div></div>
                <div class="kv-item"><label>Start date</label><div>{{ o.startDate | date: 'dd MMM yyyy' }}</div></div>
                <div class="kv-item"><label>Expected completion</label><div>{{ o.expectedCompletionDate | date: 'dd MMM yyyy' }}</div></div>
                <div class="kv-item"><label>Actual completion</label><div>{{ o.actualCompletionDate ? (o.actualCompletionDate | date: 'dd MMM yyyy') : '—' }}</div></div>
                <div class="kv-item"><label>Created</label><div>{{ o.createdAt | date: 'dd MMM yyyy, HH:mm' }}</div></div>
              </div>
              @if (o.notes) { <p style="margin-top:14px;font-size:13px;color:#5A6B87"><strong>Notes:</strong> {{ o.notes }}</p> }
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h3><i class="bi bi-boxes"></i> Material allocation</h3>
              @if (auth.can('production:update')) {
                <button class="btn btn-soft btn-sm" (click)="consume()" [disabled]="processing()">
                  <i class="bi bi-arrow-down-square"></i> Consume materials
                </button>
              }
            </div>
            <div class="table-shell">
              <table class="erp-table">
                <thead><tr><th>Material</th><th>Required</th><th>Consumed</th><th>Balance</th></tr></thead>
                <tbody>
                  @for (line of o.materials; track line.material) {
                    <tr>
                      <td><span class="cell-strong">{{ line.materialName }}</span></td>
                      <td>{{ line.requiredQty | number }} {{ line.unit }}</td>
                      <td>{{ (line.consumedQty ?? 0) | number }} {{ line.unit }}</td>
                      <td>
                        <span class="badge-status" [class]="(line.requiredQty - (line.consumedQty ?? 0)) <= 0 ? 'b-completed' : 'b-pending'">
                          {{ (line.requiredQty - (line.consumedQty ?? 0)) | number }} {{ line.unit }}
                        </span>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4"><app-empty-state icon="bi-box" title="No materials allocated" message="Edit the order to allocate raw materials." /></td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head"><h3><i class="bi bi-clipboard2-check"></i> Quality inspections</h3><a routerLink="/quality-control" class="hint">Open module</a></div>
            <div class="table-shell">
              <table class="erp-table">
                <thead><tr><th>Inspection</th><th>Batch</th><th>Inspected</th><th>Pass %</th><th>Status</th></tr></thead>
                <tbody>
                  @for (inspection of inspections(); track inspection._id) {
                    <tr>
                      <td class="cell-mono">{{ inspection.inspectionNumber }}</td>
                      <td>{{ inspection.batchNumber }}</td>
                      <td>{{ inspection.inspectedQuantity | number }}</td>
                      <td><strong>{{ inspection.qualityPassPercentage }}%</strong></td>
                      <td><app-status-badge [status]="inspection.status" /></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="5"><app-empty-state icon="bi-clipboard-x" title="No inspections yet" message="Quality inspections raised for this order will appear here." /></td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div class="panel">
            <div class="panel-head"><h3><i class="bi bi-cpu"></i> Machines</h3></div>
            <div class="panel-body">
              @for (machine of o.machines ?? []; track machine._id) {
                <div class="d-flex align-center" style="justify-content:space-between;padding:9px 0;border-bottom:1px solid #EDF1F8">
                  <div>
                    <strong style="font-size:13px">{{ machine.machineCode }}</strong>
                    <div style="font-size:11.6px;color:#7A8AA5">{{ machine.name }}</div>
                  </div>
                  <app-status-badge [status]="machine.status" />
                </div>
              } @empty {
                <p style="font-size:12.8px;color:#7A8AA5;margin:0">No machines allocated to this order.</p>
              }
            </div>
          </div>

          @if (auth.can('production:update')) {
            <div class="panel">
              <div class="panel-head"><h3><i class="bi bi-diagram-2"></i> Change status</h3></div>
              <div class="panel-body" style="display:flex;flex-wrap:wrap;gap:8px">
                @for (status of statuses; track status) {
                  <button class="btn btn-sm" [class.btn-primary]="o.status === status" [class.btn-outline]="o.status !== status"
                          (click)="advance(status)" [disabled]="o.status === status || processing()">
                    {{ status }}
                  </button>
                }
              </div>
            </div>
          }

          <div class="panel">
            <div class="panel-head"><h3><i class="bi bi-exclamation-diamond"></i> Defects</h3><a routerLink="/defects" class="hint">Open module</a></div>
            <div>
              @for (defect of defects(); track defect._id) {
                <div class="feed-item">
                  <div class="feed-icon defect"><i class="bi bi-exclamation-diamond"></i></div>
                  <div class="feed-body">
                    <div class="feed-title">{{ defect.defectNumber }} · {{ defect.quantity }} units</div>
                    <div class="feed-detail">{{ defect.defectCategory }} · {{ defect.severity }}</div>
                  </div>
                  <app-status-badge [status]="defect.status" />
                </div>
              } @empty {
                <div class="empty-state" style="padding:26px"><i class="bi bi-shield-check"></i><strong>No defects</strong><p>This order has no defect records.</p></div>
              }
            </div>
          </div>
        </div>
      </div>
    } @else if (loading()) {
      <div class="page-loader"><span class="spinner dark"></span></div>
    } @else {
      <app-empty-state icon="bi-question-circle" title="Order not found" message="The production order may have been deleted." />
    }
  `,
  styles: [`@media (max-width: 1100px) { .detail-grid { grid-template-columns: 1fr !important; } }`],
})
export class ProductionDetailComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly production = inject(ProductionService);
  private readonly quality = inject(QualityService);
  private readonly defectsApi = inject(DefectService);
  private readonly toast = inject(ToastService);

  readonly id = input<string>('');
  readonly order = signal<ProductionOrder | null>(null);
  readonly inspections = signal<QualityInspection[]>([]);
  readonly defects = signal<DefectRecord[]>([]);
  readonly loading = signal(true);
  readonly processing = signal(false);

  readonly statuses = ['Planned', 'Approved', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];

  managerName(order: ProductionOrder): string {
    const manager = order.productionManager;
    return typeof manager === 'object' && manager ? manager.name : '—';
  }

  departmentName(order: ProductionOrder): string {
    const department = order.department;
    return typeof department === 'object' && department ? department.name : '—';
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const id = this.id();
    if (!id) return;
    this.loading.set(true);
    this.production.get(id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
        this.quality.list({ order: id, limit: 20 }).subscribe((res) => this.inspections.set(res.data));
        this.defectsApi.list({ search: order.orderNumber, limit: 10 }).subscribe((res) => this.defects.set(res.data.filter((d) => d.orderNumber === order.orderNumber)));
      },
      error: () => this.loading.set(false),
    });
  }

  advance(status: string): void {
    const order = this.order();
    if (!order) return;
    this.processing.set(true);
    this.production.updateStatus(order._id, status).subscribe({
      next: (res) => {
        this.processing.set(false);
        this.toast.success('Status updated', res.message);
        this.load();
      },
      error: () => this.processing.set(false),
    });
  }

  consume(): void {
    const order = this.order();
    if (!order) return;
    this.processing.set(true);
    this.production.consumeMaterials(order._id).subscribe({
      next: (res) => {
        this.processing.set(false);
        this.toast.success('Materials consumed', res.message);
        this.load();
      },
      error: () => this.processing.set(false),
    });
  }
}
