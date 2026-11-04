import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  template: `
    <div class="pagination-bar">
      <div class="meta">
        Showing
        <strong>{{ total() === 0 ? 0 : (page() - 1) * limit() + 1 }}–{{ Math.min(page() * limit(), total()) }}</strong>
        of <strong>{{ total() }}</strong> records
      </div>
      <div class="d-flex align-center gap-2">
        <select class="form-select" style="width:auto;min-width:96px;height:32px;min-height:32px;padding:2px 26px 2px 10px;font-size:12.4px"
                [value]="limit()" (change)="limitChange.emit(+$any($event.target).value)">
          @for (size of pageSizes; track size) { <option [value]="size">{{ size }} / page</option> }
        </select>
        <div class="pager">
          <button type="button" [disabled]="page() === 1" (click)="pageChange.emit(page() - 1)"><i class="bi bi-chevron-left"></i></button>
          @for (p of pages(); track p) {
            @if (p === -1) { <button type="button" disabled>…</button> }
            @else { <button type="button" [class.active]="p === page()" (click)="pageChange.emit(p)">{{ p }}</button> }
          }
          <button type="button" [disabled]="page() >= pagesTotal()" (click)="pageChange.emit(page() + 1)"><i class="bi bi-chevron-right"></i></button>
        </div>
      </div>
    </div>
  `,
})
export class PaginationComponent {
  readonly page = input(1);
  readonly limit = input(10);
  readonly total = input(0);
  readonly pagesTotal = input(1);
  readonly pageChange = output<number>();
  readonly limitChange = output<number>();

  readonly Math = Math;
  readonly pageSizes = [10, 25, 50, 100];

  /** Compact page list with ellipsis markers (-1). */
  readonly pages = computed(() => {
    const total = this.pagesTotal();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, -1, total];
    if (current >= total - 3) return [1, -1, total - 4, total - 3, total - 2, total - 1, total];
    return [1, -1, current - 1, current, current + 1, -1, total];
  });
}
