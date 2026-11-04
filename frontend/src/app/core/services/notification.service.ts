import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiResponse, AppNotification, PaginationMeta } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);
  readonly unreadCount = signal(0);
  readonly latest = signal<AppNotification[]>([]);

  list(query: QueryParams): Observable<ApiResponse<AppNotification[]>> {
    return this.api.get<AppNotification[]>('/notifications', query);
  }

  refreshUnread(): void {
    this.api.getData<{ count: number; latest: AppNotification[] }>('/notifications/unread-count').subscribe({
      next: (data) => {
        this.unreadCount.set(data.count);
        this.latest.set(data.latest);
      },
      error: () => this.unreadCount.set(0),
    });
  }

  markRead(id: string) {
    return this.api.patch<null>(`/notifications/${id}/read`).pipe(tap(() => this.refreshUnread()));
  }

  markAllRead() {
    return this.api.patch<null>('/notifications/read-all').pipe(tap(() => this.refreshUnread()));
  }

  remove(id: string) {
    return this.api.delete<null>(`/notifications/${id}`).pipe(tap(() => this.refreshUnread()));
  }

  runAlertEngine() {
    return this.api.post<null>('/notifications/refresh').pipe(tap(() => this.refreshUnread()));
  }
}

export type { PaginationMeta };
