import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, DefectRecord } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class DefectService {
  private readonly api = inject(ApiService);

  list(query: QueryParams): Observable<ApiResponse<DefectRecord[]>> {
    return this.api.get<DefectRecord[]>('/defects', query);
  }

  get(id: string): Observable<DefectRecord> {
    return this.api.getData<DefectRecord>(`/defects/${id}`);
  }

  create(payload: Record<string, unknown>, files: File[] = []): Observable<ApiResponse<DefectRecord>> {
    if (files.length) {
      const form = this.toForm(payload, files);
      return this.api.postForm<DefectRecord>('/defects', form);
    }
    return this.api.post<DefectRecord>('/defects', payload);
  }

  update(id: string, payload: Record<string, unknown>, files: File[] = []): Observable<ApiResponse<DefectRecord>> {
    if (files.length) {
      return this.api.putForm<DefectRecord>(`/defects/${id}`, this.toForm(payload, files));
    }
    return this.api.put<DefectRecord>(`/defects/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<null>(`/defects/${id}`);
  }

  stats(): Observable<{
    total: number;
    totalQuantity: number;
    byCategory: { category: string; quantity: number; incidents: number }[];
    bySeverity: { severity: string; quantity: number }[];
    byRework: { status: string; quantity: number }[];
    byMonth: { year: number; month: number; quantity: number; incidents: number }[];
  }> {
    return this.api.getData('/defects/stats/analysis');
  }

  private toForm(payload: Record<string, unknown>, files: File[]): FormData {
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    });
    files.forEach((file) => form.append('images', file));
    return form;
  }
}
