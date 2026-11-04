import { Component, OnDestroy, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../shared/components/modal.component';
import { QualityService } from '../core/services/quality.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { QualityInspection } from '../core/models';

interface ParameterPreset {
  name: string;
  unit: string;
  standardValue: number;
  minLimit: number;
  maxLimit: number;
}

const PRESETS: ParameterPreset[] = [
  { name: 'Outer Diameter', unit: 'mm', standardValue: 90, minLimit: 89.9, maxLimit: 90.1 },
  { name: 'Bore Diameter', unit: 'mm', standardValue: 40, minLimit: 39.95, maxLimit: 40.05 },
  { name: 'Weight', unit: 'g', standardValue: 850, minLimit: 840, maxLimit: 860 },
  { name: 'Surface Finish (Ra)', unit: 'Ra', standardValue: 1.6, minLimit: 0.8, maxLimit: 2.0 },
  { name: 'Temperature', unit: '°C', standardValue: 45, minLimit: 30, maxLimit: 60 },
  { name: 'Hardness', unit: 'HRC', standardValue: 45, minLimit: 42, maxLimit: 48 },
  { name: 'Visual Defects', unit: 'count', standardValue: 0, minLimit: 0, maxLimit: 2 },
  { name: 'Functional Performance', unit: '%', standardValue: 100, minLimit: 95, maxLimit: 100 },
];

@Component({
  selector: 'app-inspection-form',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [open]="open()" size="lg" icon="bi-clipboard2-check"
               [title]="inspection() ? 'Edit Inspection' : 'New Quality Inspection'"
               subtitle="Record measured values against the accepted tolerance limits" (closed)="closed.emit()">
      <form [formGroup]="form" id="qForm" (ngSubmit)="submit()" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
          <div>
            <label class="form-label">Production order <span class="req">*</span></label>
            <select class="form-select" formControlName="productionOrder" [class.is-invalid]="invalid('productionOrder')" (change)="onOrderChange()">
              <option value="">Select the order under inspection…</option>
              @for (order of orders(); track order._id) {
                <option [value]="order._id">{{ order.orderNumber }} — {{ order.productName }}</option>
              }
            </select>
            @if (invalid('productionOrder')) { <div class="invalid-feedback">Select the production order.</div> }
          </div>

          <div>
            <label class="form-label">Batch number <span class="req">*</span></label>
            <input class="form-control" formControlName="batchNumber" placeholder="BATCH-2026-A1" [class.is-invalid]="invalid('batchNumber')" />
            @if (invalid('batchNumber')) { <div class="invalid-feedback">Batch number is required.</div> }
          </div>

          <div>
            <label class="form-label">Inspection date <span class="req">*</span></label>
            <input type="date" class="form-control" formControlName="inspectionDate" />
          </div>

          <div>
            <label class="form-label">Quality standard</label>
            <select class="form-select" formControlName="qualityStandard">
              @for (standard of standards; track standard) { <option [value]="standard">{{ standard }}</option> }
            </select>
          </div>

          <div>
            <label class="form-label">Inspected quantity <span class="req">*</span></label>
            <input type="number" min="1" class="form-control" formControlName="inspectedQuantity" [class.is-invalid]="invalid('inspectedQuantity')" (input)="recalculate()" />
            @if (invalid('inspectedQuantity')) { <div class="invalid-feedback">Inspected quantity must be at least 1.</div> }
          </div>

          <div>
            <label class="form-label">Passed quantity <span class="req">*</span></label>
            <input type="number" min="0" class="form-control" formControlName="passedQuantity" [class.is-invalid]="quantityError()" (input)="recalculate()" />
            @if (quantityError()) { <div class="invalid-feedback">{{ quantityError() }}</div> }
          </div>

          <div>
            <label class="form-label">Rework quantity</label>
            <input type="number" min="0" class="form-control" formControlName="reworkQuantity" />
          </div>

          <div class="d-flex align-center" style="gap:10px;align-items:flex-end">
            <div style="flex:1">
              <label class="form-label">Live result</label>
              <div class="d-flex gap-2">
                <span class="badge-status b-completed" style="font-size:12px">Pass {{ passPercentage() }}%</span>
                <span class="badge-status b-failed" style="font-size:12px">Defect {{ defectPercentage() }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Quality parameters -->
        <div style="margin-top:18px">
          <div class="d-flex align-center" style="justify-content:space-between;margin-bottom:6px">
            <label class="form-label" style="margin:0">Measured parameters</label>
            <div class="d-flex gap-2">
              <select class="form-select" style="height:34px;min-height:34px;width:auto;font-size:12.2px" (change)="addPreset($any($event.target).value); $any($event.target).value = ''">
                <option value="">Add preset parameter…</option>
                @for (preset of presets; track preset.name) { <option [value]="preset.name">{{ preset.name }}</option> }
              </select>
              <button type="button" class="btn btn-soft btn-sm" (click)="addParameter()"><i class="bi bi-plus-lg"></i> Custom</button>
            </div>
          </div>

          <div formArrayName="parameters">
            @for (parameter of parameters.controls; track parameter; let i = $index) {
              <div [formGroupName]="i" style="display:grid;grid-template-columns:1.4fr 0.7fr 0.8fr 0.8fr 0.9fr 0.7fr 34px;gap:7px;margin-bottom:7px;align-items:center">
                <input class="form-control" formControlName="name" placeholder="Parameter" style="font-size:12.4px" />
                <input class="form-control" formControlName="unit" placeholder="Unit" style="font-size:12.4px" />
                <input type="number" step="0.001" class="form-control" formControlName="minLimit" placeholder="Min" style="font-size:12.4px" />
                <input type="number" step="0.001" class="form-control" formControlName="maxLimit" placeholder="Max" style="font-size:12.4px" />
                <input type="number" step="0.001" class="form-control" formControlName="actualValue" placeholder="Measured" style="font-size:12.4px" (input)="recalculate()" />
                <span class="badge-status" [class]="parameterResult(i) === 'Pass' ? 'b-completed' : 'b-failed'" style="justify-content:center">{{ parameterResult(i) }}</span>
                <button type="button" class="btn btn-outline btn-icon" style="height:38px;width:34px;color:#D93A3A" (click)="removeParameter(i)">
                  <i class="bi bi-trash3"></i>
                </button>
                @if (parameterInvalid(i)) {
                  <div class="invalid-feedback" style="grid-column:1/-1;margin:-2px 0 4px">
                    Enter the parameter name, minimum limit, maximum limit and measured value.
                  </div>
                }
              </div>
            }
            @if (parameters.length === 0) {
              <div class="form-hint">Add the inspection parameters (dimensions, weight, hardness, surface finish…).</div>
            }
          </div>
        </div>

        <div style="margin-top:14px">
          <label class="form-label">Remarks</label>
          <textarea class="form-control" rows="2" formControlName="remarks" placeholder="Observations, deviation notes, corrective action…"></textarea>
        </div>

        <div class="alert-strip info" style="margin:16px 0 0">
          <i class="bi bi-calculator-fill"></i>
          <span>Quality pass % and defect % are calculated automatically. Any parameter outside its limits marks the batch as failed.</span>
        </div>
      </form>

      <div modalFooter>
        <button class="btn btn-outline" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="qForm" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>{{ inspection() ? 'Save inspection' : 'Record inspection' }}</span> }
        </button>
      </div>
    </app-modal>
  `,
})
export class InspectionFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly quality = inject(QualityService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly inspection = input<QualityInspection | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly passPercentage = signal(0);
  readonly defectPercentage = signal(0);
  readonly orders = this.lookups.orders;
  readonly presets = PRESETS;
  readonly standards = ['ISO 9001:2015', 'IATF 16949', 'IEC 61439', 'ASTM D638', 'Internal SOP-QC-01'];

  readonly form: FormGroup = this.fb.group({
    productionOrder: ['', Validators.required],
    batchNumber: ['', Validators.required],
    inspectionDate: [this.today(), Validators.required],
    qualityStandard: ['ISO 9001:2015'],
    inspectedQuantity: [null, [Validators.required, Validators.min(1)]],
    passedQuantity: [null, [Validators.required, Validators.min(0)]],
    reworkQuantity: [0],
    parameters: this.fb.array([]),
    remarks: [''],
    status: ['Pending Inspection'],
  });

  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.lookups.loadOrders(true).subscribe();
        this.initForm();
      }
    });
  }

  ngOnInit(): void {
    this.lookups.loadOrders().subscribe();
    this.initForm();
    this.timer = setInterval(() => this.recalculate(), 1200);
  }

  /** Resets the inspection form each time the modal opens. */
  private initForm(): void {
    this.form.reset({
      productionOrder: '', batchNumber: '', inspectionDate: this.today(),
      qualityStandard: 'ISO 9001:2015', inspectedQuantity: null, passedQuantity: null,
      reworkQuantity: 0, remarks: '', status: 'Pending Inspection',
    });
    this.parameters.clear();
    this.form.markAsUntouched();
    this.form.markAsPristine();
    const existing = this.inspection();
    if (existing) this.patch(existing);
    else {
      this.addParameter();
      this.recalculate();
    }
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  get parameters(): FormArray {
    return this.form.get('parameters') as FormArray;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private patch(inspection: QualityInspection): void {
    this.form.patchValue({
      productionOrder: typeof inspection.productionOrder === 'object' ? inspection.productionOrder._id : inspection.productionOrder,
      batchNumber: inspection.batchNumber,
      inspectionDate: new Date(inspection.inspectionDate).toISOString().slice(0, 10),
      qualityStandard: inspection.qualityStandard ?? 'ISO 9001:2015',
      inspectedQuantity: inspection.inspectedQuantity,
      passedQuantity: inspection.passedQuantity,
      reworkQuantity: inspection.reworkQuantity ?? 0,
      remarks: inspection.remarks ?? '',
      status: inspection.status,
    });
    this.parameters.clear();
    (inspection.parameters ?? []).forEach((p) =>
      this.parameters.push(
        this.fb.group({
          name: [p.name, Validators.required],
          unit: [p.unit ?? ''],
          minLimit: [p.minLimit, Validators.required],
          maxLimit: [p.maxLimit, Validators.required],
          actualValue: [p.actualValue, Validators.required],
        })
      )
    );
    this.recalculate();
  }

  addParameter(preset?: ParameterPreset): void {
    this.parameters.push(
      this.fb.group({
        name: [preset?.name ?? '', Validators.required],
        unit: [preset?.unit ?? ''],
        minLimit: [preset?.minLimit ?? null, Validators.required],
        maxLimit: [preset?.maxLimit ?? null, Validators.required],
        actualValue: [preset?.standardValue ?? null, Validators.required],
      })
    );
    this.recalculate();
  }

  addPreset(name: string): void {
    const preset = PRESETS.find((p) => p.name === name);
    if (preset) this.addParameter(preset);
  }

  removeParameter(index: number): void {
    this.parameters.removeAt(index);
    this.recalculate();
  }

  parameterResult(index: number): 'Pass' | 'Fail' {
    const control = this.parameters.at(index);
    if (!control) return 'Pass';
    const { minLimit, maxLimit, actualValue } = control.value;
    if (actualValue === null || actualValue === '' || minLimit === null || maxLimit === null) return 'Fail';
    return Number(actualValue) >= Number(minLimit) && Number(actualValue) <= Number(maxLimit) ? 'Pass' : 'Fail';
  }

  recalculate(): void {
    const inspected = Number(this.form.get('inspectedQuantity')?.value) || 0;
    const passed = Number(this.form.get('passedQuantity')?.value) || 0;
    this.passPercentage.set(inspected ? Math.round((passed / inspected) * 10000) / 100 : 0);
    this.defectPercentage.set(inspected ? Math.round(((inspected - passed) / inspected) * 10000) / 100 : 0);
  }

  readonly quantityError = computed(() => {
    const inspected = Number(this.form.get('inspectedQuantity')?.value) || 0;
    const passed = Number(this.form.get('passedQuantity')?.value) || 0;
    if (passed > inspected) return 'Passed quantity cannot exceed the inspected quantity.';
    return '';
  });

  onOrderChange(): void {
    const orderId = this.form.get('productionOrder')?.value;
    const order = this.orders().find((o) => o._id === orderId);
    if (order) {
      this.form.patchValue({ batchNumber: this.form.get('batchNumber')?.value || `BATCH-${new Date().getFullYear()}-${order.orderNumber.slice(-4)}` });
      if (!this.form.get('inspectedQuantity')?.value) {
        this.form.patchValue({ inspectedQuantity: Math.min(100, order.quantity), passedQuantity: Math.min(100, order.quantity) });
        this.recalculate();
      }
    }
  }

  invalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  parameterInvalid(index: number): boolean {
    const control = this.parameters.at(index);
    if (!control || !(control.dirty || control.touched)) return false;
    return control.invalid;
  }

  /** Removes untouched, completely empty parameter rows before validation. */
  private pruneEmptyParameters(): void {
    for (let i = this.parameters.length - 1; i >= 0; i -= 1) {
      const value = this.parameters.at(i).value as Record<string, unknown>;
      const blank = !value['name'] && value['minLimit'] === null && value['maxLimit'] === null && value['actualValue'] === null;
      if (blank) this.parameters.removeAt(i);
    }
  }

  submit(): void {
    this.pruneEmptyParameters();
    this.form.markAllAsTouched();
    this.parameters.controls.forEach((control) => control.markAsTouched());

    if (this.form.invalid || this.quantityError()) {
      this.form.markAllAsTouched();
      if (this.quantityError()) this.toast.warning('Check quantities', this.quantityError());
      return;
    }

    const raw = this.form.getRawValue();
    const failedParameters = (raw.parameters as { actualValue: number; minLimit: number; maxLimit: number }[]).filter(
      (p) => Number(p.actualValue) < Number(p.minLimit) || Number(p.actualValue) > Number(p.maxLimit)
    ).length;

    const payload = {
      productionOrder: raw.productionOrder,
      batchNumber: raw.batchNumber,
      inspectionDate: raw.inspectionDate,
      qualityStandard: raw.qualityStandard,
      inspectedQuantity: Number(raw.inspectedQuantity),
      passedQuantity: Number(raw.passedQuantity),
      rejectedQuantity: Number(raw.inspectedQuantity) - Number(raw.passedQuantity),
      reworkQuantity: Number(raw.reworkQuantity) || 0,
      parameters: raw.parameters,
      remarks: raw.remarks,
      status: 'Pending Inspection',
      failedParameterCount: failedParameters,
    };

    this.saving.set(true);
    const existing = this.inspection();
    const request = existing ? this.quality.update(existing._id, payload) : this.quality.create(payload);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Inspection updated' : 'Inspection recorded', res.message);
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
