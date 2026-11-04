import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductionService } from '../core/services/production.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { ConfirmService } from '../shared/components/confirm.service';
import { ProductionOrder } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';
import { PaginationComponent } from '../shared/components/pagination.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';
import { ModalComponent } from '../shared/components/modal.component';
import { ProductionFormComponent } from './production-form.component';
import { LookupService } from '../core/services/lookup.service';

@Component({
  selector: 'app-production-list',
  imports: [
    FormsModule, DatePipe, DecimalPipe, RouterLink, PageHeaderComponent, StatusBadgeComponent,
    PaginationComponent, EmptyStateComponent, ModalComponent, ProductionFormComponent,
  ],
  template: `
    <app-page-header title="Production Planning" subtitle="Create, schedule and monitor production orders across the shop floor">
      @if (auth.can('production:create')) {
        <button class="btn btn-primary btn-sm" (click)="openCreate()"><i class="bi bi-plus-lg"></i> New Production Order</button>
      }
    </app-page-header>

    <!-- Summary strip -->
    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      @for (item of summaryCards(); track item.label) {
        <div class="stat-card" style="padding:13px 15px">
          <div class="sc-label">{{ item.label }}</div>
          <div class="sc-value" style="font-size:22px">{{ item.value }}</div>
        </div>
      }
    </div>

    <div class="panel">
      <div class="toolbar">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input class="form-control" placeholder="Search order no, product…" [(ngModel)]="filters.search" (ngModelChange)="onSearchChange()" />
        </div>
        <select class="form-select" [(ngModel)]="filters.status" (ngModelChange)="reload(1)">
          <option value="all">All statuses</option>
          @for (status of statuses; track status) { <option [value]="status">{{ status }}</option> }
        </select>
        <select class="form-select" [(ngModel)]="filters.priority" (ngModelChange)="reload(1)">
          <option value="all">All priorities</option>
          @for (priority of priorities; track priority) { <option [value]="priority">{{ priority }}</option> }
        </select>
        <select class="form-select" [(ngModel)]="filters.sortBy" (ngModelChange)="reload(1)">
          <option value="createdAt">Newest first</option>
          <option value="startDate">Start date</option>
          <option value="expectedCompletionDate">Due date</option>
          <option value="quantity">Quantity</option>
          <option value="priority">Priority</option>
        </select>
        <label class="d-flex align-center gap-2" style="font-size:12.4px;color:#5A6B87;cursor:pointer;white-space:nowrap">
          <input type="checkbox" [(ngModel)]="filters.delayedOnly" (ngModelChange)="reload(1)" style="accent-color:#D93A3A" /> Delayed only
        </label>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-outline btn-sm" (click)="reload(page())" [disabled]="loading()">
          <i class="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>

      <div class="table-shell">
        <table class="erp-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Product</th>
              <th>Progress</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Schedule</th>
              <th>Machines</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (n of [1,2,3,4,5,6]; track n) {
                <tr><td colspan="8"><div class="skeleton" style="height:22px"></div></td></tr>
              }
            } @else {
              @for (order of orders(); track order._id) {
                <tr>
                  <td>
                    <a [routerLink]="['/production', order._id]" class="cell-mono">{{ order.orderNumber }}</a>
                    <span class="cell-sub">{{ managerName(order) }}</span>
                  </td>
                  <td>
                    <span class="cell-strong">{{ order.productName }}</span>
                    <span class="cell-sub">{{ order.productCode }}</span>
                  </td>
                  <td style="min-width:150px">
                    <div class="progress-thin" [class.green]="(order.progressPercentage ?? 0) >= 100" [class.orange]="(order.progressPercentage ?? 0) < 50 && order.isDelayed">
                      <span [style.width.%]="order.progressPercentage ?? 0"></span>
                    </div>
                    <div class="progress-label">{{ order.producedQuantity | number }} / {{ order.quantity | number }} {{ order.unit }}</div>
                  </td>
                  <td><span class="badge-status" [class]="'b-' + order.priority.toLowerCase()">{{ order.priority }}</span></td>
                  <td>
                    <app-status-badge [status]="order.status" />
                    @if (order.isDelayed) { <div><span class="badge-status b-delayed" style="margin-top:4px">Delayed</span></div> }
                  </td>
                  <td>
                    <span class="cell-strong" style="font-size:12.4px">{{ order.startDate | date: 'dd MMM yy' }}</span>
                    <span class="cell-sub">Due {{ order.expectedCompletionDate | date: 'dd MMM yy' }}</span>
                  </td>
                  <td>
                    @if (order.machines?.length) {
                      @for (machine of order.machines; track machine._id) {
                        <span class="b-chip" style="margin:0 3px 3px 0">{{ machine.machineCode }}</span>
                      }
                    } @else { <span class="cell-muted">—</span> }
                  </td>
                  <td>
                    <div class="table-actions">
                      <a class="btn btn-outline btn-icon" [routerLink]="['/production', order._id]" title="View"><i class="bi bi-eye"></i></a>
                      @if (auth.can('production:update')) {
                        <button class="btn btn-outline btn-icon" (click)="openEdit(order)" title="Edit"><i class="bi bi-pencil"></i></button>
                      }
                      @if (auth.can('production:update_progress') || auth.can('production:update')) {
                        <button class="btn btn-outline btn-icon" (click)="openProgress(order)" title="Update progress"><i class="bi bi-graph-up-arrow"></i></button>
                      }
                      @if (auth.can('production:delete')) {
                        <button class="btn btn-outline btn-icon" style="color:#D93A3A" (click)="remove(order)" title="Delete"><i class="bi bi-trash3"></i></button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <app-empty-state icon="bi-diagram-3" title="No production orders found"
                                     message="Adjust your filters or create a new production order to get started." />
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      <app-pagination [page]="page()" [limit]="limit()" [total]="total()" [pagesTotal]="pages()"
                      (pageChange)="reload($event)" (limitChange)="onLimitChange($event)" />
    </div>

    <!-- Create / edit -->
    <app-production-form [open]="formOpen()" [order]="selected()" (closed)="formOpen.set(false)" (saved)="reload(page())" />

    <!-- Progress / status update -->
    <app-modal [open]="progressOpen()" size="sm" icon="bi-graph-up-arrow" title="Update Production Progress"
               [subtitle]="selected()?.orderNumber ?? ''" (closed)="progressOpen.set(false)">
      @if (selected(); as order) {
        <div class="kv-grid" style="margin-bottom:16px">
          <div class="kv-item"><label>Product</label><div>{{ order.productName }}</div></div>
          <div class="kv-item"><label>Target</label><div>{{ order.quantity | number }} {{ order.unit }}</div></div>
        </div>
        <div style="margin-bottom:13px">
          <label class="form-label">Produced quantity <span class="req">*</span></label>
          <input type="number" class="form-control" min="0" [max]="order.quantity" [(ngModel)]="progress.produced" />
          <div class="form-hint">Cannot exceed the planned quantity of {{ order.quantity | number }} units.</div>
        </div>
        <div style="margin-bottom:13px">
          <label class="form-label">Rejected quantity</label>
          <input type="number" class="form-control" min="0" [(ngModel)]="progress.rejected" />
        </div>
        <div>
          <label class="form-label">Status</label>
          <select class="form-select" [(ngModel)]="progress.status">
            @for (status of statuses; track status) { <option [value]="status">{{ status }}</option> }
          </select>
        </div>
        <div class="alert-strip info" style="margin:14px 0 0">
          <i class="bi bi-info-circle-fill"></i>
          <span>Completing an order automatically consumes the allocated raw materials and updates stock levels.</span>
        </div>
      }
      <div modalFooter>
        <button class="btn btn-outline" (click)="progressOpen.set(false)">Cancel</button>
        <button class="btn btn-primary" (click)="saveProgress()" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> Saving… } @else { <i class="bi bi-check2"></i> Save progress }
        </button>
      </div>
    </app-modal>
  `,
})
export class ProductionListComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly production = inject(ProductionService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lookups = inject(LookupService);

  readonly orders = signal<ProductionOrder[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(10);
  readonly pages = signal(1);

  readonly formOpen = signal(false);
  readonly progressOpen = signal(false);
  readonly selected = signal<ProductionOrder | null>(null);

  readonly statuses = ['Planned', 'Approved', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];
  readonly priorities = ['Low', 'Medium', 'High', 'Critical'];
  readonly statusCounts = signal<Record<string, number>>({});
  readonly totals = signal({ planned: 0, produced: 0, rejected: 0 });

  filters = { search: '', status: 'all', priority: 'all', sortBy: 'createdAt', delayedOnly: false };
  progress = { produced: 0, rejected: 0, status: 'In Progress' };

  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly summaryCards = computed(() => {
    const counts = this.statusCounts();
    const totals = this.totals();
    return [
      { label: 'Total Orders', value: this.pages() ? this.total() : 0 },
      { label: 'In Progress', value: counts['In Progress'] ?? 0 },
      { label: 'Completed', value: counts['Completed'] ?? 0 },
      { label: 'On Hold', value: counts['On Hold'] ?? 0 },
      { label: 'Units Planned', value: totals.planned.toLocaleString('en-IN') },
      { label: 'Units Produced', value: totals.produced.toLocaleString('en-IN') },
      { label: 'Units Rejected', value: totals.rejected.toLocaleString('en-IN') },
    ];
  });

  ngOnInit(): void {
    const search = this.route.snapshot.queryParamMap.get('search');
    if (search) this.filters.search = search;
    this.loadStats();
    this.reload(1);
  }

  loadStats(): void {
    this.production.stats().subscribe({
      next: (stats) => {
        this.statusCounts.set(stats.byStatus ?? {});
        this.totals.set({ planned: stats.planned ?? 0, produced: stats.produced ?? 0, rejected: stats.rejected ?? 0 });
      },
    });
  }

  reload(page = this.page()): void {
    this.loading.set(true);
    this.page.set(page);
    this.production
      .list({
        page,
        limit: this.limit(),
        search: this.filters.search || undefined,
        status: this.filters.status,
        priority: this.filters.priority,
        sortBy: this.filters.sortBy,
        sortOrder: this.filters.sortBy === 'createdAt' ? 'desc' : 'asc',
        delayed: this.filters.delayedOnly ? 'true' : undefined,
      })
      .subscribe({
        next: (res) => {
          this.orders.set(res.data);
          this.total.set(res.meta?.total ?? res.data.length);
          this.pages.set(res.meta?.pages ?? 1);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(1), 350);
  }

  onLimitChange(limit: number): void {
    this.limit.set(limit);
    this.reload(1);
  }

  managerName(order: ProductionOrder): string {
    const manager = order.productionManager;
    return typeof manager === 'object' && manager ? manager.name : 'Unassigned';
  }

  openCreate(): void {
    this.selected.set(null);
    this.formOpen.set(true);
  }

  openEdit(order: ProductionOrder): void {
    this.selected.set(order);
    this.formOpen.set(true);
  }

  openProgress(order: ProductionOrder): void {
    this.selected.set(order);
    this.progress = { produced: order.producedQuantity, rejected: order.rejectedQuantity, status: order.status };
    this.progressOpen.set(true);
  }

  saveProgress(): void {
    const order = this.selected();
    if (!order) return;
    if (this.progress.produced > order.quantity) {
      this.toast.warning('Invalid quantity', `Produced quantity cannot exceed ${order.quantity}.`);
      return;
    }
    this.saving.set(true);
    this.production
      .updateProgress(order._id, {
        producedQuantity: Number(this.progress.produced),
        rejectedQuantity: Number(this.progress.rejected),
        status: this.progress.status,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.progressOpen.set(false);
          this.toast.success('Progress updated', res.message);
          this.reload(this.page());
          this.loadStats();
          this.lookups.invalidate('orders');
        },
        error: () => this.saving.set(false),
      });
  }

  async remove(order: ProductionOrder): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${order.orderNumber}?`,
      message: 'This permanently removes the production order and releases its machine allocation. This action cannot be undone.',
      confirmLabel: 'Delete order',
      danger: true,
    });
    if (!confirmed) return;
    this.production.remove(order._id).subscribe({
      next: (res) => {
        this.toast.success('Order deleted', res.message);
        this.reload(this.page());
        this.loadStats();
      },
    });
  }
}
