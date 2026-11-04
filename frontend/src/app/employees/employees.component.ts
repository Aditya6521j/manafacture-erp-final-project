import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { EmployeeService } from '../core/services/employee.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { ConfirmService } from '../shared/components/confirm.service';
import { LookupService } from '../core/services/lookup.service';
import { Employee } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';
import { PaginationComponent } from '../shared/components/pagination.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';
import { ModalComponent } from '../shared/components/modal.component';
import { EmployeeFormComponent } from './employee-form.component';

@Component({
  selector: 'app-employees',
  imports: [FormsModule, DatePipe, DecimalPipe, PageHeaderComponent, StatusBadgeComponent, PaginationComponent, EmptyStateComponent, ModalComponent, EmployeeFormComponent],
  template: `
    <app-page-header title="Employee Management" subtitle="Workforce register, shift allocation and task assignment">
      @if (auth.hasRole('Admin', 'Production Manager')) {
        <button class="btn btn-primary btn-sm" (click)="openCreate()"><i class="bi bi-person-plus"></i> Add Employee</button>
      }
    </app-page-header>

    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <div class="stat-card" style="--accent:#2563A8;--accent-soft:#E8F0FA">
        <div class="sc-top"><div><div class="sc-label">Total employees</div><div class="sc-value">{{ stats().total }}</div></div><div class="sc-icon"><i class="bi bi-people"></i></div></div>
      </div>
      @for (entry of statusCards(); track entry.label) {
        <div class="stat-card" [style.--accent]="entry.color" [style.--accent-soft]="entry.soft">
          <div class="sc-top"><div><div class="sc-label">{{ entry.label }}</div><div class="sc-value">{{ entry.count }}</div></div><div class="sc-icon"><i class="bi" [class]="entry.icon"></i></div></div>
        </div>
      }
    </div>

    <div class="panel">
      <div class="toolbar">
        <div class="search-box">
          <i class="bi bi-search"></i>
          <input class="form-control" placeholder="Search name, employee ID, role…" [(ngModel)]="filters.search" (ngModelChange)="onSearch()" />
        </div>
        <select class="form-select" [(ngModel)]="filters.status" (ngModelChange)="load(1)">
          <option value="all">All availability</option>
          @for (status of statuses; track status) { <option [value]="status">{{ status }}</option> }
        </select>
        <select class="form-select" [(ngModel)]="filters.shift" (ngModelChange)="load(1)">
          <option value="all">All shifts</option>
          @for (shift of shifts; track shift) { <option [value]="shift">{{ shift }}</option> }
        </select>
        <div class="toolbar-spacer"></div>
        <button class="btn btn-outline btn-sm" (click)="load(page())"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
      </div>

      <div class="table-shell">
        <table class="erp-table">
          <thead>
            <tr><th>Employee ID</th><th>Name</th><th>Department</th><th>Role</th><th>Shift</th><th>Tasks</th><th>Performance</th><th>Availability</th><th style="text-align:right">Actions</th></tr>
          </thead>
          <tbody>
            @for (employee of employees(); track employee._id) {
              <tr>
                <td class="cell-mono">{{ employee.employeeId }}</td>
                <td>
                  <div class="d-flex align-center gap-2">
                    <div class="avatar sm">{{ initials(employee.name) }}</div>
                    <div>
                      <span class="cell-strong">{{ employee.name }}</span>
                      <span class="cell-sub">{{ employee.phone }}</span>
                    </div>
                  </div>
                </td>
                <td>{{ departmentName(employee) }}</td>
                <td>{{ employee.role }}</td>
                <td><span class="b-chip">{{ employee.shift }}</span></td>
                <td>
                  <strong>{{ employee.tasksCompleted ?? 0 }}</strong> / {{ employee.tasksAssigned ?? 0 }}
                  <span class="cell-sub">completed / assigned</span>
                </td>
                <td style="min-width:110px">
                  <div class="progress-thin" [class.green]="(employee.performanceScore ?? 0) >= 80" [class.orange]="(employee.performanceScore ?? 0) < 60">
                    <span [style.width.%]="employee.performanceScore ?? 0"></span>
                  </div>
                  <div class="progress-label">{{ employee.performanceScore ?? 0 }} / 100</div>
                </td>
                <td><app-status-badge [status]="employee.status" /></td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-outline btn-icon" title="Tasks & assignment" (click)="openTasks(employee)"><i class="bi bi-list-task"></i></button>
                    @if (auth.hasRole('Admin', 'Production Manager')) {
                      <button class="btn btn-outline btn-icon" title="Edit" (click)="openEdit(employee)"><i class="bi bi-pencil"></i></button>
                    }
                    @if (auth.hasRole('Admin')) {
                      <button class="btn btn-outline btn-icon" style="color:#D93A3A" title="Delete" (click)="remove(employee)"><i class="bi bi-trash3"></i></button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="9"><app-empty-state icon="bi-people" title="No employees found" message="Add shop floor employees to allocate production tasks." /></td></tr>
            }
          </tbody>
        </table>
      </div>
      <app-pagination [page]="page()" [limit]="limit()" [total]="total()" [pagesTotal]="pages()" (pageChange)="load($event)" (limitChange)="onLimit($event)" />
    </div>

    <!-- Tasks / assignment -->
    <app-modal [open]="tasksOpen()" size="lg" icon="bi-list-task" [title]="selected()?.name ?? ''"
               [subtitle]="(selected()?.role ?? '') + ' · ' + (selected()?.shift ?? '')" (closed)="tasksOpen.set(false)">
      @if (selected(); as employee) {
        <div style="margin-bottom:16px">
          <label class="form-label">Assign a production task</label>
          <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px">
            <select class="form-select" [(ngModel)]="taskForm.productionOrder">
              <option value="">Select production order…</option>
              @for (order of openOrders(); track order._id) {
                <option [value]="order._id">{{ order.orderNumber }} — {{ order.productName }}</option>
              }
            </select>
            <input class="form-control" [(ngModel)]="taskForm.task" placeholder="Task description" />
            <button class="btn btn-primary" (click)="assignTask()" [disabled]="assigning()">
              <i class="bi bi-plus-lg"></i> Assign
            </button>
          </div>
        </div>

        <div class="table-shell" style="border:1px solid #E2E8F2;border-radius:11px">
          <table class="erp-table">
            <thead><tr><th>Order wise task</th><th>Assigned</th><th>Status</th><th style="text-align:right">Update</th></tr></thead>
            <tbody>
              @for (task of employee.assignedTasks ?? []; track $index) {
                <tr>
                  <td><span class="cell-strong">{{ task.orderNumber }}</span><span class="cell-sub">{{ task.task }}</span></td>
                  <td>{{ task.assignedAt | date: 'dd MMM yy' }}</td>
                  <td><app-status-badge [status]="task.status" /></td>
                  <td>
                    <div class="table-actions">
                      @if (task.status !== 'Completed') {
                        <button class="btn btn-outline btn-sm" (click)="advanceTask(employee, $index, task)">
                          {{ task.status === 'Assigned' ? 'Start' : 'Complete' }}
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4"><app-empty-state icon="bi-list-check" title="No tasks assigned" message="Assign a production order task to this employee." /></td></tr>
              }
            </tbody>
          </table>
        </div>
      }
      <div modalFooter><button class="btn btn-outline" (click)="tasksOpen.set(false)">Close</button></div>
    </app-modal>

    <app-employee-form [open]="formOpen()" [employee]="editing()" (closed)="formOpen.set(false)" (saved)="afterSave()" />
  `,
})
export class EmployeesComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly employeesApi = inject(EmployeeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly employees = signal<Employee[]>([]);
  readonly stats = signal<{ total: number; byStatus: { _id: string; count: number }[]; byDepartment: { name: string; count: number; avgScore: number }[] }>({
    total: 0, byStatus: [], byDepartment: [],
  });

  readonly page = signal(1);
  readonly limit = signal(10);
  readonly total = signal(0);
  readonly pages = signal(1);

  readonly formOpen = signal(false);
  readonly editing = signal<Employee | null>(null);
  readonly tasksOpen = signal(false);
  readonly selected = signal<Employee | null>(null);
  readonly assigning = signal(false);

  readonly openOrders = this.lookups.orders;
  readonly statuses = ['Available', 'On Task', 'On Leave', 'Inactive'];
  readonly shifts = ['Shift A (06:00-14:00)', 'Shift B (14:00-22:00)', 'Shift C (22:00-06:00)', 'General'];
  filters = { search: '', status: 'all', shift: 'all' };
  taskForm = { productionOrder: '', task: '' };

  private timer?: ReturnType<typeof setTimeout>;

  readonly statusCards = () => {
    const counts = this.stats().byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {} as Record<string, number>);
    return [
      { label: 'Available', count: counts['Available'] ?? 0, color: '#12A150', soft: '#E6F7ED', icon: 'bi-person-check' },
      { label: 'On task', count: counts['On Task'] ?? 0, color: '#2563A8', soft: '#E8F0FA', icon: 'bi-person-workspace' },
      { label: 'On leave', count: counts['On Leave'] ?? 0, color: '#E8871E', soft: '#FDF1E3', icon: 'bi-person-dash' },
    ];
  };

  ngOnInit(): void {
    this.load(1);
    this.loadStats();
    this.lookups.loadOrders().subscribe();
  }

  loadStats(): void {
    this.employeesApi.stats().subscribe({ next: (stats) => this.stats.set(stats) });
  }

  load(page = this.page()): void {
    this.page.set(page);
    this.employeesApi
      .list({ page, limit: this.limit(), search: this.filters.search || undefined, status: this.filters.status, shift: this.filters.shift })
      .subscribe({
        next: (res) => {
          this.employees.set(res.data);
          this.total.set(res.meta?.total ?? 0);
          this.pages.set(res.meta?.pages ?? 1);
        },
      });
  }

  onSearch(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(1), 330);
  }

  onLimit(limit: number): void {
    this.limit.set(limit);
    this.load(1);
  }

  openCreate(): void {
    this.editing.set(null);
    this.formOpen.set(true);
  }

  openEdit(employee: Employee): void {
    this.editing.set(employee);
    this.formOpen.set(true);
  }

  afterSave(): void {
    this.load(this.page());
    this.loadStats();
  }

  openTasks(employee: Employee): void {
    this.employeesApi.get(employee._id).subscribe({
      next: (data) => {
        this.selected.set(data);
        this.taskForm = { productionOrder: '', task: '' };
        this.tasksOpen.set(true);
      },
    });
  }

  assignTask(): void {
    const employee = this.selected();
    if (!employee) return;
    if (!this.taskForm.productionOrder || !this.taskForm.task.trim()) {
      this.toast.warning('Incomplete assignment', 'Select a production order and describe the task.');
      return;
    }
    this.assigning.set(true);
    this.employeesApi.assignTask(employee._id, this.taskForm.productionOrder, this.taskForm.task).subscribe({
      next: (res) => {
        this.assigning.set(false);
        this.selected.set(res.data);
        this.taskForm = { productionOrder: '', task: '' };
        this.toast.success('Task assigned', res.message);
        this.load(this.page());
        this.loadStats();
      },
      error: () => this.assigning.set(false),
    });
  }

  advanceTask(employee: Employee, index: number, task: { status: string }): void {
    const tasks = employee.assignedTasks ?? [];
    const taskId = (task as unknown as { _id?: string })._id;
    const nextStatus = task.status === 'Assigned' ? 'In Progress' : 'Completed';
    // The API addresses tasks by subdocument id; fall back to index when id is unavailable
    const id = taskId ?? (tasks[index] as unknown as { id?: string }).id;
    if (!id) {
      this.toast.warning('Task not addressable', 'Reload the employee record and try again.');
      return;
    }
    this.employeesApi.updateTask(employee._id, id, nextStatus).subscribe({
      next: (res) => {
        this.selected.set(res.data);
        this.toast.success('Task updated', res.message);
        this.load(this.page());
        this.loadStats();
      },
    });
  }

  departmentName(employee: Employee): string {
    return typeof employee.department === 'object' && employee.department ? employee.department.name : 'Unassigned';
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  }

  async remove(employee: Employee): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Remove ${employee.name}?`,
      message: 'This deletes the employee record and their task history.',
      confirmLabel: 'Remove employee',
      danger: true,
    });
    if (!confirmed) return;
    this.employeesApi.remove(employee._id).subscribe({
      next: (res) => {
        this.toast.success('Employee removed', res.message);
        this.load(this.page());
        this.loadStats();
      },
    });
  }
}
