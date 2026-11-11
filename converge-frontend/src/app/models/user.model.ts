export interface User {
  email: string;
  role: string;
  token: string;
  brandId?: number;
  agencyId?: number;
  organizationName?: string;
  logoUrl?: string;
  expiresAt?: number;
  loginTimestamp?: number;
  rememberMe?: boolean;
}

export interface AuthResponse {
  token: string;
  role: string;
  email: string;
  brandId?: number;
  agencyId?: number;
  organizationName?: string;
  logoUrl?: string;
  status?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}
