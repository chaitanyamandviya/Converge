import { HttpInterceptorFn } from '@angular/common/http';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

export const apiBaseInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('/api') && typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (!LOCAL_HOSTS.has(host)) {
      const configured = String((window as any).__CONVERGE_API_URL__ || '').trim().replace(/\/+$/, '');
      if (configured) {
        const suffix = req.url.slice('/api'.length);
        return next(req.clone({ url: `${configured}${suffix}` }));
      }
    }
  }
  return next(req);
};
