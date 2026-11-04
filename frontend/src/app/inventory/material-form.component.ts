import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../shared/components/modal.component';
import { InventoryService } from '../core/services/inventory.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { RawMaterial } from '../core/models';

@Component({
  selector: 'app-material-form',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [open]="open()" icon="bi-box-seam" [title]="material() ? 'Edit Raw Material' : 'Add Raw Material'"
               subtitle="Master data, stock levels and supplier linkage" (closed)="closed.emit()">
      <form [formGroup]="form" id="materialForm" (ngSubmit)="submit()" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
          <div>
            <label class="form-label">Material ID <span class="req">*</span></label>
            <input class="form-control" formControlName="materialCode" placeholder="RM-013" [class.is-invalid]="invalid('materialCode')" [readonly]="!!material()" />
            @if (invalid('materialCode')) { <div class="invalid-feedback">Material ID is required.</div> }
          </div>
          <div>
            <label class="form-label">Material name <span class="req">*</span></label>
            <input class="form-control" formControlName="name" placeholder="MS Steel Plate 5mm" [class.is-invalid]="invalid('name')" />
            @if (invalid('name')) { <div class="invalid-feedback">Material name is required.</div> }
          </div>
          <div>
            <label class="form-label">Category <span class="req">*</span></label>
            <select class="form-select" formControlName="category">
              @for (category of categories; track category) { <option [value]="category">{{ category }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Unit <span class="req">*</span></label>
            <select class="form-select" formControlName="unit">
              @for (unit of units; track unit) { <option [value]="unit">{{ unit }}</option> }
            </select>
          </div>
          <div>
            <label class="form-label">Available quantity <span class="req">*</span></label>
            <input type="number" min="0" step="0.01" class="form-control" formControlName="availableQuantity" [class.is-invalid]="invalid('availableQuantity')" />
            @if (invalid('availableQuantity')) { <div class="invalid-feedback">Quantity cannot be negative.</div> }
          </div>
          <div>
            <label class="form-label">Minimum stock level <span class="req">*</span></label>
            <input type="number" min="0" class="form-control" formControlName="minimumStockLevel" [class.is-invalid]="invalid('minimumStockLevel')" />
            <div class="form-hint">A low-stock alert is raised below this level.</div>
          </div>
          <div>
            <label class="form-label">Unit price (₹)</label>
            <input type="number" min="0" step="0.01" class="form-control" formControlName="unitPrice" />
          </div>
          <div>
            <label class="form-label">Supplier</label>
            <select class="form-select" formControlName="supplier">
              <option value="">Not linked</option>
              @for (supplier of suppliers(); track supplier._id) { <option [value]="supplier._id">{{ supplier.name }}</option> }
            </select>
          </div>
          <div style="grid-column:1/-1">
            <label class="form-label">Warehouse location</label>
            <input class="form-control" formControlName="warehouseLocation" placeholder="WH-A / Rack 3" />
          </div>
        </div>
      </form>
      <div modalFooter>
        <button class="btn btn-outline" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="materialForm" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>Save material</span> }
        </button>
      </div>
    </app-modal>
  `,
})
export class MaterialFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly inventory = inject(InventoryService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly material = input<RawMaterial | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly suppliers = this.lookups.suppliers;
  readonly categories = ['Metal', 'Plastic', 'Rubber', 'Chemical', 'Electrical', 'Packaging', 'Fasteners', 'Other'];
  readonly units = ['Kg', 'Ton', 'Nos', 'Meter', 'Litre', 'Box', 'Sheet'];

  readonly form = this.fb.group({
    materialCode: ['', Validators.required],
    name: ['', Validators.required],
    category: ['Metal', Validators.required],
    unit: ['Kg', Validators.required],
    availableQuantity: [0, [Validators.required, Validators.min(0)]],
    minimumStockLevel: [100, [Validators.required, Validators.min(0)]],
    unitPrice: [0],
    supplier: [''],
    warehouseLocation: ['WH-A / Rack 1'],
  });

  constructor() {
    effect(() => {
      if (this.open()) this.initForm();
    });
  }

  ngOnInit(): void {
    this.lookups.loadSuppliers().subscribe();
    this.initForm();
  }

  /** Resets the form so reopening the modal never reuses previous values. */
  private initForm(): void {
    this.form.reset({
      materialCode: '', name: '', category: 'Metal', unit: 'Kg', availableQuantity: 0,
      minimumStockLevel: 100, unitPrice: 0, supplier: '', warehouseLocation: 'WH-A / Rack 1',
    });
    this.form.markAsUntouched();
    this.form.markAsPristine();
    const existing = this.material();
    if (existing) {
      this.form.patchValue({
        materialCode: existing.materialCode,
        name: existing.name,
        category: existing.category,
        unit: existing.unit,
        availableQuantity: existing.availableQuantity,
        minimumStockLevel: existing.minimumStockLevel,
        unitPrice: existing.unitPrice,
        supplier: typeof existing.supplier === 'object' ? existing.supplier?._id : (existing.supplier as string) ?? '',
        warehouseLocation: existing.warehouseLocation ?? '',
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
    const payload = this.form.getRawValue();
    const existing = this.material();
    const request = existing
      ? this.inventory.update(existing._id, payload as Record<string, unknown>)
      : this.inventory.create(payload as Record<string, unknown>);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Material updated' : 'Material added', res.message);
        this.lookups.invalidate('materials');
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
