import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-header',
  imports: [RouterLink],
  template: `
    <div class="page-head">
      <div>
        <div class="breadcrumb-trail">
          <a routerLink="/dashboard">Dashboard</a>
          <i class="bi bi-chevron-right sep" style="font-size:9px"></i>
          <span class="current">{{ title() }}</span>
        </div>
        <h1>{{ title() }}</h1>
        @if (subtitle()) { <div class="sub">{{ subtitle() }}</div> }
      </div>
      <div class="d-flex gap-2 align-center" style="flex-wrap:wrap">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input('');
  readonly subtitle = input('');
}
