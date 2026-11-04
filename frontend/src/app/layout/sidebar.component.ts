import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationService } from '../core/services/notification.service';
import { Role } from '../core/models';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  permission?: string;
  roles?: Role[];
  badge?: 'notifications' | 'pending';
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar" [class.open]="open()">
      <div class="sidebar-brand">
        <div class="brand-mark"><i class="bi bi-gear-wide-connected"></i></div>
        <div class="brand-text">
          <span class="brand-title">ManuCore ERP</span>
          <span class="brand-sub">Production &amp; Quality</span>
        </div>
      </div>

      <div class="sidebar-scroll">
        <div class="nav-section-label">Operations</div>
        @for (item of primaryNav(); track item.route) {
          <a class="nav-link-item" [routerLink]="item.route" routerLinkActive="active" (click)="navigated.emit()">
            <i class="bi" [class]="item.icon"></i>
            <span>{{ item.label }}</span>
            @if (item.badge === 'notifications' && unread() > 0) {
              <span class="nav-badge">{{ unread() }}</span>
            }
          </a>
        }

        <div class="nav-section-label">Analytics &amp; System</div>
        @for (item of secondaryNav(); track item.route) {
          <a class="nav-link-item" [routerLink]="item.route" routerLinkActive="active" (click)="navigated.emit()">
            <i class="bi" [class]="item.icon"></i>
            <span>{{ item.label }}</span>
          </a>
        }

        <a class="nav-link-item" (click)="logout()" style="cursor:pointer">
          <i class="bi bi-box-arrow-right"></i>
          <span>Logout</span>
        </a>
      </div>

      <div class="sidebar-footer">
        <div class="plant-card">
          <div class="dot"></div>
          <div>
            <small>Plant 1 · Aurangabad</small>
            <strong>Line A — Operational</strong>
          </div>
        </div>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  readonly open = input(false);
  readonly navigated = output<void>();

  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  readonly unread = computed(() => this.notifications.unreadCount());

  private readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'bi-speedometer2', route: '/dashboard' },
    { label: 'Production Planning', icon: 'bi-diagram-3', route: '/production', permission: 'production:view' },
    { label: 'Production Scheduling', icon: 'bi-calendar3-week', route: '/scheduling', permission: 'schedule:view' },
    { label: 'Inventory Management', icon: 'bi-boxes', route: '/inventory', permission: 'inventory:view' },
    { label: 'Quality Control', icon: 'bi-clipboard2-check', route: '/quality-control', permission: 'quality:view' },
    { label: 'Defect Management', icon: 'bi-exclamation-diamond', route: '/defects', permission: 'defect:view' },
    { label: 'Machine Management', icon: 'bi-cpu', route: '/machines', permission: 'machine:view' },
    { label: 'Employee Management', icon: 'bi-people', route: '/employees' },
    { label: 'Reports', icon: 'bi-graph-up-arrow', route: '/reports', permission: 'report:view' },
    { label: 'Notifications', icon: 'bi-bell', route: '/notifications', badge: 'notifications' },
    { label: 'Settings', icon: 'bi-sliders', route: '/settings' },
  ];

  readonly primaryNav = computed(() => this.filterNav(this.navItems.slice(0, 8)));
  readonly secondaryNav = computed(() => this.filterNav(this.navItems.slice(8)));

  private filterNav(items: NavItem[]): NavItem[] {
    return items.filter((item) => !item.permission || this.auth.can(item.permission));
  }

  logout(): void {
    this.auth.logout();
  }
}
