import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./landing/landing').then(m => m.LandingComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: '',
    loadComponent: () => import('./shared/portal-layout/portal-layout').then(m => m.PortalLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'campaigns',
        loadComponent: () => import('./dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'overview',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'agencies',
        loadComponent: () => import('./agencies/agencies').then(m => m.AgenciesComponent)
      },
      {
        path: 'creators',
        loadComponent: () => import('./creators/creators').then(m => m.CreatorsComponent)
      },
      {
        path: 'creators/:handle',
        loadComponent: () => import('./creator-detail/creator-detail').then(m => m.CreatorDetailComponent)
      },
      {
        path: 'content-library',
        loadComponent: () => import('./content-library/content-library').then(m => m.ContentLibraryComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
