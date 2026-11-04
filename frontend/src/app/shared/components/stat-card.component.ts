import { Component, input } from '@angular/core';

export type StatAccent = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'teal' | 'navy';

const ACCENTS: Record<StatAccent, { accent: string; soft: string }> = {
  blue: { accent: '#2563A8', soft: '#E8F0FA' },
  green: { accent: '#12A150', soft: '#E6F7ED' },
  orange: { accent: '#E8871E', soft: '#FDF1E3' },
  red: { accent: '#D93A3A', soft: '#FDECEC' },
  purple: { accent: '#6B4DBA', soft: '#F0EBFB' },
  teal: { accent: '#0E9AA7', soft: '#E3F6F8' },
  navy: { accent: '#12203F', soft: '#E7ECF5' },
};

@Component({
  selector: 'app-stat-card',
  template: `
    <div class="stat-card" [style.--accent]="colors.accent" [style.--accent-soft]="colors.soft">
      <div class="sc-top">
        <div>
          <div class="sc-label">{{ label() }}</div>
          <div class="sc-value">{{ value() }}</div>
        </div>
        <div class="sc-icon"><i class="bi" [class]="icon()"></i></div>
      </div>
      @if (hint()) {
        <div class="sc-hint">
          @if (trend()) {
            <span class="trend" [class.up]="trend() === 'up'" [class.down]="trend() === 'down'">
              <i class="bi" [class.bi-arrow-up-right]="trend() === 'up'" [class.bi-arrow-down-right]="trend() === 'down'"></i>
            </span>
          }
          {{ hint() }}
        </div>
      }
    </div>
  `,
})
export class StatCardComponent {
  readonly label = input('');
  readonly value = input<string | number | null>('—');
  readonly icon = input('bi-box');
  readonly hint = input('');
  readonly accent = input<StatAccent>('blue');
  readonly trend = input<'up' | 'down' | ''>('');

  get colors() {
    return ACCENTS[this.accent()] ?? ACCENTS.blue;
  }
}
