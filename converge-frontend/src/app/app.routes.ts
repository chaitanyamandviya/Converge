import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing';
import { LoginComponent } from './login/login';
import { PortalLayoutComponent } from './shared/portal-layout/portal-layout';
import { DashboardComponent } from './dashboard/dashboard';
import { AgenciesComponent } from './agencies/agencies';
import { CreatorsComponent } from './creators/creators';
import { CreatorDetailComponent } from './creator-detail/creator-detail';
import { ContentLibraryComponent } from './content-library/content-library';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: '',
    component: PortalLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'overview', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'agencies', component: AgenciesComponent },
      { path: 'creators', component: CreatorsComponent },
      { path: 'creators/:handle', component: CreatorDetailComponent },
      { path: 'content-library', component: ContentLibraryComponent }
    ]
  },
  { path: '**', redirectTo: '' }
];
