import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiResponse, Department, Role, User } from '../models';
import { ApiService, QueryParams } from './api.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);

  list(query: QueryParams): Observable<ApiResponse<User[]>> {
    return this.api.get<User[]>('/users', query);
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<User>('/users', payload);
  }

  update(id: string, payload: Record<string, unknown>) {
    return this.api.put<User>(`/users/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<null>(`/users/${id}`);
  }

  roles(): Observable<{ roles: Role[]; departments: Department[]; permissions: Record<string, string[]> }> {
    return this.api.getData('/auth/roles');
  }
}

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private readonly api = inject(ApiService);

  all(): Observable<Department[]> {
    return this.api.getData<Department[]>('/departments/all');
  }

  list(query: QueryParams): Observable<ApiResponse<Department[]>> {
    return this.api.get<Department[]>('/departments', query);
  }

  create(payload: Record<string, unknown>) {
    return this.api.post<Department>('/departments', payload);
  }

  update(id: string, payload: Record<string, unknown>) {
    return this.api.put<Department>(`/departments/${id}`, payload);
  }

  remove(id: string) {
    return this.api.delete<null>(`/departments/${id}`);
  }
}
