import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PortalService } from '../../services/portal.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="portal-root">
      <!-- Top Workspace Header -->
      <header class="app-header">
        <div class="header-left">
          <a routerLink="/dashboard" class="logo-link" title="Return to Overview">
            <img src="/assets/converge-logo.svg" alt="Converge" class="header-logo" />
          </a>
          <span class="header-divider">/</span>
          <a routerLink="/dashboard" class="workspace-pill-link" title="Workspace Overview">
            <div class="workspace-pill">
              @if (user()?.logoUrl && !logoFailed) {
                <img [src]="user()?.logoUrl" alt="" class="workspace-logo-img" (error)="logoFailed = true" />
              } @else {
                <span class="workspace-dot"></span>
              }
              <span class="workspace-name">{{ workspaceName() }}</span>
            </div>
          </a>
        </div>

        <div class="header-right">
          <div class="user-chip">
            <span class="user-avatar">{{ (user()?.email || 'U')[0].toUpperCase() }}</span>
            <div class="user-details">
              <span class="user-email">{{ user()?.email }}</span>
              <span class="user-role-badge">{{ roleDisplay() }}</span>
            </div>
          </div>
          <button type="button" class="logout-btn" (click)="logout()" title="Sign out of workspace">
            <svg class="logout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Log out</span>
          </button>
        </div>
      </header>

      <!-- Portal Body -->
      <div class="portal-layout">
        <!-- Sidebar Navigation -->
        <aside class="portal-sidebar">
          <div class="sidebar-category">{{ isAgencyManager() ? 'AGENCY WORKSPACE' : (isAdmin() ? 'ADMIN CONSOLE' : 'BRAND WORKSPACE') }}</div>
          <nav class="sidebar-nav">
            <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item">
              <img src="/assets/layout-dashboard.svg" alt="" class="nav-icon" />
              <span>{{ isAdmin() ? 'Brands & Organizations' : 'Overview' }}</span>
            </a>

            <!-- Agencies nav item visible to System Admin and Brand Manager -->
            @if (!isAgencyManager()) {
              <a routerLink="/agencies" routerLinkActive="active" class="nav-item">
                <img src="/assets/building-2.svg" alt="" class="nav-icon" />
                <span>{{ isAdmin() ? 'Agencies (Directory)' : 'Agencies' }}</span>
              </a>
            }

            <a routerLink="/creators" routerLinkActive="active" class="nav-item">
              <img src="/assets/users.svg" alt="" class="nav-icon" />
              <span>{{ isAgencyManager() ? 'My Talent Roster' : (isAdmin() ? 'Creators (Directory)' : 'Creators') }}</span>
            </a>
            <a routerLink="/content-library" routerLinkActive="active" class="nav-item">
              <img src="/assets/panels-top-left.svg" alt="" class="nav-icon" />
              <span>{{ isAdmin() ? 'Deliverables Audit' : 'Content library' }}</span>
            </a>
          </nav>

          <div class="sidebar-footer">
            <div class="sidebar-stat-chip">
              <span class="status-indicator-dot"></span>
              <span>{{ isAgencyManager() ? 'Agency active' : (activeAgenciesCount() + ' agencies active') }}</span>
            </div>
          </div>
        </aside>

        <!-- Main Dynamic Portal Content -->
        <main class="portal-main">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .portal-root {
      min-height: 100vh;
      width: 100%;
      max-width: 100vw;
      display: flex;
      flex-direction: column;
      background-color: #F6F4EC;
      color: #243F82;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow-x: hidden;
      box-sizing: border-box;
    }

    .app-header {
      min-height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      background: #FFFFFF;
      border-bottom: 1px solid rgba(36, 63, 130, 0.12);
      position: sticky;
      top: 0;
      z-index: 50;
      width: 100%;
      box-sizing: border-box;
      gap: 12px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex-shrink: 1;
    }

    .logo-link {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      cursor: pointer;
    }

    .workspace-pill-link {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      min-width: 0;
    }

    .header-logo {
      height: 24px;
      display: block;
      flex-shrink: 0;
    }

    .header-divider {
      color: rgba(36, 63, 130, 0.3);
      font-size: 16px;
      flex-shrink: 0;
    }

    .workspace-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(36, 63, 130, 0.06);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      color: #243F82;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .workspace-dot {
      width: 7px;
      height: 7px;
      background-color: #527E5A;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .workspace-logo-img {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      object-fit: contain;
      flex-shrink: 0;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-shrink: 0;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(36, 63, 130, 0.05);
      padding: 4px 12px 4px 6px;
      border-radius: 999px;
      max-width: 260px;
    }

    .user-avatar {
      width: 28px;
      height: 28px;
      background: #243F82;
      color: #F6F4EC;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 12px;
      flex-shrink: 0;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
      min-width: 0;
      overflow: hidden;
    }

    .user-email {
      font-size: 12px;
      font-weight: 600;
      color: #243F82;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role-badge {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: rgba(36, 63, 130, 0.65);
      white-space: nowrap;
    }

    .logout-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #D32F2F;
      border: 1.5px solid #B71C1C;
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.02em;
      min-height: 38px;
      padding: 7px 18px;
      border-radius: 999px;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(211, 47, 47, 0.28);
      transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .logout-btn:hover {
      background: #B71C1C;
      border-color: #7F0000;
      color: #FFFFFF;
      transform: translateY(-1.5px);
      box-shadow: 0 6px 18px rgba(183, 28, 28, 0.4);
    }

    .logout-icon {
      width: 15px;
      height: 15px;
    }

    .portal-layout {
      display: flex;
      flex: 1;
      width: 100%;
      min-width: 0;
    }

    .portal-sidebar {
      width: 250px;
      flex-shrink: 0;
      background: #FFFFFF;
      border-right: 1px solid rgba(36, 63, 130, 0.12);
      display: flex;
      flex-direction: column;
      padding: 24px 16px;
      gap: 16px;
    }

    .sidebar-campaign-card {
      padding: 12px 14px;
      border-radius: 10px;
      background: #F6F4EC;
      border: 1px solid rgba(36, 63, 130, 0.08);
    }

    .sidebar-brand-name {
      font-size: 13px;
      font-weight: 700;
      color: #243F82;
      display: flex;
      justify-content: space-between;
    }

    .sidebar-active-campaign {
      font-size: 11px;
      color: rgba(36, 63, 130, 0.7);
      margin-top: 2px;
    }

    .sidebar-category {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: rgba(36, 63, 130, 0.5);
      margin-top: 8px;
      padding: 0 10px;
    }

    .sidebar-nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 44px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 600;
      color: rgba(36, 63, 130, 0.75);
      text-decoration: none;
      border-radius: 8px;
      transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .nav-item:hover {
      background: rgba(36, 63, 130, 0.06);
      color: #243F82;
      transform: translateX(2px);
    }

    .nav-item.active {
      background: #243F82;
      color: #F6F4EC;
      box-shadow: 0 4px 12px rgba(36, 63, 130, 0.22);
    }

    .nav-item.active .nav-icon {
      filter: brightness(0) invert(1);
    }

    .nav-icon {
      width: 17px;
      height: 17px;
      opacity: 0.85;
    }

    .sidebar-footer {
      margin-top: auto;
      padding: 12px 10px;
      border-top: 1px solid rgba(36, 63, 130, 0.08);
    }

    .sidebar-stat-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      font-weight: 600;
      color: #527E5A;
    }

    .status-indicator-dot {
      width: 8px;
      height: 8px;
      background: #527E5A;
      border-radius: 50%;
    }

    .portal-main {
      flex: 1 1 auto;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
      padding: 32px 36px;
      max-width: 1340px;
      margin: 0 auto;
      overflow-x: hidden;
    }

    @media (max-width: 1100px) {
      .portal-main {
        padding: 24px 20px;
      }
    }

    @media (max-width: 900px) {
      .portal-layout {
        flex-direction: column;
      }
      .portal-sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid rgba(36, 63, 130, 0.12);
        padding: 14px 16px;
        gap: 10px;
      }
      .sidebar-nav {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 6px;
      }
      .nav-item {
        min-height: 38px;
        padding: 8px 12px;
        font-size: 12px;
      }
      .sidebar-footer {
        display: none;
      }
      .portal-main {
        padding: 18px 14px;
      }
    }

    @media (max-width: 640px) {
      .app-header {
        padding: 0 14px;
      }
      .user-details {
        display: none;
      }
      .user-chip {
        padding: 4px;
      }
      .logout-btn {
        padding: 6px 12px;
        font-size: 12px;
        min-height: 34px;
      }
      .workspace-pill {
        display: none;
      }
      .header-divider {
        display: none;
      }
      .portal-main {
        padding: 14px 10px;
      }
    }
  `]
})
export class PortalLayoutComponent {
  private auth = inject(AuthService);
  private portal = inject(PortalService);
  private confirmService = inject(ConfirmService);
  private router = inject(Router);

  user = this.auth.currentUser;
  logoFailed = false;

  activeAgenciesCount = computed(() =>
    this.portal.agencies().filter(a => a.status === 'ACTIVE').length
  );

  isAdmin = computed(() => this.user()?.role === 'SYSTEM_ADMIN');
  isAgencyManager = computed(() => this.user()?.role === 'AGENCY_MANAGER');
  isBrandManager = computed(() => this.user()?.role === 'BRAND_MANAGER');

  workspaceName = computed(() => {
    const org = this.user()?.organizationName;
    if (org && org.trim()) {
      return org.trim();
    }
    if (this.isAgencyManager()) {
      return 'Agency Workspace';
    }
    if (this.isAdmin()) {
      return 'Converge System Admin';
    }
    return 'Brand Workspace';
  });

  workspaceSubtitle = computed(() => {
    if (this.isAdmin()) {
      return 'Brand & Agency Governance';
    }
    if (this.isAgencyManager()) {
      return 'Creator Roster & Deliverables';
    }
    return 'Multi-Agency Campaign Hub';
  });

  roleDisplay = computed(() => {
    switch (this.user()?.role) {
      case 'SYSTEM_ADMIN': return 'System Admin';
      case 'AGENCY_MANAGER': return 'Agency Manager';
      case 'BRAND_MANAGER': return 'Brand Manager';
      default: return 'User';
    }
  });

  async logout() {
    const confirmed = await this.confirmService.confirm({
      title: 'Sign Out of Workspace?',
      message: 'Are you sure you want to log out of your active Converge session?',
      detail: this.user()?.email ? `Account: ${this.user()?.email} (${this.roleDisplay()})` : undefined,
      confirmText: 'Log Out',
      cancelText: 'Stay Signed In',
      variant: 'danger'
    });
    if (!confirmed) return;
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
