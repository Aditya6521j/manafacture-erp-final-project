import { Component, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';

@Component({
  selector: 'app-confirm-host',
  template: `
    @if (confirm.state().open) {
      <div class="modal-backdrop-c" style="align-items:center" (click)="confirm.respond(false)">
        <div class="modal-panel sm" (click)="$event.stopPropagation()">
          <div class="modal-body" style="padding:24px 22px 18px;text-align:center">
            <div style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;margin:0 auto 14px"
                 [style.background]="confirm.state().danger ? '#FDECEC' : '#E8F0FA'"
                 [style.color]="confirm.state().danger ? '#D93A3A' : '#2563A8'">
              <i class="bi" [class.bi-exclamation-triangle-fill]="confirm.state().danger" [class.bi-question-circle-fill]="!confirm.state().danger" style="font-size:22px"></i>
            </div>
            <h3 style="font-size:16px;margin-bottom:6px">{{ confirm.state().title }}</h3>
            <p style="font-size:13px;color:#5A6B87;margin:0">{{ confirm.state().message }}</p>
          </div>
          <div class="modal-foot" style="justify-content:center;padding-bottom:18px">
            <button class="btn btn-outline" (click)="confirm.respond(false)">{{ confirm.state().cancelLabel }}</button>
            <button class="btn" [class.btn-danger]="confirm.state().danger" [class.btn-primary]="!confirm.state().danger" (click)="confirm.respond(true)">
              {{ confirm.state().confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmHostComponent {
  readonly confirm = inject(ConfirmService);
}
