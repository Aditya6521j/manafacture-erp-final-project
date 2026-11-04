import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { Role } from '../models';

/** Blocks unauthenticated users and redirects them to /login with a returnUrl. */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};

/** Restricts a route to a set of roles using route data: { roles: ['Admin'] }. */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const roles = (route.data?.['roles'] as Role[]) ?? [];
  if (!roles.length || auth.hasRole(...roles)) return true;
  toast.error('Access denied', `This page is restricted to: ${roles.join(', ')}.`);
  router.navigate(['/dashboard']);
  return false;
};

/** Restricts a route by RBAC permission string using route data: { permission: 'quality:create' }. */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const permission = route.data?.['permission'] as string | undefined;
  if (!permission || auth.can(permission)) return true;
  toast.error('Access denied', `Your role (${auth.role()}) cannot access this module.`);
  router.navigate(['/dashboard']);
  return false;
};
