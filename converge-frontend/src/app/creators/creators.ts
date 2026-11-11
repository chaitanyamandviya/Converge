import { Component, inject, OnInit, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PortalService, Creator } from '../services/portal.service';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';
import { CustomSelectComponent, SelectOption } from '../shared/custom-select/custom-select.component';

@Component({
  selector: 'app-creators',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, CustomSelectComponent],
  template: `
    <div class="creators-view">
      <!-- Page Header -->
      <header class="page-header">
        <div class="header-text">
          <h1 class="page-title">{{ isAgency() ? 'My Talent Roster' : 'Creators' }}</h1>
          <p class="page-subtitle">
            {{ isAdmin() ? 'Platform directory of rostered talent across partner agencies (View-only for System Admin).' : (isAgency() ? 'Onboard creators, attach Instagram content URLs, and manage final submission pricing.' : 'Directory of contracted talent and submitted deliverables across partner agencies.') }}
          </p>
        </div>
        @if (canAddCreator()) {
          <button type="button" class="add-creator-btn" (click)="openNewCreatorModal()">
            <img src="/assets/plus.svg" alt="" class="btn-icon" />
            <span>Onboard creator</span>
          </button>
        }
      </header>

      <!-- Agency Filter Tabs (Shown to Brand Manager / System Admin when filtering multiple agencies) -->
      @if (!isAgency() && filterTabs().length > 1) {
        <div class="tabs-bar">
          @for (tab of filterTabs(); track tab) {
            <button
              type="button"
              class="tab-btn"
              [class.active]="selectedTab() === tab"
              (click)="selectTab(tab)"
            >
              {{ tab }}
            </button>
          }
        </div>
      }

      <!-- Creators Table Container -->
      <section class="table-container">
        @if (filteredCreators().length === 0) {
          <div class="macos-empty-state">
            <div class="macos-empty-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h3 class="macos-empty-title">No Creators Rostered</h3>
            <p class="macos-empty-text">
              @if (isAdmin()) {
                No creators have been rostered yet across partner agencies.
              } @else {
                Fetch Instagram handles, attach deliverable URLs, and submit pricing models.
              }
            </p>
            @if (!isAdmin()) {
              <button type="button" class="macos-empty-cta" (click)="openNewCreatorModal()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Onboard Creator</span>
              </button>
            }
          </div>
        } @else {
          <div class="table-scroll-wrap">
            <table class="creators-table">
              <thead>
                <tr>
                  <th class="col-name">NAME</th>
                  <th class="col-type">TYPE</th>
                  <th class="col-agency">AGENCY</th>
                  <th class="col-actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                @for (creator of filteredCreators(); track creator.id || creator.handle; let idx = $index) {
                  <tr>
                    <td class="col-name">
                      <div class="creator-cell-flex">
                        <div class="creator-avatar-wrap">
                          @if (creator.avatarUrl && !failedAvatars()[creator.handle]) {
                            <img
                              [src]="creator.avatarUrl"
                              [alt]="creator.name"
                              class="creator-avatar-img"
                              (error)="markAvatarFailed(creator.handle)"
                            />
                          } @else {
                            <div class="creator-avatar">{{ creator.avatarInitials || 'CR' }}</div>
                          }
                        </div>
                        <div class="creator-identity">
                          <a [routerLink]="['/creators', creator.handle.replace('@', '')]" class="creator-name-link">
                            {{ creator.name }}
                          </a>
                          <div class="creator-sub-line">
                            <span class="creator-handle">{{ creator.handle }}</span>
                            @if (creator.followersCount) {
                              <span class="dot-sep">·</span>
                              <span class="followers-text">{{ formatFollowers(creator.followersCount) }} followers</span>
                            }
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="col-type nowrap-cell">
                      <span class="type-badge">{{ creator.category || 'Creator (Professional Account)' }}</span>
                    </td>
                    <td class="col-agency nowrap-cell">
                      <span class="agency-tag">{{ creator.agencyName || 'Partner Agency' }}</span>
                    </td>
                    <td class="col-actions actions-cell">
                      <div class="action-dropdown-container">
                        <button
                          type="button"
                          class="btn-action-trigger"
                          (click)="toggleActionMenu(creator.id, $event)"
                          title="Actions menu"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"/>
                            <circle cx="12" cy="12" r="2"/>
                            <circle cx="12" cy="19" r="2"/>
                          </svg>
                          <span>Actions</span>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="margin-left: 2px; opacity: 0.7;"><path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/></svg>
                        </button>
                        @if (openMenuId() === creator.id) {
                          <div
                            class="action-dropdown-menu"
                            [class.drop-up]="idx >= filteredCreators().length - 1 && filteredCreators().length > 2"
                            (click)="$event.stopPropagation()"
                          >
                            <a [routerLink]="['/creators', creator.handle.replace('@', '')]" class="dropdown-item" (click)="closeMenu()">
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8Z"/><circle cx="8" cy="8" r="2"/></svg>
                              <span>View Profile</span>
                            </a>
                            @if (canAddCreator()) {
                              <button type="button" class="dropdown-item" (click)="openEditCreator(creator); closeMenu()">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M11.333 2a1.886 1.886 0 0 1 2.667 2.667L4.667 14 2 14.667l.667-2.667L11.333 2Z"/></svg>
                                <span>Edit Details & URLs</span>
                              </button>
                              <div class="dropdown-divider"></div>
                              <button type="button" class="dropdown-item danger" (click)="deleteCreator(creator); closeMenu()">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2.5 4h11"/><path d="M5.5 4V2.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V4"/><path d="M4 4l.7 9.5a1.5 1.5 0 0 0 1.5 1.5h3.6a1.5 1.5 0 0 0 1.5-1.5L12 4"/></svg>
                                <span>Delete Creator</span>
                              </button>
                            }
                          </div>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <!-- Onboard / Edit Creator Modal Dialog -->
      @if (openModal) {
        <div class="modal-backdrop" (click)="openModal = false">
          <div class="modal-card" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <h3>{{ editingCreatorId ? 'Update Creator & Content URLs' : 'Onboard New Creator' }}</h3>
              <button type="button" class="close-btn" (click)="openModal = false">✕</button>
            </div>
            <form (ngSubmit)="submitCreator()" class="modal-form">
              <div class="modal-body-scroll">
                <!-- Handle Lookup Row with Live Profile Picture Preview -->
                <div class="form-group">
                  <label>Instagram Handle * {{ editingCreatorId ? '(Permanent)' : '' }}</label>
                  <div class="handle-lookup-row">
                    <div class="modal-avatar-preview">
                      @if (newCreatorAvatarUrl && !modalAvatarFailed()) {
                        <img [src]="newCreatorAvatarUrl" alt="" (error)="modalAvatarFailed.set(true)" />
                      } @else {
                        <span>{{ previewInitials() }}</span>
                      }
                    </div>
                    <input
                      type="text"
                      [(ngModel)]="newCreatorHandle"
                      name="handle"
                      required
                      [disabled]="!!editingCreatorId"
                      [class.input-locked]="!!editingCreatorId"
                      placeholder="e.g. @virat.kohli"
                      class="form-input handle-input"
                      (blur)="onCreatorHandleBlur()"
                    />
                    @if (editingCreatorId) {
                      <span class="locked-handle-badge" title="Handle is permanent and cannot be modified">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        <span>Locked</span>
                      </span>
                    } @else {
                      <button
                        type="button"
                        class="btn-fetch-handle"
                        [disabled]="isFetchingHandle() || !newCreatorHandle.trim()"
                        (click)="fetchHandleDetails()"
                      >
                        @if (isFetchingHandle()) {
                          <span class="btn-spinner dark"></span>
                          <span>Fetching...</span>
                        } @else {
                          <span>Fetch Details</span>
                        }
                      </button>
                    }
                  </div>
                  @if (editingCreatorId) {
                    <span class="field-hint-locked">Instagram handle is locked to protect historical deliverables and insight syncs.</span>
                  }
                  @if (handleVerificationError()) {
                    <div class="handle-error-banner">
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/><path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/></svg>
                      <span>{{ handleVerificationError() }}</span>
                    </div>
                  }
                </div>

                <div class="form-row-2">
                  <div class="form-group">
                    <label>Assign to Campaign</label>
                    <app-custom-select
                      [options]="campaignSelectOptions()"
                      [(ngModel)]="newCreatorCampaignId"
                      name="campaignId"
                      placeholder="Select Campaign"
                    ></app-custom-select>
                  </div>
                  @if (!isAgency()) {
                    <div class="form-group">
                      <label>Managing Agency</label>
                      <app-custom-select
                        [options]="agencySelectOptions()"
                        [(ngModel)]="newCreatorAgencyName"
                        name="agencyName"
                        placeholder="Select Managing Agency"
                      ></app-custom-select>
                    </div>
                  }
                </div>

                <div class="form-group" style="margin-bottom: 12px;">
                  <label>Pricing Structure *</label>
                  <div class="pricing-toggle-group">
                    <label class="pricing-radio-card" [class.selected]="newCreatorPricingModel === 'PER_DELIVERABLE'">
                      <input type="radio" name="newCreatorPricingModel" value="PER_DELIVERABLE" [(ngModel)]="newCreatorPricingModel" />
                      <div class="pricing-radio-content">
                        <strong class="pricing-radio-title">Per Deliverable (Itemized)</strong>
                        <span class="pricing-radio-desc">Cost is per reel/post. Total spend auto-sums all attached deliverables.</span>
                      </div>
                    </label>
                    <label class="pricing-radio-card" [class.selected]="newCreatorPricingModel === 'PACKAGE'">
                      <input type="radio" name="newCreatorPricingModel" value="PACKAGE" [(ngModel)]="newCreatorPricingModel" />
                      <div class="pricing-radio-content">
                        <strong class="pricing-radio-title">Package Deal (Fixed Retainer)</strong>
                        <span class="pricing-radio-desc">Total agreed contract fee for all deliverables combined.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div class="form-row-2">
                  <div class="form-group">
                    <label>Full Name *</label>
                    <input type="text" [(ngModel)]="newCreatorName" name="name" required placeholder="Auto-filled or enter full name" class="form-input" />
                  </div>
                  <div class="form-group">
                    <label>{{ newCreatorPricingModel === 'PACKAGE' ? 'Total Package Fee (₹) *' : 'Rate Per Deliverable (₹) *' }}</label>
                    <input type="number" min="0" [(ngModel)]="newCreatorRate" name="rate" required [placeholder]="newCreatorPricingModel === 'PACKAGE' ? 'e.g. 50000 (total for all posts)' : 'e.g. 10000 (per post)'" class="form-input" />
                  </div>
                </div>

                @if (newCreatorPricingModel === 'PER_DELIVERABLE') {
                  <div class="form-row-2 rate-range-section">
                    <div class="form-group">
                      <label>Min Rate Allowed (₹) <span class="opt-label">(Optional)</span></label>
                      <input
                        type="number"
                        min="0"
                        [(ngModel)]="newCreatorMinPrice"
                        name="minPrice"
                        placeholder="e.g. 2000"
                        class="form-input"
                      />
                      <span class="field-hint-mini">Minimum acceptable deliverable price</span>
                    </div>
                    <div class="form-group">
                      <label>Max Rate Allowed (₹) <span class="opt-label">(Optional)</span></label>
                      <input
                        type="number"
                        min="0"
                        [(ngModel)]="newCreatorMaxPrice"
                        name="maxPrice"
                        placeholder="e.g. 5000"
                        class="form-input"
                      />
                      <span class="field-hint-mini">Maximum acceptable deliverable price</span>
                    </div>
                  </div>
                  @if (newCreatorMinPrice && newCreatorMaxPrice && newCreatorMinPrice > newCreatorMaxPrice) {
                    <div class="range-warning-box">
                      ⚠️ Minimum rate (₹{{ newCreatorMinPrice | number }}) cannot exceed maximum rate (₹{{ newCreatorMaxPrice | number }}).
                    </div>
                  }
                }

                <!-- Multi-Slot Content Deliverable URLs (Unlimited — No 2-Slot Cap) -->
                <div class="form-group content-urls-group">
                  <div class="urls-header-row">
                    <label>Campaign Content Deliverable URLs (Instagram Reels / Posts)</label>
                    <button type="button" class="btn-add-url-slot" (click)="addContentUrlSlot()">
                      + Add another URL
                    </button>
                  </div>
                  <div class="urls-list">
                    @for (url of newContentUrls; track $index) {
                      <div class="url-slot-row">
                        <input
                          type="url"
                          [(ngModel)]="newContentUrls[$index]"
                          [name]="'contentUrl_' + $index"
                          placeholder="https://www.instagram.com/reel/..."
                          class="form-input url-slot-input"
                        />
                        @if (newContentUrls.length > 1) {
                          <button type="button" class="btn-remove-url" (click)="removeContentUrlSlot($index)" title="Remove URL">
                            ✕
                          </button>
                        }
                      </div>
                    }
                  </div>
                  <span class="field-hint">Add as many deliverable post/reel URLs as needed—each URL is automatically synced to the Content Library.</span>
                </div>
              </div>

              <div class="modal-actions">
                <button type="button" class="btn-cancel" [disabled]="isSubmitting" (click)="openModal = false">Cancel</button>
                <button type="submit" class="btn-submit" [disabled]="isSubmitting">
                  @if (isSubmitting) {
                    <span class="btn-spinner"></span>
                    <span>{{ editingCreatorId ? 'Updating Creator...' : 'Submitting Creator...' }}</span>
                  } @else {
                    <span>{{ editingCreatorId ? 'Update Creator' : 'Submit Creator' }}</span>
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
    .creators-view {
      display: flex;
      flex-direction: column;
      gap: 24px;
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
      font-size: 28px;
      font-weight: 800;
      color: #1D1D1F;
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 14px;
      color: rgba(0, 0, 0, 0.7);
      margin: 0;
      line-height: 1.45;
    }

    .add-creator-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #0071E3;
      color: #FFFFFF;
      border: none;
      padding: 10px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .add-creator-btn:hover {
      background: #0077ED;
      transform: translateY(-1px);
    }

    .btn-icon {
      width: 14px;
      height: 14px;
      filter: brightness(0) invert(1);
    }

    .tabs-bar {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
      padding-bottom: 12px;
      overflow-x: auto;
      width: 100%;
      box-sizing: border-box;
    }

    .tab-btn {
      background: transparent;
      border: 1px solid rgba(0, 0, 0, 0.15);
      color: rgba(0, 0, 0, 0.7);
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .tab-btn:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #1D1D1F;
    }

    .tab-btn.active {
      background: #0071E3;
      color: #FFFFFF;
      border-color: #0071E3;
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

    .creators-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
    }

    .creators-table th {
      padding: 12px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: rgba(0, 0, 0, 0.6);
      background: rgba(0, 0, 0, 0.03, 0.6);
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      white-space: nowrap;
    }

    .creators-table td {
      padding: 13px 14px;
      font-size: 13px;
      color: #1D1D1F;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      vertical-align: middle;
    }

    .creators-table tr:hover {
      background: rgba(0, 0, 0, 0.02);
    }

    .nowrap-cell {
      white-space: nowrap;
    }

    /* Clean 4-Column Layout: Name, Type, Agency, Actions */
    .col-name {
      text-align: left;
      padding-left: 24px !important;
      width: 42%;
      min-width: 220px;
    }

    .col-type {
      text-align: left;
      width: 28%;
      min-width: 150px;
    }

    .col-agency {
      text-align: left;
      width: 20%;
      min-width: 130px;
    }

    .col-actions {
      text-align: right;
      padding-right: 24px !important;
      width: 10%;
      min-width: 100px;
    }

    .type-badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(0, 0, 0, 0.05);
      color: #1D1D1F;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    .agency-tag {
      display: inline-block;
      padding: 4px 12px;
      background: #f8fafc;
      color: #334155;
      border: 1px solid #cbd5e1;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }

    .creator-cell-flex {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .creator-avatar-wrap {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      flex-shrink: 0;
      overflow: hidden;
      border: 2px solid rgba(0, 0, 0, 0.12);
      background: #0071E3;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .creator-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .creator-avatar {
      color: #FFFFFF;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.02em;
    }

    .creator-identity {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .creator-name-link {
      font-weight: 700;
      font-size: 14px;
      color: #1D1D1F;
      text-decoration: none;
      white-space: nowrap;
    }

    .creator-name-link:hover {
      text-decoration: underline;
    }

    .creator-sub-line {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      font-size: 11.5px;
    }

    .creator-handle {
      color: #3D5EAB;
      font-weight: 600;
    }

    .dot-sep {
      color: rgba(0, 0, 0, 0.35);
    }

    .category-text {
      color: rgba(0, 0, 0, 0.58);
    }

    .followers-text {
      color: #1D1D1F;
      font-weight: 700;
    }

    .tier-chip {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 2px 6px;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.08);
      color: #1D1D1F;
      border: 1px solid rgba(0, 0, 0, 0.14);
    }

    .agency-tag {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      background: rgba(0, 0, 0, 0.06);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }

    .slot-pill {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.12);
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 11.5px;
    }

    .number-data {
      font-weight: 700;
    }

    .price-data {
      font-weight: 800;
      color: #527E5A;
      font-size: 13.5px;
    }

    .actions-cell {
      white-space: nowrap;
      text-align: right;
      position: relative;
    }

    .action-dropdown-container {
      position: relative;
      display: inline-block;
    }

    .btn-action-trigger {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.18);
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

    .btn-action-trigger:active {
      transform: scale(0.96) translateY(0);
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

    .handle-error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: 8px;
      color: #B91C1C;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
    }

    /* Modal styling */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(18, 32, 68, 0.48);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 100;
    }

    .modal-card {
      background: #FFFFFF;
      border-radius: 18px;
      width: 100%;
      max-width: 580px;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 20px 48px rgba(18, 32, 68, 0.24);
      box-sizing: border-box;
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      margin-bottom: 0;
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

    .modal-form {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
    }

    .modal-body-scroll {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden !important;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      box-sizing: border-box;
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 0, 0, 0.22) transparent;
    }

    .modal-body-scroll::-webkit-scrollbar {
      width: 6px;
    }

    .modal-body-scroll::-webkit-scrollbar-track {
      background: transparent;
    }

    .modal-body-scroll::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.22);
      border-radius: 999px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .pricing-toggle-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 4px;
    }

    .pricing-radio-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 9px;
      border: 1.5px solid rgba(0, 0, 0, 0.18);
      background: #FFFFFF;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .pricing-radio-card:hover {
      border-color: #0071E3;
      background: rgba(0, 0, 0, 0.02);
    }

    .pricing-radio-card.selected {
      border-color: #0071E3;
      background: rgba(0, 0, 0, 0.05);
      box-shadow: 0 0 0 1px #0071E3;
    }

    .pricing-radio-card input {
      margin-top: 3px;
      accent-color: #1D1D1F;
    }

    .pricing-radio-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .pricing-radio-title {
      font-size: 12px;
      font-weight: 700;
      color: #1D1D1F;
    }

    .pricing-radio-desc {
      font-size: 11px;
      color: #64748B;
      line-height: 1.35;
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 12px;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
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
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .form-input:focus {
      border-color: #0071E3;
    }

    .form-input.input-locked,
    .form-input:disabled {
      background: rgba(0, 0, 0, 0.05) !important;
      color: #475569 !important;
      border-color: rgba(0, 0, 0, 0.16) !important;
      cursor: not-allowed;
      font-weight: 600;
    }

    .locked-handle-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 8px 14px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.08);
      color: #1D1D1F;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid rgba(0, 0, 0, 0.15);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .field-hint-locked {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.7);
      margin-top: 3px;
      display: block;
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

    .handle-lookup-row {
      display: flex;
      gap: 10px;
      align-items: center;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .modal-avatar-preview {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #0071E3;
      color: #FFFFFF;
      font-size: 12px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      border: 2px solid rgba(0, 0, 0, 0.15);
    }

    .modal-avatar-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .handle-input {
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
    }

    .btn-fetch-handle {
      height: 40px;
      padding: 0 14px;
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.25);
      background: #FFFFFF;
      color: #1D1D1F;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .btn-fetch-handle:hover:not(:disabled) {
      background: #0071E3;
      color: #FFFFFF;
      border-color: #0071E3;
    }

    .content-urls-group {
      background: rgba(0, 0, 0, 0.03, 0.55);
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 12px;
      padding: 14px;
    }

    .rate-range-section {
      background: rgba(0, 0, 0, 0.03);
      border: 1px dashed rgba(0, 0, 0, 0.18);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 8px;
    }

    .opt-label {
      font-size: 10px;
      font-weight: 500;
      color: #64748B;
    }

    .field-hint-mini {
      font-size: 10.5px;
      color: #64748B;
      margin-top: 3px;
      display: block;
    }

    .range-warning-box {
      font-size: 11.5px;
      font-weight: 600;
      color: #B45309;
      background: #FEF3C7;
      border: 1px solid #FCD34D;
      border-radius: 6px;
      padding: 6px 10px;
      margin-top: 4px;
    }

    .urls-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }

    .btn-add-url-slot {
      background: #FFFFFF;
      border: 1px solid rgba(0, 0, 0, 0.22);
      color: #1D1D1F;
      font-size: 11.5px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 999px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
    }

    .btn-add-url-slot:hover {
      background: #0071E3;
      color: #FFFFFF;
    }

    .urls-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .url-slot-row {
      display: flex;
      gap: 8px;
      align-items: center;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }

    .url-slot-input {
      flex: 1;
      min-width: 0;
      box-sizing: border-box;
      background: #FFFFFF;
    }

    .btn-remove-url {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid rgba(185, 28, 28, 0.2);
      background: #FFF5F5;
      color: #B91C1C;
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .field-hint {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.6);
      margin-top: 2px;
    }

    .btn-fetch-handle:disabled,
    .btn-submit:disabled,
    .btn-cancel:disabled,
    .btn-row-action:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: #FAFAFB;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      margin-top: 0;
    }

    .btn-cancel {
      padding: 9px 16px;
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
      position: relative;
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

    .btn-fetch-handle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid rgba(0, 0, 0, 0.25);
      background: #FFFFFF;
      color: #1D1D1F;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .btn-fetch-handle:hover:not(:disabled) {
      background: #FFFFFF;
      border-color: #0071E3;
      transform: translateY(-1px);
    }

    .btn-fetch-handle:active:not(:disabled) {
      transform: scale(0.96) translateY(0);
    }

    .btn-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2.2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #FFFFFF;
      border-radius: 50%;
      animation: btnSpin 0.65s linear infinite;
      flex-shrink: 0;
    }

    .btn-spinner.dark {
      border-color: rgba(0, 0, 0, 0.25);
      border-top-color: #0071E3;
    }

    @keyframes btnSpin {
      to { transform: rotate(360deg); }
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
      .form-row-2 {
        grid-template-columns: 1fr;
        gap: 8px;
      }
    }
  `]
})
export class CreatorsComponent implements OnInit {
  private portalService = inject(PortalService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);

  creators = this.portalService.creators;
  agencies = this.portalService.agencies;
  campaigns = this.portalService.campaigns;
  isAgency = computed(() => this.authService.userRole() === 'AGENCY_MANAGER');
  isAdmin = computed(() => this.authService.userRole() === 'SYSTEM_ADMIN');
  canAddCreator = computed(() => !this.isAdmin());

  campaignSelectOptions = computed<SelectOption[]>(() => [
    { label: 'General Workspace (All Campaigns)', value: null },
    ...this.campaigns().map(c => ({
      label: `${c.name}${c.timeframe ? ' (' + c.timeframe + ')' : ''}`,
      value: c.id
    }))
  ]);

  agencySelectOptions = computed<SelectOption[]>(() => [
    { label: 'Partner Agency (Direct Onboard)', value: 'Partner Agency' },
    ...this.agencies().map(a => ({
      label: a.name,
      value: a.name
    }))
  ]);

  filterTabs = computed(() => ['All', ...this.agencies().map(a => a.name)]);
  selectedTab = signal<string>('All');

  openModal = false;
  isSubmitting = false;
  editingCreatorId: number | null = null;
  readonly isFetchingHandle = signal(false);
  readonly processingCreatorId = signal<number | null>(null);
  readonly failedAvatars = signal<Record<string, boolean>>({});
  readonly modalAvatarFailed = signal(false);
  readonly openMenuId = signal<number | null>(null);
  readonly handleVerificationError = signal<string | null>(null);
  readonly isHandleVerified = signal<boolean>(false);

  newCreatorName = '';
  newCreatorHandle = '';
  newCreatorCategory = 'Creator (Professional Account)';
  newCreatorRate = 0;
  newCreatorPricingModel = 'PER_DELIVERABLE';
  newCreatorProfileUrl = '';
  newCreatorAvatarUrl = '';
  newCreatorCampaignId: number | null = null;
  newCreatorAgencyName = 'Partner Agency';
  newContentUrls: string[] = [''];

  previewInitials = computed(() => {
    const src = this.newCreatorName.trim() || this.newCreatorHandle.replace('@', '').trim();
    if (!src) return 'CR';
    const parts = src.split(/[\s._-]+/).filter(Boolean);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : src.substring(0, 2).toUpperCase();
  });

  formatFollowers(count: number): string {
    if (!count) return '0';
    if (count >= 1000000) return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return count.toLocaleString('en-IN');
  }

  formatInr(val: number | undefined | null): string {
    return Number(val || 0).toLocaleString('en-IN');
  }

  getTier(creator: Creator): string {
    if (creator.tier && creator.tier !== 'Auto') return creator.tier;
    const f = creator.followersCount || 0;
    if (f >= 1000000) return 'Mega';
    if (f >= 500000) return 'Macro';
    if (f >= 100000) return 'Mid-Tier';
    if (f >= 10000) return 'Micro';
    return 'Nano';
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.openModal = false;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  toggleActionMenu(id: number | undefined, event: MouseEvent): void {
    event.stopPropagation();
    this.openMenuId.update(curr => (curr === id ? null : (id ?? null)));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  ngOnInit() {
    this.portalService.fetchCreators().subscribe();
    this.portalService.fetchAgencies().subscribe();
    this.portalService.fetchCampaigns().subscribe();
  }

  markAvatarFailed(handle: string) {
    this.failedAvatars.update(prev => ({ ...prev, [handle]: true }));
  }

  formatDeliverablesLabel(slots?: string): string {
    if (!slots || slots === '0 / 2' || slots === '1 / 1') {
      return '0 posts';
    }
    return slots;
  }

  newCreatorMinPrice: number | null = null;
  newCreatorMaxPrice: number | null = null;

  openNewCreatorModal() {
    this.editingCreatorId = null;
    this.newCreatorName = '';
    this.newCreatorHandle = '';
    this.newCreatorCategory = 'Creator (Professional Account)';
    this.newCreatorRate = 0;
    this.newCreatorMinPrice = null;
    this.newCreatorMaxPrice = null;
    this.newCreatorPricingModel = 'PER_DELIVERABLE';
    this.newCreatorProfileUrl = '';
    this.newCreatorAvatarUrl = '';
    this.newCreatorCampaignId = null;
    this.newCreatorAgencyName = 'Partner Agency';
    this.newContentUrls = [''];
    this.modalAvatarFailed.set(false);
    this.handleVerificationError.set(null);
    this.isHandleVerified.set(false);
    this.openModal = true;
  }

  openEditCreator(creator: Creator) {
    this.editingCreatorId = creator.id ?? null;
    this.newCreatorName = creator.name || '';
    this.newCreatorHandle = creator.handle || '';
    this.newCreatorCategory = creator.category || 'Creator (Professional Account)';
    this.newCreatorRate = creator.price || 0;
    this.newCreatorMinPrice = creator.minPrice ?? null;
    this.newCreatorMaxPrice = creator.maxPrice ?? null;
    this.newCreatorPricingModel = creator.pricingModel || 'PER_DELIVERABLE';
    this.newCreatorProfileUrl = creator.profileUrl || '';
    this.newCreatorAvatarUrl = creator.avatarUrl || `https://unavatar.io/instagram/${creator.handle.replace('@', '')}`;
    this.newCreatorCampaignId = creator.campaignId ?? null;
    this.newCreatorAgencyName = creator.agencyName || 'Partner Agency';
    this.newContentUrls = [''];
    this.modalAvatarFailed.set(false);
    this.handleVerificationError.set(null);
    this.isHandleVerified.set(true);
    this.openModal = true;
  }

  addContentUrlSlot() {
    this.newContentUrls = [...this.newContentUrls, ''];
  }

  removeContentUrlSlot(index: number) {
    if (this.newContentUrls.length > 1) {
      this.newContentUrls = this.newContentUrls.filter((_, idx) => idx !== index);
    }
  }

  selectTab(tab: string) {
    this.selectedTab.set(tab);
    if (tab === 'All') {
      this.portalService.fetchCreators().subscribe();
    } else {
      this.portalService.fetchCreators(tab).subscribe();
    }
  }

  filteredCreators() {
    const tab = this.selectedTab();
    if (tab === 'All') return this.creators();
    return this.creators().filter(c => c.agencyName?.toLowerCase() === tab.toLowerCase());
  }

  onCreatorHandleBlur() {
    if (this.newCreatorHandle.trim().length >= 2) {
      this.fetchHandleDetails();
    }
  }

  fetchHandleDetails() {
    const raw = this.newCreatorHandle.trim();
    if (!raw || this.isFetchingHandle()) return;
    this.isFetchingHandle.set(true);
    this.modalAvatarFailed.set(false);
    this.handleVerificationError.set(null);
    this.isHandleVerified.set(false);

    this.portalService.lookupCreatorByHandle(raw, undefined, false).subscribe({
      next: (creator) => {
        this.isFetchingHandle.set(false);
        this.isHandleVerified.set(true);
        this.handleVerificationError.set(null);
        this.newCreatorHandle = creator.handle;
        if (creator.name && (!this.newCreatorName || !this.editingCreatorId)) {
          this.newCreatorName = creator.name;
        }
        if (creator.category) this.newCreatorCategory = creator.category;
        if (creator.profileUrl) this.newCreatorProfileUrl = creator.profileUrl;
        if (creator.avatarUrl) this.newCreatorAvatarUrl = creator.avatarUrl;
        if (creator.price > 0 && !this.newCreatorRate) this.newCreatorRate = creator.price;
        this.toast.info('Verified Instagram Profile', `Found ${creator.name} (${creator.handle}) on Instagram.`);
      },
      error: (err) => {
        this.isFetchingHandle.set(false);
        this.isHandleVerified.set(false);
        const msg = err.error?.message || err.message || `Instagram account '${raw}' does not exist. Please check the handle.`;
        this.handleVerificationError.set(msg);
        this.toast.error('Account Not Found', msg);
      }
    });
  }

  async deleteCreator(creator: Creator) {
    if (!creator.id || this.processingCreatorId() === creator.id) return;
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Creator from Roster?',
      message: `Are you sure you want to remove "${creator.name}" (${creator.handle}) and their recorded deliverables?`,
      detail: `Creator: ${creator.name} · Final Price: ₹${(creator.price || 0).toLocaleString('en-IN')}`,
      confirmText: 'Delete Creator',
      variant: 'danger'
    });
    if (!confirmed) return;

    this.processingCreatorId.set(creator.id);
    this.portalService.deleteCreator(creator.id).subscribe({
      next: () => {
        this.processingCreatorId.set(null);
        this.toast.success('Creator Removed', `${creator.name} (${creator.handle}) has been deleted.`);
      },
      error: (err) => {
        this.processingCreatorId.set(null);
        this.toast.error('Delete Failed', err.error?.message || err.message || 'Could not delete creator.');
      }
    });
  }

  async submitCreator() {
    if (!this.newCreatorName.trim() || !this.newCreatorHandle.trim() || this.isSubmitting) return;

    if (this.handleVerificationError()) {
      this.toast.error('Invalid Instagram Handle', this.handleVerificationError()!);
      return;
    }

    if (this.newCreatorPricingModel === 'PER_DELIVERABLE' && this.newCreatorMinPrice && this.newCreatorMaxPrice && this.newCreatorMinPrice > this.newCreatorMaxPrice) {
      this.toast.error('Invalid Rate Range', 'Minimum rate cannot exceed maximum rate.');
      return;
    }

    const cleanUrls = this.newContentUrls.map(u => u.trim()).filter(Boolean);
    const isEditing = !!this.editingCreatorId;

    const rateLabel = this.newCreatorPricingModel === 'PACKAGE' ? 'Total Package Fee' : 'Rate Per Deliverable';
    const rangeDetail = this.newCreatorPricingModel === 'PER_DELIVERABLE' && (this.newCreatorMinPrice || this.newCreatorMaxPrice)
      ? ` · Rate Range: ₹${(this.newCreatorMinPrice || 0).toLocaleString('en-IN')} – ${this.newCreatorMaxPrice ? '₹' + this.newCreatorMaxPrice.toLocaleString('en-IN') : '∞'}`
      : '';

    const confirmed = await this.confirmService.confirm({
      title: isEditing ? 'Confirm Creator Update?' : 'Confirm Creator Submission?',
      message: isEditing
        ? `Save updated details and content URLs for "${this.newCreatorName.trim()}" (${this.newCreatorHandle.trim()})?`
        : `Onboard "${this.newCreatorName.trim()}" (${this.newCreatorHandle.trim()}) into the campaign roster?`,
      detail: `${rateLabel}: ₹${(this.newCreatorRate || 0).toLocaleString('en-IN')}${rangeDetail} · Content URLs attached: ${cleanUrls.length}`,
      confirmText: isEditing ? 'Update Creator' : 'Submit Creator',
      variant: 'primary'
    });
    if (!confirmed) return;

    this.isSubmitting = true;
    const cleanHandle = this.newCreatorHandle.trim().startsWith('@')
      ? this.newCreatorHandle.trim()
      : `@${this.newCreatorHandle.trim()}`;
    const username = cleanHandle.replace(/^@+/, '');

    const matchedCamp = this.newCreatorCampaignId
      ? this.campaigns().find(c => c.id === this.newCreatorCampaignId)
      : null;

    const payload: Partial<Creator> = {
      name: this.newCreatorName.trim(),
      handle: cleanHandle,
      agencyName: this.newCreatorAgencyName || 'Partner Agency',
      campaignId: this.newCreatorCampaignId || undefined,
      campaignName: matchedCamp ? matchedCamp.name : undefined,
      avatarInitials: this.previewInitials(),
      avatarUrl: this.newCreatorAvatarUrl || `https://unavatar.io/instagram/${username}`,
      category: this.newCreatorCategory || 'Lifestyle & Wellness',
      price: this.newCreatorRate || 0,
      minPrice: this.newCreatorPricingModel === 'PER_DELIVERABLE' && this.newCreatorMinPrice ? this.newCreatorMinPrice : undefined,
      maxPrice: this.newCreatorPricingModel === 'PER_DELIVERABLE' && this.newCreatorMaxPrice ? this.newCreatorMaxPrice : undefined,
      pricingModel: this.newCreatorPricingModel,
      platform: 'Instagram',
      profileUrl: this.newCreatorProfileUrl || `https://www.instagram.com/${username}`,
      contentUrls: cleanUrls
    };

    const request$ = isEditing && this.editingCreatorId
      ? this.portalService.updateCreator(this.editingCreatorId, payload)
      : this.portalService.addCreator(payload);

    request$.subscribe({
      next: (saved) => {
        this.isSubmitting = false;
        this.openModal = false;
        this.toast.success(
          isEditing ? 'Creator Updated' : 'Creator Onboarded',
          `${saved.name} (${saved.handle}) saved with final price ₹${(saved.price || 0).toLocaleString('en-IN')}.`
        );
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toast.error('Submission Failed', err.error?.message || err.message || 'Could not save creator.');
      }
    });
  }
}
