import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="toast-stack">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="toast-card" [class]="toast.kind">
          <div class="t-icon">
            <i class="bi" [class.bi-check-circle-fill]="toast.kind === 'success'"
               [class.bi-exclamation-octagon-fill]="toast.kind === 'error'"
               [class.bi-exclamation-triangle-fill]="toast.kind === 'warning'"
               [class.bi-info-circle-fill]="toast.kind === 'info'"></i>
          </div>
          <div style="flex:1">
            <div class="t-title">{{ toast.title }}</div>
            @if (toast.message) { <div class="t-msg">{{ toast.message }}</div> }
          </div>
          <button class="btn-ghost" style="border:none;background:none;cursor:pointer;color:#94A3B8" (click)="toasts.dismiss(toast.id)">
            <i class="bi bi-x-lg" style="font-size:12px"></i>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toasts = inject(ToastService);
}
