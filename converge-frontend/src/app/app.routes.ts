import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing.component';
import { AuthComponent } from './pages/auth.component';
import { LegalComponent } from './pages/legal.component';
import { AdminOnboardingComponent } from './pages/admin-onboarding.component';
import { AdminBrandDetailsComponent } from './pages/admin-brand-details.component';
import { WorkspaceComponent } from './pages/workspace.component';
import { adminGuard, dashboardExitGuard, guestGuard, workspaceGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'auth', component: AuthComponent, canActivate: [guestGuard] },
  { path: 'login', redirectTo: 'auth', pathMatch: 'full' },
  { path: 'signup', redirectTo: 'auth', pathMatch: 'full' },
  { path: 'legal', component: LegalComponent },
  { path: 'privacy', redirectTo: 'legal', pathMatch: 'full' },
  { path: 'terms', redirectTo: 'legal', pathMatch: 'full' },
  { path: 'admin', component: AdminOnboardingComponent, canActivate: [adminGuard], canDeactivate: [dashboardExitGuard] },
  { path: 'admin/brands', component: AdminOnboardingComponent, canActivate: [adminGuard], canDeactivate: [dashboardExitGuard] },
  { path: 'admin/brands/:id', component: AdminBrandDetailsComponent, canActivate: [adminGuard], canDeactivate: [dashboardExitGuard] },
  { path: 'workspace', component: WorkspaceComponent, canActivate: [workspaceGuard], canDeactivate: [dashboardExitGuard] },
  { path: '**', redirectTo: '' }
];
