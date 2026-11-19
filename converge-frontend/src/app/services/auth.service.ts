import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBase = '/api/auth';
  readonly currentUser = signal<AuthUser | null>(this.loadStoredUser());

  constructor(private http: HttpClient) {}

  private loadStoredUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem('converge_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  get token(): string | null {
    return localStorage.getItem('converge_token');
  }

  isAuthenticated(): boolean {
    return !!this.token && !!this.currentUser();
  }

  signup(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBase}/signup`, { name, email, password }).pipe(
      tap(res => this.persistAuth(res))
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBase}/login`, { email, password }).pipe(
      tap(res => this.persistAuth(res))
    );
  }

  getConfig(): Observable<{ googleClientId: string }> {
    return this.http.get<{ googleClientId: string }>(`${this.apiBase}/config`);
  }

  googleLogin(payload: { idToken?: string; accessToken?: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiBase}/google`, payload).pipe(
      tap(res => this.persistAuth(res))
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiBase}/forgot-password`, { email });
  }

  logout(): void {
    localStorage.removeItem('converge_token');
    localStorage.removeItem('converge_user');
    this.currentUser.set(null);
  }

  private persistAuth(res: AuthResponse): void {
    localStorage.setItem('converge_token', res.token);
    localStorage.setItem('converge_user', JSON.stringify(res.user));
    this.currentUser.set(res.user);
  }
}
