import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiResponse, Role, User } from '../models';
import { ApiService } from './api.service';

interface AuthPayload {
  token: string;
  user: User;
}

const TOKEN_KEY = 'mppqc_token';
const USER_KEY = 'mppqc_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly userSignal = signal<User | null>(this.restoreUser());
  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => !!this.userSignal() && !!this.token);
  readonly role = computed<Role | null>(() => this.userSignal()?.role ?? null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private restoreUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  login(email: string, password: string): Observable<ApiResponse<AuthPayload>> {
    return this.api.post<AuthPayload>('/auth/login', { email, password }).pipe(tap((res) => this.persist(res.data)));
  }

  register(payload: { name: string; email: string; password: string; role?: Role; phone?: string; department?: string }) {
    return this.api.post<AuthPayload>('/auth/register', payload).pipe(tap((res) => this.persist(res.data)));
  }

  refreshProfile(): Observable<User> {
    return this.api.getData<User>('/auth/me').pipe(
      tap((user) => {
        this.userSignal.set(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
    );
  }

  updateProfile(payload: { name?: string; phone?: string; department?: string }): Observable<ApiResponse<User>> {
    return this.api.put<User>('/auth/profile', payload).pipe(
      tap((res) => {
        this.userSignal.set(res.data);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data));
      })
    );
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.api.put<null>('/auth/password', { currentPassword, newPassword });
  }

  logout(redirect = true): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userSignal.set(null);
    if (redirect) this.router.navigate(['/login']);
  }

  hasRole(...roles: Role[]): boolean {
    const current = this.role();
    return !!current && roles.includes(current);
  }

  /** Checks the RBAC matrix returned by the API with the logged-in user. */
  can(permission: string): boolean {
    const permissions = this.userSignal()?.permissions ?? [];
    return permissions.includes('*') || permissions.includes(permission);
  }

  private persist(payload: AuthPayload): void {
    localStorage.setItem(TOKEN_KEY, payload.token);
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
    this.userSignal.set(payload.user);
  }
}
