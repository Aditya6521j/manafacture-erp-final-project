import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../shared/components/modal.component';
import { DepartmentService } from '../core/services/user.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { Department } from '../core/models';

@Component({
  selector: 'app-department-form',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [open]="open()" icon="bi-building" [title]="department() ? 'Edit Department' : 'Create Department'"
               subtitle="Production departments used across orders, defects and employees" (closed)="closed.emit()">
      <form [formGroup]="form" id="deptForm" (ngSubmit)="submit()" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
          <div>
            <label class="form-label">Department name <span class="req">*</span></label>
            <input class="form-control" formControlName="name" [class.is-invalid]="invalid('name')" />
            @if (invalid('name')) { <div class="invalid-feedback">Name is required.</div> }
          </div>
          <div>
            <label class="form-label">Code <span class="req">*</span></label>
            <input class="form-control" formControlName="code" placeholder="QA" [class.is-invalid]="invalid('code')" />
            @if (invalid('code')) { <div class="invalid-feedback">Code is required.</div> }
          </div>
          <div>
            <label class="form-label">Department head</label>
            <input class="form-control" formControlName="head" />
          </div>
          <div>
            <label class="form-label">Location</label>
            <input class="form-control" formControlName="location" placeholder="Plant 1 · Bay A" />
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">Description</label>
            <textarea class="form-control" rows="2" formControlName="description"></textarea>
          </div>
        </div>
      </form>
      <div modalFooter>
        <button class="btn btn-outline" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="deptForm" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>Save department</span> }
        </button>
      </div>
    </app-modal>
  `,
})
export class DepartmentFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly departmentsApi = inject(DepartmentService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly department = input<Department | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly saving = signal(false);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    head: [''],
    location: ['Plant 1'],
    description: [''],
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
      name: '', code: '', head: '', location: 'Plant 1', description: '',
    });
    this.form.markAsUntouched();
    this.form.markAsPristine();
    const existing = this.department();
    if (existing) {
      this.form.patchValue({
        name: existing.name, code: existing.code, head: existing.head ?? '',
        location: existing.location ?? '', description: existing.description ?? '',
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
    const payload = this.form.getRawValue() as Record<string, unknown>;
    const existing = this.department();
    const request = existing ? this.departmentsApi.update(existing._id, payload) : this.departmentsApi.create(payload);
    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Department updated' : 'Department created', res.message);
        this.lookups.invalidate('departments');
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
