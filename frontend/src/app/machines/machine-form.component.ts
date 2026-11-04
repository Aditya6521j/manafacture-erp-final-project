import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../shared/components/modal.component';
import { MachineService } from '../core/services/machine.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { Machine } from '../core/models';

@Component({
  selector: 'app-machine-form',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [open]="open()" size="lg" icon="bi-cpu" [title]="machine() ? 'Edit Machine' : 'Register Machine'"
               subtitle="Equipment master data and maintenance planning" (closed)="closed.emit()">
      <form [formGroup]="form" id="machineForm" (ngSubmit)="submit()" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
          <div>
            <label class="form-label">Machine code <span class="req">*</span></label>
            <input class="form-control" formControlName="machineCode" placeholder="MCH-007" [readonly]="!!machine()" [class.is-invalid]="invalid('machineCode')" />
            @if (invalid('machineCode')) { <div class="invalid-feedback">Machine code is required.</div> }
          </div>
          <div>
            <label class="form-label">Machine name <span class="req">*</span></label>
            <input class="form-control" formControlName="name" placeholder="CNC Turning Center TX-300" [class.is-invalid]="invalid('name')" />
            @if (invalid('name')) { <div class="invalid-feedback">Machine name is required.</div> }
          </div>
          <div>
            <label class="form-label">Type <span class="req">*</span></label>
            <select class="form-select" formControlName="type">
              @for (type of types; track type) { <option [value]="type">{{ type }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Status</label>
            <select class="form-select" formControlName="status">
              @for (status of statuses; track status) { <option [value]="status">{{ status }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Manufacturer</label>
            <input class="form-control" formControlName="manufacturer" />
          </div>
          <div>
            <label class="form-label">Model</label>
            <input class="form-control" formControlName="model" />
          </div>
          <div>
            <label class="form-label">Serial number</label>
            <input class="form-control" formControlName="serialNumber" />
          </div>
          <div>
            <label class="form-label">Capacity per hour</label>
            <input type="number" min="1" class="form-control" formControlName="capacityPerHour" />
          </div>
          <div>
            <label class="form-label">Location</label>
            <input class="form-control" formControlName="location" placeholder="Shop Floor A" />
          </div>
          <div>
            <label class="form-label">Operating hours</label>
            <input type="number" min="0" class="form-control" formControlName="operatingHours" />
          </div>
          <div>
            <label class="form-label">Last maintenance</label>
            <input type="date" class="form-control" formControlName="lastMaintenanceDate" />
          </div>
          <div>
            <label class="form-label">Next maintenance</label>
            <input type="date" class="form-control" formControlName="nextMaintenanceDate" />
          </div>
        </div>
      </form>
      <div modalFooter>
        <button class="btn btn-outline" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="machineForm" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>Save machine</span> }
        </button>
      </div>
    </app-modal>
  `,
})
export class MachineFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly machinesApi = inject(MachineService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly machine = input<Machine | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly saving = signal(false);

  readonly types = ['CNC Machine', 'Injection Molding', 'Lathe', 'Press', 'Welding Robot', 'Packaging Unit', 'Assembly Line', 'Furnace'];
  readonly statuses = ['Running', 'Idle', 'Under Maintenance', 'Breakdown'];

  readonly form = this.fb.group({
    machineCode: ['', Validators.required],
    name: ['', Validators.required],
    type: ['CNC Machine', Validators.required],
    status: ['Idle'],
    manufacturer: [''],
    model: [''],
    serialNumber: [''],
    capacityPerHour: [50],
    location: ['Shop Floor A'],
    operatingHours: [0],
    lastMaintenanceDate: [''],
    nextMaintenanceDate: [''],
  });

  constructor() {
    effect(() => {
      if (this.open()) this.initForm();
    });
  }

  ngOnInit(): void {
    this.initForm();
  }

  /** Resets the form so reopening the modal never reuses previous values. */
  private initForm(): void {
    this.form.reset({
      machineCode: '', name: '', type: 'CNC Machine', status: 'Idle', manufacturer: '', model: '',
      serialNumber: '', capacityPerHour: 50, location: 'Shop Floor A', operatingHours: 0,
      lastMaintenanceDate: '', nextMaintenanceDate: '',
    });
    this.form.markAsUntouched();
    this.form.markAsPristine();
    const existing = this.machine();
    if (existing) {
      this.form.patchValue({
        machineCode: existing.machineCode,
        name: existing.name,
        type: existing.type,
        status: existing.status,
        manufacturer: existing.manufacturer ?? '',
        model: existing.model ?? '',
        serialNumber: existing.serialNumber ?? '',
        capacityPerHour: existing.capacityPerHour ?? 50,
        location: existing.location ?? '',
        operatingHours: existing.operatingHours ?? 0,
        lastMaintenanceDate: existing.lastMaintenanceDate ? new Date(existing.lastMaintenanceDate).toISOString().slice(0, 10) : '',
        nextMaintenanceDate: existing.nextMaintenanceDate ? new Date(existing.nextMaintenanceDate).toISOString().slice(0, 10) : '',
      });
    }
  }

  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      ...raw,
      lastMaintenanceDate: raw.lastMaintenanceDate || undefined,
      nextMaintenanceDate: raw.nextMaintenanceDate || undefined,
    };
    const existing = this.machine();
    const request = existing ? this.machinesApi.update(existing._id, payload) : this.machinesApi.create(payload);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Machine updated' : 'Machine registered', res.message);
        this.lookups.invalidate('machines');
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
