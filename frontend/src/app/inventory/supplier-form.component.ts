import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../shared/components/modal.component';
import { SupplierService } from '../core/services/inventory.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { Supplier } from '../core/models';

@Component({
  selector: 'app-supplier-form',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [open]="open()" icon="bi-truck" [title]="supplier() ? 'Edit Supplier' : 'Add Supplier'"
               subtitle="Vendor master with contact and tax details" (closed)="closed.emit()">
      <form [formGroup]="form" id="supplierForm" (ngSubmit)="submit()" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
          <div>
            <label class="form-label">Supplier code <span class="req">*</span></label>
            <input class="form-control" formControlName="supplierCode" placeholder="SUP-006" [readonly]="!!supplier()" [class.is-invalid]="invalid('supplierCode')" />
            @if (invalid('supplierCode')) { <div class="invalid-feedback">Supplier code is required.</div> }
          </div>
          <div>
            <label class="form-label">Supplier name <span class="req">*</span></label>
            <input class="form-control" formControlName="name" placeholder="Bharat Steel Traders" [class.is-invalid]="invalid('name')" />
            @if (invalid('name')) { <div class="invalid-feedback">Supplier name is required.</div> }
          </div>
          <div>
            <label class="form-label">Contact person</label>
            <input class="form-control" formControlName="contactPerson" />
          </div>
          <div>
            <label class="form-label">Phone</label>
            <input class="form-control" formControlName="phone" placeholder="+91 22 2456 7890" />
          </div>
          <div>
            <label class="form-label">Email</label>
            <input type="email" class="form-control" formControlName="email" [class.is-invalid]="invalid('email')" />
            @if (invalid('email')) { <div class="invalid-feedback">Enter a valid email address.</div> }
          </div>
          <div>
            <label class="form-label">GSTIN</label>
            <input class="form-control" formControlName="gstin" placeholder="27AABCB1234C1Z5" />
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">Address</label>
            <textarea class="form-control" rows="2" formControlName="address"></textarea>
          </div>
          <div>
            <label class="form-label">Rating (0–5)</label>
            <input type="number" min="0" max="5" step="0.1" class="form-control" formControlName="rating" />
          </div>
        </div>
      </form>
      <div modalFooter>
        <button class="btn btn-outline" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="supplierForm" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>Save supplier</span> }
        </button>
      </div>
    </app-modal>
  `,
})
export class SupplierFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly suppliersApi = inject(SupplierService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly supplier = input<Supplier | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();
  readonly saving = signal(false);

  readonly form = this.fb.group({
    supplierCode: ['', Validators.required],
    name: ['', Validators.required],
    contactPerson: [''],
    phone: [''],
    email: ['', Validators.email],
    gstin: [''],
    address: [''],
    rating: [4],
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
      supplierCode: '', name: '', contactPerson: '', phone: '', email: '',
      gstin: '', address: '', rating: 4,
    });
    this.form.markAsUntouched();
    this.form.markAsPristine();
    const existing = this.supplier();
    if (existing) this.form.patchValue(existing as unknown as Record<string, never>);
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
    const existing = this.supplier();
    const request = existing ? this.suppliersApi.update(existing._id, payload) : this.suppliersApi.create(payload);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Supplier updated' : 'Supplier added', res.message);
        this.lookups.invalidate('suppliers');
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
