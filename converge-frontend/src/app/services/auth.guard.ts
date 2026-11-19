import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/auth'], { queryParams: { mode: 'signin' } });
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth'], { queryParams: { mode: 'signin' } });
  }
  if (auth.currentUser()?.role === 'SYSTEM_ADMIN') {
    return true;
  }
  return router.createUrlTree(['/workspace']);
};

export const workspaceGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth'], { queryParams: { mode: 'signin' } });
  }
  if (auth.currentUser()?.role === 'SYSTEM_ADMIN') {
    return router.createUrlTree(['/admin']);
  }
  return true;
};
