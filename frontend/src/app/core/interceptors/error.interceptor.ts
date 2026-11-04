import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

/** Centralised error surface: toasts for API failures, auto-logout on expired sessions. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        toast.error('Network error', 'Cannot reach the server. Please check that the API is running.');
      } else if (error.status === 401) {
        toast.error('Session expired', error.error?.message || 'Please log in again.');
        auth.logout(false);
        router.navigate(['/login']);
      } else if (error.status === 403) {
        toast.warning('Access denied', error.error?.message || 'You do not have permission for this action.');
      } else if (error.status === 404) {
        toast.error('Not found', error.error?.message || 'The requested record could not be found.');
      } else if (error.status === 409) {
        toast.warning('Conflict', error.error?.message || 'The record already exists.');
      } else {
        const message = error.error?.message || 'Something went wrong. Please try again.';
        toast.error('Request failed', message);
      }
      return throwError(() => error);
    })
  );
};
