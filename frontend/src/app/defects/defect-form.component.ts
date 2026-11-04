import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalComponent } from '../shared/components/modal.component';
import { DefectService } from '../core/services/defect.service';
import { LookupService } from '../core/services/lookup.service';
import { ToastService } from '../core/services/toast.service';
import { DefectRecord } from '../core/models';

@Component({
  selector: 'app-defect-form',
  imports: [ModalComponent, ReactiveFormsModule],
  template: `
    <app-modal [open]="open()" size="lg" icon="bi-exclamation-diamond"
               [title]="defect() ? 'Edit Defect Record' : 'Report a Defect'"
               subtitle="Capture the defect, assign responsibility and plan corrective action" (closed)="closed.emit()">
      <form [formGroup]="form" id="defectForm" (ngSubmit)="submit()" novalidate>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px">
          <div>
            <label class="form-label">Production order</label>
            <select class="form-select" formControlName="productionOrder">
              <option value="">Not linked to an order</option>
              @for (order of orders(); track order._id) {
                <option [value]="order._id">{{ order.orderNumber }} — {{ order.productName }}</option>
              }
            </select>
          </div>
          <div>
            <label class="form-label">Batch number</label>
            <input class="form-control" formControlName="batchNumber" placeholder="BATCH-2026-A1" />
          </div>

          <div>
            <label class="form-label">Defect category <span class="req">*</span></label>
            <select class="form-select" formControlName="defectCategory" [class.is-invalid]="invalid('defectCategory')">
              @for (category of categories; track category) { <option [value]="category">{{ category }}</option> }
            </select>
          </div>

          <div>
            <label class="form-label">Severity <span class="req">*</span></label>
            <select class="form-select" formControlName="severity">
              @for (severity of severities; track severity) { <option [value]="severity">{{ severity }}</option> }
            </select>
          </div>

          <div>
            <label class="form-label">Defective quantity <span class="req">*</span></label>
            <input type="number" min="1" class="form-control" formControlName="quantity" [class.is-invalid]="invalid('quantity')" />
            @if (invalid('quantity')) { <div class="invalid-feedback">Quantity must be at least 1.</div> }
          </div>

          <div>
            <label class="form-label">Detected on</label>
            <input type="date" class="form-control" formControlName="detectedDate" />
          </div>

          <div>
            <label class="form-label">Responsible department</label>
            <select class="form-select" formControlName="responsibleDepartment">
              <option value="">Not assigned</option>
              @for (dept of departments(); track dept._id) { <option [value]="dept._id">{{ dept.name }}</option> }
            </select>
          </div>

          <div>
            <label class="form-label">Rework status</label>
            <select class="form-select" formControlName="reworkStatus">
              @for (status of reworkStatuses; track status) { <option [value]="status">{{ status }}</option> }
            </select>
          </div>

          <div style="grid-column:1/-1">
            <label class="form-label">Defect description <span class="req">*</span></label>
            <textarea class="form-control" rows="3" formControlName="description" [class.is-invalid]="invalid('description')"
                      placeholder="What was observed, where and against which specification?"></textarea>
            @if (invalid('description')) { <div class="invalid-feedback">A description of at least 10 characters is required.</div> }
          </div>

          <div>
            <label class="form-label">Root cause (5-Why)</label>
            <textarea class="form-control" rows="2" formControlName="rootCause"></textarea>
          </div>

          <div>
            <label class="form-label">Corrective action</label>
            <textarea class="form-control" rows="2" formControlName="correctiveAction"></textarea>
          </div>

          <div>
            <label class="form-label">Record status</label>
            <select class="form-select" formControlName="status">
              @for (status of recordStatuses; track status) { <option [value]="status">{{ status }}</option> }
            </select>
          </div>

          <div>
            <label class="form-label">Defect images</label>
            <input type="file" class="form-control" accept="image/png,image/jpeg,image/webp" multiple (change)="onFiles($event)" />
            <div class="form-hint">Up to 3 images, 5 MB each (JPG, PNG, WEBP).</div>
            @if (selectedFiles.length) {
              <div class="form-hint" style="color:#2563A8">{{ selectedFiles.length }} image(s) selected</div>
            }
          </div>
        </div>

        @if (existingImages().length) {
          <div style="margin-top:12px">
            <label class="form-label">Uploaded images</label>
            <div class="d-flex gap-2" style="flex-wrap:wrap">
              @for (image of existingImages(); track image) {
                <img [src]="image" alt="Defect evidence" style="width:74px;height:74px;object-fit:cover;border-radius:9px;border:1px solid #E2E8F2" />
              }
            </div>
          </div>
        }
      </form>

      <div modalFooter>
        <button class="btn btn-outline" (click)="closed.emit()">Cancel</button>
        <button class="btn btn-primary" type="submit" form="defectForm" [disabled]="saving()">
          @if (saving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>{{ defect() ? 'Save changes' : 'Report defect' }}</span> }
        </button>
      </div>
    </app-modal>
  `,
})
export class DefectFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly defectsApi = inject(DefectService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  readonly open = input(false);
  readonly defect = input<DefectRecord | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly orders = this.lookups.orders;
  readonly departments = this.lookups.departments;
  readonly existingImages = signal<string[]>([]);
  selectedFiles: File[] = [];

  readonly categories = ['Dimensional Defect', 'Surface Defect', 'Material Defect', 'Assembly Defect', 'Functional Defect', 'Packaging Defect'];
  readonly severities = ['Minor', 'Major', 'Critical'];
  readonly reworkStatuses = ['Pending', 'In Rework', 'Reworked', 'Scrapped', 'Not Required'];
  readonly recordStatuses = ['Open', 'Under Analysis', 'In Progress', 'Closed'];

  readonly form = this.fb.group({
    productionOrder: [''],
    batchNumber: [''],
    defectCategory: ['Dimensional Defect', Validators.required],
    severity: ['Major', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    detectedDate: [new Date().toISOString().slice(0, 10)],
    responsibleDepartment: [''],
    reworkStatus: ['Pending'],
    description: ['', [Validators.required, Validators.minLength(10)]],
    rootCause: [''],
    correctiveAction: [''],
    status: ['Open'],
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.lookups.loadOrders(true).subscribe();
        this.lookups.loadDepartments().subscribe();
        this.initForm();
      }
    });
  }

  ngOnInit(): void {
    this.lookups.loadOrders().subscribe();
    this.lookups.loadDepartments().subscribe();
    this.initForm();
  }

  /** Resets the defect form each time the modal opens. */
  private initForm(): void {
    this.selectedFiles = [];
    this.existingImages.set([]);
    this.form.reset({
      productionOrder: '', batchNumber: '', defectCategory: 'Dimensional Defect', severity: 'Major',
      quantity: 1, detectedDate: new Date().toISOString().slice(0, 10), responsibleDepartment: '',
      reworkStatus: 'Pending', description: '', rootCause: '', correctiveAction: '', status: 'Open',
    });
    this.form.markAsUntouched();
    this.form.markAsPristine();
    const existing = this.defect();
    if (existing) {
      this.form.patchValue({
        productionOrder: typeof existing.productionOrder === 'object' ? existing.productionOrder?._id ?? '' : (existing.productionOrder as string) ?? '',
        batchNumber: existing.batchNumber ?? '',
        defectCategory: existing.defectCategory,
        severity: existing.severity,
        quantity: existing.quantity,
        detectedDate: new Date(existing.detectedDate).toISOString().slice(0, 10),
        responsibleDepartment: typeof existing.responsibleDepartment === 'object' ? existing.responsibleDepartment?._id ?? '' : '',
        reworkStatus: existing.reworkStatus,
        description: existing.description,
        rootCause: existing.rootCause ?? '',
        correctiveAction: existing.correctiveAction ?? '',
        status: existing.status,
      });
      this.existingImages.set(existing.images ?? []);
    }
  }

  onFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFiles = Array.from(input.files ?? []).slice(0, 3);
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
      productionOrder: raw.productionOrder || undefined,
      responsibleDepartment: raw.responsibleDepartment || undefined,
      quantity: Number(raw.quantity),
    };

    this.saving.set(true);
    const existing = this.defect();
    const request = existing
      ? this.defectsApi.update(existing._id, payload, this.selectedFiles)
      : this.defectsApi.create(payload, this.selectedFiles);

    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.toast.success(existing ? 'Defect updated' : 'Defect reported', res.message);
        this.saved.emit();
        this.closed.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
