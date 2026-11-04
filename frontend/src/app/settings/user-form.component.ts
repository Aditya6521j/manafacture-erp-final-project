import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../shared/components/modal.component';
import { UserService } from '../core/services/user.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { Role, User } from '../core/models';

@Component({
  selector: 'app-user-form',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [open]="open()" icon="bi-person-gear" [title]="user() ? 'Edit User' : 'Create User'"
               subtitle="Role based access control for the ERP workspace" (closed)="closed.emit()">
      <form [formGroup]="form" id="userForm" (ngSubmit)="submit()" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
          <div>
            <label class="form-label">Full name <span class="req">*</span></label>
            <input class="form-control" formControlName="name" [class.is-invalid]="invalid('name')" />
            @if (invalid('name')) { <div class="invalid-feedback">Name is required.</div> }
          </div>
          <div>
            <label class="form-label">Email <span class="req">*</span></label>
            <input type="email" class="form-control" formControlName="email" [class.is-invalid]="invalid('email')" />
            @if (invalid('email')) { <div class="invalid-feedback">Enter a valid email address.</div> }
          </div>
          <div>
            <label class="form-label">Role <span class="req">*</span></label>
            <select class="form-select" formControlName="role">
              @for (role of roles; track role) { <option [value]="role">{{ role }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Department</label>
            <select class="form-select" formControlName="department">
              <option value="">Unassigned</option>
              @for (dept of departments(); track dept._id) { <option [value]="dept._id">{{ dept.name }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Phone</label>
            <input class="form-control" formControlName="phone" />
          </div>
          <div>
            <label class="form-label">{{ user() ? 'Reset password (optional)' : 'Password' }} @if (!user()) {<span class="req">*</span>}</label>
            <input type="password" class="form-control" formControlName="password" [class.is-invalid]="invalid('password')" placeholder="Min 6 characters" />
            @if (invalid('password')) { <div class="invalid-feedback">Password must be at least 6 characters.</div> }
          </div>
          <div style="grid-column:1/-1">
            <label class="d-flex align-center gap-2" style="font-size:12.8px;cursor:pointer">
              <input type="checkbox" formControlName="isActive" style="accent-color:#12A150" /> Account is active
            </label>
          </div>
        </div>
      </form>
      <div modalFooter>
        <button class="btn btn-outline" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="userForm" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>Save user</span> }
        </button>
      </div>
    </app-modal>
  `,
})
export class UserFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usersApi = inject(UserService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly user = input<User | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly saving = signal(false);
  readonly departments = this.lookups.departments;

  readonly roles: Role[] = ['Admin', 'Production Manager', 'Quality Control Inspector', 'Inventory Manager', 'Machine Operator'];

  readonly form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['Machine Operator' as Role],
    department: [''],
    phone: [''],
    password: ['', [Validators.minLength(6)]],
    isActive: [true],
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
      name: '', email: '', role: 'Machine Operator', department: '', phone: '', password: '', isActive: true,
    });
    this.form.markAsUntouched();
    this.form.markAsPristine();
    const existing = this.user();
    if (existing) {
      this.form.patchValue({
        name: existing.name,
        email: existing.email,
        role: existing.role,
        department: typeof existing.department === 'object' ? existing.department?._id ?? '' : (existing.department as string) ?? '',
        phone: existing.phone ?? '',
        isActive: existing.isActive !== false,
        password: '',
      });
    }
  }

  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  submit(): void {
    const existing = this.user();
    if (!existing && !this.form.get('password')?.value) {
      this.form.get('password')?.setErrors({ required: true });
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: Record<string, unknown> = {
      name: raw.name,
      email: raw.email,
      role: raw.role,
      phone: raw.phone,
      department: raw.department || undefined,
      isActive: raw.isActive,
    };
    if (raw.password) payload['password'] = raw.password;

    this.saving.set(true);
    const request = existing ? this.usersApi.update(existing._id, payload) : this.usersApi.create(payload);
    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(existing ? 'User updated' : 'User created', res.message);
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
