/**
 * Global API URL Configuration
 * - Local Development: http://localhost:8080/api
 * - Cloudflare Pages / Production: Automatically uses window.__CONVERGE_API_URL__ (from config.js)
 *   or falls back to relative '/api' if a reverse proxy is configured.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__CONVERGE_API_URL__) {
    const custom = (window as any).__CONVERGE_API_URL__.trim();
    if (custom.length > 0) {
      return custom.replace(/\/+$/, '');
    }
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8080/api';
    }
  }
  return '/api';
}
