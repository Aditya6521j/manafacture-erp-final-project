import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    @if (open()) {
      <div class="modal-backdrop-c" (click)="onBackdrop($event)">
        <div class="modal-panel" [class.lg]="size() === 'lg'" [class.sm]="size() === 'sm'" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div>
              <h3>@if (icon()) { <i class="bi" [class]="icon()"></i> } {{ title() }}</h3>
              @if (subtitle()) { <div class="sub">{{ subtitle() }}</div> }
            </div>
            <button class="btn-ghost" style="border:none;background:none;cursor:pointer;font-size:15px;color:#7A8AA5" (click)="closed.emit()">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="modal-body"><ng-content /></div>
          <div class="modal-foot"><ng-content select="[modalFooter]" /></div>
        </div>
      </div>
    }
  `,
})
export class ModalComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly subtitle = input('');
  readonly icon = input('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly closeOnBackdrop = input(true);
  readonly closed = output<void>();

  onBackdrop(event: MouseEvent): void {
    if (this.closeOnBackdrop()) this.closed.emit();
  }
}
