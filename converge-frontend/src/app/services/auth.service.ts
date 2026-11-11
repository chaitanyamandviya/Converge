import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, throwError } from 'rxjs';
import { AuthResponse, LoginCredentials, User } from '../models/user.model';
import { ToastService } from './toast.service';
import { PortalService } from './portal.service';
import { getApiBaseUrl } from '../config/api.config';

const STORAGE_KEY = 'converge_auth_user';
const LOGOUT_BROADCAST_KEY = 'converge_logout_broadcast';
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity
const DEFAULT_SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours max session
const getBaseAuthUrl = () => `${getApiBaseUrl()}/auth`;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly portalService = inject(PortalService);

  private lastActivityTime = Date.now();
  private idleCheckInterval: any = null;

  readonly currentUser = signal<User | null>(this.loadStoredUser());
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly userRole = computed(() => this.currentUser()?.role ?? '');
  readonly token = computed(() => this.currentUser()?.token ?? null);

  constructor() {
    this.initSessionSync();
    this.startIdleMonitor();
    if (this.currentUser()?.token && !this.currentUser()?.organizationName) {
      this.fetchCurrentUserProfile();
    }
  }

  /**
   * Cross-tab isolation:
   * Sessions are held per-tab in sessionStorage so users can work across multiple tabs
   * (e.g. Agency Manager in Tab 1, Brand Manager in Tab 2) without session collisions.
   */
  private initSessionSync(): void {
    // Isolated per-tab sessions enabled.
  }

  /**
   * Starts enterprise idle monitoring:
   * Tracks user interaction events. If idle for 15 minutes, automatically logs out.
   */
  private startIdleMonitor(): void {
    if (typeof window === 'undefined') return;

    const resetActivity = () => {
      this.lastActivityTime = Date.now();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

    this.idleCheckInterval = setInterval(() => {
      this.checkSessionLiveness();
    }, 15000);
  }

  private checkSessionLiveness(): void {
    const user = this.currentUser();
    if (!user) return;

    const now = Date.now();
    // 1. Check idle inactivity (15 minutes)
    if (now - this.lastActivityTime > IDLE_TIMEOUT_MS) {
      this.logout(true, 'Your session expired due to 15 minutes of inactivity.');
      return;
    }

    // 2. Check token absolute lifetime (2 hours)
    if (user.expiresAt && now > user.expiresAt) {
      this.logout(true, 'Your session has expired. Please log in again.');
      return;
    }
  }

  isSessionValid(): boolean {
    const user = this.currentUser();
    if (!user || !user.token) return false;
    const now = Date.now();
    if (user.expiresAt && now > user.expiresAt) return false;
    if (now - this.lastActivityTime > IDLE_TIMEOUT_MS) return false;
    return true;
  }

  login(credentials: LoginCredentials): Observable<User> {
    return this.http.post<AuthResponse>(`${getBaseAuthUrl()}/login`, {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password
    }).pipe(
      map(response => this.handleAuthResponse(response, !!credentials.rememberMe)),
      catchError(err => this.handleAuthError(err))
    );
  }

  getAvailableBrands(): Observable<Array<{ id: number; name: string; category?: string; primaryManagerEmail?: string; status?: string }>> {
    return this.http.get<Array<{ id: number; name: string; category?: string; primaryManagerEmail?: string; status?: string }>>(`${getBaseAuthUrl()}/brands`);
  }

  register(
    email: string,
    password: string,
    role: string,
    fullName = '',
    organizationName = '',
    category = 'Lifestyle & Wellness',
    websiteUrl = '',
    brandId?: number,
    brandName?: string
  ): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${getBaseAuthUrl()}/register`, {
      email: email.trim().toLowerCase(),
      password,
      role,
      fullName,
      organizationName,
      category,
      websiteUrl,
      brandId,
      brandName
    }).pipe(
      catchError(err => this.handleAuthError(err))
    );
  }

  forgotPassword(email: string, newPassword = ''): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${getBaseAuthUrl()}/forgot-password`, {
      email: email.trim().toLowerCase(),
      password: newPassword
    }).pipe(
      catchError(err => this.handleAuthError(err))
    );
  }

  submitFeedback(email: string, message: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${getBaseAuthUrl()}/feedback`, {
      email: email.trim().toLowerCase(),
      message
    }).pipe(
      catchError(err => this.handleAuthError(err))
    );
  }

  googleLogin(email: string, rememberMe = false): Observable<User> {
    return this.http.post<AuthResponse>(`${getBaseAuthUrl()}/google`, {
      email: email.trim().toLowerCase()
    }).pipe(
      map(response => this.handleAuthResponse(response, rememberMe)),
      catchError(err => this.handleAuthError(err))
    );
  }

  fetchCurrentUserProfile(): void {
    const user = this.currentUser();
    if (!user || !user.token) return;
    this.http.get<any>(`${getBaseAuthUrl()}/me`).subscribe({
      next: (profile) => {
        if (profile) {
          const updated: User = {
            ...user,
            organizationName: profile.organizationName || user.organizationName,
            logoUrl: profile.logoUrl || user.logoUrl,
            brandId: profile.brandId || user.brandId,
            agencyId: profile.agencyId || user.agencyId
          };
          this.currentUser.set(updated);
          this.saveUser(updated, !!user.rememberMe);
        }
      },
      error: () => {}
    });
  }

  private handleAuthResponse(response: AuthResponse, rememberMe: boolean): User {
    const now = Date.now();
    const user: User = {
      email: response.email,
      role: response.role,
      token: response.token,
      brandId: response.brandId,
      agencyId: response.agencyId,
      organizationName: response.organizationName,
      logoUrl: response.logoUrl,
      loginTimestamp: now,
      expiresAt: now + DEFAULT_SESSION_DURATION_MS,
      rememberMe: rememberMe
    };
    this.lastActivityTime = now;
    this.saveUser(user, rememberMe);
    this.currentUser.set(user);
    return user;
  }

  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    let message = 'Authentication failed. Please check your credentials.';
    if (error.status === 0) {
      message = 'Cannot connect to Converge backend API on port 8080. Please ensure the backend service is running.';
    } else if (error.status === 401 || error.status === 403 || error.status === 500) {
      message = error.error?.message || 'Invalid email or password.';
    } else if (error.error && typeof error.error === 'string') {
      message = error.error;
    } else if (error.error?.message) {
      message = error.error.message;
    }
    return throwError(() => new Error(message));
  }

  logout(isAuto = false, reason?: string): void {
    this.clearSessionLocally();
    if (reason) {
      this.toast.info('Session Ended', reason);
    }
    this.router.navigate(['/login']);
  }

  private clearSessionLocally(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LOGOUT_BROADCAST_KEY);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    this.portalService.resetState();
    this.currentUser.set(null);
  }

  private saveUser(user: User, rememberMe: boolean): void {
    this.portalService.resetState();
    const serialized = JSON.stringify(user);
    // Keep active session in sessionStorage for strict per-tab isolation
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, serialized);
    }
    // Clean up localStorage so new tabs open fresh and don't inherit another tab's session
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private loadStoredUser(): User | null {
    try {
      // Clean up any stale localStorage token on boot
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
      if (!stored) return null;
      const user: User = JSON.parse(stored);
      // Validate expiration
      if (user.expiresAt && Date.now() > user.expiresAt) {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }
}
