import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../core/services/notification.service';
import { ToastService } from '../core/services/toast.service';
import { ConfirmService } from '../shared/components/confirm.service';
import { AppNotification } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { PaginationComponent } from '../shared/components/pagination.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';

@Component({
  selector: 'app-notifications',
  imports: [FormsModule, DatePipe, PageHeaderComponent, PaginationComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Notifications & Alerts" subtitle="Low stock, deadlines, breakdowns, quality failures and pending approvals">
      <button class="btn btn-outline btn-sm" (click)="runAlerts()" [disabled]="refreshing()">
        <i class="bi bi-arrow-repeat" [class.spin]="refreshing()"></i> Run alert engine
      </button>
      <button class="btn btn-primary btn-sm" (click)="markAll()"><i class="bi bi-check2-all"></i> Mark all read</button>
    </app-page-header>

    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      <div class="stat-card" style="--accent:#2563A8;--accent-soft:#E8F0FA">
        <div class="sc-top"><div><div class="sc-label">Unread</div><div class="sc-value">{{ service.unreadCount() }}</div></div><div class="sc-icon"><i class="bi bi-bell-fill"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#12203F;--accent-soft:#E7ECF5">
        <div class="sc-top"><div><div class="sc-label">Total visible</div><div class="sc-value">{{ total() }}</div></div><div class="sc-icon"><i class="bi bi-inbox"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#D93A3A;--accent-soft:#FDECEC">
        <div class="sc-top"><div><div class="sc-label">Critical</div><div class="sc-value">{{ criticalCount() }}</div></div><div class="sc-icon"><i class="bi bi-exclamation-octagon"></i></div></div>
      </div>
    </div>

    <div class="panel">
      <div class="toolbar">
        <select class="form-select" [(ngModel)]="type" (ngModelChange)="load(1)">
          <option value="all">All alert types</option>
          <option value="low_stock">Low stock</option>
          <option value="deadline">Deadline approaching</option>
          <option value="delayed">Delayed orders</option>
          <option value="breakdown">Machine breakdown</option>
          <option value="quality_failure">Quality failure</option>
          <option value="approval">Pending approvals</option>
          <option value="maintenance">Maintenance</option>
          <option value="system">System</option>
        </select>
        <label class="d-flex align-center gap-2" style="font-size:12.4px;color:#5A6B87;cursor:pointer">
          <input type="checkbox" [(ngModel)]="unreadOnly" (ngModelChange)="load(1)" style="accent-color:#2563A8" /> Unread only
        </label>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-outline btn-sm" (click)="load(page())"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
      </div>

      <div>
        @for (item of notifications(); track item._id) {
          <div class="notif-item" [class.unread]="!item.isRead">
            <div class="n-icon" [class]="item.type"><i class="bi" [class]="iconFor(item.type)"></i></div>
            <div style="flex:1;min-width:0">
              <div class="n-title">{{ item.title }}</div>
              <div class="n-msg">{{ item.message }}</div>
              <div class="n-meta">
                <span><i class="bi bi-clock"></i> {{ item.createdAt | date: 'dd MMM yyyy, hh:mm a' }}</span>
                <span class="b-chip">{{ typeLabel(item.type) }}</span>
                @if (item.link) {
                  <a style="font-weight:700;cursor:pointer" (click)="open(item)">Open module →</a>
                }
              </div>
            </div>
            <div class="table-actions" style="align-items:flex-start">
              @if (!item.isRead) {
                <button class="btn btn-outline btn-icon" title="Mark as read" (click)="markRead(item)"><i class="bi bi-check2"></i></button>
              }
              <button class="btn btn-outline btn-icon" style="color:#D93A3A" title="Delete" (click)="remove(item)"><i class="bi bi-trash3"></i></button>
            </div>
          </div>
        } @empty {
          <app-empty-state icon="bi-bell-slash" title="No notifications" message="You are all caught up — no alerts match the current filters." />
        }
      </div>

      <app-pagination [page]="page()" [limit]="limit()" [total]="total()" [pagesTotal]="pages()" (pageChange)="load($event)" (limitChange)="onLimit($event)" />
    </div>
  `,
  styles: [`.spin { animation: spin .8s linear infinite; display: inline-block; }`],
})
export class NotificationsComponent implements OnInit {
  private readonly api = inject(NotificationService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);

  readonly service = this.api;
  readonly notifications = signal<AppNotification[]>([]);
  readonly page = signal(1);
  readonly limit = signal(12);
  readonly total = signal(0);
  readonly pages = signal(1);
  readonly refreshing = signal(false);
  readonly criticalCount = signal(0);

  type = 'all';
  unreadOnly = false;

  ngOnInit(): void {
    this.api.refreshUnread();
    this.load(1);
  }

  load(page = this.page()): void {
    this.page.set(page);
    this.api.list({ page, limit: this.limit(), type: this.type, unread: this.unreadOnly ? 'true' : undefined }).subscribe({
      next: (res) => {
        this.notifications.set(res.data);
        this.total.set(res.meta?.total ?? 0);
        this.pages.set(res.meta?.pages ?? 1);
        this.criticalCount.set(res.data.filter((n) => n.severity === 'critical').length);
      },
    });
  }

  onLimit(limit: number): void {
    this.limit.set(limit);
    this.load(1);
  }

  markRead(item: AppNotification): void {
    this.api.markRead(item._id).subscribe({
      next: () => {
        this.notifications.update((list) => list.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
        this.load(this.page());
      },
    });
  }

  markAll(): void {
    this.api.markAllRead().subscribe({
      next: (res) => {
        this.toast.success('All caught up', res.message);
        this.load(this.page());
      },
    });
  }

  runAlerts(): void {
    this.refreshing.set(true);
    this.api.runAlertEngine().subscribe({
      next: (res) => {
        this.refreshing.set(false);
        this.toast.info('Alert engine complete', res.message);
        this.load(1);
      },
      error: () => this.refreshing.set(false),
    });
  }

  open(item: AppNotification): void {
    if (!item.isRead) this.api.markRead(item._id).subscribe();
    if (item.link) this.router.navigateByUrl(item.link);
  }

  async remove(item: AppNotification): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Delete notification?',
      message: 'This notification will be removed from the alert history.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    this.api.remove(item._id).subscribe({
      next: () => {
        this.toast.success('Notification deleted');
        this.load(this.page());
      },
    });
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      low_stock: 'Low stock', deadline: 'Deadline', delayed: 'Delayed', breakdown: 'Breakdown',
      quality_failure: 'Quality', approval: 'Approval', maintenance: 'Maintenance', system: 'System',
    };
    return map[type] ?? type;
  }

  iconFor(type: string): string {
    const map: Record<string, string> = {
      low_stock: 'bi-box-seam', breakdown: 'bi-tools', quality_failure: 'bi-x-octagon',
      deadline: 'bi-clock-history', delayed: 'bi-alarm', approval: 'bi-patch-check',
      maintenance: 'bi-gear-wide-connected', system: 'bi-info-circle',
    };
    return map[type] ?? 'bi-info-circle';
  }
}
