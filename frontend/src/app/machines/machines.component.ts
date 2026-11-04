import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import { MachineService } from '../core/services/machine.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { ConfirmService } from '../shared/components/confirm.service';
import { LookupService } from '../core/services/lookup.service';
import { Machine, MaintenanceRecord } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';
import { PaginationComponent } from '../shared/components/pagination.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';
import { ModalComponent } from '../shared/components/modal.component';
import { MachineFormComponent } from './machine-form.component';

@Component({
  selector: 'app-machines',
  imports: [FormsModule, DatePipe, DecimalPipe, SlicePipe, PageHeaderComponent, StatusBadgeComponent, PaginationComponent, EmptyStateComponent, ModalComponent, MachineFormComponent],
  template: `
    <app-page-header title="Machine Management" subtitle="Equipment register, live status, utilization and maintenance history">
      @if (auth.can('production:create')) {
        <button class="btn btn-primary btn-sm" (click)="openMachineForm()"><i class="bi bi-plus-lg"></i> Register Machine</button>
      }
    </app-page-header>

    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      <div class="stat-card" style="--accent:#2563A8;--accent-soft:#E8F0FA">
        <div class="sc-top"><div><div class="sc-label">Total machines</div><div class="sc-value">{{ summary().total }}</div></div><div class="sc-icon"><i class="bi bi-cpu"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#12A150;--accent-soft:#E6F7ED">
        <div class="sc-top"><div><div class="sc-label">Running</div><div class="sc-value">{{ summary().running }}</div></div><div class="sc-icon"><i class="bi bi-play-circle"></i></div></div>
        <div class="sc-hint">{{ summary().avgUtilization }}% avg utilization</div>
      </div>
      <div class="stat-card" style="--accent:#6B4DBA;--accent-soft:#F0EBFB">
        <div class="sc-top"><div><div class="sc-label">Under maintenance</div><div class="sc-value">{{ summary().maintenance }}</div></div><div class="sc-icon"><i class="bi bi-tools"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#D93A3A;--accent-soft:#FDECEC">
        <div class="sc-top"><div><div class="sc-label">Breakdown</div><div class="sc-value">{{ summary().breakdown }}</div></div><div class="sc-icon"><i class="bi bi-exclamation-octagon"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#0E9AA7;--accent-soft:#E3F6F8">
        <div class="sc-top"><div><div class="sc-label">Operating hours</div><div class="sc-value">{{ summary().totalOperatingHours | number }}</div></div><div class="sc-icon"><i class="bi bi-clock-history"></i></div></div>
      </div>
    </div>

    @if (summary().breakdown > 0) {
      <div class="alert-strip danger">
        <i class="bi bi-exclamation-octagon-fill"></i>
        <span><strong>{{ summary().breakdown }} machine(s) in breakdown.</strong> Maintenance team has been notified — check the maintenance register below.</span>
      </div>
    }

    <div class="panel">
      <div class="tabs-line">
        <div class="tab-item" [class.active]="tab() === 'machines'" (click)="tab.set('machines')"><i class="bi bi-cpu"></i> Machine register</div>
        <div class="tab-item" [class.active]="tab() === 'maintenance'" (click)="tab.set('maintenance')"><i class="bi bi-tools"></i> Maintenance</div>
      </div>

      @if (tab() === 'machines') {
        <div class="toolbar">
          <div class="search-box">
            <i class="bi bi-search"></i>
            <input class="form-control" placeholder="Search machine code, name, location…" [(ngModel)]="filters.search" (ngModelChange)="onSearch()" />
          </div>
          <select class="form-select" [(ngModel)]="filters.status" (ngModelChange)="load(1)">
            <option value="all">All statuses</option>
            @for (status of statuses; track status) { <option [value]="status">{{ status }}</option> }
          </select>
          <select class="form-select" [(ngModel)]="filters.type" (ngModelChange)="load(1)">
            <option value="all">All types</option>
            @for (type of types; track type) { <option [value]="type">{{ type }}</option> }
          </select>
          <div class="toolbar-spacer"></div>
          <button class="btn btn-outline btn-sm" (click)="load(page())"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
        </div>

        <div class="table-shell">
          <table class="erp-table">
            <thead>
              <tr><th>Machine</th><th>Type</th><th>Location</th><th>Status</th><th>Utilization</th><th>Operating hrs</th><th>Next maintenance</th><th style="text-align:right">Actions</th></tr>
            </thead>
            <tbody>
              @for (machine of machines(); track machine._id) {
                <tr>
                  <td><span class="cell-mono">{{ machine.machineCode }}</span><span class="cell-sub">{{ machine.name }}</span></td>
                  <td>{{ machine.type }}<span class="cell-sub">{{ machine.manufacturer }} {{ machine.model }}</span></td>
                  <td>{{ machine.location }}</td>
                  <td><app-status-badge [status]="machine.status" /></td>
                  <td style="min-width:120px">
                    <div class="progress-thin" [class.green]="(machine.utilizationPercentage ?? 0) >= 70" [class.orange]="(machine.utilizationPercentage ?? 0) < 40">
                      <span [style.width.%]="machine.utilizationPercentage ?? 0"></span>
                    </div>
                    <div class="progress-label">{{ machine.utilizationPercentage ?? 0 }}%</div>
                  </td>
                  <td>{{ machine.operatingHours | number }}</td>
                  <td>{{ machine.nextMaintenanceDate ? (machine.nextMaintenanceDate | date: 'dd MMM yy') : '—' }}</td>
                  <td>
                    <div class="table-actions">
                      @if (auth.can('machine:update_status')) {
                        <select class="form-select" style="height:32px;min-height:32px;font-size:12px;width:auto;padding:2px 24px 2px 8px"
                                [ngModel]="machine.status" (ngModelChange)="changeStatus(machine, $event)" title="Update machine status">
                          @for (status of statuses; track status) { <option [value]="status">{{ status }}</option> }
                        </select>
                      }
                      @if (auth.can('machine:view')) {
                        <button class="btn btn-outline btn-icon" title="Schedule maintenance" (click)="openMaintenance(machine)"><i class="bi bi-tools"></i></button>
                        <button class="btn btn-outline btn-icon" title="History" (click)="openHistory(machine)"><i class="bi bi-clock-history"></i></button>
                      }
                      @if (auth.can('production:update')) {
                        <button class="btn btn-outline btn-icon" title="Edit" (click)="editMachine(machine)"><i class="bi bi-pencil"></i></button>
                      }
                      @if (auth.can('production:delete')) {
                        <button class="btn btn-outline btn-icon" style="color:#D93A3A" title="Delete" (click)="remove(machine)"><i class="bi bi-trash3"></i></button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8"><app-empty-state icon="bi-cpu" title="No machines registered" message="Register the manufacturing equipment to track status and maintenance." /></td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="page()" [limit]="limit()" [total]="total()" [pagesTotal]="pages()" (pageChange)="load($event)" (limitChange)="onLimit($event)" />
      }

      @if (tab() === 'maintenance') {
        <div class="toolbar">
          <select class="form-select" [(ngModel)]="maintenanceFilter" (ngModelChange)="loadMaintenance()">
            <option value="all">All maintenance</option>
            @for (status of maintenanceStatuses; track status) { <option [value]="status">{{ status }}</option> }
          </select>
          <div class="toolbar-spacer"></div>
          <span class="hint" style="font-size:12.4px;color:#7A8AA5">Preventive, breakdown, corrective and predictive jobs</span>
        </div>
        <div class="table-shell">
          <table class="erp-table">
            <thead><tr><th>Code</th><th>Machine</th><th>Type</th><th>Scheduled</th><th>Completed</th><th>Technician</th><th>Downtime</th><th>Cost</th><th>Status</th><th style="text-align:right">Actions</th></tr></thead>
            <tbody>
              @for (record of maintenance(); track record._id) {
                <tr>
                  <td class="cell-mono">{{ record.maintenanceCode }}</td>
                  <td><span class="cell-strong">{{ machineName(record) }}</span><span class="cell-sub">{{ record.description | slice: 0:52 }}</span></td>
                  <td><span class="b-chip">{{ record.type }}</span></td>
                  <td>{{ record.scheduledDate | date: 'dd MMM yy' }}</td>
                  <td>{{ record.completedDate ? (record.completedDate | date: 'dd MMM yy') : '—' }}</td>
                  <td>{{ record.technician || '—' }}</td>
                  <td>{{ record.downtimeHours }} h</td>
                  <td>₹{{ record.cost | number }}</td>
                  <td><app-status-badge [status]="record.status" /></td>
                  <td>
                    <div class="table-actions">
                      @if (record.status !== 'Completed' && auth.can('machine:view')) {
                        <button class="btn btn-success btn-sm" (click)="completeMaintenance(record)"><i class="bi bi-check2"></i> Complete</button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="10"><app-empty-state icon="bi-tools" title="No maintenance records" message="Schedule preventive maintenance to keep equipment healthy." /></td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- Breakdown reason -->
    <app-modal [open]="breakdownOpen()" size="sm" icon="bi-exclamation-octagon" title="Report Machine Breakdown"
               [subtitle]="breakdownMachine()?.name ?? ''" (closed)="breakdownOpen.set(false)">
      <div class="alert-strip danger" style="margin:0 0 14px">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <span>Reporting a breakdown notifies the production manager and opens a maintenance work order automatically.</span>
      </div>
      <label class="form-label">Breakdown reason <span class="req">*</span></label>
      <textarea class="form-control" rows="3" [(ngModel)]="breakdownReason" placeholder="e.g. Spindle alarm E-204, hydraulic pressure drop…"></textarea>
      <div modalFooter>
        <button class="btn btn-outline" (click)="breakdownOpen.set(false)">Cancel</button>
        <button class="btn btn-danger" (click)="confirmBreakdown()" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Reporting…</span> } @else { <i class="bi bi-exclamation-octagon"></i> <span>Report breakdown</span> }
        </button>
      </div>
    </app-modal>

    <!-- Schedule maintenance -->
    <app-modal [open]="maintenanceOpen()" icon="bi-tools" title="Schedule Maintenance"
               [subtitle]="maintenanceMachine()?.name ?? ''" (closed)="maintenanceOpen.set(false)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
        <div>
          <label class="form-label">Maintenance type</label>
          <select class="form-select" [(ngModel)]="maintenanceForm.type">
            @for (type of maintenanceTypes; track type) { <option [value]="type">{{ type }}</option> }
          </select>
        </div>
        <div>
          <label class="form-label">Scheduled date <span class="req">*</span></label>
          <input type="date" class="form-control" [(ngModel)]="maintenanceForm.scheduledDate" />
        </div>
        <div>
          <label class="form-label">Technician</label>
          <input class="form-control" [(ngModel)]="maintenanceForm.technician" placeholder="Dinesh Chaudhari" />
        </div>
        <div>
          <label class="form-label">Estimated cost (₹)</label>
          <input type="number" min="0" class="form-control" [(ngModel)]="maintenanceForm.cost" />
        </div>
        <div>
          <label class="form-label">Expected downtime (hours)</label>
          <input type="number" min="0" class="form-control" [(ngModel)]="maintenanceForm.downtimeHours" />
        </div>
        <div style="grid-column:1/-1">
          <label class="form-label">Work description <span class="req">*</span></label>
          <textarea class="form-control" rows="2" [(ngModel)]="maintenanceForm.description" placeholder="Planned maintenance activities, parts expected…"></textarea>
        </div>
      </div>
      <div modalFooter>
        <button class="btn btn-outline" (click)="maintenanceOpen.set(false)">Cancel</button>
        <button class="btn btn-primary" (click)="saveMaintenance()" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>Schedule</span> }
        </button>
      </div>
    </app-modal>

    <!-- History -->
    <app-modal [open]="historyOpen()" size="lg" icon="bi-clock-history" title="Maintenance History"
               [subtitle]="historyMachine()?.name ?? ''" (closed)="historyOpen.set(false)">
      <div class="table-shell" style="border:1px solid #E2E8F2;border-radius:11px">
        <table class="erp-table">
          <thead><tr><th>Code</th><th>Type</th><th>Scheduled</th><th>Completed</th><th>Technician</th><th>Downtime</th><th>Status</th></tr></thead>
          <tbody>
            @for (record of history(); track record._id) {
              <tr>
                <td class="cell-mono">{{ record.maintenanceCode }}</td>
                <td>{{ record.type }}</td>
                <td>{{ record.scheduledDate | date: 'dd MMM yy' }}</td>
                <td>{{ record.completedDate ? (record.completedDate | date: 'dd MMM yy') : '—' }}</td>
                <td>{{ record.technician }}</td>
                <td>{{ record.downtimeHours }} h</td>
                <td><app-status-badge [status]="record.status" /></td>
              </tr>
            } @empty {
              <tr><td colspan="7"><app-empty-state icon="bi-clock-history" title="No history" message="Maintenance history will appear here." /></td></tr>
            }
          </tbody>
        </table>
      </div>
      <div modalFooter><button class="btn btn-outline" (click)="historyOpen.set(false)">Close</button></div>
    </app-modal>

    <app-machine-form [open]="machineFormOpen()" [machine]="editingMachine()" (closed)="machineFormOpen.set(false)" (saved)="afterSave()" />
  `,
})
export class MachinesComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly machinesApi = inject(MachineService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly tab = signal<'machines' | 'maintenance'>('machines');
  readonly machines = signal<Machine[]>([]);
  readonly maintenance = signal<MaintenanceRecord[]>([]);
  readonly summary = signal({ total: 0, running: 0, idle: 0, maintenance: 0, breakdown: 0, avgUtilization: 0, totalOperatingHours: 0 });

  readonly page = signal(1);
  readonly limit = signal(10);
  readonly total = signal(0);
  readonly pages = signal(1);

  readonly machineFormOpen = signal(false);
  readonly editingMachine = signal<Machine | null>(null);
  readonly breakdownOpen = signal(false);
  readonly breakdownMachine = signal<Machine | null>(null);
  readonly maintenanceOpen = signal(false);
  readonly maintenanceMachine = signal<Machine | null>(null);
  readonly historyOpen = signal(false);
  readonly historyMachine = signal<Machine | null>(null);
  readonly history = signal<MaintenanceRecord[]>([]);
  readonly saving = signal(false);

  readonly statuses = ['Running', 'Idle', 'Under Maintenance', 'Breakdown'];
  readonly types = ['CNC Machine', 'Injection Molding', 'Lathe', 'Press', 'Welding Robot', 'Packaging Unit', 'Assembly Line', 'Furnace'];
  readonly maintenanceTypes = ['Preventive', 'Breakdown', 'Corrective', 'Predictive'];
  readonly maintenanceStatuses = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];

  filters = { search: '', status: 'all', type: 'all' };
  maintenanceFilter = 'all';
  breakdownReason = '';
  maintenanceForm = { type: 'Preventive', scheduledDate: new Date().toISOString().slice(0, 10), technician: '', cost: 0, downtimeHours: 0, description: '' };

  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.load(1);
    this.loadSummary();
    this.loadMaintenance();
  }

  loadSummary(): void {
    this.machinesApi.utilization().subscribe({
      next: (data) => this.summary.set({
        total: data.total, running: data.running, idle: data.idle, maintenance: data.maintenance,
        breakdown: data.breakdown, avgUtilization: data.avgUtilization, totalOperatingHours: data.totalOperatingHours,
      }),
    });
  }

  load(page = this.page()): void {
    this.page.set(page);
    this.machinesApi.list({ page, limit: this.limit(), search: this.filters.search || undefined, status: this.filters.status, type: this.filters.type }).subscribe({
      next: (res) => {
        this.machines.set(res.data);
        this.total.set(res.meta?.total ?? 0);
        this.pages.set(res.meta?.pages ?? 1);
      },
    });
  }

  loadMaintenance(): void {
    this.machinesApi.maintenanceList({ limit: 50, status: this.maintenanceFilter }).subscribe({
      next: (res) => this.maintenance.set(res.data),
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

  openMachineForm(): void {
    this.editingMachine.set(null);
    this.machineFormOpen.set(true);
  }

  editMachine(machine: Machine): void {
    this.editingMachine.set(machine);
    this.machineFormOpen.set(true);
  }

  afterSave(): void {
    this.load(this.page());
    this.loadSummary();
  }

  changeStatus(machine: Machine, status: string): void {
    if (status === machine.status) return;
    if (status === 'Breakdown') {
      this.breakdownMachine.set(machine);
      this.breakdownReason = '';
      this.breakdownOpen.set(true);
      return;
    }
    this.machinesApi.updateStatus(machine._id, status).subscribe({
      next: (res) => {
        this.toast.success('Machine status updated', res.message);
        this.load(this.page());
        this.loadSummary();
        this.lookups.invalidate('machines');
      },
      error: () => this.load(this.page()),
    });
  }

  confirmBreakdown(): void {
    const machine = this.breakdownMachine();
    if (!machine) return;
    if (!this.breakdownReason.trim()) {
      this.toast.warning('Reason required', 'Please describe the breakdown before reporting.');
      return;
    }
    this.saving.set(true);
    this.machinesApi.updateStatus(machine._id, 'Breakdown', this.breakdownReason).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.breakdownOpen.set(false);
        this.toast.error('Breakdown reported', res.message);
        this.load(this.page());
        this.loadSummary();
        this.loadMaintenance();
      },
      error: () => this.saving.set(false),
    });
  }

  openMaintenance(machine: Machine): void {
    this.maintenanceMachine.set(machine);
    this.maintenanceForm = {
      type: 'Preventive',
      scheduledDate: new Date().toISOString().slice(0, 10),
      technician: '',
      cost: 0,
      downtimeHours: 0,
      description: `Preventive maintenance for ${machine.name}`,
    };
    this.maintenanceOpen.set(true);
  }

  saveMaintenance(): void {
    const machine = this.maintenanceMachine();
    if (!machine) return;
    if (!this.maintenanceForm.scheduledDate || !this.maintenanceForm.description.trim()) {
      this.toast.warning('Incomplete form', 'Scheduled date and description are required.');
      return;
    }
    this.saving.set(true);
    this.machinesApi.scheduleMaintenance(machine._id, this.maintenanceForm).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.maintenanceOpen.set(false);
        this.toast.success('Maintenance scheduled', res.message);
        this.load(this.page());
        this.loadSummary();
        this.loadMaintenance();
      },
      error: () => this.saving.set(false),
    });
  }

  openHistory(machine: Machine): void {
    this.historyMachine.set(machine);
    this.machinesApi.get(machine._id).subscribe({
      next: (data) => {
        this.history.set(data.maintenanceHistory ?? []);
        this.historyOpen.set(true);
      },
    });
  }

  completeMaintenance(record: MaintenanceRecord): void {
    this.machinesApi.updateMaintenance(record._id, { status: 'Completed', completedDate: new Date().toISOString() }).subscribe({
      next: (res) => {
        this.toast.success('Maintenance closed', res.message);
        this.loadMaintenance();
        this.load(this.page());
        this.loadSummary();
      },
    });
  }

  machineName(record: MaintenanceRecord): string {
    return typeof record.machine === 'object' && record.machine ? `${record.machine.machineCode} · ${record.machine.name}` : record.machineName ?? '—';
  }

  async remove(machine: Machine): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${machine.machineCode}?`,
      message: 'Machines allocated to active production orders cannot be deleted.',
      confirmLabel: 'Delete machine',
      danger: true,
    });
    if (!confirmed) return;
    this.machinesApi.remove(machine._id).subscribe({
      next: (res) => {
        this.toast.success('Machine deleted', res.message);
        this.load(this.page());
        this.loadSummary();
      },
    });
  }
}
