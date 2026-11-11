import { Component, inject, OnInit, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PortalService, Agency } from '../services/portal.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { CustomSelectComponent } from '../shared/custom-select/custom-select.component';

@Component({
  selector: 'app-agencies',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CustomSelectComponent],
  template: `
    <div class="agencies-view">
      <!-- Page Header -->
      <header class="page-header">
        <div class="header-text">
          <h1 class="page-title">Agencies</h1>
          <p class="page-subtitle">
            {{ isAdmin() ? 'Platform directory of partner agencies connected across brand workspaces (View-only for System Admin).' : 'Manage partner agencies, edit contact details, and oversee contracted budget.' }}
          </p>
        </div>
        @if (!isAdmin()) {
          <button class="invite-btn" (click)="openModal = true">
            <img src="/assets/plus.svg" alt="" class="btn-icon" />
            <span>Invite agency</span>
          </button>
        }
      </header>

      <!-- macOS Soft Capsule Status Strip (Zero Big Boxy Cards) -->
      <div class="macos-stat-strip">
        <div class="stat-pill-item">
          <span class="pill-dot blue"></span>
          <span class="pill-label">Agencies</span>
          <span class="pill-count">{{ agencies().length }} ({{ activeCount() }} active)</span>
        </div>
        <span class="strip-sep">/</span>
        <div class="stat-pill-item">
          <span class="pill-dot green"></span>
          <span class="pill-label">Creators</span>
          <span class="pill-count">{{ totalCreatorsCount() }}</span>
        </div>
        <span class="strip-sep">/</span>
        <div class="stat-pill-item">
          <span class="pill-dot sky"></span>
          <span class="pill-label">Content Slots</span>
          <span class="pill-count">{{ overview().contentSlotsFilled }} / {{ overview().totalContentSlots }}</span>
        </div>
        <span class="strip-sep">/</span>
        <div class="stat-pill-item">
          <span class="pill-dot orange"></span>
          <span class="pill-label">Allocated Spend</span>
          <span class="pill-count">₹{{ formatInr(totalSpend()) }}</span>
        </div>
      </div>

      <!-- Agencies Table Container -->
      <section class="table-container">
        <div class="table-header-strip">
          <h2 class="table-title">All Agencies</h2>
          <span class="table-badge">{{ activeCount() }} Active</span>
        </div>

        @if (agencies().length === 0) {
          <div class="macos-empty-state">
            <div class="macos-empty-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3 class="macos-empty-title">No Partner Agencies</h3>
            <p class="macos-empty-text">Onboard partner agencies to delegate creator roster management and campaign deliverables.</p>
            <button type="button" class="macos-empty-cta" (click)="openModal = true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Invite Agency</span>
            </button>
          </div>
        } @else {
          <div class="table-scroll-wrap">
            <table class="agencies-table">
              <thead>
                <tr>
                  <th class="col-agency-main">AGENCY</th>
                  <th class="col-brand">PARTNER BRAND</th>
                  <th class="col-category">CATEGORY</th>
                  <th class="col-creators-count">CREATORS</th>
                  <th class="col-spend">SPEND</th>
                  <th class="col-status">STATUS</th>
                  <th class="col-agency-actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                @for (agency of agencies(); track agency.id || agency.name; let idx = $index) {
                  <tr>
                    <td class="col-agency-main">
                      <div class="agency-cell-flex">
                        <span class="agency-badge-avatar" [style.background-color]="agency.avatarColor">
                          @if (agency.logoUrl) {
                            <img [src]="agency.logoUrl" alt="" class="agency-badge-avatar-img" (error)="agency.logoUrl = ''" />
                          } @else {
                            {{ agency.name[0] }}
                          }
                        </span>
                        <div>
                          <div class="agency-name">{{ agency.name }}</div>
                          <div class="agency-email">{{ agency.email }}</div>
                          @if (agency.websiteUrl) {
                            <a [href]="agency.websiteUrl" target="_blank" rel="noopener" class="agency-email" style="color: #2C54A6; text-decoration: underline;">
                              {{ agency.websiteUrl }} ↗
                            </a>
                          }
                        </div>
                      </div>
                    </td>
                    <td class="col-brand"><span class="partner-brand-pill">{{ resolveBrandName(agency) }}</span></td>
                    <td class="col-category"><span class="category-pill">{{ agency.category }}</span></td>
                    <td class="col-creators-count nowrap-cell"><strong class="number-data">{{ agency.creatorsCount }}</strong> creators</td>
                    <td class="col-spend nowrap-cell"><strong class="spend-data">₹{{ formatInr(agency.spend) }}</strong></td>
                    <td class="col-status nowrap-cell">
                      @if (agency.status === 'PENDING_APPROVAL') {
                        <span class="status-chip pending">PENDING APPROVAL</span>
                      } @else if (agency.status === 'DEACTIVATED') {
                        <span class="status-chip deactivated">DEACTIVATED</span>
                      } @else {
                        <span class="status-chip active">{{ agency.status }}</span>
                      }
                    </td>
                    <td class="col-agency-actions actions-cell">
                      @if (!isAdmin()) {
                        <div class="action-dropdown-container">
                          <button
                            type="button"
                            class="btn-action-trigger"
                            (click)="toggleActionMenu(agency.id, $event)"
                            title="Actions menu"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="2"/>
                              <circle cx="12" cy="12" r="2"/>
                              <circle cx="12" cy="19" r="2"/>
                            </svg>
                            <span>Actions</span>
                            <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor" style="opacity: 0.7;"><path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/></svg>
                          </button>
                          @if (openMenuId() === agency.id) {
                            <div
                              class="action-dropdown-menu"
                              [class.drop-up]="idx >= agencies().length - 1 && agencies().length > 2"
                              (click)="$event.stopPropagation()"
                            >
                              <a
                                [routerLink]="['/creators']"
                                [queryParams]="{ agency: agency.name }"
                                class="dropdown-item"
                                (click)="closeMenu()"
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>
                                <span>View Creators</span>
                              </a>
                              <button
                                type="button"
                                class="dropdown-item"
                                [disabled]="processingAgencyId() === agency.id"
                                (click)="openEditAgency(agency); closeMenu()"
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L4.667 14 2 14.667l.667-2.667L11.333 2Z"/></svg>
                                <span>Edit Agency</span>
                              </button>
                              <div class="dropdown-divider"></div>
                              <button
                                type="button"
                                class="dropdown-item danger"
                                [disabled]="processingAgencyId() === agency.id"
                                (click)="deleteAgency(agency); closeMenu()"
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 4h11"/><path d="M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4"/><path d="M4 4l.7 9.5a1.5 1.5 0 0 0 1.5 1.5h3.6a1.5 1.5 0 0 0 1.5-1.5L12 4"/></svg>
                                <span>Delete Agency</span>
                              </button>
                            </div>
                          }
                        </div>
                      } @else {
                        <span class="partner-brand-pill" style="color: #64748B; background: #F1F5F9;">Managed by Brand</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Invite Modal Dialog (Sends Set-Initial-Password Link via Email — No Password Field Needed) -->
      @if (openModal) {
        <div class="modal-backdrop" (click)="openModal = false">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3>Invite New Agency</h3>
              <button class="close-btn" (click)="openModal = false">✕</button>
            </div>
            <form (ngSubmit)="submitInvite()">
              <div class="form-group">
                <label>Agency Name *</label>
                <input type="text" [(ngModel)]="newAgencyName" name="name" required placeholder="e.g. Elevate Creators" class="form-input" />
              </div>
              <div class="form-group">
                <label>Agency Website / Portfolio URL (if available)</label>
                <div class="website-input-row">
                  <input type="url" [(ngModel)]="newAgencyWebsiteUrl" (blur)="newAgencyWebsiteUrl && !newAgencyLogoUrl ? fetchAgencyLogo('new') : null" name="websiteUrl" placeholder="https://elevate.agency" class="form-input" />
                  <button type="button" class="btn-fetch-logo" (click)="fetchAgencyLogo('new')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    <span>Fetch Logo</span>
                  </button>
                </div>
                @if (newAgencyLogoUrl) {
                  <div class="logo-preview-chip">
                    <img [src]="newAgencyLogoUrl" alt="Agency Logo" class="preview-logo-thumb" (error)="newAgencyLogoUrl = ''" />
                    <span class="preview-logo-text">Detected Logo Preview</span>
                    <button type="button" class="btn-clear-logo" (click)="newAgencyLogoUrl = ''" title="Clear logo">✕</button>
                  </div>
                }
              </div>
              <div class="form-group">
                <label>Agency Manager Email *</label>
                <input type="email" [(ngModel)]="newAgencyEmail" name="email" required placeholder="team@elevate.agency" class="form-input" />
              </div>
              @if (brands().length > 0) {
                <div class="form-group">
                  <label>Partner Brand *</label>
                  <app-custom-select
                    [(ngModel)]="newAgencyBrandId"
                    name="brandId"
                    [options]="brandSelectOptions()"
                    placeholder="Select Partner Brand"
                  ></app-custom-select>
                </div>
              }
              <div class="form-group">
                <label>Primary Vertical</label>
                <app-custom-select
                  [(ngModel)]="newAgencyCategory"
                  name="category"
                  [options]="primaryVerticals"
                  placeholder="Select Primary Vertical"
                ></app-custom-select>
              </div>
              <p class="modal-helper-note">
                An invitation email with a <strong>Set Initial Password</strong> link will be sent automatically to the Agency Manager.
              </p>

              <div class="modal-actions">
                <button type="button" class="btn-cancel" [disabled]="isSubmitting" (click)="openModal = false">Cancel</button>
                <button type="submit" class="btn-submit" [disabled]="isSubmitting">
                  @if (isSubmitting) {
                    <span class="btn-spinner"></span>
                    <span>Sending Invitation...</span>
                  } @else {
                    <span>Send Invitation</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Edit Agency Modal Dialog -->
      @if (openEditModal) {
        <div class="modal-backdrop" (click)="openEditModal = false">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3>Edit Agency Details</h3>
              <button class="close-btn" (click)="openEditModal = false">✕</button>
            </div>
            <form (ngSubmit)="submitEdit()">
              <div class="form-group">
                <label>Agency Name *</label>
                <input type="text" [(ngModel)]="editAgencyName" name="editName" required class="form-input" />
              </div>
              <div class="form-group">
                <label>Agency Website / Portfolio URL (if available)</label>
                <div class="website-input-row">
                  <input type="url" [(ngModel)]="editAgencyWebsiteUrl" (blur)="editAgencyWebsiteUrl && !editAgencyLogoUrl ? fetchAgencyLogo('edit') : null" name="editWebsiteUrl" class="form-input" />
                  <button type="button" class="btn-fetch-logo" (click)="fetchAgencyLogo('edit')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                    <span>Fetch Logo</span>
                  </button>
                </div>
                @if (editAgencyLogoUrl) {
                  <div class="logo-preview-chip">
                    <img [src]="editAgencyLogoUrl" alt="Agency Logo" class="preview-logo-thumb" (error)="editAgencyLogoUrl = ''" />
                    <span class="preview-logo-text">Detected Logo Preview</span>
                    <button type="button" class="btn-clear-logo" (click)="editAgencyLogoUrl = ''" title="Clear logo">✕</button>
                  </div>
                }
              </div>
              <div class="form-group">
                <label>Agency Manager Email *</label>
                <input type="email" [(ngModel)]="editAgencyEmail" name="editEmail" required class="form-input" />
              </div>
              <div class="form-group">
                <label>Primary Vertical</label>
                <app-custom-select
                  [(ngModel)]="editAgencyCategory"
                  name="editCategory"
                  [options]="primaryVerticals"
                  placeholder="Select Primary Vertical"
                ></app-custom-select>
              </div>
              <div class="form-group">
                <label>Agreed Spend (₹)</label>
                <input type="number" [(ngModel)]="editAgencySpend" name="editSpend" placeholder="e.g. 500000" class="form-input" />
              </div>

              @if (selectedAgencyForEdit) {
                <div class="edit-quick-actions" style="margin-top: 14px; padding: 12px; background: rgba(0, 0, 0, 0.04); border-radius: 10px; border: 1px solid rgba(0, 0, 0, 0.1);">
                  <div style="font-size: 11.5px; font-weight: 700; color: #1D1D1F; margin-bottom: 8px;">Workspace Access & Communication</div>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    @if (selectedAgencyForEdit.status === 'PENDING_APPROVAL') {
                      <button type="button" class="btn-row-action" style="background: #059669; color: #fff; border: none;" (click)="approveAgency(selectedAgencyForEdit)">
                        ✓ Approve Workspace
                      </button>
                    }
                    <button type="button" class="btn-row-action" (click)="resendInvite(selectedAgencyForEdit)">
                      <svg class="act-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1.5" y="3" width="13" height="10" rx="2"/><path d="m2 4 6 4.5L14 4"/></svg>
                      <span>Resend Invite Email</span>
                    </button>
                    <button type="button" class="btn-row-action warn" (click)="toggleStatus(selectedAgencyForEdit)">
                      <span>{{ selectedAgencyForEdit.status === 'DEACTIVATED' ? 'Activate Account' : 'Deactivate Account' }}</span>
                    </button>
                  </div>
                </div>
              }

              <div class="modal-actions">
                <button type="button" class="btn-cancel" [disabled]="isSubmittingEdit" (click)="openEditModal = false">Cancel</button>
                <button type="submit" class="btn-submit" [disabled]="isSubmittingEdit">
                  @if (isSubmittingEdit) {
                    <span class="btn-spinner"></span>
                    <span>Saving Changes...</span>
                  } @else {
                    <span>Save Changes</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .agencies-view {
      display: flex;
      flex-direction: column;
      gap: 28px;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      width: 100%;
    }

    .header-text {
      min-width: 0;
      flex: 1 1 280px;
    }

    .page-title {
      font-size: 26px;
      font-weight: 700;
      color: #37352F;
      margin: 0 0 4px 0;
      letter-spacing: -0.025em;
    }

    .page-subtitle {
      font-size: 13.5px;
      color: #787774;
      margin: 0;
      line-height: 1.45;
    }

    .invite-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0066CC;
      color: #FFFFFF;
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .invite-btn:hover {
      background: #0052A3;
    }

    .btn-icon {
      width: 13px;
      height: 13px;
      filter: brightness(0) invert(1);
    }

    .macos-stat-strip {
      display: inline-flex;
      align-items: center;
      gap: 16px;
      padding: 6px 14px;
      background: #F7F6F3;
      border: 1px solid #EDEDED;
      border-radius: 4px;
      width: fit-content;
      max-width: 100%;
      overflow-x: auto;
    }

    .stat-pill-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      white-space: nowrap;
    }

    .pill-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .pill-dot.blue { background: #0071E3; }
    .pill-dot.green { background: #34C759; }
    .pill-dot.sky { background: #5AC8FA; }
    .pill-dot.orange { background: #FF9500; }

    .pill-label {
      color: #86868B;
      font-weight: 500;
    }

    .pill-count {
      color: #1D1D1F;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .strip-sep {
      color: rgba(0, 0, 0, 0.15);
      font-size: 13px;
      user-select: none;
    }

    .table-container {
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .table-header-strip {
      padding: 18px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .table-title {
      font-size: 16px;
      font-weight: 700;
      margin: 0;
      color: #1D1D1F;
    }

    .table-badge {
      background: rgba(82, 126, 90, 0.12);
      color: #527E5A;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }

    .macos-empty-state {
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .macos-empty-icon {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: rgba(0, 0, 0, 0.03);
      color: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }

    .macos-empty-title {
      font-size: 15px;
      font-weight: 600;
      color: #1D1D1F;
      margin: 0;
      letter-spacing: -0.01em;
    }

    .macos-empty-text {
      font-size: 13px;
      color: #86868B;
      margin: 0;
      max-width: 380px;
      line-height: 1.45;
    }

    .macos-empty-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      background: #0071E3;
      color: #FFFFFF;
      border: none;
      padding: 8px 16px;
      border-radius: 980px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 113, 227, 0.25);
      transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .macos-empty-cta:hover {
      background: #0077ED;
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(0, 113, 227, 0.35);
    }

    .macos-empty-cta:active {
      transform: scale(0.96);
    }

    .table-scroll-wrap {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      display: block;
      min-height: 280px;
      padding-bottom: 75px;
      box-sizing: border-box;
    }

    .agencies-table {
      width: 100%;
      min-width: 640px;
      border-collapse: collapse;
      text-align: left;
    }

    .agencies-table th {
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: rgba(0, 0, 0, 0.6);
      background: rgba(0, 0, 0, 0.03, 0.6);
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    }

    .agencies-table td {
      padding: 14px 16px;
      font-size: 13px;
      color: #1D1D1F;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      vertical-align: middle;
    }

    .agencies-table tr:hover {
      background: rgba(0, 0, 0, 0.02);
    }

    .col-agency-main {
      text-align: left;
      padding-left: 20px !important;
      min-width: 200px;
    }

    .col-brand,
    .col-category,
    .col-creators-count,
    .col-status {
      text-align: left;
    }

    .col-spend {
      text-align: right;
      min-width: 90px;
    }

    .col-agency-actions {
      text-align: right;
      padding-right: 20px !important;
      min-width: 85px;
    }

    .agency-cell-flex {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .agency-badge-avatar {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      color: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
    }

    .agency-name {
      font-weight: 700;
      color: #1D1D1F;
    }

    .agency-email {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.6);
    }

    .partner-brand-pill {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      background: rgba(0, 0, 0, 0.08);
      border: 1px solid rgba(0, 0, 0, 0.14);
      color: #1D1D1F;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
    }

    .category-pill {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.12);
      color: #1D1D1F;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 600;
    }

    .nowrap-cell {
      white-space: nowrap;
    }

    .number-data {
      font-weight: 700;
    }

    .spend-data {
      font-weight: 700;
      color: #1D1D1F;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      background: rgba(0, 0, 0, 0.08);
      color: #1D1D1F;
    }

    .status-chip.active {
      background: rgba(82, 126, 90, 0.15);
      color: #527E5A;
    }

    .status-chip.pending {
      background: rgba(244, 218, 64, 0.35);
      color: #855A00;
    }

    .status-chip.deactivated {
      background: rgba(220, 86, 72, 0.15);
      color: #9B1C1C;
    }

    .actions-cell {
      white-space: nowrap;
    }

    .action-buttons-row {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      flex-wrap: nowrap;
      white-space: nowrap;
      padding: 3px;
      background: rgba(0, 0, 0, 0.03, 0.75);
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 10px;
    }

    .approve-agency-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      background: #527E5A;
      color: #FFFFFF;
      border: none;
      padding: 5px 10px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }

    .action-dropdown-container {
      position: relative;
      display: inline-block;
    }

    .btn-action-trigger {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background: #FFFFFF;
      color: #1D1D1F;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(18, 32, 68, 0.05);
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-action-trigger:hover {
      background: #FFFFFF;
      border-color: #0071E3;
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
    }

    .action-dropdown-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 5px);
      z-index: 1000;
      min-width: 175px;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.14);
      border-radius: 12px;
      box-shadow: 0 14px 34px rgba(18, 32, 68, 0.18);
      padding: 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      animation: menuPop 0.14s cubic-bezier(0.2, 1, 0.3, 1);
    }

    .action-dropdown-menu.drop-up {
      top: auto;
      bottom: calc(100% + 6px);
      transform-origin: bottom right;
    }

    @keyframes menuPop {
      from { opacity: 0; transform: scale(0.95) translateY(-4px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: transparent;
      border-radius: 8px;
      color: #0077ED;
      font-size: 12.5px;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.14s ease;
      text-align: left;
    }

    .dropdown-item:hover {
      background: #FFFFFF;
      color: #1D1D1F;
    }

    .dropdown-item.danger {
      color: #DC2626;
    }

    .dropdown-item.danger:hover {
      background: #FEF2F2;
      color: #B91C1C;
    }

    .dropdown-divider {
      height: 1px;
      background: rgba(0, 0, 0, 0.08);
      margin: 4px 6px;
    }

    .btn-row-action {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.12);
      color: #1D1D1F;
      padding: 5px 9px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .act-icon {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
    }

    .btn-row-action:hover:not(:disabled) {
      background: #0071E3;
      border-color: #0071E3;
      color: #FFFFFF;
    }

    .btn-row-action.warn:hover:not(:disabled) {
      background: #D97706;
      border-color: #D97706;
      color: #FFFFFF;
    }

    .btn-row-action.danger {
      color: #B91C1C;
      border-color: rgba(185, 28, 28, 0.18);
      background: #FFFBFB;
    }

    .btn-row-action.danger:hover:not(:disabled) {
      background: #B91C1C;
      border-color: #B91C1C;
      color: #FFFFFF;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .modal-card {
      background: #FFFFFF;
      border-radius: 16px;
      width: 100%;
      max-width: 440px;
      padding: 28px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .modal-head h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      color: #1D1D1F;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      color: rgba(0, 0, 0, 0.5);
    }

    .form-group {
      margin-bottom: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 12px;
      font-weight: 700;
      color: #1D1D1F;
    }

    .form-input {
      padding: 10px 14px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      font-family: inherit;
    }

    .form-input:focus {
      border-color: #0071E3;
    }

    select.form-input {
      padding-right: 38px !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23243F82' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") !important;
      background-repeat: no-repeat !important;
      background-position: right 14px center !important;
      appearance: none !important;
      -webkit-appearance: none !important;
      -moz-appearance: none !important;
      cursor: pointer;
      text-overflow: ellipsis;
      white-space: nowrap;
      background-color: #FFFFFF;
    }

    .agency-badge-avatar-img {
      width: 100%;
      height: 100%;
      border-radius: inherit;
      object-fit: cover;
    }

    /* Logo Auto-Fetch & Preview Styles */
    .website-input-row {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .website-input-row .form-input {
      flex: 1;
    }

    .btn-fetch-logo {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 42px;
      padding: 0 14px;
      background: #FFFFFF;
      border: 1.5px solid rgba(0, 0, 0, 0.22);
      border-radius: 8px;
      color: #1D1D1F;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.16s ease;
      flex-shrink: 0;
    }

    .btn-fetch-logo:hover {
      background: rgba(0, 0, 0, 0.06);
      border-color: #0071E3;
      transform: translateY(-1px);
    }

    .logo-preview-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding: 4px 10px 4px 6px;
      background: rgba(0, 0, 0, 0.06);
      border: 1px solid rgba(0, 0, 0, 0.14);
      border-radius: 999px;
      width: fit-content;
    }

    .preview-logo-thumb {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.1);
    }

    .preview-logo-text {
      font-size: 12px;
      font-weight: 600;
      color: #1D1D1F;
    }

    .btn-clear-logo {
      border: none;
      background: transparent;
      color: rgba(0, 0, 0, 0.6);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 0 2px;
      line-height: 1;
    }

    .btn-clear-logo:hover {
      color: #DC2626;
    }

    .modal-helper-note {
      margin: 4px 0 0 0;
      padding: 10px 12px;
      background: rgba(0, 0, 0, 0.05);
      border-radius: 8px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.8);
      line-height: 1.45;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 24px;
    }

    .btn-cancel {
      padding: 8px 16px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      background: transparent;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      color: #1D1D1F;
    }

    .btn-submit {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 22px;
      border: none;
      background: #0071E3;
      color: #FFFFFF;
      border-radius: 999px;
      font-size: 13.5px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-submit:hover:not(:disabled) {
      background: #0077ED;
      transform: translateY(-1.5px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    }

    .btn-submit:active:not(:disabled) {
      transform: scale(0.96) translateY(0);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .btn-submit:disabled {
      opacity: 0.75;
      cursor: not-allowed;
      transform: none !important;
    }

    .approve-agency-btn:disabled,
    .btn-row-action:disabled,
    .btn-submit:disabled,
    .btn-cancel:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-spinner {
      display: inline-block;
      width: 11px;
      height: 11px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #FFFFFF;
      border-radius: 50%;
      animation: agSpin 0.65s linear infinite;
      margin-right: 4px;
      vertical-align: middle;
    }

    .btn-spinner.dark {
      border-color: rgba(0, 0, 0, 0.25);
      border-top-color: #0071E3;
    }

    @keyframes agSpin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 900px) {
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .page-title {
        font-size: 24px;
      }
      .page-header {
        gap: 12px;
      }
      .modal-card {
        padding: 20px 16px;
        max-width: 95vw;
      }
    }
  `]
})
export class AgenciesComponent implements OnInit {
  private portalService = inject(PortalService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);

  agencies = this.portalService.agencies;
  brands = this.portalService.brands;
  overview = this.portalService.overview;

  activeCount = computed(() => this.agencies().filter(a => a.status === 'ACTIVE').length);
  totalCreatorsCount = computed(() => this.agencies().reduce((s, a) => s + (a.creatorsCount || 0), 0));
  totalSpend = computed(() => this.agencies().reduce((s, a) => s + (a.spend || 0), 0));

  formatInr(val: number | undefined | null): string {
    return Number(val || 0).toLocaleString('en-IN');
  }

  isAdmin = computed(() => this.authService.userRole() === 'SYSTEM_ADMIN');
  isBrandManager = computed(() => this.authService.userRole() === 'BRAND_MANAGER');

  readonly openMenuId = signal<number | null>(null);

  toggleActionMenu(id?: number, e?: Event) {
    if (e) e.stopPropagation();
    if (!id) return;
    this.openMenuId.update(curr => (curr === id ? null : id));
  }

  closeMenu() {
    this.openMenuId.set(null);
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.closeMenu();
  }

  openModal = false;
  openEditModal = false;
  isSubmitting = false;
  isSubmittingEdit = false;
  readonly processingAgencyId = signal<number | null>(null);
  readonly processingAgencyAction = signal<string>('');

  readonly primaryVerticals = [
    'Lifestyle & Wellness',
    'Fashion & Beauty',
    'Tech & Modern Work',
    'Creative & Culture',
    'Food & Beverage',
    'Retail & E-Commerce'
  ];

  brandSelectOptions = computed(() =>
    this.brands().map(b => ({ label: b.name, value: b.id }))
  );

  newAgencyName = '';
  newAgencyWebsiteUrl = '';
  newAgencyLogoUrl = '';
  newAgencyEmail = '';
  newAgencyBrandId: number | undefined = undefined;
  newAgencyCategory = 'Lifestyle & Wellness';

  editingAgencyId: number | null = null;
  editAgencyName = '';
  editAgencyWebsiteUrl = '';
  editAgencyLogoUrl = '';
  editAgencyEmail = '';
  editAgencyCategory = 'Lifestyle & Wellness';
  editAgencySpend = 0;

  extractDomain(url: string): string {
    if (!url) return '';
    return url.trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split('?')[0]
      .toLowerCase();
  }

  fetchAgencyLogo(target: 'new' | 'edit'): void {
    const url = target === 'new' ? this.newAgencyWebsiteUrl : this.editAgencyWebsiteUrl;
    const domain = this.extractDomain(url);
    if (!domain) {
      this.toast.info('Enter Website', 'Please enter a valid website URL first (e.g. elevate.agency)');
      return;
    }
    const logo = `https://unavatar.io/${domain}`;
    if (target === 'new') {
      this.newAgencyLogoUrl = logo;
    } else {
      this.editAgencyLogoUrl = logo;
    }
    this.toast.success('Logo Detected', `Agency logo successfully extracted for ${domain}`);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.openModal = false;
    this.openEditModal = false;
  }

  ngOnInit() {
    this.portalService.fetchAgencies().subscribe();
    this.portalService.fetchOverview().subscribe();
    if (this.portalService.fetchBrands) {
      this.portalService.fetchBrands().subscribe(list => {
        if (list && list.length > 0 && !this.newAgencyBrandId) {
          this.newAgencyBrandId = list[0].id;
        }
      });
    }
  }

  resolveBrandName(agency: Agency): string {
    if (agency.brandName && agency.brandName !== 'Current Workspace') {
      return agency.brandName;
    }
    if (agency.brandId) {
      const matched = this.brands().find(b => b.id === agency.brandId);
      if (matched) return matched.name;
    }
    if (this.brands().length > 0) {
      return this.brands()[0].name;
    }
    return 'Brand Workspace';
  }

  private isRestrictedEmail(email: string): boolean {
    const clean = email.trim().toLowerCase();
    const currentEmail = this.authService.currentUser()?.email?.trim().toLowerCase();
    return clean === 'chaitanyamandviya7@gmail.com' || (!!currentEmail && clean === currentEmail);
  }

  async approveAgency(agency: Agency) {
    if (!agency.id || this.processingAgencyId() === agency.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Approve Partner Agency?',
      message: `Approve "${agency.name}" and activate their Agency Partner Workspace?`,
      detail: `Manager: ${agency.email} · Partner Brand: ${this.resolveBrandName(agency)}`,
      confirmText: 'Approve Agency',
      variant: 'primary'
    });
    if (!confirmed) return;
    this.processingAgencyId.set(agency.id);
    this.processingAgencyAction.set('approve');
    this.portalService.approveAgency(agency.id).subscribe({
      next: () => {
        this.processingAgencyId.set(null);
        this.processingAgencyAction.set('');
        this.toast.success(
          'Agency Approved',
          `${agency.name} is now ACTIVE. Approval email sent to ${agency.email}.`
        );
      },
      error: (err) => {
        this.processingAgencyId.set(null);
        this.processingAgencyAction.set('');
        this.toast.error('Approval Failed', err.message || 'Could not approve agency.');
      }
    });
  }

  selectedAgencyForEdit: Agency | null = null;

  openEditAgency(agency: Agency) {
    this.selectedAgencyForEdit = agency;
    this.editingAgencyId = agency.id ?? null;
    this.editAgencyName = agency.name || '';
    this.editAgencyWebsiteUrl = agency.websiteUrl || '';
    this.editAgencyLogoUrl = agency.logoUrl || '';
    this.editAgencyEmail = agency.email || '';
    this.editAgencyCategory = agency.category || 'Lifestyle & Wellness';
    this.editAgencySpend = agency.spend || 0;
    this.openEditModal = true;
  }

  async submitEdit() {
    if (!this.editingAgencyId || !this.editAgencyName || !this.editAgencyEmail || this.isSubmittingEdit) return;
    if (this.isRestrictedEmail(this.editAgencyEmail)) {
      this.toast.error('Security Policy Violation', 'System Administrator or your own manager email cannot be assigned to an Agency.');
      return;
    }
    const confirmed = await this.confirmService.confirm({
      title: 'Confirm Agency Update?',
      message: `Save changes to "${this.editAgencyName}"?`,
      detail: `Email: ${this.editAgencyEmail} · Agreed Spend: ₹${(this.editAgencySpend || 0).toLocaleString('en-IN')}`,
      confirmText: 'Save Changes',
      variant: 'primary'
    });
    if (!confirmed) return;
    this.isSubmittingEdit = true;
    this.portalService.updateAgency(this.editingAgencyId, {
      name: this.editAgencyName,
      websiteUrl: this.editAgencyWebsiteUrl,
      logoUrl: this.editAgencyLogoUrl || undefined,
      email: this.editAgencyEmail,
      category: this.editAgencyCategory,
      spend: this.editAgencySpend
    }).subscribe({
      next: () => {
        this.isSubmittingEdit = false;
        this.openEditModal = false;
        this.toast.success('Agency Updated', `${this.editAgencyName} has been updated.`);
      },
      error: (err) => {
        this.isSubmittingEdit = false;
        this.toast.error('Update Failed', err.error?.message || err.message || 'Could not update agency.');
      }
    });
  }

  async toggleStatus(agency: Agency) {
    if (!agency.id || this.processingAgencyId() === agency.id) return;
    const nextStatus = agency.status === 'DEACTIVATED' ? 'ACTIVE' : 'DEACTIVATED';
    const confirmed = await this.confirmService.confirm({
      title: nextStatus === 'ACTIVE' ? 'Activate Partner Agency?' : 'Deactivate Partner Agency?',
      message: nextStatus === 'ACTIVE'
        ? `Re-enable workspace login for "${agency.name}"?`
        : `Suspend workspace access for "${agency.name}"?`,
      detail: `${agency.name} (${agency.email})`,
      confirmText: nextStatus === 'ACTIVE' ? 'Activate Agency' : 'Deactivate Agency',
      variant: nextStatus === 'ACTIVE' ? 'primary' : 'warning'
    });
    if (!confirmed) return;
    this.processingAgencyId.set(agency.id);
    this.processingAgencyAction.set('status');
    this.portalService.updateAgencyStatus(agency.id, nextStatus).subscribe({
      next: () => {
        this.processingAgencyId.set(null);
        this.processingAgencyAction.set('');
        this.toast.info(
          nextStatus === 'ACTIVE' ? 'Agency Activated' : 'Agency Deactivated',
          `${agency.name} status is now ${nextStatus}.`
        );
      },
      error: (err) => {
        this.processingAgencyId.set(null);
        this.processingAgencyAction.set('');
        this.toast.error('Status Error', err.message || 'Could not update agency status.');
      }
    });
  }

  async deleteAgency(agency: Agency) {
    if (!agency.id || this.processingAgencyId() === agency.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Permanently Delete Agency?',
      message: `Are you sure you want to remove "${agency.name}" from the workspace? This action cannot be undone.`,
      detail: `Agency: ${agency.name} · Manager: ${agency.email}`,
      confirmText: 'Delete Agency',
      variant: 'danger'
    });
    if (!confirmed) return;
    this.processingAgencyId.set(agency.id);
    this.processingAgencyAction.set('delete');
    this.portalService.deleteAgency(agency.id).subscribe({
      next: () => {
        this.processingAgencyId.set(null);
        this.processingAgencyAction.set('');
        this.toast.success('Agency Deleted', `${agency.name} has been removed.`);
      },
      error: (err) => {
        this.processingAgencyId.set(null);
        this.processingAgencyAction.set('');
        this.toast.error('Delete Failed', err.message || 'Could not delete agency.');
      }
    });
  }

  async resendInvite(agency: Agency) {
    if (!agency.id || this.processingAgencyId() === agency.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Send Invitation Email?',
      message: `Dispatch a Set-Initial-Password email link to "${agency.name}"?`,
      detail: `Recipient: ${agency.email}`,
      confirmText: 'Send Email',
      variant: 'primary'
    });
    if (!confirmed) return;
    this.processingAgencyId.set(agency.id);
    this.processingAgencyAction.set('mail');
    this.portalService.resendAgencyInvite(agency.id).subscribe({
      next: () => {
        this.processingAgencyId.set(null);
        this.processingAgencyAction.set('');
        this.toast.success(
          'Invitation Email Triggered',
          `Set-Initial-Password link sent to ${agency.email}.`
        );
      },
      error: (err) => {
        this.processingAgencyId.set(null);
        this.processingAgencyAction.set('');
        this.toast.error('Email Failed', err.message || 'Could not send invitation email.');
      }
    });
  }

  async submitInvite() {
    if (!this.newAgencyName || !this.newAgencyEmail) return;
    if (this.isRestrictedEmail(this.newAgencyEmail)) {
      this.toast.error('Security Policy Violation', 'System Administrator or your own manager email cannot be onboarded as an Agency.');
      return;
    }
    const selectedBrand = this.brands().find(b => b.id === this.newAgencyBrandId);
    const confirmed = await this.confirmService.confirm({
      title: 'Confirm Agency Invitation?',
      message: `Onboard "${this.newAgencyName}" and send a Set-Initial-Password invitation email?`,
      detail: `Email: ${this.newAgencyEmail} · Brand: ${selectedBrand?.name || 'Brand Workspace'}`,
      confirmText: 'Send Invitation',
      variant: 'primary'
    });
    if (!confirmed) return;
    this.isSubmitting = true;
    const name = this.newAgencyName;
    const email = this.newAgencyEmail;
    this.portalService.inviteAgency(
      this.newAgencyName,
      this.newAgencyEmail,
      this.newAgencyCategory,
      this.newAgencyWebsiteUrl,
      this.newAgencyBrandId,
      selectedBrand?.name,
      this.newAgencyLogoUrl || undefined
    )
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.openModal = false;
          this.toast.success('Agency Onboarded & Email Sent', `${name} added. Set-Initial-Password link sent to ${email}.`);
          this.newAgencyName = '';
          this.newAgencyWebsiteUrl = '';
          this.newAgencyLogoUrl = '';
          this.newAgencyEmail = '';
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toast.error('Invitation Failed', err.error?.message || err.message || 'Could not send agency invitation.');
        }
      });
  }
}
