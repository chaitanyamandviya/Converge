import { Injectable, OnDestroy, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, from, map, of, switchMap, tap, throwError } from 'rxjs';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'SYSTEM_ADMIN' | 'BRAND_MANAGER' | 'AGENCY_MANAGER' | 'CREATOR';
  verified: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface ActiveTabRecord {
  email: string;
  lastSeenMs: number;
}

const SESSION_TOKEN_KEY = 'converge_token';
const SESSION_USER_KEY = 'converge_user';
const SESSION_TAB_ID_KEY = 'converge_tab_id';
const ACTIVE_TABS_REGISTRY_KEY = 'converge_active_tabs';
const SESSION_CHANNEL_NAME = 'converge_auth_sessions';
const HEARTBEAT_INTERVAL_MS = 4000;
const HEARTBEAT_STALE_MS = 12000;
const ALLOWED_ROLES = new Set<AuthUser['role']>(['SYSTEM_ADMIN', 'BRAND_MANAGER', 'AGENCY_MANAGER', 'CREATOR']);

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private readonly apiBase = '/api/auth';
  private readonly runtimeId = this.createUniqueId();
  private readonly tabId = this.loadOrCreateTabId();
  private channel: BroadcastChannel | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private serverVerifiedThisLoad = false;

  readonly currentUser = signal<AuthUser | null>(null);

  constructor(private http: HttpClient) {
    // Purge legacy cross-tab shared credentials so each tab keeps its own sessionStorage session.
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
    }

    const restored = this.loadStoredUser();
    this.currentUser.set(restored);

    if (typeof window !== 'undefined') {
      this.initCrossTabPresence();
      if (restored) {
        this.registerTabPresence(restored.email);
      }
    }
  }

  ngOnDestroy(): void {
    this.stopHeartbeat();
    this.unregisterTabPresence();
    this.channel?.close();
  }

  private createUniqueId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private loadOrCreateTabId(): string {
    if (typeof sessionStorage === 'undefined') {
      return this.runtimeId;
    }
    try {
      const existing = sessionStorage.getItem(SESSION_TAB_ID_KEY);
      if (existing) return existing;
      sessionStorage.setItem(SESSION_TAB_ID_KEY, this.runtimeId);
      return this.runtimeId;
    } catch {
      return this.runtimeId;
    }
  }

  private parseJwtPayload(token: string | null): { sub: string; role: AuthUser['role']; exp: number } | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));
      const sub = typeof payload?.sub === 'string' ? payload.sub.trim().toLowerCase() : '';
      const role = payload?.role;
      const exp = typeof payload?.exp === 'number' ? payload.exp : 0;
      if (!sub || !ALLOWED_ROLES.has(role) || !exp || exp * 1000 <= Date.now()) {
        return null;
      }
      return { sub, role, exp };
    } catch {
      return null;
    }
  }

  private loadStoredUser(): AuthUser | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
      const rawUser = sessionStorage.getItem(SESSION_USER_KEY);
      if (!token || !rawUser) return null;
      const claims = this.parseJwtPayload(token);
      if (!claims) {
        this.clearTabStorage();
        return null;
      }
      const parsed = JSON.parse(rawUser) as AuthUser;
      if (!parsed?.email || parsed.email.trim().toLowerCase() !== claims.sub) {
        this.clearTabStorage();
        return null;
      }
      // Always treat the signed JWT role claim as authoritative client-side.
      return {
        ...parsed,
        email: claims.sub,
        role: claims.role
      };
    } catch {
      this.clearTabStorage();
      return null;
    }
  }

  get token(): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!raw || !this.parseJwtPayload(raw)) {
      return null;
    }
    return raw;
  }

  isAuthenticated(): boolean {
    const t = this.token;
    const u = this.currentUser();
    if (!t || !u) {
      if (this.currentUser() !== null) {
        this.clearTabStorage();
        this.currentUser.set(null);
      }
      return false;
    }
    return true;
  }

  dashboardRoute(): string {
    return this.currentUser()?.role === 'SYSTEM_ADMIN' ? '/admin' : '/workspace';
  }

  verifySessionWithServer(): void {
    if (!this.isAuthenticated() || this.serverVerifiedThisLoad) {
      return;
    }
    this.serverVerifiedThisLoad = true;
    this.http.get<AuthUser>(`${this.apiBase}/me`).pipe(
      tap(user => {
        if (user?.email && this.currentUser()?.email.toLowerCase() === user.email.toLowerCase()) {
          sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
          this.currentUser.set(user);
        }
      }),
      catchError(() => of(null))
    ).subscribe();
  }

  private initCrossTabPresence(): void {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
      this.channel.onmessage = (ev: MessageEvent) => {
        const msg = ev.data;
        if (!msg || msg.requesterRuntimeId === this.runtimeId) return;
        if (msg.type === 'PING_USER' && typeof msg.email === 'string') {
          const activeUser = this.currentUser();
          if (activeUser && this.isAuthenticated() && activeUser.email.toLowerCase() === msg.email.toLowerCase()) {
            this.channel?.postMessage({
              type: 'USER_ALIVE',
              email: activeUser.email.toLowerCase(),
              ownerRuntimeId: this.runtimeId,
              ownerTabId: this.tabId
            });
          }
        }
      };
    }

    const cleanup = () => this.unregisterTabPresence();
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('beforeunload', cleanup);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isAuthenticated()) {
        const email = this.currentUser()?.email;
        if (email) this.writeRegistryEntry(email);
      }
    });
  }

  private registerTabPresence(email: string): void {
    this.writeRegistryEntry(email);
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const u = this.currentUser();
      if (this.isAuthenticated() && u?.email) {
        this.writeRegistryEntry(u.email);
      } else {
        this.unregisterTabPresence();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private readActiveTabsMap(): Record<string, ActiveTabRecord> {
    if (typeof localStorage === 'undefined') return {};
    try {
      const raw = localStorage.getItem(ACTIVE_TABS_REGISTRY_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return {};
      const now = Date.now();
      const cleaned: Record<string, ActiveTabRecord> = {};
      for (const [k, v] of Object.entries(parsed)) {
        const rec = v as ActiveTabRecord;
        if (rec && typeof rec.email === 'string' && typeof rec.lastSeenMs === 'number'
            && now - rec.lastSeenMs <= HEARTBEAT_STALE_MS) {
          cleaned[k] = rec;
        }
      }
      return cleaned;
    } catch {
      return {};
    }
  }

  private writeRegistryEntry(email: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const map = this.readActiveTabsMap();
      map[this.tabId] = { email: email.trim().toLowerCase(), lastSeenMs: Date.now() };
      localStorage.setItem(ACTIVE_TABS_REGISTRY_KEY, JSON.stringify(map));
    } catch {}
  }

  private unregisterTabPresence(): void {
    this.stopHeartbeat();
    if (typeof localStorage === 'undefined') return;
    try {
      const map = this.readActiveTabsMap();
      if (map[this.tabId]) {
        delete map[this.tabId];
        localStorage.setItem(ACTIVE_TABS_REGISTRY_KEY, JSON.stringify(map));
      }
    } catch {}
  }

  private async isEmailActiveElsewhere(rawEmail: string): Promise<'SAME_TAB' | 'OTHER_TAB' | null> {
    const email = rawEmail.trim().toLowerCase();
    if (!email) return null;

    if (this.isAuthenticated()) {
      return 'SAME_TAB';
    }

    if (this.channel) {
      const repliedAlive = await new Promise<boolean>((resolve) => {
        let settled = false;
        const onMsg = (ev: MessageEvent) => {
          const msg = ev.data;
          if (msg?.type === 'USER_ALIVE' && msg?.email === email && msg?.ownerRuntimeId !== this.runtimeId) {
            settled = true;
            this.channel?.removeEventListener('message', onMsg);
            resolve(true);
          }
        };
        this.channel!.addEventListener('message', onMsg);
        this.channel!.postMessage({
          type: 'PING_USER',
          email,
          requesterRuntimeId: this.runtimeId
        });
        setTimeout(() => {
          if (!settled) {
            this.channel?.removeEventListener('message', onMsg);
            resolve(false);
          }
        }, 120);
      });
      if (repliedAlive) {
        return 'OTHER_TAB';
      }
    }

    const tabs = this.readActiveTabsMap();
    for (const [id, rec] of Object.entries(tabs)) {
      if (id !== this.tabId && rec.email.toLowerCase() === email) {
        return 'OTHER_TAB';
      }
    }
    return null;
  }

  private ensureSessionSlotAvailable(email: string): Observable<void> {
    return from(this.isEmailActiveElsewhere(email)).pipe(
      switchMap(conflict => {
        if (conflict === 'SAME_TAB') {
          return throwError(() => ({
            error: { error: `You are already signed in as ${this.currentUser()?.email} in this tab. Sign out first to switch accounts.` }
          }));
        }
        if (conflict === 'OTHER_TAB') {
          return throwError(() => ({
            error: { error: `Account ${email.trim().toLowerCase()} is already signed in on another tab. Sign out there or sign in with a different user.` }
          }));
        }
        return of(undefined);
      })
    );
  }

  signup(name: string, email: string, password: string, token?: string): Observable<AuthResponse> {
    const payload: Record<string, string> = { name, email, password };
    if (token && token.trim()) {
      payload['token'] = token.trim();
    }
    return this.ensureSessionSlotAvailable(email).pipe(
      switchMap(() => this.http.post<AuthResponse>(`${this.apiBase}/signup`, payload)),
      switchMap(res => this.acceptAuthResponse(res))
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.ensureSessionSlotAvailable(email).pipe(
      switchMap(() => this.http.post<AuthResponse>(`${this.apiBase}/login`, { email, password })),
      switchMap(res => this.acceptAuthResponse(res))
    );
  }

  getConfig(): Observable<{ googleClientId: string }> {
    return this.http.get<{ googleClientId: string }>(`${this.apiBase}/config`);
  }

  googleLogin(payload: { idToken?: string; accessToken?: string }): Observable<AuthResponse> {
    if (this.isAuthenticated()) {
      return throwError(() => ({
        error: { error: `You are already signed in as ${this.currentUser()?.email} in this tab. Sign out first to switch accounts.` }
      }));
    }
    return this.http.post<AuthResponse>(`${this.apiBase}/google`, payload).pipe(
      switchMap(res => this.acceptAuthResponse(res))
    );
  }

  private acceptAuthResponse(res: AuthResponse): Observable<AuthResponse> {
    return this.ensureSessionSlotAvailable(res.user.email).pipe(
      tap(() => this.persistAuth(res)),
      map(() => res)
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBase}/forgot-password`, { email });
  }

  logout(): void {
    this.clearTabStorage();
    this.unregisterTabPresence();
    this.serverVerifiedThisLoad = false;
    this.currentUser.set(null);
  }

  private clearTabStorage(): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_USER_KEY);
    }
  }

  private persistAuth(res: AuthResponse): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_TOKEN_KEY, res.token);
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(res.user));
    }
    this.serverVerifiedThisLoad = true;
    this.currentUser.set(res.user);
    this.registerTabPresence(res.user.email);
  }
}
