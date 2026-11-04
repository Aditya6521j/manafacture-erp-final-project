import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty-state">
      <i class="bi" [class]="icon()"></i>
      <strong>{{ title() }}</strong>
      <p>{{ message() }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input('bi-inbox');
  readonly title = input('Nothing here yet');
  readonly message = input('Try adjusting your filters or create a new record.');
}
