import { inject, signal } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { Observable, Subject, of, take } from 'rxjs';
import { AuthService } from './auth.service';

export interface DashboardExitAware {
  confirmDashboardExit(nextUrl: string): boolean | Observable<boolean>;
}

/**
 * Coordinates async Sign-Out confirmation when leaving a dashboard route via browser Back/Forward or public links.
 */
export class DashboardExitController {
  private pending$ = new Subject<boolean>();
  private waiting = false;
  readonly promptVisible = signal(false);

  requestExit(openModal: () => void): Observable<boolean> {
    if (this.waiting) {
      return of(false);
    }
    this.waiting = true;
    this.promptVisible.set(true);
    openModal();
    return this.pending$.asObservable().pipe(take(1));
  }

  confirm(logoutFn: () => void): boolean {
    if (!this.waiting) {
      return false;
    }
    this.waiting = false;
    this.promptVisible.set(false);
    logoutFn();
    this.pending$.next(true);
    return true;
  }

  cancel(closeModal: () => void): void {
    closeModal();
    if (this.waiting) {
      this.waiting = false;
      this.promptVisible.set(false);
      this.pending$.next(false);
    }
  }

  destroy(): void {
    if (this.waiting) {
      this.waiting = false;
      this.promptVisible.set(false);
      this.pending$.next(false);
    }
    this.pending$.complete();
  }
}

function isInternalOrLegalRoute(url: string): boolean {
  const path = (url || '/').split('?')[0].split('#')[0] || '/';
  return path.startsWith('/workspace')
    || path.startsWith('/admin')
    || path.startsWith('/legal')
    || path.startsWith('/privacy')
    || path.startsWith('/terms');
}

export const dashboardExitGuard: CanDeactivateFn<DashboardExitAware> = (
  component,
  _currentRoute,
  _currentState,
  nextState
) => {
  const auth = inject(AuthService);
  if (!auth.isAuthenticated()) {
    return true;
  }
  const targetUrl = nextState?.url || '/';
  if (isInternalOrLegalRoute(targetUrl)) {
    return true;
  }
  if (component && typeof component.confirmDashboardExit === 'function') {
    return component.confirmDashboardExit(targetUrl);
  }
  return true;
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return router.createUrlTree([auth.dashboardRoute()]);
  }
  return true;
};

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    auth.verifySessionWithServer();
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
  auth.verifySessionWithServer();
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
  auth.verifySessionWithServer();
  if (auth.currentUser()?.role === 'SYSTEM_ADMIN') {
    return router.createUrlTree(['/admin']);
  }
  return true;
};
