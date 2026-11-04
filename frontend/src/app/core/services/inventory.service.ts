import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, RawMaterial, Supplier } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly api = inject(ApiService);

  list(query: QueryParams): Observable<ApiResponse<RawMaterial[]>> {
    return this.api.get<RawMaterial[]>('/materials', query);
  }

  lowStock(): Observable<RawMaterial[]> {
    return this.api.getData<RawMaterial[]>('/materials/low-stock');
  }

  stats(): Observable<{ total: number; lowStock: number; outOfStock: number; stockValue: number; byCategory: { _id: string; count: number; quantity: number }[] }> {
    return this.api.getData('/materials/stats');
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<RawMaterial>('/materials', payload);
  }

  update(id: string, payload: Record<string, unknown>) {
    return this.api.put<RawMaterial>(`/materials/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<null>(`/materials/${id}`);
  }

  consume(id: string, quantity: number) {
    return this.api.post<RawMaterial>(`/materials/${id}/consume`, { quantity });
  }

  purchase(id: string, quantity: number, unitPrice?: number) {
    return this.api.post<RawMaterial>(`/materials/${id}/purchase`, { quantity, unitPrice });
  }

  syncRequirements() {
    return this.api.post<null>('/materials/sync-requirements');
  }
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly api = inject(ApiService);

  list(query: QueryParams): Observable<ApiResponse<Supplier[]>> {
    return this.api.get<Supplier[]>('/suppliers', query);
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<Supplier>('/suppliers', payload);
  }

  update(id: string, payload: Record<string, unknown>) {
    return this.api.put<Supplier>(`/suppliers/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<null>(`/suppliers/${id}`);
  }
}
