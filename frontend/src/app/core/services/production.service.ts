import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, PaginationMeta, ProductionOrder } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class ProductionService {
  private readonly api = inject(ApiService);

  list(query: QueryParams): Observable<ApiResponse<ProductionOrder[]>> {
    return this.api.get<ProductionOrder[]>('/production-orders', query);
  }

  get(id: string): Observable<ProductionOrder> {
    return this.api.getData<ProductionOrder>(`/production-orders/${id}`);
  }

  create(payload: Record<string, unknown>): Observable<ApiResponse<ProductionOrder>> {
    return this.api.post<ProductionOrder>('/production-orders', payload);
  }

  update(id: string, payload: Record<string, unknown>): Observable<ApiResponse<ProductionOrder>> {
    return this.api.put<ProductionOrder>(`/production-orders/${id}`, payload);
  }

  updateStatus(id: string, status: string, remark?: string): Observable<ApiResponse<ProductionOrder>> {
    return this.api.patch<ProductionOrder>(`/production-orders/${id}/status`, { status, remark });
  }

  updateProgress(id: string, payload: { producedQuantity?: number; rejectedQuantity?: number; status?: string }) {
    return this.api.patch<ProductionOrder>(`/production-orders/${id}/progress`, payload);
  }

  consumeMaterials(id: string) {
    return this.api.patch<ProductionOrder>(`/production-orders/${id}/consume-materials`);
  }

  remove(id: string): Observable<ApiResponse<null>> {
    return this.api.delete<null>(`/production-orders/${id}`);
  }

  stats(): Observable<{ byStatus: Record<string, number>; planned: number; produced: number; rejected: number }> {
    return this.api.getData('/production-orders/stats/summary');
  }
}

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly api = inject(ApiService);

  list(query: QueryParams): Observable<ApiResponse<import('../models').ProductionSchedule[]>> {
    return this.api.get('/schedules', query);
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<import('../models').ProductionSchedule>('/schedules', payload);
  }

  update(id: string, payload: Record<string, unknown>) {
    return this.api.put<import('../models').ProductionSchedule>(`/schedules/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<null>(`/schedules/${id}`);
  }
}

export type { PaginationMeta };
