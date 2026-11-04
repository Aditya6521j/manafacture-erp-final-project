import { Component, HostListener, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/services/auth.service';
import { NotificationService } from '../core/services/notification.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-topbar',
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <header class="topbar">
      <button class="hamburger" (click)="toggleSidebar.emit()"><i class="bi bi-list"></i></button>

      <div class="global-search">
        <i class="bi bi-search"></i>
        <input
          type="search"
          placeholder="Search production orders, batches, products…"
          [(ngModel)]="searchTerm"
          (keyup.enter)="runSearch()"
          aria-label="Global search"
        />
      </div>

      <div class="topbar-actions">
        <button class="icon-btn" title="Run alert checks" (click)="runAlertEngine()">
          <i class="bi bi-arrow-repeat"></i>
        </button>

        <button class="icon-btn" title="Notifications" (click)="toggleNotifications($event)">
          <i class="bi bi-bell"></i>
          @if (unread() > 0) { <span class="ping">{{ unread() > 9 ? '9+' : unread() }}</span> }
        </button>

        <div class="user-chip" (click)="toggleUserMenu($event)">
          <div class="avatar">{{ initials() }}</div>
          <div>
            <div class="u-name">{{ user()?.name }}</div>
            <div class="u-role">{{ user()?.role }}</div>
          </div>
          <i class="bi bi-chevron-down" style="font-size:10px;color:#94A3B8"></i>
        </div>
      </div>

      @if (showNotifications()) {
        <div class="dropdown-panel wide" (click)="$event.stopPropagation()">
          <div class="dropdown-head">
            <strong>Notifications</strong>
            <button class="btn-ghost btn-sm" style="border:none;background:none;color:#2563A8;font-weight:600;cursor:pointer" (click)="markAllRead()">
              Mark all read
            </button>
          </div>
          <div class="dropdown-body">
            @for (item of latest(); track item._id) {
              <div class="notif-item" [class.unread]="!item.isRead" (click)="openNotification(item.link)">
                <div class="n-icon" [class]="item.type"><i class="bi" [class]="iconFor(item.type)"></i></div>
                <div>
                  <div class="n-title">{{ item.title }}</div>
                  <div class="n-msg">{{ item.message }}</div>
                  <div class="n-meta">{{ item.createdAt | date: 'dd MMM, hh:mm a' }}</div>
                </div>
              </div>
            } @empty {
              <div class="empty-state" style="padding:28px">
                <i class="bi bi-bell-slash"></i>
                <strong>All caught up</strong>
                <p>No new notifications right now.</p>
              </div>
            }
          </div>
          <div class="dropdown-foot"><a routerLink="/notifications" (click)="showNotifications.set(false)">View all notifications</a></div>
        </div>
      }

      @if (showUserMenu()) {
        <div class="dropdown-panel" style="width:250px" (click)="$event.stopPropagation()">
          <div class="dropdown-head">
            <div>
              <strong>{{ user()?.name }}</strong>
              <div style="font-size:11.5px;color:#7A8AA5">{{ user()?.email }}</div>
            </div>
          </div>
          <div style="padding:8px">
            <a class="nav-link-item" style="color:#243455" routerLink="/settings" (click)="showUserMenu.set(false)">
              <i class="bi bi-person-gear" style="color:#5A6B87"></i> Profile &amp; Settings
            </a>
            <a class="nav-link-item" style="color:#243455" routerLink="/notifications" (click)="showUserMenu.set(false)">
              <i class="bi bi-bell" style="color:#5A6B87"></i> Notifications
            </a>
            <a class="nav-link-item" style="color:#B22828;cursor:pointer" (click)="logout()">
              <i class="bi bi-box-arrow-right" style="color:#B22828"></i> Sign out
            </a>
          </div>
        </div>
      }
    </header>
  `,
})
export class TopbarComponent {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly toggleSidebar = output<void>();
  readonly user = this.auth.user;
  readonly unread = computed(() => this.notifications.unreadCount());
  readonly latest = computed(() => this.notifications.latest());

  readonly showNotifications = signal(false);
  readonly showUserMenu = signal(false);
  searchTerm = '';

  readonly initials = computed(() => {
    const name = this.user()?.name ?? '';
    return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U';
  });

  @HostListener('document:click')
  closeMenus(): void {
    this.showNotifications.set(false);
    this.showUserMenu.set(false);
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.showUserMenu.set(false);
    this.showNotifications.update((v) => !v);
    this.notifications.refreshUnread();
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showNotifications.set(false);
    this.showUserMenu.update((v) => !v);
  }

  markAllRead(): void {
    this.notifications.markAllRead().subscribe({
      next: () => this.toast.success('Notifications cleared', 'All notifications marked as read.'),
    });
  }

  openNotification(link?: string): void {
    this.showNotifications.set(false);
    if (link) this.router.navigateByUrl(link);
  }

  runAlertEngine(): void {
    this.notifications.runAlertEngine().subscribe({
      next: (res) => this.toast.info('Alert engine', res.message ?? 'Alerts refreshed.'),
    });
  }

  runSearch(): void {
    const term = this.searchTerm.trim();
    if (!term) return;
    this.router.navigate(['/production'], { queryParams: { search: term } });
    this.searchTerm = '';
  }

  iconFor(type: string): string {
    const map: Record<string, string> = {
      low_stock: 'bi-box-seam', breakdown: 'bi-tools', quality_failure: 'bi-x-octagon',
      deadline: 'bi-clock-history', delayed: 'bi-alarm', approval: 'bi-patch-check',
      maintenance: 'bi-gear-wide-connected', system: 'bi-info-circle',
    };
    return map[type] ?? 'bi-info-circle';
  }

  logout(): void {
    this.auth.logout();
  }
}
