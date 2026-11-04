import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, QualityInspection } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class QualityService {
  private readonly api = inject(ApiService);

  list(query: QueryParams): Observable<ApiResponse<QualityInspection[]>> {
    return this.api.get<QualityInspection[]>('/inspections', query);
  }

  get(id: string): Observable<QualityInspection> {
    return this.api.getData<QualityInspection>(`/inspections/${id}`);
  }

  create(payload: Record<string, unknown>): Observable<ApiResponse<QualityInspection>> {
    return this.api.post<QualityInspection>('/inspections', payload);
  }

  update(id: string, payload: Record<string, unknown>): Observable<ApiResponse<QualityInspection>> {
    return this.api.put<QualityInspection>(`/inspections/${id}`, payload);
  }

  decide(id: string, decision: 'Passed' | 'Failed' | 'Rework Required', remarks?: string) {
    return this.api.patch<QualityInspection>(`/inspections/${id}/approve`, { decision, remarks });
  }

  remove(id: string) {
    return this.api.delete<null>(`/inspections/${id}`);
  }

  stats(): Observable<{
    inspections: number;
    inspected: number;
    passed: number;
    rejected: number;
    qualityPassPercentage: number;
    defectPercentage: number;
    byStatus: Record<string, number>;
  }> {
    return this.api.getData('/inspections/stats');
  }
}
