import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  readonly toasts = signal<Toast[]>([]);

  show(kind: ToastKind, title: string, message?: string, duration = 4200): void {
    const id = ++this.counter;
    this.toasts.update((list) => [...list, { id, kind, title, message }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(title: string, message?: string) { this.show('success', title, message); }
  error(title: string, message?: string) { this.show('error', title, message, 6000); }
  warning(title: string, message?: string) { this.show('warning', title, message, 5200); }
  info(title: string, message?: string) { this.show('info', title, message); }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
