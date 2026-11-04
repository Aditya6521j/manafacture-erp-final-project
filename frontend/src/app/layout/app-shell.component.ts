import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';
import { LookupService } from '../core/services/lookup.service';
import { NotificationService } from '../core/services/notification.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <div class="app-shell">
      <app-sidebar [open]="sidebarOpen()" (navigated)="sidebarOpen.set(false)" />

      @if (sidebarOpen()) {
        <div class="sidebar-overlay" (click)="sidebarOpen.set(false)"></div>
      }

      <div class="main-area">
        <app-topbar (toggleSidebar)="sidebarOpen.set(!sidebarOpen())" />
        <main class="page-wrap">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent implements OnInit {
  readonly sidebarOpen = signal(false);
  private readonly lookups = inject(LookupService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);

  ngOnInit(): void {
    // Warm the shared lookup caches and refresh the notification badge
    this.lookups.loadAll();
    this.notifications.refreshUnread();
    this.auth.refreshProfile().subscribe({ error: () => undefined });
  }
}
