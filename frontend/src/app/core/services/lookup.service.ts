import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { Department, Employee, Machine, Product, ProductionOrder, RawMaterial, Supplier, User } from '../models';
import { ApiService } from './api.service';

/**
 * Caches reference data used by dropdowns across modules so every form
 * does not re-fetch the same lists.
 */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly api = inject(ApiService);

  readonly products = signal<Product[]>([]);
  readonly materials = signal<RawMaterial[]>([]);
  readonly machines = signal<Machine[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly managers = signal<User[]>([]);
  readonly orders = signal<ProductionOrder[]>([]);

  private loaded = new Set<string>();

  loadAll(): void {
    this.loadProducts();
    this.loadMaterials();
    this.loadMachines();
    this.loadEmployees();
    this.loadDepartments();
    this.loadSuppliers();
    this.loadManagers();
    this.loadOrders();
  }

  loadProducts(force = false): Observable<Product[]> {
    return this.cached('products', () => this.api.getData<Product[]>('/products/all'), this.products, force);
  }
  loadMaterials(force = false): Observable<RawMaterial[]> {
    return this.cached('materials', () => this.api.getData<RawMaterial[]>('/materials/all'), this.materials, force);
  }
  loadMachines(force = false): Observable<Machine[]> {
    return this.cached('machines', () => this.api.getData<Machine[]>('/machines/all'), this.machines, force);
  }
  loadEmployees(force = false): Observable<Employee[]> {
    return this.cached('employees', () => this.api.getData<Employee[]>('/employees/all'), this.employees, force);
  }
  loadDepartments(force = false): Observable<Department[]> {
    return this.cached('departments', () => this.api.getData<Department[]>('/departments/all'), this.departments, force);
  }
  loadSuppliers(force = false): Observable<Supplier[]> {
    return this.cached('suppliers', () => this.api.getData<Supplier[]>('/suppliers/all'), this.suppliers, force);
  }
  loadManagers(force = false): Observable<User[]> {
    return this.cached('managers', () => this.api.getData<User[]>('/users/assignable', { role: 'Production Manager' }), this.managers, force);
  }
  loadOrders(force = false): Observable<ProductionOrder[]> {
    return this.cached(
      'orders',
      () => this.api.getData<ProductionOrder[]>('/production-orders', { limit: 200, sortBy: 'createdAt', sortOrder: 'desc' }),
      this.orders,
      force
    );
  }

  invalidate(key?: string): void {
    if (key) this.loaded.delete(key);
    else this.loaded.clear();
  }

  private cached<T>(key: string, request: () => Observable<T[]>, target: ReturnType<typeof signal<T[]>>, force: boolean): Observable<T[]> {
    if (force) this.loaded.delete(key);
    if (!this.loaded.has(key)) {
      this.loaded.add(key);
      return request().pipe(tap((data) => target.set(data)));
    }
    return new Observable<T[]>((subscriber) => {
      subscriber.next(target());
      subscriber.complete();
    });
  }
}
