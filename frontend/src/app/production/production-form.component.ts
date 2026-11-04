import { Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../shared/components/modal.component';
import { ProductionService } from '../core/services/production.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { Machine, ProductionOrder, RawMaterial } from '../core/models';

/** Create / edit a production order with machine and material allocation. */
@Component({
  selector: 'app-production-form',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [open]="open()" size="lg" icon="bi-diagram-3"
               [title]="isEdit() ? 'Edit Production Order' : 'Create Production Order'"
               [subtitle]="isEdit() ? order()?.orderNumber ?? '' : 'Define the product, quantities, machines and material allocation'"
               (closed)="closed.emit()">
      <form [formGroup]="form" id="poForm" (ngSubmit)="submit()" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            <label class="form-label">Product <span class="req">*</span></label>
            <select class="form-select" formControlName="product" [class.is-invalid]="invalid('product')">
              <option value="">Select a product…</option>
              @for (product of products(); track product._id) {
                <option [value]="product._id">{{ product.productCode }} — {{ product.name }}</option>
              }
            </select>
            @if (invalid('product')) { <div class="invalid-feedback">Please select the product to manufacture.</div> }
          </div>

          <div>
            <label class="form-label">Production quantity <span class="req">*</span></label>
            <input type="number" min="1" class="form-control" formControlName="quantity" [class.is-invalid]="invalid('quantity')" />
            @if (invalid('quantity')) { <div class="invalid-feedback">Quantity must be at least 1.</div> }
          </div>

          <div>
            <label class="form-label">Start date <span class="req">*</span></label>
            <input type="date" class="form-control" formControlName="startDate" [class.is-invalid]="invalid('startDate')" />
            @if (invalid('startDate')) { <div class="invalid-feedback">Start date is required.</div> }
          </div>

          <div>
            <label class="form-label">Completion date <span class="req">*</span></label>
            <input type="date" class="form-control" formControlName="expectedCompletionDate" [class.is-invalid]="invalid('expectedCompletionDate') || dateOrderInvalid()" />
            @if (invalid('expectedCompletionDate')) { <div class="invalid-feedback">Completion date is required.</div> }
            @else if (dateOrderInvalid()) { <div class="invalid-feedback">Completion date must be on or after the start date.</div> }
          </div>

          <div>
            <label class="form-label">Priority <span class="req">*</span></label>
            <select class="form-select" formControlName="priority">
              @for (priority of priorities; track priority) { <option [value]="priority">{{ priority }}</option> }
            </select>
          </div>

          <div>
            <label class="form-label">Status</label>
            <select class="form-select" formControlName="status">
              @for (status of statuses; track status) { <option [value]="status">{{ status }}</option> }
            </select>
          </div>

          <div>
            <label class="form-label">Production manager</label>
            <select class="form-select" formControlName="productionManager">
              <option value="">Assign to me</option>
              @for (manager of managers(); track manager._id) { <option [value]="manager._id">{{ manager.name }}</option> }
            </select>
          </div>

          <div>
            <label class="form-label">Department</label>
            <select class="form-select" formControlName="department">
              <option value="">Not assigned</option>
              @for (dept of departments(); track dept._id) { <option [value]="dept._id">{{ dept.name }}</option> }
            </select>
          </div>
        </div>

        <!-- Machine allocation -->
        <div style="margin-top:18px">
          <label class="form-label">Allocate machines</label>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;margin-top:4px">
            @for (machine of machines(); track machine._id) {
              <label class="d-flex align-center gap-2" style="border:1px solid #E2E8F2;border-radius:10px;padding:8px 11px;font-size:12.8px"
                     [style.background]="isMachineSelected(machine._id) ? '#F2F7FD' : '#fff'"
                     [style.borderColor]="isMachineSelected(machine._id) ? '#9CC1E8' : '#E2E8F2'"
                     [style.cursor]="machineBlocked(machine) ? 'not-allowed' : 'pointer'"
                     [style.opacity]="machineBlocked(machine) ? '0.6' : '1'"
                     [title]="machineBlocked(machine) ? 'Not available until released by maintenance' : machine.name">
                <input type="checkbox" [checked]="isMachineSelected(machine._id)" [disabled]="machineBlocked(machine)"
                       (change)="toggleMachine(machine._id)" style="accent-color:#2563A8" />
                <span>
                  <strong style="display:block;font-size:12.4px">{{ machine.machineCode }}</strong>
                  <span style="color:#7A8AA5;font-size:11.4px">{{ machine.name }} · {{ machine.status }}</span>
                </span>
              </label>
            }
          </div>
          @if (unavailableMachineWarning()) {
            <div class="form-hint" style="color:#B26A0B">{{ unavailableMachineWarning() }}</div>
          }
        </div>

        <!-- Material allocation -->
        <div style="margin-top:18px">
          <div class="d-flex align-center" style="justify-content:space-between;margin-bottom:6px">
            <label class="form-label" style="margin:0">Allocate raw materials</label>
            <button type="button" class="btn btn-soft btn-sm" (click)="addMaterialLine()"><i class="bi bi-plus-lg"></i> Add material</button>
          </div>

          <div formArrayName="materials">
            @for (line of materialLines.controls; track line; let i = $index) {
              <div [formGroupName]="i" style="display:grid;grid-template-columns:1fr 130px 90px 34px;gap:8px;margin-bottom:8px;align-items:start">
                <select class="form-select" formControlName="material">
                  <option value="">Select material…</option>
                  @for (material of materials(); track material._id) {
                    <option [value]="material._id">{{ material.materialCode }} — {{ material.name }} ({{ material.availableQuantity }} {{ material.unit }})</option>
                  }
                </select>
                <input type="number" min="0.01" step="0.01" class="form-control" formControlName="requiredQty" placeholder="Qty" />
                <div class="form-control d-flex align-center" style="background:#F7F9FD;color:#7A8AA5">{{ unitFor(line.value.material) }}</div>
                <button type="button" class="btn btn-outline btn-icon" style="height:40px;width:34px;color:#D93A3A" (click)="removeMaterialLine(i)">
                  <i class="bi bi-trash3"></i>
                </button>
                @if (materialLineInvalid(i)) {
                  <div class="invalid-feedback" style="grid-column:1/-1;margin:-2px 0 4px">
                    Select a material and enter a required quantity greater than zero.
                  </div>
                }
              </div>
            }
            @if (materialLines.length === 0) {
              <div class="form-hint">No materials allocated yet — add the raw materials required for this run.</div>
            }
          </div>
        </div>

        <div style="margin-top:16px">
          <label class="form-label">Planning notes</label>
          <textarea class="form-control" formControlName="notes" rows="2" placeholder="Routing sheet references, special instructions…"></textarea>
        </div>
      </form>

      <div modalFooter>
        <button class="btn btn-outline" type="button" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="poForm" [disabled]="saving()">
          @if (saving()) {
            <span class="spinner"></span>
            <span>Saving…</span>
          } @else {
            <i class="bi bi-check2"></i>
            <span>{{ isEdit() ? 'Save changes' : 'Create order' }}</span>
          }
        </button>
      </div>
    </app-modal>
  `,
})
export class ProductionFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly production = inject(ProductionService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly order = input<ProductionOrder | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly machines = this.lookups.machines;
  readonly materials = this.lookups.materials;
  readonly departments = this.lookups.departments;
  readonly managers = this.lookups.managers;

  readonly priorities = ['Low', 'Medium', 'High', 'Critical'];
  readonly statuses = ['Planned', 'Approved', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];

  readonly products = computed(() => this.lookups.products());
  readonly isEdit = computed(() => !!this.order());

  readonly form: FormGroup = this.fb.group({
    product: ['', Validators.required],
    quantity: [null, [Validators.required, Validators.min(1)]],
    startDate: ['', Validators.required],
    expectedCompletionDate: ['', Validators.required],
    priority: ['Medium', Validators.required],
    status: ['Planned', Validators.required],
    productionManager: [''],
    department: [''],
    machines: [[] as string[]],
    materials: this.fb.array([]),
    notes: [''],
  });

  constructor() {
    // Reload lookups each time the modal opens
    effect(() => {
      if (this.open()) {
        this.lookups.loadProducts(true).subscribe();
        this.lookups.loadMachines(true).subscribe();
        this.lookups.loadMaterials(true).subscribe();
        this.lookups.loadDepartments().subscribe();
        this.lookups.loadManagers().subscribe();
        this.initForm();
      }
    });
  }

  ngOnInit(): void {
    this.lookups.loadDepartments().subscribe();
    this.lookups.loadManagers().subscribe();
    this.initForm();
  }

  /** Rebuilds the form so a create modal never reuses the previous entry. */
  private initForm(): void {
    this.form.reset({
      product: '', quantity: null, startDate: '', expectedCompletionDate: '',
      priority: 'Medium', status: 'Planned', productionManager: '', department: '',
      machines: [], notes: '',
    });
    this.materialLines.clear();
    this.form.markAsUntouched();
    this.form.markAsPristine();
    const existing = this.order();
    if (existing) this.patch(existing);
    else this.addMaterialLine();
  }

  get materialLines(): FormArray {
    return this.form.get('materials') as FormArray;
  }

  private patch(order: ProductionOrder): void {
    const productId = typeof order.product === 'object' ? order.product._id : order.product;
    const managerId = typeof order.productionManager === 'object' ? order.productionManager?._id : order.productionManager;
    const departmentId = typeof order.department === 'object' ? order.department?._id : order.department;

    this.form.patchValue({
      product: productId,
      quantity: order.quantity,
      startDate: this.toDateInput(order.startDate),
      expectedCompletionDate: this.toDateInput(order.expectedCompletionDate),
      priority: order.priority,
      status: order.status,
      productionManager: managerId ?? '',
      department: departmentId ?? '',
      machines: (order.machines ?? []).map((m) => m._id),
      notes: order.notes ?? '',
    });

    this.materialLines.clear();
    (order.materials ?? []).forEach((line) => {
      const materialId = typeof line.material === 'object' ? line.material._id : line.material;
      this.materialLines.push(this.fb.group({ material: [materialId, Validators.required], requiredQty: [line.requiredQty, [Validators.required, Validators.min(0.01)]] }));
    });
    if (!this.materialLines.length) this.addMaterialLine();
  }

  private toDateInput(value: string | Date): string {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  addMaterialLine(): void {
    this.materialLines.push(this.fb.group({ material: ['', Validators.required], requiredQty: [null, [Validators.required, Validators.min(0.01)]] }));
  }

  removeMaterialLine(index: number): void {
    this.materialLines.removeAt(index);
  }

  unitFor(materialId: string): string {
    return this.materials().find((m) => m._id === materialId)?.unit ?? '—';
  }

  isMachineSelected(id: string): boolean {
    return ((this.form.get('machines')?.value as string[]) ?? []).includes(id);
  }

  machineBlocked(machine: Machine): boolean {
    return machine.status === 'Breakdown' || machine.status === 'Under Maintenance';
  }

  toggleMachine(id: string): void {
    const current = (this.form.get('machines')?.value as string[]) ?? [];
    const next = current.includes(id) ? current.filter((m) => m !== id) : [...current, id];
    this.form.get('machines')?.setValue(next);
  }

  readonly unavailableMachineWarning = computed(() => {
    const selected = (this.form.get('machines')?.value as string[]) ?? [];
    const blocked = this.machines().filter((m) => selected.includes(m._id) && ['Breakdown', 'Under Maintenance'].includes(m.status));
    if (!blocked.length) return '';
    return `Note: ${blocked.map((m) => `${m.machineCode} (${m.status})`).join(', ')} cannot start production until released by maintenance.`;
  });

  dateOrderInvalid(): boolean {
    const start = this.form.get('startDate')?.value;
    const end = this.form.get('expectedCompletionDate')?.value;
    return !!start && !!end && new Date(end) < new Date(start);
  }

  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  materialLineInvalid(index: number): boolean {
    const line = this.materialLines.at(index);
    if (!line || !(line.dirty || line.touched)) return false;
    return line.invalid;
  }

  /** Drops half-filled material rows so they do not block submission silently. */
  private pruneEmptyMaterialLines(): void {
    for (let i = this.materialLines.length - 1; i >= 0; i -= 1) {
      const value = this.materialLines.at(i).value as { material?: string; requiredQty?: number | string | null };
      if (!value.material && (value.requiredQty === null || value.requiredQty === undefined || value.requiredQty === '')) {
        this.materialLines.removeAt(i);
      }
    }
  }

  submit(): void {
    this.pruneEmptyMaterialLines();
    if (this.materialLines.length === 0) this.addMaterialLine();
    this.form.markAllAsTouched();
    this.materialLines.controls.forEach((control) => control.markAsTouched());

    if (this.form.invalid || this.dateOrderInvalid()) return;

    this.saving.set(true);
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const payload: Record<string, unknown> = {
      ...raw,
      productionManager: raw['productionManager'] || undefined,
      department: raw['department'] || undefined,
      notes: raw['notes'] || undefined,
      materials: (raw['materials'] as { material: string; requiredQty: number }[]).map((line) => ({
        material: line.material,
        requiredQty: Number(line.requiredQty),
      })),
    };

    const existing = this.order();
    const request = existing
      ? this.production.update(existing._id, payload)
      : this.production.create(payload);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Production order updated' : 'Production order created', res.message);
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
