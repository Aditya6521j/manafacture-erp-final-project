import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../shared/components/modal.component';
import { EmployeeService } from '../core/services/employee.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { Employee } from '../core/models';

@Component({
  selector: 'app-employee-form',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [open]="open()" icon="bi-person-plus" [title]="employee() ? 'Edit Employee' : 'Add Employee'"
               subtitle="Shop floor workforce master and shift allocation" (closed)="closed.emit()">
      <form [formGroup]="form" id="employeeForm" (ngSubmit)="submit()" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
          <div>
            <label class="form-label">Employee ID <span class="req">*</span></label>
            <input class="form-control" formControlName="employeeId" placeholder="EMP-113" [readonly]="!!employee()" [class.is-invalid]="invalid('employeeId')" />
            @if (invalid('employeeId')) { <div class="invalid-feedback">Employee ID is required.</div> }
          </div>
          <div>
            <label class="form-label">Full name <span class="req">*</span></label>
            <input class="form-control" formControlName="name" [class.is-invalid]="invalid('name')" />
            @if (invalid('name')) { <div class="invalid-feedback">Name is required.</div> }
          </div>
          <div>
            <label class="form-label">Email</label>
            <input type="email" class="form-control" formControlName="email" [class.is-invalid]="invalid('email')" />
            @if (invalid('email')) { <div class="invalid-feedback">Enter a valid email.</div> }
          </div>
          <div>
            <label class="form-label">Phone</label>
            <input class="form-control" formControlName="phone" />
          </div>
          <div>
            <label class="form-label">Department</label>
            <select class="form-select" formControlName="department">
              <option value="">Unassigned</option>
              @for (dept of departments(); track dept._id) { <option [value]="dept._id">{{ dept.name }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Job role <span class="req">*</span></label>
            <input class="form-control" formControlName="role" placeholder="CNC Operator" [class.is-invalid]="invalid('role')" />
            @if (invalid('role')) { <div class="invalid-feedback">Job role is required.</div> }
          </div>
          <div>
            <label class="form-label">Shift</label>
            <select class="form-select" formControlName="shift">
              @for (shift of shifts; track shift) { <option [value]="shift">{{ shift }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Availability</label>
            <select class="form-select" formControlName="status">
              @for (status of statuses; track status) { <option [value]="status">{{ status }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Hourly rate (₹)</label>
            <input type="number" min="0" class="form-control" formControlName="hourlyRate" />
          </div>
          <div>
            <label class="form-label">Join date</label>
            <input type="date" class="form-control" formControlName="joinDate" />
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">Skills (comma separated)</label>
            <input class="form-control" formControlName="skillSet" placeholder="CNC Turning, GD&T, Tool Setting" />
          </div>
        </div>
      </form>
      <div modalFooter>
        <button class="btn btn-outline" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="employeeForm" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>Save employee</span> }
        </button>
      </div>
    </app-modal>
  `,
})
export class EmployeeFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly employeesApi = inject(EmployeeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly employee = input<Employee | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly saving = signal(false);
  readonly departments = this.lookups.departments;

  readonly shifts = ['Shift A (06:00-14:00)', 'Shift B (14:00-22:00)', 'Shift C (22:00-06:00)', 'General'];
  readonly statuses = ['Available', 'On Task', 'On Leave', 'Inactive'];

  readonly form = this.fb.group({
    employeeId: ['', Validators.required],
    name: ['', Validators.required],
    email: ['', Validators.email],
    phone: [''],
    department: [''],
    role: ['', Validators.required],
    shift: ['Shift A (06:00-14:00)'],
    status: ['Available'],
    hourlyRate: [300],
    joinDate: [new Date().toISOString().slice(0, 10)],
    skillSet: [''],
  });

  constructor() {
    effect(() => {
      if (this.open()) this.initForm();
    });
  }

  ngOnInit(): void {
    this.lookups.loadDepartments().subscribe();
    this.initForm();
  }

  /** Resets the form so reopening the modal never reuses previous values. */
  private initForm(): void {
    this.form.reset({
      employeeId: '', name: '', email: '', phone: '', department: '', role: '',
      shift: 'Shift A (06:00-14:00)', status: 'Available', hourlyRate: 300,
      joinDate: new Date().toISOString().slice(0, 10), skillSet: '',
    });
    this.form.markAsUntouched();
    this.form.markAsPristine();
    const existing = this.employee();
    if (existing) {
      this.form.patchValue({
        employeeId: existing.employeeId,
        name: existing.name,
        email: existing.email ?? '',
        phone: existing.phone ?? '',
        department: typeof existing.department === 'object' ? existing.department?._id ?? '' : (existing.department as string) ?? '',
        role: existing.role,
        shift: existing.shift,
        status: existing.status,
        hourlyRate: existing.hourlyRate ?? 300,
        joinDate: existing.joinDate ? new Date(existing.joinDate).toISOString().slice(0, 10) : '',
        skillSet: (existing.skillSet ?? []).join(', '),
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
    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      ...raw,
      department: raw.department || undefined,
      skillSet: (raw.skillSet ?? '').split(',').map((s) => s.trim()).filter(Boolean),
      hourlyRate: Number(raw.hourlyRate),
    };
    this.saving.set(true);
    const existing = this.employee();
    const request = existing ? this.employeesApi.update(existing._id, payload) : this.employeesApi.create(payload);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Employee updated' : 'Employee added', res.message);
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
