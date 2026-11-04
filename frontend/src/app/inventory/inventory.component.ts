import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { InventoryService, SupplierService } from '../core/services/inventory.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { ConfirmService } from '../shared/components/confirm.service';
import { LookupService } from '../core/services/lookup.service';
import { RawMaterial, Supplier } from '../core/models';
import { PageHeaderComponent } from '../shared/components/page-header.component';
import { StatusBadgeComponent } from '../shared/components/status-badge.component';
import { PaginationComponent } from '../shared/components/pagination.component';
import { EmptyStateComponent } from '../shared/components/empty-state.component';
import { ModalComponent } from '../shared/components/modal.component';
import { MaterialFormComponent } from './material-form.component';
import { SupplierFormComponent } from './supplier-form.component';

@Component({
  selector: 'app-inventory',
  imports: [
    FormsModule, DatePipe, DecimalPipe, PageHeaderComponent, StatusBadgeComponent, PaginationComponent,
    EmptyStateComponent, ModalComponent, MaterialFormComponent, SupplierFormComponent,
  ],
  template: `
    <app-page-header title="Inventory Management" subtitle="Raw material stock, consumption and supplier master">
      @if (auth.can('inventory:update')) {
        <button class="btn btn-outline btn-sm" (click)="syncRequirements()" [disabled]="syncing()">
          <i class="bi bi-arrow-repeat"></i> Recalculate demand
        </button>
      }
      @if (auth.can('inventory:create')) {
        <button class="btn btn-primary btn-sm" (click)="openMaterialForm()"><i class="bi bi-plus-lg"></i> Add Raw Material</button>
      }
    </app-page-header>

    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
      <div class="stat-card" style="--accent:#2563A8;--accent-soft:#E8F0FA">
        <div class="sc-top"><div><div class="sc-label">Materials tracked</div><div class="sc-value">{{ stats().total }}</div></div>
        <div class="sc-icon"><i class="bi bi-boxes"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#E8871E;--accent-soft:#FDF1E3">
        <div class="sc-top"><div><div class="sc-label">Low stock</div><div class="sc-value">{{ stats().lowStock }}</div></div>
        <div class="sc-icon"><i class="bi bi-exclamation-triangle"></i></div></div>
        <div class="sc-hint">Below minimum level</div>
      </div>
      <div class="stat-card" style="--accent:#D93A3A;--accent-soft:#FDECEC">
        <div class="sc-top"><div><div class="sc-label">Out of stock</div><div class="sc-value">{{ stats().outOfStock }}</div></div>
        <div class="sc-icon"><i class="bi bi-x-octagon"></i></div></div>
      </div>
      <div class="stat-card" style="--accent:#12A150;--accent-soft:#E6F7ED">
        <div class="sc-top"><div><div class="sc-label">Stock value</div><div class="sc-value">₹{{ stats().stockValue | number: '1.0-0' }}</div></div>
        <div class="sc-icon"><i class="bi bi-currency-rupee"></i></div></div>
      </div>
    </div>

    @if (lowStockCount() > 0) {
      <div class="alert-strip warning">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <div>
          <strong>{{ lowStockCount() }} material(s) below minimum stock level.</strong>
          Reorder soon to avoid production stoppage.
          <span style="cursor:pointer;font-weight:700;text-decoration:underline" (click)="toggleLowStockFilter()">
            {{ filters.lowStock ? 'Show all materials' : 'Show only low stock' }}
          </span>
        </div>
      </div>
    }

    <div class="panel">
      <div class="tabs-line">
        <div class="tab-item" [class.active]="tab() === 'materials'" (click)="setTab('materials')">
          <i class="bi bi-box-seam"></i> Raw Materials <span class="count">{{ total() }}</span>
        </div>
        <div class="tab-item" [class.active]="tab() === 'suppliers'" (click)="setTab('suppliers')">
          <i class="bi bi-truck"></i> Suppliers <span class="count">{{ suppliersTotal() }}</span>
        </div>
      </div>

      @if (tab() === 'materials') {
        <div class="toolbar">
          <div class="search-box">
            <i class="bi bi-search"></i>
            <input class="form-control" placeholder="Search material name or ID…" [(ngModel)]="filters.search" (ngModelChange)="onSearch()" />
          </div>
          <select class="form-select" [(ngModel)]="filters.category" (ngModelChange)="loadMaterials(1)">
            <option value="all">All categories</option>
            @for (category of categories; track category) { <option [value]="category">{{ category }}</option> }
          </select>
          <label class="d-flex align-center gap-2" style="font-size:12.4px;color:#5A6B87;cursor:pointer">
            <input type="checkbox" [(ngModel)]="filters.lowStock" (ngModelChange)="loadMaterials(1)" style="accent-color:#E8871E" /> Low stock only
          </label>
          <div class="toolbar-spacer"></div>
          <button class="btn btn-outline btn-sm" (click)="loadMaterials(page())"><i class="bi bi-arrow-clockwise"></i> Refresh</button>
        </div>

        <div class="table-shell">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Material ID</th><th>Material</th><th>Category</th><th>Available</th><th>Required</th>
                <th>Unit</th><th>Supplier</th><th>Stock status</th><th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (material of materials(); track material._id) {
                <tr>
                  <td class="cell-mono">{{ material.materialCode }}</td>
                  <td>
                    <span class="cell-strong">{{ material.name }}</span>
                    <span class="cell-sub">{{ material.warehouseLocation }}</span>
                  </td>
                  <td><span class="b-chip">{{ material.category }}</span></td>
                  <td>
                    <strong [style.color]="material.isLowStock ? '#B22828' : '#101A2E'">{{ material.availableQuantity | number }}</strong>
                    <span class="cell-sub">min {{ material.minimumStockLevel | number }}</span>
                  </td>
                  <td>{{ material.requiredQuantity | number }}</td>
                  <td>{{ material.unit }}</td>
                  <td>{{ supplierName(material) }}</td>
                  <td><app-status-badge [status]="material.stockStatus || 'In Stock'" /></td>
                  <td>
                    <div class="table-actions">
                      @if (auth.can('inventory:purchase')) {
                        <button class="btn btn-outline btn-icon" title="Record purchase" (click)="openMovement(material, 'purchase')"><i class="bi bi-box-arrow-in-down"></i></button>
                        <button class="btn btn-outline btn-icon" title="Record consumption" (click)="openMovement(material, 'consume')"><i class="bi bi-box-arrow-up"></i></button>
                      }
                      @if (auth.can('inventory:update')) {
                        <button class="btn btn-outline btn-icon" title="Edit" (click)="editMaterial(material)"><i class="bi bi-pencil"></i></button>
                      }
                      @if (auth.can('inventory:delete')) {
                        <button class="btn btn-outline btn-icon" style="color:#D93A3A" title="Delete" (click)="removeMaterial(material)"><i class="bi bi-trash3"></i></button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="9"><app-empty-state icon="bi-box" title="No raw materials" message="Add materials to start tracking stock levels." /></td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="page()" [limit]="limit()" [total]="total()" [pagesTotal]="pages()"
                        (pageChange)="loadMaterials($event)" (limitChange)="onLimit($event)" />
      }

      @if (tab() === 'suppliers') {
        <div class="toolbar">
          <div class="search-box">
            <i class="bi bi-search"></i>
            <input class="form-control" placeholder="Search supplier name, contact…" [(ngModel)]="supplierSearch" (ngModelChange)="onSupplierSearch()" />
          </div>
          <div class="toolbar-spacer"></div>
          @if (auth.can('supplier:create')) {
            <button class="btn btn-primary btn-sm" (click)="openSupplierForm()"><i class="bi bi-plus-lg"></i> Add Supplier</button>
          }
        </div>
        <div class="table-shell">
          <table class="erp-table">
            <thead>
              <tr><th>Code</th><th>Supplier</th><th>Contact</th><th>Phone / Email</th><th>Materials</th><th>Rating</th><th style="text-align:right">Actions</th></tr>
            </thead>
            <tbody>
              @for (supplier of suppliers(); track supplier._id) {
                <tr>
                  <td class="cell-mono">{{ supplier.supplierCode }}</td>
                  <td><span class="cell-strong">{{ supplier.name }}</span><span class="cell-sub">{{ supplier.gstin }}</span></td>
                  <td>{{ supplier.contactPerson || '—' }}</td>
                  <td>
                    <span>{{ supplier.phone || '—' }}</span>
                    <span class="cell-sub">{{ supplier.email }}</span>
                  </td>
                  <td>
                    @for (material of supplier.materialsSupplied ?? []; track material._id) {
                      <span class="b-chip" style="margin:0 3px 3px 0">{{ material.materialCode }}</span>
                    } @empty { <span class="cell-muted">—</span> }
                  </td>
                  <td><span class="b-chip"><i class="bi bi-star-fill" style="color:#E8871E"></i> {{ supplier.rating }}</span></td>
                  <td>
                    <div class="table-actions">
                      @if (auth.can('supplier:update')) {
                        <button class="btn btn-outline btn-icon" (click)="editSupplier(supplier)"><i class="bi bi-pencil"></i></button>
                      }
                      @if (auth.can('supplier:delete')) {
                        <button class="btn btn-outline btn-icon" style="color:#D93A3A" (click)="removeSupplier(supplier)"><i class="bi bi-trash3"></i></button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7"><app-empty-state icon="bi-truck" title="No suppliers" message="Add supplier records to link them with raw materials." /></td></tr>
              }
            </tbody>
          </table>
        </div>
        <app-pagination [page]="supplierPage()" [limit]="limit()" [total]="suppliersTotal()" [pagesTotal]="suppliersPages()"
                        (pageChange)="loadSuppliers($event)" (limitChange)="onLimit($event)" />
      }
    </div>

    <!-- Stock movement modal -->
    <app-modal [open]="movementOpen()" size="sm" [icon]="movementType === 'purchase' ? 'bi-box-arrow-in-down' : 'bi-box-arrow-up'"
               [title]="movementType === 'purchase' ? 'Record Material Purchase' : 'Record Material Consumption'"
               [subtitle]="movementMaterial()?.name ?? ''" (closed)="movementOpen.set(false)">
      @if (movementMaterial(); as material) {
        <div class="kv-grid" style="margin-bottom:14px">
          <div class="kv-item"><label>Available</label><div>{{ material.availableQuantity | number }} {{ material.unit }}</div></div>
          <div class="kv-item"><label>Minimum level</label><div>{{ material.minimumStockLevel | number }} {{ material.unit }}</div></div>
        </div>
        <div style="margin-bottom:13px">
          <label class="form-label">Quantity ({{ material.unit }}) <span class="req">*</span></label>
          <input type="number" min="0.01" step="0.01" class="form-control" [(ngModel)]="movementQty" />
          @if (movementType === 'consume' && movementQty > material.availableQuantity) {
            <div class="invalid-feedback">Cannot consume more than the available stock.</div>
          }
        </div>
        @if (movementType === 'purchase') {
          <div>
            <label class="form-label">Unit price (₹)</label>
            <input type="number" min="0" step="0.01" class="form-control" [(ngModel)]="movementPrice" />
          </div>
        }
        <div class="alert-strip info" style="margin:14px 0 0">
          <i class="bi bi-info-circle-fill"></i>
          <span>Stock levels update instantly and a low-stock alert is raised automatically when the level falls below the minimum.</span>
        </div>
      }
      <div modalFooter>
        <button class="btn btn-outline" (click)="movementOpen.set(false)">Cancel</button>
        <button class="btn btn-primary" (click)="saveMovement()" [disabled]="movementSaving()">
          @if (movementSaving()) { <span class="spinner"></span> <span>Saving…</span> } @else { <i class="bi bi-check2"></i> <span>Confirm</span> }
        </button>
      </div>
    </app-modal>

    <app-material-form [open]="materialFormOpen()" [material]="editingMaterial()" (closed)="materialFormOpen.set(false)" (saved)="afterSave()" />
    <app-supplier-form [open]="supplierFormOpen()" [supplier]="editingSupplier()" (closed)="supplierFormOpen.set(false)" (saved)="afterSupplierSave()" />
  `,
})
export class InventoryComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly inventory = inject(InventoryService);
  private readonly suppliersApi = inject(SupplierService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  readonly tab = signal<'materials' | 'suppliers'>('materials');
  readonly materials = signal<RawMaterial[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly stats = signal({ total: 0, lowStock: 0, outOfStock: 0, stockValue: 0 });

  readonly page = signal(1);
  readonly limit = signal(10);
  readonly total = signal(0);
  readonly pages = signal(1);

  readonly supplierPage = signal(1);
  readonly suppliersTotal = signal(0);
  readonly suppliersPages = signal(1);
  supplierSearch = '';

  readonly materialFormOpen = signal(false);
  readonly supplierFormOpen = signal(false);
  readonly editingMaterial = signal<RawMaterial | null>(null);
  readonly editingSupplier = signal<Supplier | null>(null);

  readonly movementOpen = signal(false);
  readonly movementMaterial = signal<RawMaterial | null>(null);
  readonly movementSaving = signal(false);
  readonly syncing = signal(false);
  movementType: 'purchase' | 'consume' = 'purchase';
  movementQty = 0;
  movementPrice = 0;

  readonly categories = ['Metal', 'Plastic', 'Rubber', 'Chemical', 'Electrical', 'Packaging', 'Fasteners', 'Other'];
  filters = { search: '', category: 'all', lowStock: false };

  readonly lowStockCount = computed(() => this.stats().lowStock);
  private searchTimer?: ReturnType<typeof setTimeout>;
  private supplierTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.loadMaterials(1);
    this.loadSuppliers(1);
    this.loadStats();
  }

  loadStats(): void {
    this.inventory.stats().subscribe({ next: (stats) => this.stats.set(stats) });
  }

  loadMaterials(page = this.page()): void {
    this.page.set(page);
    this.inventory
      .list({
        page,
        limit: this.limit(),
        search: this.filters.search || undefined,
        category: this.filters.category,
        lowStock: this.filters.lowStock ? 'true' : undefined,
      })
      .subscribe({
        next: (res) => {
          this.materials.set(res.data);
          this.total.set(res.meta?.total ?? 0);
          this.pages.set(res.meta?.pages ?? 1);
        },
      });
  }

  loadSuppliers(page = this.supplierPage()): void {
    this.supplierPage.set(page);
    this.suppliersApi.list({ page, limit: this.limit(), search: this.supplierSearch || undefined }).subscribe({
      next: (res) => {
        this.suppliers.set(res.data);
        this.suppliersTotal.set(res.meta?.total ?? 0);
        this.suppliersPages.set(res.meta?.pages ?? 1);
      },
    });
  }

  setTab(tab: 'materials' | 'suppliers'): void {
    this.tab.set(tab);
  }

  onSearch(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadMaterials(1), 320);
  }

  onSupplierSearch(): void {
    clearTimeout(this.supplierTimer);
    this.supplierTimer = setTimeout(() => this.loadSuppliers(1), 320);
  }

  onLimit(limit: number): void {
    this.limit.set(limit);
    this.loadMaterials(1);
    this.loadSuppliers(1);
  }

  toggleLowStockFilter(): void {
    this.filters.lowStock = !this.filters.lowStock;
    this.loadMaterials(1);
  }

  supplierName(material: RawMaterial): string {
    return typeof material.supplier === 'object' && material.supplier ? material.supplier.name : '—';
  }

  openMaterialForm(): void {
    this.editingMaterial.set(null);
    this.materialFormOpen.set(true);
  }

  editMaterial(material: RawMaterial): void {
    this.editingMaterial.set(material);
    this.materialFormOpen.set(true);
  }

  openSupplierForm(): void {
    this.editingSupplier.set(null);
    this.supplierFormOpen.set(true);
  }

  editSupplier(supplier: Supplier): void {
    this.editingSupplier.set(supplier);
    this.supplierFormOpen.set(true);
  }

  afterSave(): void {
    this.loadMaterials(this.page());
    this.loadStats();
  }

  afterSupplierSave(): void {
    this.loadSuppliers(this.supplierPage());
  }

  openMovement(material: RawMaterial, type: 'purchase' | 'consume'): void {
    this.movementMaterial.set(material);
    this.movementType = type;
    this.movementQty = 0;
    this.movementPrice = material.unitPrice ?? 0;
    this.movementOpen.set(true);
  }

  saveMovement(): void {
    const material = this.movementMaterial();
    if (!material) return;
    if (!this.movementQty || this.movementQty <= 0) {
      this.toast.warning('Invalid quantity', 'Enter a quantity greater than zero.');
      return;
    }
    if (this.movementType === 'consume' && this.movementQty > material.availableQuantity) {
      this.toast.error('Insufficient stock', `Only ${material.availableQuantity} ${material.unit} available.`);
      return;
    }
    this.movementSaving.set(true);
    const request = this.movementType === 'purchase'
      ? this.inventory.purchase(material._id, Number(this.movementQty), Number(this.movementPrice))
      : this.inventory.consume(material._id, Number(this.movementQty));

    request.subscribe({
      next: (res) => {
        this.movementSaving.set(false);
        this.movementOpen.set(false);
        this.toast.success(this.movementType === 'purchase' ? 'Stock received' : 'Consumption recorded', res.message);
        this.loadMaterials(this.page());
        this.loadStats();
        this.lookups.invalidate('materials');
      },
      error: () => this.movementSaving.set(false),
    });
  }

  syncRequirements(): void {
    this.syncing.set(true);
    this.inventory.syncRequirements().subscribe({
      next: (res) => {
        this.syncing.set(false);
        this.toast.success('Demand recalculated', res.message);
        this.loadMaterials(this.page());
      },
      error: () => this.syncing.set(false),
    });
  }

  async removeMaterial(material: RawMaterial): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${material.name}?`,
      message: 'This removes the material from inventory. Materials allocated to production orders cannot be deleted.',
      confirmLabel: 'Delete material',
      danger: true,
    });
    if (!confirmed) return;
    this.inventory.remove(material._id).subscribe({
      next: (res) => {
        this.toast.success('Material deleted', res.message);
        this.loadMaterials(this.page());
        this.loadStats();
      },
    });
  }

  async removeSupplier(supplier: Supplier): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `Delete ${supplier.name}?`,
      message: 'Suppliers linked to raw materials cannot be removed.',
      confirmLabel: 'Delete supplier',
      danger: true,
    });
    if (!confirmed) return;
    this.suppliersApi.remove(supplier._id).subscribe({
      next: (res) => {
        this.toast.success('Supplier deleted', res.message);
        this.loadSuppliers(this.supplierPage());
      },
    });
  }
}
