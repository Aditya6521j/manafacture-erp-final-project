import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  template: `<span class="badge-status" [class]="cssClass()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input('');

  readonly label = computed(() => this.status() || '—');
  readonly cssClass = computed(() => `b-${String(this.status()).toLowerCase().replace(/[\s_-]+/g, '')}`);
}
