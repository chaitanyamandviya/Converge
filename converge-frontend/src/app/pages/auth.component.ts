import { Component, OnInit, NgZone, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

declare const google: any;

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="bg-surface font-body text-on-surface min-h-screen flex flex-col selection:bg-blue-container selection:text-ink-primary overflow-x-hidden">
      <!-- Light Minimal Header -->
      <header class="shrink-0 w-full z-40 bg-surface/85 backdrop-blur-xl border-b border-surface-container-high/40">
        <div class="h-[52px] max-w-6xl mx-auto px-5 sm:px-8 flex items-center justify-between gap-4">
          <a routerLink="/" class="flex items-center gap-2.5 group shrink-0">
            <img src="/converge-logo.png" alt="Converge" class="w-7 h-7 rounded-full object-contain shrink-0 transition-transform duration-300 group-hover:rotate-12"/>
            <span class="font-headline text-base sm:text-lg font-bold text-ink-primary tracking-tight group-hover:text-primary transition-colors">Converge</span>
          </a>
          <a routerLink="/" class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-surface-container-high/80 bg-surface-container-lowest/90 hover:bg-surface-container-low text-ink-secondary hover:text-ink-primary font-medium text-xs shadow-2xs hover:-translate-y-0.5 active:scale-95 transition-all whitespace-nowrap shrink-0 group">
            <svg class="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5"/>
              <path d="M11 6l-6 6 6 6"/>
            </svg>
            <span>Back to Home</span>
          </a>
        </div>
      </header>

      <!-- Spacious Two-Column Minimal Canvas -->
      <main class="w-full flex-1 bg-surface relative flex items-center justify-center px-5 sm:px-8 py-2">
        <!-- Soft Warm Ambient Glows -->
        <div class="absolute top-6 left-1/4 w-[320px] sm:w-[480px] h-[320px] sm:h-[480px] pointer-events-none rounded-full bg-gradient-to-tr from-blue-container/35 via-marigold-container/20 to-transparent blur-3xl animate-pulse-glow -z-10"></div>
        <div class="absolute bottom-0 right-1/4 w-[280px] sm:w-[420px] h-[280px] sm:h-[420px] pointer-events-none rounded-full bg-coral-container/25 blur-3xl animate-drift -z-10"></div>

        <div class="w-full max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">

          <!-- Left Column: Calm Editorial Brand Anchor (Desktop) -->
          <div class="hidden lg:flex lg:col-span-5 flex-col items-start justify-center pr-4 animate-fade-in-up">
            <!-- Orbital Doodle Ring Emblem -->
            <div class="relative w-16 h-16 mb-5 flex items-center justify-center">
              <div class="absolute inset-0 rounded-full border border-dashed border-primary/25 animate-orbit"></div>
              <div class="absolute inset-1.5 rounded-full border border-dotted border-secondary/25 animate-orbit-reverse"></div>
              <div class="w-10 h-10 rounded-full bg-surface-container-lowest shadow-sm border border-surface-container-high/60 flex items-center justify-center p-1.5">
                <img src="/converge-logo.png" alt="Converge" class="w-full h-full object-contain rounded-full"/>
              </div>
            </div>

            <h1 class="font-headline text-4xl font-bold text-ink-primary tracking-tight leading-[1.15]">
              {{ mode() === 'signin' ? 'Welcome back.' : 'Start with clarity.' }}
            </h1>
            <p class="text-base text-ink-secondary mt-2.5 leading-relaxed max-w-sm">
              {{ mode() === 'signin'
                ? 'Sign in to manage verified brand workspaces and live creator deliverables.'
                : 'Create your Converge account to collaborate with brands and track verified Reels.' }}
            </p>
          </div>

          <!-- Right Column: Light Frosted Editorial Card -->
          <div class="lg:col-span-7 w-full flex flex-col items-center lg:items-end animate-fade-in-up">
            <!-- Mobile / Tablet Heading -->
            <div class="lg:hidden text-center mb-3">
              <h1 class="font-headline text-2xl sm:text-3xl font-bold text-ink-primary tracking-tight">
                {{ mode() === 'signin' ? 'Welcome back' : 'Create your account' }}
              </h1>
            </div>

            <div
              class="w-full max-w-[464px] bg-surface-container-lowest/90 backdrop-blur-xl rounded-[24px] p-4 sm:p-5 shadow-[0_16px_48px_-12px_rgba(31,29,25,0.06)] border border-surface-container-high/70 transition-all duration-300"
              [class.animate-shake]="shakeForm()">

              <!-- Sliding Pill Switcher -->
              <div class="w-full relative flex p-1 rounded-full bg-surface-container-low border border-surface-container-high/50 mb-3 select-none" role="tablist">
                <div
                  class="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-surface-container-lowest shadow-xs transition-all duration-300"
                  style="transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);"
                  [style.left]="mode() === 'signin' ? '4px' : 'calc(50% + 2px)'">
                </div>
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="mode() === 'signin'"
                  (click)="switchMode('signin')"
                  class="relative z-10 flex-1 py-1.5 text-center rounded-full text-xs font-semibold transition-colors duration-200 cursor-pointer"
                  [ngClass]="mode() === 'signin' ? 'text-ink-primary' : 'text-ink-secondary hover:text-ink-primary'">
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="mode() === 'signup'"
                  (click)="switchMode('signup')"
                  class="relative z-10 flex-1 py-1.5 text-center rounded-full text-xs font-semibold transition-colors duration-200 cursor-pointer"
                  [ngClass]="mode() === 'signup' ? 'text-ink-primary' : 'text-ink-secondary hover:text-ink-primary'">
                  Create Account
                </button>
              </div>

              @if (!successState()) {
                <!-- Native Crisp Google SSO Button -->
                <button
                  type="button"
                  (click)="handleGoogle()"
                  [disabled]="loading() || googleLoading()"
                  class="w-full h-9.5 px-5 rounded-full bg-surface-container-lowest hover:bg-surface-cream active:scale-[0.985] text-ink-primary text-xs font-semibold flex items-center justify-center gap-2.5 border border-surface-container-high hover:border-outline-variant shadow-2xs hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all duration-200 cursor-pointer disabled:opacity-60">
                  @if (googleLoading()) {
                    <svg class="w-4 h-4 animate-spin text-primary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                      <path d="M12 3a9 9 0 1 0 9 9"/>
                    </svg>
                    <span>Connecting to Google...</span>
                  } @else {
                    <svg aria-hidden="true" class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" fill="#4285F4"></path>
                      <path d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z" fill="#34A853"></path>
                      <path d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z" fill="#FBBC05"></path>
                      <path d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" fill="#EA4335"></path>
                    </svg>
                    <span>Continue with Google</span>
                  }
                </button>

                <!-- Hairline Divider -->
                <div class="relative my-2.5 flex items-center justify-center">
                  <div class="absolute inset-0 flex items-center"><div class="w-full bg-surface-container-high/70 h-[1px]"></div></div>
                  <span class="relative px-3 bg-surface-container-lowest text-[11px] font-medium text-ink-secondary">or continue with email</span>
                </div>

                <!-- Single Unified Alert Banner -->
                @if (banner(); as msg) {
                  <div
                    class="mb-2.5 px-3 py-2 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 animate-pop-in"
                    [ngClass]="msg.type === 'error'
                      ? 'bg-coral-container/40 border-secondary/20 text-secondary'
                      : 'bg-mint-container/45 border-mint-green/25 text-[#137333]'">
                    <div class="flex items-center gap-2 min-w-0">
                      @if (msg.type === 'error') {
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="9"/>
                          <path d="M12 8v4"/>
                          <circle cx="12" cy="16" r="0.6" fill="currentColor"/>
                        </svg>
                      } @else {
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9z"/>
                          <path d="M5 7l7 5 7-5"/>
                        </svg>
                      }
                      <span class="leading-snug">{{ msg.text }}</span>
                    </div>
                    <button type="button" (click)="banner.set(null)" aria-label="Dismiss message" class="shrink-0 opacity-65 hover:opacity-100 p-0.5 rounded-full cursor-pointer">
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M6 6l12 12M18 6L6 18"/>
                      </svg>
                    </button>
                  </div>
                }

                <!-- Full-Width Airy Form with Animated Monoline SVG Doodles -->
                <form (ngSubmit)="submit()" novalidate class="space-y-2">
                  @if (mode() === 'signup') {
                    <div>
                      <div class="flex items-center justify-between mb-0.5 px-1">
                        <label for="auth-name" class="text-[11px] font-medium text-ink-primary">Full Name</label>
                        @if (nameTouched() && nameError()) {
                          <span class="text-[11px] text-secondary font-medium">{{ nameError() }}</span>
                        }
                      </div>
                      <div
                        class="group flex items-center gap-2.5 h-9 px-3.5 rounded-full bg-surface-cream border transition-all duration-200 focus-within:bg-surface-container-lowest"
                        [ngClass]="nameTouched() && nameError()
                          ? 'border-secondary/50 ring-2 ring-secondary/10'
                          : (nameValid() ? 'border-mint-green/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15' : 'border-surface-container-high focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15')">
                        <!-- Animated Monoline Person Doodle -->
                        <svg class="doodle-svg w-[17px] h-[17px] shrink-0"
                             [ngClass]="nameTouched() && nameError() ? 'text-secondary' : 'text-ink-secondary group-focus-within:text-primary'"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="8" r="3.8"/>
                          <path d="M5.5 19.5c1-3.4 3.5-5 6.5-5s5.5 1.6 6.5 5"/>
                        </svg>
                        <input
                          id="auth-name"
                          [ngModel]="name()"
                          (ngModelChange)="onFieldChange(name, $event)"
                          (blur)="nameTouched.set(true)"
                          name="name"
                          autocomplete="name"
                          placeholder="Alex Morgan"
                          type="text"
                          class="flex-1 min-w-0 bg-transparent text-ink-primary placeholder:text-ink-secondary/55 text-sm outline-none"/>
                        @if (nameValid()) {
                          <svg class="w-[17px] h-[17px] text-mint-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="9" class="opacity-30" fill="#ceead6"/>
                            <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                          </svg>
                        }
                      </div>
                    </div>
                  }

                  <div>
                    <div class="flex items-center justify-between mb-0.5 px-1">
                      <label for="auth-email" class="text-[11px] font-medium text-ink-primary">Email Address</label>
                      @if (emailTouched() && emailError()) {
                        <span class="text-[11px] text-secondary font-medium">{{ emailError() }}</span>
                      }
                    </div>
                    <div
                      class="group flex items-center gap-2.5 h-9 px-3.5 rounded-full bg-surface-cream border transition-all duration-200 focus-within:bg-surface-container-lowest"
                      [ngClass]="emailTouched() && emailError()
                        ? 'border-secondary/50 ring-2 ring-secondary/10'
                        : (emailValid() ? 'border-mint-green/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15' : 'border-surface-container-high focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15')">
                      <!-- Animated Monoline Envelope Doodle -->
                      <svg class="doodle-svg w-[17px] h-[17px] shrink-0"
                           [ngClass]="emailTouched() && emailError() ? 'text-secondary' : 'text-ink-secondary group-focus-within:text-primary'"
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3.5" y="5.5" width="17" height="13" rx="3.5"/>
                        <path d="M5 7.5l7 5.2 7-5.2"/>
                      </svg>
                      <input
                        id="auth-email"
                        [ngModel]="email()"
                        (ngModelChange)="onFieldChange(email, $event)"
                        (blur)="emailTouched.set(true)"
                        name="email"
                        autocomplete="email"
                        placeholder="name@company.com"
                        type="email"
                        class="flex-1 min-w-0 bg-transparent text-ink-primary placeholder:text-ink-secondary/55 text-sm outline-none"/>
                      @if (emailValid()) {
                        <svg class="w-[17px] h-[17px] text-mint-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="9" class="opacity-30" fill="#ceead6"/>
                          <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                        </svg>
                      }
                    </div>
                  </div>

                  <!-- Password Field -->
                  <div>
                    <div class="flex items-center justify-between mb-0.5 px-1">
                      <label for="auth-password" class="text-[11px] font-medium text-ink-primary">{{ mode() === 'signup' ? 'Create Password' : 'Password' }}</label>
                      @if (passwordTouched() && passwordError()) {
                        <span class="text-[11px] text-secondary font-medium">{{ passwordError() }}</span>
                      } @else if (mode() === 'signup' && password().length > 0) {
                        <div class="flex items-center gap-1.5">
                          <div class="flex items-center gap-0.5">
                            <span class="w-3 h-1 rounded-full transition-colors duration-200" [ngClass]="passwordStrength().score >= 1 ? passwordStrength().color : 'bg-surface-container-high'"></span>
                            <span class="w-3 h-1 rounded-full transition-colors duration-200" [ngClass]="passwordStrength().score >= 2 ? passwordStrength().color : 'bg-surface-container-high'"></span>
                            <span class="w-3 h-1 rounded-full transition-colors duration-200" [ngClass]="passwordStrength().score >= 3 ? passwordStrength().color : 'bg-surface-container-high'"></span>
                            <span class="w-3 h-1 rounded-full transition-colors duration-200" [ngClass]="passwordStrength().score >= 4 ? passwordStrength().color : 'bg-surface-container-high'"></span>
                          </div>
                          <span class="text-[10px] font-semibold" [ngClass]="passwordStrength().textColor">{{ passwordStrength().label }}</span>
                        </div>
                      } @else if (mode() === 'signin') {
                        <button type="button" (click)="handleForgot()" class="text-[11px] font-semibold text-primary hover:underline cursor-pointer">Forgot password?</button>
                      }
                    </div>
                    <div
                      class="group flex items-center gap-2.5 h-9 px-3.5 rounded-full bg-surface-cream border transition-all duration-200 focus-within:bg-surface-container-lowest"
                      [ngClass]="passwordTouched() && passwordError()
                        ? 'border-secondary/50 ring-2 ring-secondary/10'
                        : 'border-surface-container-high focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15'">
                      <!-- Animated Padlock Doodle (shackle lifts when password is visible) -->
                      <svg class="doodle-svg w-[17px] h-[17px] shrink-0"
                           [ngClass]="passwordTouched() && passwordError() ? 'text-secondary' : 'text-ink-secondary group-focus-within:text-primary'"
                           viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                        <path class="doodle-shackle" [class.doodle-shackle-open]="showPass()" d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/>
                        <rect x="5.5" y="10.5" width="13" height="9.5" rx="3"/>
                        <circle cx="12" cy="15.2" r="1.2" fill="currentColor"/>
                      </svg>
                      <input
                        id="auth-password"
                        [ngModel]="password()"
                        (ngModelChange)="onFieldChange(password, $event)"
                        (blur)="passwordTouched.set(true)"
                        name="password"
                        [autocomplete]="mode() === 'signup' ? 'new-password' : 'current-password'"
                        [placeholder]="mode() === 'signup' ? 'At least 8 characters' : 'Enter your password'"
                        [type]="showPass() ? 'text' : 'password'"
                        class="flex-1 min-w-0 bg-transparent text-ink-primary placeholder:text-ink-secondary/55 text-sm outline-none"/>
                      <!-- Animated Hand-Drawn Eye Doodle -->
                      <button
                        type="button"
                        (click)="showPass.set(!showPass())"
                        aria-label="Toggle password visibility"
                        class="shrink-0 w-7 h-7 rounded-full hover:bg-surface-container-soft flex items-center justify-center text-ink-secondary hover:text-primary active:scale-90 transition-all cursor-pointer">
                        @if (showPass()) {
                          <svg class="w-[17px] h-[17px] doodle-eye-lid animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z"/>
                            <circle cx="12" cy="12" r="2.6" fill="currentColor" class="opacity-85"/>
                            <circle cx="12.9" cy="11.1" r="0.8" fill="#ffffff" stroke="none"/>
                          </svg>
                        } @else {
                          <svg class="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3.5 11.5c2.2 3 5 4.2 8.5 4.2s6.3-1.2 8.5-4.2"/>
                            <path d="M7 14.5l-1.3 2.3"/>
                            <path d="M12 15.8v2.6"/>
                            <path d="M17 14.5l1.3 2.3"/>
                          </svg>
                        }
                      </button>
                    </div>
                  </div>

                  <!-- Confirm Password (Full Width in Create Account Mode) -->
                  @if (mode() === 'signup') {
                    <div>
                      <div class="flex items-center justify-between mb-0.5 px-1">
                        <label for="auth-confirm" class="text-[11px] font-medium text-ink-primary">Confirm Password</label>
                        @if (confirmTouched() && confirmError()) {
                          <span class="text-[11px] text-secondary font-medium">{{ confirmError() }}</span>
                        }
                      </div>
                      <div
                        class="group flex items-center gap-2.5 h-9 px-3.5 rounded-full bg-surface-cream border transition-all duration-200 focus-within:bg-surface-container-lowest"
                        [ngClass]="confirmTouched() && confirmError()
                          ? 'border-secondary/50 ring-2 ring-secondary/10'
                          : (confirmValid() ? 'border-mint-green/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15' : 'border-surface-container-high focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15')">
                        <!-- Animated Shield Doodle -->
                        <svg class="doodle-svg w-[17px] h-[17px] shrink-0"
                             [ngClass]="confirmTouched() && confirmError() ? 'text-secondary' : (confirmValid() ? 'text-mint-green' : 'text-ink-secondary group-focus-within:text-primary')"
                             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M12 3.5l7 2.8v5.2c0 4.6-3 8.1-7 9.5-4-1.4-7-4.9-7-9.5V6.3l7-2.8z"/>
                          @if (confirmValid()) {
                            <path d="M9 12.2l2 2 4.2-4.2" class="doodle-check-path"/>
                          }
                        </svg>
                        <input
                          id="auth-confirm"
                          [ngModel]="confirmPassword()"
                          (ngModelChange)="onFieldChange(confirmPassword, $event)"
                          (blur)="confirmTouched.set(true)"
                          name="confirmPassword"
                          autocomplete="new-password"
                          placeholder="Re-enter password"
                          [type]="showConfirm() ? 'text' : 'password'"
                          class="flex-1 min-w-0 bg-transparent text-ink-primary placeholder:text-ink-secondary/55 text-sm outline-none"/>
                        <!-- Animated Hand-Drawn Eye Doodle -->
                        <button
                          type="button"
                          (click)="showConfirm.set(!showConfirm())"
                          aria-label="Toggle confirm password visibility"
                          class="shrink-0 w-7 h-7 rounded-full hover:bg-surface-container-soft flex items-center justify-center text-ink-secondary hover:text-primary active:scale-90 transition-all cursor-pointer">
                          @if (showConfirm()) {
                            <svg class="w-[17px] h-[17px] doodle-eye-lid animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6z"/>
                              <circle cx="12" cy="12" r="2.6" fill="currentColor" class="opacity-85"/>
                              <circle cx="12.9" cy="11.1" r="0.8" fill="#ffffff" stroke="none"/>
                            </svg>
                          } @else {
                            <svg class="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M3.5 11.5c2.2 3 5 4.2 8.5 4.2s6.3-1.2 8.5-4.2"/>
                              <path d="M7 14.5l-1.3 2.3"/>
                              <path d="M12 15.8v2.6"/>
                              <path d="M17 14.5l1.3 2.3"/>
                            </svg>
                          }
                        </button>
                      </div>
                    </div>
                  }

                  <!-- Primary Submit CTA -->
                  <button
                    type="submit"
                    [disabled]="loading()"
                    class="btn-shimmer w-full h-10 mt-2 rounded-full bg-primary hover:bg-primary-container active:scale-[0.985] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer disabled:opacity-60">
                    @if (loading()) {
                      <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                        <path d="M12 3a9 9 0 1 0 9 9"/>
                      </svg>
                      <span>{{ mode() === 'signin' ? 'Signing in...' : 'Creating account...' }}</span>
                    } @else {
                      <span>{{ mode() === 'signin' ? 'Sign In' : 'Create Account' }}</span>
                      <svg class="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14"/>
                        <path d="M13 6l6 6-6 6"/>
                      </svg>
                    }
                  </button>
                </form>
              } @else {
                <!-- Account Created Celebration View -->
                <div class="py-5 text-center flex flex-col items-center animate-pop-in">
                  <div class="w-12 h-12 rounded-full bg-mint-container text-[#137333] flex items-center justify-center shadow-inner mb-3">
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M4 8l8 5 8-5"/>
                      <rect x="3.5" y="5.5" width="17" height="13" rx="3.5"/>
                    </svg>
                  </div>
                  <h2 class="font-headline text-xl font-bold text-ink-primary">{{ successTitle() }}</h2>
                  <p class="text-sm text-ink-secondary mt-1 max-w-xs">{{ successSub() }}</p>
                  <button
                    type="button"
                    (click)="proceedAfterAuth()"
                    class="btn-shimmer mt-4 h-10 px-6 rounded-full bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container shadow-sm transition-all cursor-pointer flex items-center gap-2 group">
                    <span>{{ targetRoute() === '/admin' ? 'Continue to Admin Console' : 'Continue to Workspace' }}</span>
                    <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12h14"/>
                      <path d="M13 6l6 6-6 6"/>
                    </svg>
                  </button>
                </div>
              }

              <!-- Legal Line inside Card Footer -->
              <p class="mt-2.5 text-center text-[11px] text-ink-secondary/80">
                By continuing, you agree to our
                <a routerLink="/legal" [queryParams]="{tab: 'terms'}" class="underline hover:text-ink-primary">Terms</a> &amp;
                <a routerLink="/legal" [queryParams]="{tab: 'privacy'}" class="underline hover:text-ink-primary">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer class="shrink-0 w-full bg-surface-container-low/70 py-2 border-t border-surface-container-high/40">
        <div class="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-ink-secondary text-xs">
          <p>© 2026 Converge. All rights reserved.</p>
          <div class="flex items-center gap-4">
            <a routerLink="/legal" [queryParams]="{tab: 'privacy'}" class="hover:text-on-surface hover:underline">Privacy Policy</a>
            <a routerLink="/legal" [queryParams]="{tab: 'terms'}" class="hover:text-on-surface hover:underline">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  `
})
export class AuthComponent implements OnInit {
  mode = signal<'signin' | 'signup'>('signin');
  showPass = signal(false);
  showConfirm = signal(false);
  loading = signal(false);
  googleLoading = signal(false);
  shakeForm = signal(false);
  banner = signal<{ type: 'error' | 'success'; text: string } | null>(null);
  successState = signal(false);
  successTitle = signal('');
  successSub = signal('');
  targetRoute = signal('/workspace');

  private googleClientId = '';
  private tokenClient: any = null;
  private googleTimer: any = null;

  name = signal('');
  email = signal('');
  password = signal('');
  confirmPassword = signal('');

  nameTouched = signal(false);
  emailTouched = signal(false);
  passwordTouched = signal(false);
  confirmTouched = signal(false);

  nameError = computed(() => {
    const v = this.name().trim();
    if (!v) return 'Required';
    if (v.length < 2) return 'Min 2 chars';
    return '';
  });
  nameValid = computed(() => this.name().trim().length >= 2);

  emailError = computed(() => {
    const v = this.email().trim();
    if (!v) return 'Required';
    if (!EMAIL_REGEX.test(v)) return 'Invalid email';
    return '';
  });
  emailValid = computed(() => EMAIL_REGEX.test(this.email().trim()));

  passwordError = computed(() => {
    const v = this.password();
    if (!v) return 'Required';
    const min = this.mode() === 'signup' ? 8 : 6;
    if (v.length < min) return `Min ${min} chars`;
    return '';
  });

  confirmError = computed(() => {
    if (this.mode() !== 'signup') return '';
    if (!this.confirmPassword()) return 'Required';
    if (this.confirmPassword() !== this.password()) return 'Mismatch';
    return '';
  });
  confirmValid = computed(() =>
    this.mode() === 'signup' && this.confirmPassword().length >= 8 && this.confirmPassword() === this.password()
  );

  passwordStrength = computed(() => {
    const p = this.password();
    let score = 0;
    if (p.length >= 6) score++;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-secondary', textColor: 'text-secondary' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-tertiary-fixed-dim', textColor: 'text-tertiary' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-primary', textColor: 'text-primary' };
    return { score: 4, label: 'Strong', color: 'bg-mint-green', textColor: 'text-mint-green' };
  });

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      const m = String(p['mode'] || '').trim().toLowerCase();
      if (m === 'signup' || m === 'register' || m === 'onboard') {
        this.switchMode('signup');
      } else if (m === 'signin' || m === 'login') {
        this.switchMode('signin');
      }
      if (p['email']) {
        this.email.set(String(p['email']).trim());
      }
    });

    this.authService.getConfig().subscribe({
      next: (cfg) => {
        this.googleClientId = cfg.googleClientId;
        this.initGoogleTokenClient();
      },
      error: () => {}
    });
  }

  private initGoogleTokenClient(): boolean {
    if (!this.googleClientId || typeof google === 'undefined' || !google?.accounts?.oauth2) {
      return false;
    }
    if (!this.tokenClient) {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this.googleClientId,
        scope: 'openid email profile',
        callback: (resp: any) => {
          this.ngZone.run(() => {
            this.clearGoogleTimer();
            if (resp?.access_token) {
              this.submitGoogleAccessToken(resp.access_token);
            } else {
              this.googleLoading.set(false);
              this.showError(resp?.error_description || 'Google Sign-In did not return an authorization token.');
            }
          });
        },
        error_callback: (err: any) => {
          this.ngZone.run(() => {
            this.clearGoogleTimer();
            this.googleLoading.set(false);
            if (err?.type === 'popup_closed') {
              return;
            }
            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://converge-etp.pages.dev';
            this.showError(`Google Sign-In window could not open. Allow popups or verify ${origin} in Google OAuth settings.`);
          });
        }
      });
    }
    return true;
  }

  private clearGoogleTimer() {
    if (this.googleTimer) {
      clearTimeout(this.googleTimer);
      this.googleTimer = null;
    }
  }

  onFieldChange(targetSignal: { set: (val: string) => void }, value: string) {
    targetSignal.set(value);
    if (this.banner()) {
      this.banner.set(null);
    }
  }

  switchMode(newMode: 'signin' | 'signup') {
    this.mode.set(newMode);
    this.banner.set(null);
    this.successState.set(false);
    this.nameTouched.set(false);
    this.emailTouched.set(false);
    this.passwordTouched.set(false);
    this.confirmTouched.set(false);
  }

  private showError(text: string) {
    this.banner.set({ type: 'error', text });
  }

  private showSuccess(text: string) {
    this.banner.set({ type: 'success', text });
  }

  private triggerShake() {
    this.shakeForm.set(false);
    setTimeout(() => this.shakeForm.set(true), 10);
    setTimeout(() => this.shakeForm.set(false), 400);
  }

  submit() {
    this.banner.set(null);
    this.emailTouched.set(true);
    this.passwordTouched.set(true);

    if (this.mode() === 'signup') {
      this.nameTouched.set(true);
      this.confirmTouched.set(true);
      if (this.nameError() || this.emailError() || this.passwordError() || this.confirmError()) {
        this.triggerShake();
        return;
      }
    } else if (this.emailError() || this.passwordError()) {
      this.triggerShake();
      return;
    }

    this.loading.set(true);
    const obs = this.mode() === 'signup'
      ? this.authService.signup(this.name().trim(), this.email().trim(), this.password())
      : this.authService.login(this.email().trim(), this.password());

    obs.subscribe({
      next: (res) => {
        this.loading.set(false);
        this.targetRoute.set(res.user.role === 'SYSTEM_ADMIN' ? '/admin' : '/workspace');
        if (this.mode() === 'signup') {
          this.successState.set(true);
          this.successTitle.set('Account Created!');
          this.successSub.set(`Welcome, ${res.user.name}. Your Converge identity is registered and ready.`);
        } else {
          this.router.navigateByUrl(this.targetRoute());
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.triggerShake();
        this.showError(err?.error?.error || 'Authentication failed. Please check your credentials.');
      }
    });
  }

  handleGoogle() {
    this.banner.set(null);
    if (!this.googleClientId) {
      this.googleLoading.set(true);
      this.authService.getConfig().subscribe({
        next: (cfg) => {
          this.googleClientId = (cfg?.googleClientId || '').trim();
          this.googleLoading.set(false);
          if (!this.googleClientId) {
            this.showError('Google Sign-In is not configured on the backend server yet. Sign in or create an account with Email below.');
            return;
          }
          this.launchGooglePopup();
        },
        error: () => {
          this.googleLoading.set(false);
          this.showError('Backend server is still waking up or unreachable. Please wait a few seconds and try again.');
        }
      });
      return;
    }
    this.launchGooglePopup();
  }

  private launchGooglePopup() {
    if (!this.initGoogleTokenClient()) {
      this.showError('Google Identity Services script is blocked or still loading. Please try again.');
      return;
    }
    this.clearGoogleTimer();
    this.googleLoading.set(true);
    try {
      this.tokenClient.requestAccessToken({ prompt: 'select_account' });
      this.googleTimer = setTimeout(() => {
        this.ngZone.run(() => {
          if (this.googleLoading() && document.hasFocus()) {
            this.googleLoading.set(false);
            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://converge-etp.pages.dev';
            this.showError(`Google Sign-In popup could not open here. Ensure popups are allowed and ${origin} is authorized in Google Cloud Console.`);
          }
        });
      }, 2500);
    } catch {
      this.googleLoading.set(false);
      this.showError('Google Sign-In could not be started on this origin.');
    }
  }

  private submitGoogleAccessToken(accessToken: string) {
    this.authService.googleLogin({ accessToken }).subscribe({
      next: (res) => {
        this.googleLoading.set(false);
        this.router.navigateByUrl(res.user.role === 'SYSTEM_ADMIN' ? '/admin' : '/workspace');
      },
      error: (err) => {
        this.googleLoading.set(false);
        this.triggerShake();
        this.showError(err?.error?.error || 'Google authentication failed.');
      }
    });
  }

  proceedAfterAuth() {
    this.router.navigateByUrl(this.targetRoute());
  }

  handleForgot() {
    this.banner.set(null);
    this.emailTouched.set(true);
    if (this.emailError()) {
      this.triggerShake();
      this.showError('Enter your email address first to receive reset instructions.');
      return;
    }
    this.authService.forgotPassword(this.email().trim()).subscribe({
      next: (res) => this.showSuccess(res.message),
      error: () => this.showSuccess('Password reset instructions dispatched if the account exists.')
    });
  }
}
