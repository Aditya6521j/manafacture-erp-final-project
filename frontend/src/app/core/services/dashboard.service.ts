import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardOverview, DashboardStats } from '../models';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  overview(): Observable<DashboardOverview> {
    return this.api.getData<DashboardOverview>('/dashboard/overview');
  }

  stats(): Observable<DashboardStats> {
    return this.api.getData<DashboardStats>('/dashboard/stats');
  }

  charts(months = 6) {
    return this.api.getData<{
      monthlyProduction: { label: string; target: number; actual: number }[];
      quality: { trend: { label: string; passPercentage: number; defectPercentage: number }[]; byStatus: Record<string, number> };
      defects: { byCategory: { category: string; quantity: number }[]; trend: { label: string; quantity: number }[] };
      machines: { machineCode: string; name: string; status: string; utilizationPercentage: number; operatingHours: number }[];
      materials: { material: string; consumed: number }[];
    }>('/dashboard/charts', { months });
  }
}
