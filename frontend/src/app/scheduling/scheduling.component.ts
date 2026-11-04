import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScheduleService } from '../core/services/production.service';
import { LookupService } from '../core/services/lookup.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { ConfirmService } from '../shared/components/confirm.service';
import { Machine, ProductionSchedule } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';
import { ModalComponent } from '../shared/components/modal.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';

interface DayBucket {
  date: Date;
  isToday: boolean;
  items: ProductionSchedule[];
}

@Component({
  selector: 'app-scheduling',
  imports: [FormsModule, DatePipe, TitleCasePipe, PageHeaderComponent, StatusBadgeComponent, ModalComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Production Scheduling" subtitle="Daily, weekly and monthly machine and workforce allocation">
      @if (auth.can('schedule:create')) {
        <button class="btn btn-primary btn-sm" (click)="openCreate()"><i class="bi bi-calendar-plus"></i> New Schedule</button>
      }
    </app-page-header>

    @if (conflicts().length) {
      <div class="alert-strip danger">
        <i class="bi bi-exclamation-octagon-fill"></i>
        <div>
          <strong>Scheduling conflict detected:</strong>
          {{ conflicts().length }} machine/shift combination(s) double booked in this period —
          @for (conflict of conflicts(); track conflict.key) { <span class="b-chip" style="margin-left:4px">{{ conflict.machine || 'Machine' }}</span> }
        </div>
      </div>
    }
    @if (delayedCount() > 0) {
      <div class="alert-strip warning">
        <i class="bi bi-alarm-fill"></i>
        <span><strong>{{ delayedCount() }} schedule(s) delayed</strong> — production is behind the planned shift timeline.</span>
      </div>
    }

    <div class="panel">
      <div class="toolbar">
        <div class="d-flex" style="border:1px solid #E2E8F2;border-radius:10px;overflow:hidden">
          @for (option of views; track option) {
            <button class="btn btn-sm" style="border-radius:0;padding:7px 14px"
                    [class.btn-primary]="view() === option" [class.btn-outline]="view() !== option"
                    [style.border]="view() === option ? 'none' : 'none'" (click)="setView(option)">
              {{ option | titlecase }}
            </button>
          }
        </div>

        <div class="d-flex align-center gap-2">
          <button class="btn btn-outline btn-icon" (click)="shift(-1)"><i class="bi bi-chevron-left"></i></button>
          <input type="date" class="form-control" style="width:auto;height:38px;min-height:38px" [value]="dateInput()" (change)="setDate($any($event.target).value)" />
          <button class="btn btn-outline btn-icon" (click)="shift(1)"><i class="bi bi-chevron-right"></i></button>
          <button class="btn btn-soft btn-sm" (click)="today()">Today</button>
        </div>

        <div class="toolbar-spacer"></div>
        <span class="hint" style="font-size:12.4px;color:#7A8AA5">{{ rangeLabel() }}</span>
        <button class="btn btn-outline btn-sm" (click)="load()"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
      </div>

      <!-- Weekly / daily timeline board -->
      @if (view() !== 'monthly') {
        <div class="panel-body">
          <div class="timeline-days">
            @for (day of days(); track day.date.toISOString()) {
              <div class="day-col" [class.today]="day.isToday">
                <div class="day-head">
                  <div>
                    <div class="dow">{{ day.date | date: 'EEE' }}</div>
                    <div class="dom">{{ day.date | date: 'dd' }}</div>
                  </div>
                  <span class="b-chip">{{ day.items.length }}</span>
                </div>
                <div class="day-body">
                  @for (item of day.items; track item._id) {
                    <div class="schedule-chip" [class]="chipClass(item)" (click)="openEdit(item)">
                      <strong>{{ machineCode(item) }}</strong>
                      <span>{{ orderNumber(item) }}</span>
                      <span style="display:block">{{ item.startTime }}–{{ item.endTime }} · {{ item.plannedQuantity }} u</span>
                      <span style="display:block;margin-top:3px"><app-status-badge [status]="item.status" /></span>
                    </div>
                  } @empty {
                    <div style="font-size:11.4px;color:#A6B3C7;text-align:center;padding:14px 4px">No schedule</div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="panel-body">
          <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">
            @for (weekday of weekdays; track weekday) {
              <div style="font-size:10.6px;text-transform:uppercase;letter-spacing:.08em;color:#7A8AA5;font-weight:800;text-align:center">{{ weekday }}</div>
            }
            @for (cell of monthCells(); track $index) {
              <div style="min-height:92px;border:1px solid #E2E8F2;border-radius:9px;padding:6px;background:#fff"
                   [style.background]="cell.isToday ? '#F2F7FD' : '#fff'" [style.borderColor]="cell.isToday ? '#9CC1E8' : '#E2E8F2'"
                   [style.opacity]="cell.inMonth ? 1 : 0.45">
                <div style="font-size:11.6px;font-weight:800;color:#243455;margin-bottom:4px">{{ cell.date | date: 'dd' }}</div>
                @for (item of cell.items.slice(0, 2); track item._id) {
                  <div class="schedule-chip" style="padding:3px 6px;font-size:10.6px;margin-bottom:3px" [class]="chipClass(item)" (click)="openEdit(item)">
                    {{ machineCode(item) }} · {{ item.startTime }}
                  </div>
                }
                @if (cell.items.length > 2) {
                  <div style="font-size:10.4px;color:#2563A8;font-weight:700">+{{ cell.items.length - 2 }} more</div>
                }
              </div>
            }
          </div>
        </div>
      }
    </div>

    <!-- Schedule table -->
    <div class="panel">
      <div class="panel-head">
        <h3><i class="bi bi-list-columns-reverse"></i> Schedule register</h3>
        <span class="hint">{{ schedules().length }} entries in this period</span>
      </div>
      <div class="table-shell">
        <table class="erp-table">
          <thead>
            <tr><th>Code</th><th>Order</th><th>Machine</th><th>Date</th><th>Shift</th><th>Time</th><th>Planned</th><th>Team</th><th>Status</th><th style="text-align:right">Actions</th></tr>
          </thead>
          <tbody>
            @for (schedule of schedules(); track schedule._id) {
              <tr>
                <td class="cell-mono">{{ schedule.scheduleCode }}</td>
                <td><span class="cell-strong">{{ orderNumber(schedule) }}</span></td>
                <td>{{ machineCode(schedule) }}</td>
                <td>{{ schedule.scheduleDate | date: 'dd MMM yyyy' }}</td>
                <td><span class="b-chip">{{ schedule.shift }}</span></td>
                <td>{{ schedule.startTime }}–{{ schedule.endTime }}</td>
                <td><strong>{{ schedule.plannedQuantity }}</strong> / <span style="color:#7A8AA5">{{ schedule.producedQuantity }}</span></td>
                <td>
                  @for (employee of schedule.employees; track employee._id) {
                    <span class="b-chip" style="margin:0 3px 3px 0" [title]="employee.role">{{ employee.name }}</span>
                  } @empty { <span class="cell-muted">Unassigned</span> }
                </td>
                <td><app-status-badge [status]="schedule.status" /></td>
                <td>
                  <div class="table-actions">
                    @if (auth.can('schedule:update')) {
                      <button class="btn btn-outline btn-icon" (click)="openEdit(schedule)"><i class="bi bi-pencil"></i></button>
                    }
                    @if (auth.can('schedule:delete')) {
                      <button class="btn btn-outline btn-icon" style="color:#D93A3A" (click)="remove(schedule)"><i class="bi bi-trash3"></i></button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="10"><app-empty-state icon="bi-calendar3" title="No schedules in this period" message="Create a schedule to allocate machines and employees to production orders." /></td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create / edit schedule -->
    <app-modal [open]="formOpen()" size="lg" icon="bi-calendar-plus"
               [title]="editing() ? 'Edit Schedule' : 'New Production Schedule'"
               subtitle="Allocate a machine, shift and workforce to a production order" (closed)="formOpen.set(false)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="grid-column:1/-1">
          <label class="form-label">Production order <span class="req">*</span></label>
          <select class="form-select" [(ngModel)]="form.productionOrder" [class.is-invalid]="errors['productionOrder']">
            <option value="">Select an order…</option>
            @for (order of openOrders(); track order._id) {
              <option [value]="order._id">{{ order.orderNumber }} — {{ order.productName }} ({{ order.status }})</option>
            }
          </select>
          @if (errors['productionOrder']) { <div class="invalid-feedback">{{ errors['productionOrder'] }}</div> }
        </div>

        <div>
          <label class="form-label">Machine <span class="req">*</span></label>
          <select class="form-select" [(ngModel)]="form.machine" [class.is-invalid]="errors['machine']">
            <option value="">Select machine…</option>
            @for (machine of machines(); track machine._id) {
              <option [value]="machine._id" [disabled]="machine.status === 'Breakdown'">
                {{ machine.machineCode }} — {{ machine.name }} ({{ machine.status }})
              </option>
            }
          </select>
          @if (errors['machine']) { <div class="invalid-feedback">{{ errors['machine'] }}</div> }
        </div>

        <div>
          <label class="form-label">Schedule date <span class="req">*</span></label>
          <input type="date" class="form-control" [(ngModel)]="form.scheduleDate" [class.is-invalid]="errors['scheduleDate']" />
          @if (errors['scheduleDate']) { <div class="invalid-feedback">{{ errors['scheduleDate'] }}</div> }
        </div>

        <div>
          <label class="form-label">Shift <span class="req">*</span></label>
          <select class="form-select" [(ngModel)]="form.shift" (ngModelChange)="applyShiftTimes($event)">
            @for (shift of shifts; track shift) { <option [value]="shift">{{ shift }}</option> }
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div>
            <label class="form-label">Start <span class="req">*</span></label>
            <input type="time" class="form-control" [(ngModel)]="form.startTime" />
          </div>
          <div>
            <label class="form-label">End <span class="req">*</span></label>
            <input type="time" class="form-control" [(ngModel)]="form.endTime" [class.is-invalid]="errors['endTime']" />
          </div>
        </div>

        <div>
          <label class="form-label">Planned quantity <span class="req">*</span></label>
          <input type="number" min="1" class="form-control" [(ngModel)]="form.plannedQuantity" [class.is-invalid]="errors['plannedQuantity']" />
          @if (errors['plannedQuantity']) { <div class="invalid-feedback">{{ errors['plannedQuantity'] }}</div> }
        </div>

        <div>
          <label class="form-label">Status</label>
          <select class="form-select" [(ngModel)]="form.status">
            @for (status of scheduleStatuses; track status) { <option [value]="status">{{ status }}</option> }
          </select>
        </div>

        <div style="grid-column:1/-1">
          <label class="form-label">Allocate employees</label>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:7px">
            @for (employee of employees(); track employee._id) {
              <label class="d-flex align-center gap-2" style="border:1px solid #E2E8F2;border-radius:9px;padding:7px 10px;cursor:pointer;font-size:12.4px"
                     [style.background]="form.employees.includes(employee._id) ? '#F2F7FD' : '#fff'">
                <input type="checkbox" [checked]="form.employees.includes(employee._id)" (change)="toggleEmployee(employee._id)" style="accent-color:#2563A8" />
                <span>
                  <strong style="display:block;font-size:12.2px">{{ employee.name }}</strong>
                  <span style="color:#7A8AA5;font-size:11px">{{ employee.role }} · {{ employee.status }}</span>
                </span>
              </label>
            }
          </div>
        </div>

        <div style="grid-column:1/-1">
          <label class="form-label">Notes</label>
          <textarea class="form-control" rows="2" [(ngModel)]="form.notes" placeholder="Shift instructions, tooling requirements…"></textarea>
        </div>
      </div>

      <div modalFooter>
        <button class="btn btn-outline" (click)="formOpen.set(false)">Cancel</button>
        <button class="btn btn-primary" (click)="save()" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>{{ editing() ? 'Save changes' : 'Create schedule' }}</span> }
        </button>
      </div>
    </app-modal>
  `,
})
export class SchedulingComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly schedulesApi = inject(ScheduleService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly schedules = signal<ProductionSchedule[]>([]);
  readonly view = signal<'daily' | 'weekly' | 'monthly'>('weekly');
  readonly currentDate = signal(new Date());
  readonly conflicts = signal<{ key: string; machine?: string }[]>([]);
  readonly delayedCount = signal(0);
  readonly formOpen = signal(false);
  readonly editing = signal<ProductionSchedule | null>(null);
  readonly saving = signal(false);

  readonly machines = this.lookups.machines;
  readonly employees = this.lookups.employees;
  readonly orders = this.lookups.orders;

  readonly views: ('daily' | 'weekly' | 'monthly')[] = ['daily', 'weekly', 'monthly'];
  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly shifts = ['Shift A (06:00-14:00)', 'Shift B (14:00-22:00)', 'Shift C (22:00-06:00)'];
  readonly scheduleStatuses = ['Scheduled', 'In Progress', 'Completed', 'Delayed', 'Cancelled'];

  errors: Record<string, string> = {};
  form = this.blankForm();

  readonly openOrders = computed(() => this.orders().filter((o) => !['Completed', 'Cancelled'].includes(o.status)));

  readonly dateInput = computed(() => this.toInputDate(this.currentDate()));

  readonly rangeLabel = computed(() => {
    const date = this.currentDate();
    if (this.view() === 'daily') return date.toDateString();
    if (this.view() === 'weekly') {
      const start = this.startOfWeek(date);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toDateString()} → ${end.toDateString()}`;
    }
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  });

  readonly days = computed<DayBucket[]>(() => {
    const base = this.currentDate();
    const start = this.view() === 'daily' ? new Date(base) : this.startOfWeek(base);
    const count = this.view() === 'daily' ? 1 : 7;
    const today = new Date().toDateString();

    return Array.from({ length: count }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return {
        date,
        isToday: date.toDateString() === today,
        items: this.schedules().filter((s) => new Date(s.scheduleDate).toDateString() === date.toDateString()),
      };
    });
  });

  readonly monthCells = computed(() => {
    const base = this.currentDate();
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const startOffset = first.getDay();
    const start = new Date(first);
    start.setDate(first.getDate() - startOffset);
    const today = new Date().toDateString();

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return {
        date,
        inMonth: date.getMonth() === base.getMonth(),
        isToday: date.toDateString() === today,
        items: this.schedules().filter((s) => new Date(s.scheduleDate).toDateString() === date.toDateString()),
      };
    });
  });

  ngOnInit(): void {
    this.lookups.loadOrders().subscribe();
    this.lookups.loadMachines().subscribe();
    this.lookups.loadEmployees().subscribe();
    this.load();
  }

  load(): void {
    this.schedulesApi
      .list({ view: this.view(), date: this.toInputDate(this.currentDate()), limit: 200 })
      .subscribe({
        next: (res) => {
          this.schedules.set(res.data);
          this.conflicts.set(res.meta?.conflicts ?? []);
          this.delayedCount.set(res.meta?.delayedCount ?? 0);
        },
      });
  }

  setView(view: 'daily' | 'weekly' | 'monthly'): void {
    this.view.set(view);
    this.load();
  }

  setDate(value: string): void {
    if (!value) return;
    this.currentDate.set(new Date(value));
    this.load();
  }

  shift(direction: number): void {
    const date = new Date(this.currentDate());
    if (this.view() === 'daily') date.setDate(date.getDate() + direction);
    else if (this.view() === 'weekly') date.setDate(date.getDate() + 7 * direction);
    else date.setMonth(date.getMonth() + direction);
    this.currentDate.set(date);
    this.load();
  }

  today(): void {
    this.currentDate.set(new Date());
    this.load();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = this.blankForm();
    this.form.scheduleDate = this.toInputDate(this.currentDate());
    this.errors = {};
    this.formOpen.set(true);
    this.lookups.loadOrders(true).subscribe();
  }

  openEdit(schedule: ProductionSchedule): void {
    this.editing.set(schedule);
    this.form = {
      productionOrder: typeof schedule.productionOrder === 'object' ? schedule.productionOrder._id : schedule.productionOrder,
      machine: typeof schedule.machine === 'object' ? schedule.machine._id : schedule.machine,
      scheduleDate: this.toInputDate(new Date(schedule.scheduleDate)),
      shift: schedule.shift,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      plannedQuantity: schedule.plannedQuantity,
      producedQuantity: schedule.producedQuantity,
      status: schedule.status,
      employees: (schedule.employees ?? []).map((e) => e._id),
      notes: schedule.notes ?? '',
    };
    this.errors = {};
    this.formOpen.set(true);
  }

  toggleEmployee(id: string): void {
    this.form.employees = this.form.employees.includes(id)
      ? this.form.employees.filter((e) => e !== id)
      : [...this.form.employees, id];
  }

  applyShiftTimes(shift: string): void {
    if (shift.startsWith('Shift A')) { this.form.startTime = '06:00'; this.form.endTime = '14:00'; }
    else if (shift.startsWith('Shift B')) { this.form.startTime = '14:00'; this.form.endTime = '22:00'; }
    else { this.form.startTime = '22:00'; this.form.endTime = '06:00'; }
  }

  validate(): boolean {
    const errors: Record<string, string> = {};
    if (!this.form.productionOrder) errors['productionOrder'] = 'Select the production order.';
    if (!this.form.machine) errors['machine'] = 'Select the machine.';
    if (!this.form.scheduleDate) errors['scheduleDate'] = 'Choose the schedule date.';
    if (!this.form.plannedQuantity || this.form.plannedQuantity < 1) errors['plannedQuantity'] = 'Planned quantity must be at least 1.';
    if (this.form.startTime === this.form.endTime) errors['endTime'] = 'End time must differ from the start time.';
    this.errors = errors;
    return Object.keys(errors).length === 0;
  }

  save(): void {
    if (!this.validate()) {
      this.toast.warning('Incomplete form', 'Please fix the highlighted fields.');
      return;
    }
    this.saving.set(true);
    const payload = { ...this.form, scheduleDate: new Date(this.form.scheduleDate).toISOString() };
    const request = this.editing()
      ? this.schedulesApi.update(this.editing()!._id, payload)
      : this.schedulesApi.create(payload);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(this.editing() ? 'Schedule updated' : 'Schedule created', res.message);
        this.formOpen.set(false);
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  async remove(schedule: ProductionSchedule): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'Delete schedule?',
      message: `${schedule.scheduleCode} will be removed and its team released back to the available pool.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    this.schedulesApi.remove(schedule._id).subscribe({
      next: (res) => {
        this.toast.success('Schedule deleted', res.message);
        this.load();
      },
    });
  }

  orderNumber(schedule: ProductionSchedule): string {
    return typeof schedule.productionOrder === 'object' ? schedule.productionOrder?.orderNumber : '—';
  }

  machineCode(schedule: ProductionSchedule): string {
    return typeof schedule.machine === 'object' ? schedule.machine?.machineCode : '—';
  }

  chipClass(schedule: ProductionSchedule): string {
    const status = schedule.status.toLowerCase().replace(/\s+/g, '');
    const delayed = schedule.status !== 'Completed' && new Date(schedule.scheduleDate) < new Date(new Date().toDateString());
    return delayed ? 'delayed' : status;
  }

  private blankForm() {
    return {
      productionOrder: '',
      machine: '' as string,
      scheduleDate: this.toInputDate(new Date()),
      shift: 'Shift A (06:00-14:00)',
      startTime: '06:00',
      endTime: '14:00',
      plannedQuantity: 100,
      producedQuantity: 0,
      status: 'Scheduled',
      employees: [] as string[],
      notes: '',
    };
  }

  private startOfWeek(date: Date): Date {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private toInputDate(date: Date): string {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}

type MachineOption = Machine;
