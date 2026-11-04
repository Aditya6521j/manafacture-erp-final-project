import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, Machine, MaintenanceRecord, ProductionOrder } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class MachineService {
  private readonly api = inject(ApiService);

  list(query: QueryParams): Observable<ApiResponse<Machine[]>> {
    return this.api.get<Machine[]>('/machines', query);
  }

  get(id: string): Observable<Machine & { maintenanceHistory: MaintenanceRecord[] }> {
    return this.api.getData(`/machines/${id}`);
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<Machine>('/machines', payload);
  }

  update(id: string, payload: Record<string, unknown>) {
    return this.api.put<Machine>(`/machines/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<null>(`/machines/${id}`);
  }

  updateStatus(id: string, status: string, breakdownReason?: string, operatingHoursDelta?: number) {
    return this.api.patch<Machine>(`/machines/${id}/status`, { status, breakdownReason, operatingHoursDelta });
  }

  scheduleMaintenance(id: string, payload: Record<string, unknown>) {
    return this.api.post<MaintenanceRecord>(`/machines/${id}/maintenance`, payload);
  }

  utilization(): Observable<{
    total: number;
    running: number;
    idle: number;
    maintenance: number;
    breakdown: number;
    avgUtilization: number;
    totalOperatingHours: number;
    machines: Machine[];
  }> {
    return this.api.getData('/machines/utilization/summary');
  }

  maintenanceList(query: QueryParams): Observable<ApiResponse<MaintenanceRecord[]>> {
    return this.api.get<MaintenanceRecord[]>('/maintenance', query);
  }

  updateMaintenance(id: string, payload: Record<string, unknown>) {
    return this.api.put<MaintenanceRecord>(`/maintenance/${id}`, payload);
  }

  createMaintenance(payload: Record<string, unknown>) {
    return this.api.post<MaintenanceRecord>('/maintenance', payload);
  }
}

export type { ProductionOrder };
