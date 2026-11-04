import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, Employee } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly api = inject(ApiService);

  list(query: QueryParams): Observable<ApiResponse<Employee[]>> {
    return this.api.get<Employee[]>('/employees', query);
  }

  get(id: string): Observable<Employee> {
    return this.api.getData<Employee>(`/employees/${id}`);
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<Employee>('/employees', payload);
  }

  update(id: string, payload: Record<string, unknown>) {
    return this.api.put<Employee>(`/employees/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<null>(`/employees/${id}`);
  }

  assignTask(id: string, productionOrder: string, task: string) {
    return this.api.post<Employee>(`/employees/${id}/tasks`, { productionOrder, task });
  }

  updateTask(id: string, taskId: string, status: string) {
    return this.api.patch<Employee>(`/employees/${id}/tasks/${taskId}`, { status });
  }

  stats(): Observable<{ total: number; byStatus: { _id: string; count: number }[]; byDepartment: { name: string; count: number; avgScore: number }[] }> {
    return this.api.getData('/employees/stats/summary');
  }
}
