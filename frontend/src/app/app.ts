import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/components/toast-container.component';
import { ConfirmHostComponent } from './shared/components/confirm-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, ConfirmHostComponent],
  template: `
    <router-outlet />
    <app-toast-container />
    <app-confirm-host />
  `,
})
export class App {}
