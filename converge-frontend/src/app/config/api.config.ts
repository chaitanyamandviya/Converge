/**
 * Global API URL Configuration
 * - Local Development: http://localhost:8080/api
 * - Cloudflare Pages / Production: Automatically uses window.__CONVERGE_API_URL__ (from config.js)
 *   or falls back to relative '/api' if a reverse proxy is configured.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;

    // Local development always connects to local backend
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8080/api';
    }

    // Production (Cloudflare Pages / Custom Domain) uses configured backend URL
    const custom = ((window as any).__CONVERGE_API_URL__ || '').trim();
    if (custom.length > 0) {
      return custom.replace(/\/+$/, '');
    }
  }
  return '/api';
}

/**
 * Global Google OAuth 2.0 Web Client ID
 * Set via window.__CONVERGE_GOOGLE_CLIENT_ID__ in public/config.js or environment
 */
export function getGoogleClientId(): string {
  if (typeof window !== 'undefined') {
    const custom = ((window as any).__CONVERGE_GOOGLE_CLIENT_ID__ || '').trim();
    if (custom.length > 0) {
      return custom;
    }
  }
  return '';
}
