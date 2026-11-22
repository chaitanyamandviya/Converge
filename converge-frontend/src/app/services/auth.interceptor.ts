import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const PUBLIC_AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/signup',
  '/auth/google',
  '/auth/forgot-password',
  '/auth/config'
];

function isConvergeApiRequest(url: string): boolean {
  if (url.startsWith('/api/')) return true;
  if (typeof window !== 'undefined') {
    const configured = String((window as any).__CONVERGE_API_URL__ || '').trim().replace(/\/+$/, '');
    if (configured && url.startsWith(`${configured}/`)) {
      return true;
    }
  }
  return false;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isApi = isConvergeApiRequest(req.url);
  const token = isApi ? auth.token : null;
  const outgoing = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && isApi) {
        const isPublicAuth = PUBLIC_AUTH_ENDPOINTS.some(ep => req.url.endsWith(ep));
        if (!isPublicAuth) {
          auth.logout();
          if (!router.url.startsWith('/auth')) {
            router.navigate(['/auth'], {
              queryParams: { mode: 'signin', reason: 'expired' },
              replaceUrl: true
            });
          }
        }
      }
      return throwError(() => err);
    })
  );
};
