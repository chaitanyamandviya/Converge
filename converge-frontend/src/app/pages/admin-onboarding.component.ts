import { Component, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiService, Brand } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { DashboardExitAware, DashboardExitController } from '../services/auth.guard';
import { ConfirmModalComponent } from '../components/confirm-modal.component';
import { AppHeaderComponent } from '../components/app-header.component';
import { AppFooterComponent } from '../components/app-footer.component';
import { ThemeToggleComponent } from '../components/theme-toggle.component';
import {
  CountryPickerComponent,
  enforcePhoneKeydown,
  findCountryByIso,
  validatePhoneDigits
} from '../components/country-picker.component';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

@Component({
  selector: 'app-admin-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent, AppHeaderComponent, AppFooterComponent, CountryPickerComponent, ThemeToggleComponent],
  template: `
    <div class="bg-cv-canvas font-body text-cv-ink antialiased min-h-screen flex flex-col overflow-x-clip selection:bg-[#f54e26]/25 selection:text-cv-ink">
      <!-- Fixed Top Header -->
      <app-header [elevated]="true" brandLink="/admin">
        <div header-right class="flex items-center gap-2.5 shrink-0">
          <app-theme-toggle />
          <button type="button" (click)="showSignOutConfirm.set(true)"
                  class="h-8.5 px-4 rounded-[4px] bg-cv-ink hover:bg-[#f54e26] text-cv-ink-inverse hover:text-[#111111] border-2 border-[#111111] shadow-[2px_2px_0px_#f54e26] hover:shadow-[2px_2px_0px_var(--cv-shadow-ink)] active:translate-x-[1px] active:translate-y-[1px] inline-flex items-center gap-1.5 font-headline uppercase tracking-[0.04em] text-sm font-bold cursor-pointer whitespace-nowrap transition-all">
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter">
              <path d="M11 4H5v16h6"/>
              <path d="M10 12h10"/>
              <path d="M16 8l4 4-4 4"/>
            </svg>
            <span>SIGN OUT</span>
          </button>
        </div>
      </app-header>

      <main class="w-full bg-cv-canvas flex-1">
        <div class="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-5 lg:py-6">
          <!-- Page Title + Even Stats Strip -->
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 mb-5 border-b border-cv-border animate-fade-in-up">
            <div class="min-w-0">
              <h1 class="font-headline uppercase text-3xl sm:text-4xl lg:text-[2.75rem] font-bold text-cv-ink tracking-[0.01em] leading-none">
                BRAND REGISTRY <span class="text-[#f54e26]">&amp; ONBOARDING</span>
              </h1>
              <p class="mt-2 text-sm text-cv-ink-muted">
                Set up brand workspaces and assign brand managers.
              </p>
            </div>

            <div class="grid grid-cols-3 divide-x divide-cv-divide rounded-[4px] bg-cv-card border border-cv-border w-full md:w-auto shrink-0 tabular-nums">
              <div class="px-4 py-2">
                <span class="block text-[11px] text-cv-ink-muted">Active</span>
                <span class="font-headline text-2xl font-bold text-cv-green leading-none">{{ activeCount() }}</span>
              </div>
              <div class="px-4 py-2">
                <span class="block text-[11px] text-cv-ink-muted">Drafts</span>
                <span class="font-headline text-2xl font-bold text-cv-gold leading-none">{{ draftCount() }}</span>
              </div>
              <div class="px-4 py-2">
                <span class="block text-[11px] text-cv-ink-muted">Total</span>
                <span class="font-headline text-2xl font-bold text-cv-ink leading-none">{{ brands().length }}</span>
              </div>
            </div>
          </div>

          <!-- Aligned Two-Column Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start lg:items-stretch animate-fade-in-up">
            <!-- Left Column: Brand Onboarding Form -->
            <section
              class="lg:col-span-7 flex flex-col bg-cv-card rounded-[6px] border border-cv-border p-5 relative transition-all duration-300"
              [class.animate-shake]="shakeForm()">
              <div class="flex items-center justify-between gap-3 pb-3.5 mb-4 border-b border-cv-border-soft">
                <h2 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.02em] leading-none">NEW BRAND WORKSPACE</h2>
              </div>

              @if (banner(); as msg) {
                <div
                  class="mb-4 px-3.5 py-2.5 rounded-[4px] border text-xs font-medium flex items-center justify-between gap-2 animate-pop-in"
                  [ngClass]="msg.type === 'error'
                    ? 'bg-cv-danger-bg border-[#ff5c5c]/40 text-cv-danger-ink'
                    : 'bg-cv-success-bg border-[#007656] text-cv-success-ink'">
                  <div class="flex items-center gap-2 min-w-0">
                    <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      @if (msg.type === 'error') {
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M12 8v4"/>
                        <circle cx="12" cy="16" r="0.6" fill="currentColor"/>
                      } @else {
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M8.5 12.5l2.5 2.5 4.5-5" class="doodle-check-path"/>
                      }
                    </svg>
                    <span class="leading-snug">{{ msg.text }}</span>
                  </div>
                  <button type="button" (click)="banner.set(null)" aria-label="Dismiss message" class="opacity-70 hover:opacity-100 cursor-pointer shrink-0 p-0.5">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
                  </button>
                </div>
              }

              <form (ngSubmit)="submitBrand('ACTIVE')" novalidate class="flex-1 flex flex-col justify-between gap-4">
                <div class="flex flex-col gap-4">
                  <!-- Row 1: Brand Org + Manager Name -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center justify-between h-4">
                        <label for="brand-org" class="text-xs text-cv-ink font-medium">Brand organization name</label>
                        @if ((brandTouched() || brandDuplicate()) && brandError()) {
                          <span class="text-xs text-cv-red-soft font-medium">{{ brandError() }}</span>
                        }
                      </div>
                      <div
                        class="group flex items-center gap-2.5 px-3 h-10 rounded-[4px] bg-cv-well border transition-colors duration-150"
                        [ngClass]="(brandTouched() || brandDuplicate()) && brandError()
                          ? 'border-[#ff5c5c]'
                          : (brandValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                        <svg class="doodle-svg w-4 h-4 shrink-0"
                             [ngClass]="(brandTouched() || brandDuplicate()) && brandError() ? 'text-[#ff5c5c]' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]'"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="4" y="4.5" width="16" height="15" rx="2.5"/>
                          <path d="M9 9h2M13 9h2M9 13h2M13 13h2M10 19.5v-3h4v3"/>
                        </svg>
                        <input
                          id="brand-org"
                          [ngModel]="brandName()"
                          (ngModelChange)="onSimpleChange(brandName, $event)"
                          (blur)="brandTouched.set(true)"
                          name="brandName"
                          autocomplete="off"
                          placeholder="e.g. Acme Skincare"
                          type="text"
                          class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                        @if (brandValid()) {
                          <svg class="w-4 h-4 text-cv-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-25" fill="currentColor"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>

                    <div class="flex flex-col gap-1">
                      <div class="flex items-center justify-between h-4">
                        <label for="manager-name" class="text-xs text-cv-ink font-medium">Brand manager name</label>
                        @if (managerNameTouched() && managerNameError()) {
                          <span class="text-xs text-cv-red-soft font-medium">{{ managerNameError() }}</span>
                        }
                      </div>
                      <div
                        class="group flex items-center gap-2.5 px-3 h-10 rounded-[4px] bg-cv-well border transition-colors duration-150"
                        [ngClass]="managerNameTouched() && managerNameError()
                          ? 'border-[#ff5c5c]'
                          : (managerNameValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                        <svg class="doodle-svg w-4 h-4 shrink-0"
                             [ngClass]="managerNameTouched() && managerNameError() ? 'text-[#ff5c5c]' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]'"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="8.5" r="3.6"/>
                          <path d="M5.5 19.5c1-3.2 3.3-4.8 6.5-4.8s5.5 1.6 6.5 4.8"/>
                        </svg>
                        <input
                          id="manager-name"
                          [ngModel]="managerName()"
                          (ngModelChange)="onManagerNameInput($event)"
                          (blur)="managerNameTouched.set(true)"
                          name="brandManagerDisplayName"
                          autocomplete="off"
                          placeholder="Manager full name"
                          type="text"
                          class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                        @if (managerNameValid()) {
                          <svg class="w-4 h-4 text-cv-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-25" fill="currentColor"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Row 2: Brand Manager Email + Strict Digits-Only Contact Number -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1">
                      <div class="flex items-center justify-between h-4">
                        <label for="manager-email" class="text-xs text-cv-ink font-medium">Brand manager email</label>
                        @if ((emailTouched() || emailIsAdmin()) && emailError()) {
                          <span class="text-xs text-cv-red-soft font-medium">{{ emailError() }}</span>
                        }
                      </div>
                      <div
                        class="group flex items-center gap-2.5 px-3 h-10 rounded-[4px] bg-cv-well border transition-colors duration-150"
                        [ngClass]="(emailTouched() || emailIsAdmin()) && emailError()
                          ? 'border-[#ff5c5c]'
                          : (emailValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                        <svg class="doodle-svg w-4 h-4 shrink-0"
                             [ngClass]="(emailTouched() || emailIsAdmin()) && emailError() ? 'text-[#ff5c5c]' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]'"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                          <rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/>
                          <path d="M5 7.5l7 5.2 7-5.2"/>
                        </svg>
                        <input
                          id="manager-email"
                          [ngModel]="managerEmail()"
                          (ngModelChange)="onManagerEmailChange($event)"
                          (blur)="emailTouched.set(true)"
                          name="brandManagerEmailInput"
                          autocomplete="off"
                          placeholder="manager@brand.com"
                          type="email"
                          class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                        @if (emailValid()) {
                          <svg class="w-4 h-4 text-cv-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-25" fill="currentColor"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>

                    <div class="flex flex-col gap-1">
                      <div class="flex items-center justify-between h-4">
                        <label for="brand-contact" class="text-xs text-cv-ink font-medium">Contact number</label>
                        @if (phoneTouched() && phoneError()) {
                          <span class="text-xs text-cv-red-soft font-medium">{{ phoneError() }}</span>
                        }
                      </div>
                      <div
                        class="group flex items-center gap-2 pl-2 pr-3 h-10 rounded-[4px] bg-cv-well border transition-colors duration-150"
                        [ngClass]="phoneTouched() && phoneError()
                          ? 'border-[#ff5c5c]'
                          : (phoneValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                        <app-country-picker
                          [iso]="countryIso()"
                          (isoChange)="onCountryChange($event)">
                        </app-country-picker>

                        <input
                          id="brand-contact"
                          [value]="phoneLocal()"
                          (input)="onPhoneInput($event)"
                          (keydown)="onPhoneKeydown($event)"
                          (blur)="phoneTouched.set(true)"
                          [attr.maxlength]="selectedCountry().maxDigits"
                          inputmode="numeric"
                          pattern="[0-9]*"
                          name="contactNumber"
                          autocomplete="off"
                          [placeholder]="selectedCountry().placeholder"
                          type="tel"
                          class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none tabular-nums"/>

                        @if (phoneValid()) {
                          <svg class="w-4 h-4 text-cv-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-25" fill="currentColor"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-cv-border-soft">
                  <button type="button" (click)="submitBrand('DRAFT')" [disabled]="submitting()"
                          class="h-10 px-5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover text-cv-ink-muted hover:text-cv-ink text-xs font-semibold border border-cv-border cursor-pointer transition-colors">
                    Save as Draft
                  </button>
                  <button type="submit" [disabled]="submitting()"
                          class="h-10 flex items-center justify-center gap-2 px-6 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-lg font-bold transition-colors cursor-pointer disabled:opacity-60">
                    @if (submitting()) {
                      <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>
                      <span>CREATING...</span>
                    } @else {
                      <span>ONBOARD BRAND ↗</span>
                    }
                  </button>
                </div>
              </form>

              <!-- Success Overlay -->
              @if (provisionedBrand(); as pb) {
                <div class="absolute inset-0 rounded-[6px] bg-cv-card/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center z-30 animate-pop-in">
                  @if (pb.status === 'DRAFT') {
                    <div class="w-12 h-12 rounded-[6px] bg-[#fabf29] flex items-center justify-center text-[#111111] mb-3">
                      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v15.5l-6.5-4-6.5 4V5A1.5 1.5 0 0 1 7 3.5z"/>
                      </svg>
                    </div>
                    <h3 class="font-headline uppercase text-3xl font-bold text-cv-ink tracking-[0.02em]">{{ pb.name }} SAVED AS DRAFT</h3>
                    <p class="text-sm text-cv-ink-muted max-w-md mt-2">
                      Saved for <strong class="text-cv-ink">{{ pb.managerName }} ({{ pb.managerEmail }})</strong>. Open Brand Details to activate when ready.
                    </p>
                  } @else {
                    <div class="w-12 h-12 rounded-[6px] bg-[#007656] flex items-center justify-center text-[#fff6e8] mb-3">
                      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    </div>
                    <h3 class="font-headline uppercase text-3xl font-bold text-cv-ink tracking-[0.02em]">{{ pb.name }} IS LIVE</h3>
                    <p class="text-sm text-cv-ink-muted max-w-md mt-2">
                      <strong class="text-cv-ink">{{ pb.managerName }} ({{ pb.managerEmail }})</strong> can now sign in with this email.
                    </p>
                  }
                  <div class="mt-6 flex items-center justify-center gap-3">
                    <button type="button" (click)="openBrand(pb.id)" class="h-10 px-5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover border border-cv-border text-cv-ink text-xs font-semibold cursor-pointer transition-colors">Open Brand Details</button>
                    <button type="button" (click)="provisionedBrand.set(null)" class="h-10 px-6 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-lg font-bold cursor-pointer transition-colors">DONE</button>
                  </div>
                </div>
              }
            </section>

            <!-- Right Column: Unified Brand Directory Panel -->
            <section class="lg:col-span-5 flex flex-col bg-cv-card rounded-[6px] border border-cv-border p-5">
              <div class="flex items-center justify-between pb-3.5 mb-4 border-b border-cv-border-soft">
                <h2 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.02em] leading-none">BRAND DIRECTORY</h2>
              </div>

              <div class="mb-3.5">
                <div class="group flex items-center gap-2.5 px-3 h-10 rounded-[4px] bg-cv-well border border-cv-border focus-within:border-[#f54e26] transition-colors">
                  <svg class="doodle-svg w-4 h-4 text-cv-ink-muted group-focus-within:text-[#f54e26] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="6.5"/>
                    <path d="M16 16l4 4"/>
                  </svg>
                  <input [(ngModel)]="searchQuery" (ngModelChange)="searchSignal.set($event)" placeholder="Filter by brand or manager..." type="text" class="w-full min-w-0 bg-transparent text-cv-ink placeholder:text-cv-ink-subtle text-sm focus:outline-none"/>
                </div>
              </div>

              @if (filteredBrands().length === 0) {
                <div class="p-8 rounded-[4px] bg-cv-well border border-dashed border-cv-border-strong text-center flex flex-col items-center">
                  <h3 class="font-headline uppercase text-lg font-bold text-cv-ink">NO BRANDS FOUND</h3>
                  <p class="text-xs text-cv-ink-muted mt-1">Create a brand using the form on the left.</p>
                </div>
              } @else {
                <div class="rounded-[4px] bg-cv-well border border-cv-border overflow-hidden max-h-[320px] lg:max-h-[calc(100vh-315px)] overflow-y-auto">
                  @for (b of filteredBrands(); track b.id) {
                    <div
                      (click)="openBrand(b.id)"
                      class="group flex items-center justify-between px-3.5 py-3 border-b last:border-b-0 border-cv-divide hover:bg-cv-hover-subtle transition-colors cursor-pointer">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-9 h-9 rounded-[4px] bg-[#f54e26] text-[#111111] font-headline text-lg font-bold flex items-center justify-center shrink-0">
                          {{ b.name.charAt(0).toUpperCase() }}
                        </div>
                        <div class="min-w-0">
                          <h3 class="font-headline uppercase text-lg font-bold text-cv-ink tracking-[0.015em] truncate group-hover:text-[#f54e26] transition-colors leading-tight">{{ b.name }}</h3>
                          <p class="text-xs text-cv-ink-muted truncate mt-0.5">{{ b.managerName }} • {{ b.managerEmail }}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-2 shrink-0 ml-2">
                        @if (b.status === 'DRAFT') {
                          <span class="px-2 py-0.5 rounded-[3px] text-[10px] font-semibold bg-[#fabf29] text-[#111111]">
                            DRAFT
                          </span>
                        }
                        <span class="font-headline text-base text-cv-ink-muted group-hover:text-[#f54e26] transition-colors">↗</span>
                      </div>
                    </div>
                  }
                </div>
              }
            </section>
          </div>
        </div>
      </main>

      <!-- Sign Out Confirmation Modal -->
      <app-confirm-modal
        [open]="showSignOutConfirm()"
        [title]="exitCtrl.promptVisible() ? 'Sign out &amp; leave Admin?' : 'Sign out of Admin?'"
        [message]="exitCtrl.promptVisible() ? 'Going back to the home page will sign you out of your current session.' : 'You will be returned to the sign-in screen.'"
        confirmLabel="Sign Out"
        [cancelLabel]="exitCtrl.promptVisible() ? 'Stay Here' : 'Cancel'"
        tone="primary"
        (confirm)="confirmSignOutModal()"
        (cancel)="cancelSignOutModal()">
      </app-confirm-modal>

      <app-footer></app-footer>
    </div>
  `
})
export class AdminOnboardingComponent implements OnInit, OnDestroy, DashboardExitAware {
  readonly exitCtrl = new DashboardExitController();
  brands = signal<Brand[]>([]);
  searchSignal = signal<string>('');
  searchQuery = '';

  brandName = signal('');
  managerName = signal('');
  managerEmail = signal('');
  countryIso = signal('IN');
  phoneLocal = signal('');

  brandTouched = signal(false);
  managerNameTouched = signal(false);
  emailTouched = signal(false);
  phoneTouched = signal(false);

  private managerNameManual = false;
  submitting = signal(false);
  shakeForm = signal(false);
  banner = signal<{ type: 'error' | 'success'; text: string } | null>(null);
  provisionedBrand = signal<Brand | null>(null);
  showSignOutConfirm = signal(false);

  private currentAdminEmail = computed(() => (this.auth.currentUser()?.email || '').trim().toLowerCase());

  selectedCountry = computed(() => findCountryByIso(this.countryIso()));

  brandDuplicate = computed(() => {
    const v = this.brandName().trim().toLowerCase();
    return v.length >= 2 && this.brands().some(b => b.name.trim().toLowerCase() === v);
  });

  brandError = computed(() => {
    const v = this.brandName().trim();
    if (!v) return 'Required';
    if (v.length < 2) return 'Min 2 chars';
    if (this.brandDuplicate()) return 'Already exists';
    return '';
  });
  brandValid = computed(() => this.brandName().trim().length >= 2 && !this.brandDuplicate());

  managerNameError = computed(() => {
    const v = this.managerName().trim();
    if (!v) return 'Required';
    if (v.length < 2) return 'Min 2 chars';
    return '';
  });
  managerNameValid = computed(() => this.managerName().trim().length >= 2);

  emailIsAdmin = computed(() => {
    const v = this.managerEmail().trim().toLowerCase();
    return !!this.currentAdminEmail() && v === this.currentAdminEmail();
  });

  emailError = computed(() => {
    const v = this.managerEmail().trim();
    if (!v) return 'Required';
    if (!EMAIL_REGEX.test(v)) return 'Invalid email';
    if (this.emailIsAdmin()) return 'Admin email not allowed';
    return '';
  });
  emailValid = computed(() => {
    const v = this.managerEmail().trim();
    return EMAIL_REGEX.test(v) && !this.emailError();
  });

  phoneError = computed(() => validatePhoneDigits(this.countryIso(), this.phoneLocal(), true));
  phoneValid = computed(() => this.phoneLocal().length > 0 && !this.phoneError());

  activeCount = computed(() => this.brands().filter(b => b.status === 'ACTIVE').length);
  draftCount = computed(() => this.brands().filter(b => b.status === 'DRAFT').length);
  filteredBrands = computed(() => {
    const q = this.searchSignal().trim().toLowerCase();
    return this.brands().filter(b =>
      !q ||
      b.name.toLowerCase().includes(q) ||
      (b.managerName || '').toLowerCase().includes(q) ||
      (b.managerEmail || '').toLowerCase().includes(q)
    );
  });

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBrands();
  }

  loadBrands() {
    this.api.listBrands().subscribe({
      next: (data) => this.brands.set(data),
      error: () => {}
    });
  }

  onSimpleChange(target: { set: (val: string) => void }, val: string) {
    target.set(val);
    if (this.banner()?.type === 'error') {
      this.banner.set(null);
    }
  }

  onManagerNameInput(val: string) {
    this.managerNameManual = val.trim().length > 0;
    this.managerName.set(val);
    if (this.banner()?.type === 'error') {
      this.banner.set(null);
    }
  }

  onCountryChange(iso: string) {
    this.countryIso.set(iso);
    const max = this.selectedCountry().maxDigits;
    const trimmed = this.phoneLocal().replace(/\D/g, '').slice(0, max);
    this.phoneLocal.set(trimmed);
    if (trimmed) {
      this.phoneTouched.set(true);
    }
  }

  onPhoneKeydown(event: KeyboardEvent) {
    enforcePhoneKeydown(event, this.phoneLocal(), this.selectedCountry().maxDigits);
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const max = this.selectedCountry().maxDigits;
    const digitsOnly = input.value.replace(/\D/g, '').slice(0, max);
    if (input.value !== digitsOnly) {
      input.value = digitsOnly;
    }
    this.phoneLocal.set(digitsOnly);
    if (this.banner()?.type === 'error') {
      this.banner.set(null);
    }
  }

  onManagerEmailChange(email: string) {
    this.managerEmail.set(email);
    if (this.banner()?.type === 'error') {
      this.banner.set(null);
    }
  }

  private triggerShake() {
    this.shakeForm.set(false);
    setTimeout(() => this.shakeForm.set(true), 10);
    setTimeout(() => this.shakeForm.set(false), 400);
  }

  submitBrand(status: 'ACTIVE' | 'DRAFT') {
    this.banner.set(null);
    this.brandTouched.set(true);
    this.managerNameTouched.set(true);
    this.emailTouched.set(true);

    if (status === 'ACTIVE') {
      this.phoneTouched.set(true);
    }

    const phoneInvalid = (status === 'ACTIVE' && !!this.phoneError()) || (this.phoneLocal().trim().length > 0 && !!this.phoneError());
    if (this.brandError() || this.managerNameError() || this.emailError() || phoneInvalid) {
      this.triggerShake();
      this.banner.set({
        type: 'error',
        text: this.brandDuplicate()
          ? 'A brand with this name already exists.'
          : (this.emailIsAdmin()
            ? 'Admin email cannot be assigned as a Brand Manager.'
            : 'Please fix the highlighted fields before continuing.')
      });
      return;
    }

    const rawPhone = this.phoneLocal().replace(/\D/g, '');
    const formattedPhone = rawPhone ? `${this.selectedCountry().dial} ${rawPhone}` : '';

    this.submitting.set(true);
    this.api.provisionBrand({
      name: this.brandName().trim(),
      managerName: this.managerName().trim(),
      managerEmail: this.managerEmail().trim(),
      contactNumber: formattedPhone,
      status
    }).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.provisionedBrand.set(created);
        this.brandName.set('');
        this.managerName.set('');
        this.managerEmail.set('');
        this.phoneLocal.set('');
        this.managerNameManual = false;
        this.brandTouched.set(false);
        this.managerNameTouched.set(false);
        this.emailTouched.set(false);
        this.phoneTouched.set(false);
        this.loadBrands();
      },
      error: (err) => {
        this.submitting.set(false);
        this.triggerShake();
        this.banner.set({ type: 'error', text: err?.error?.error || 'Could not create brand workspace.' });
      }
    });
  }

  openBrand(id: string) {
    this.router.navigate(['/admin/brands', id]);
  }

  ngOnDestroy(): void {
    this.exitCtrl.destroy();
  }

  confirmDashboardExit(): Observable<boolean> {
    return this.exitCtrl.requestExit(() => this.showSignOutConfirm.set(true));
  }

  confirmSignOutModal() {
    if (this.exitCtrl.confirm(() => this.auth.logout())) {
      this.showSignOutConfirm.set(false);
      return;
    }
    this.logout();
  }

  cancelSignOutModal() {
    this.exitCtrl.cancel(() => this.showSignOutConfirm.set(false));
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/auth', { replaceUrl: true });
  }
}
