import { Component, signal, computed, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { ConfirmService } from '../services/confirm.service';

export interface SystemGoogleAccount {
  name: string;
  email: string;
  avatarInitials: string;
  avatarColor?: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  // Mode: 'login' | 'signup' | 'forgot'
  readonly mode = signal<'login' | 'signup' | 'forgot'>('login');

  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly rememberMe = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  // Custom Dropdown open states
  readonly roleDropdownOpen = signal(false);
  readonly categoryDropdownOpen = signal(false);
  readonly brandDropdownOpen = signal(false);

  // Available Brands for Agency Self-Onboarding
  readonly availableBrands = signal<Array<{ id: number; name: string; category?: string }>>([]);
  readonly selectedBrandId = signal<number | undefined>(undefined);
  readonly selectedBrandName = signal<string>('');

  // Google Sign-In state
  readonly showGoogleModal = signal(false);
  readonly useAnotherGoogleAccount = signal(false);
  readonly googleEmail = signal('');

  readonly systemGoogleAccounts = signal<SystemGoogleAccount[]>(this.loadSystemGoogleAccounts());

  // Privacy & Help/Feedback Modals state
  readonly showPrivacyModal = signal(false);
  readonly showHelpModal = signal(false);
  readonly supportSenderEmail = signal('');
  readonly supportQuestion = signal('');
  readonly isSendingSupport = signal(false);

  // Self-Onboarding (Signup) extra fields
  readonly fullName = signal('');
  readonly organizationName = signal('');
  readonly websiteUrl = signal('');
  readonly category = signal('Lifestyle & Wellness');
  readonly role = signal<'BRAND_MANAGER' | 'AGENCY_MANAGER'>('BRAND_MANAGER');

  readonly categoryOptions = [
    'Lifestyle & Wellness',
    'Fashion & Beauty',
    'Skincare & Apparel',
    'Tech & Modern Work',
    'Creative & Culture'
  ];

  // Password Strength Computed ('none' | 'low' | 'medium' | 'high')
  readonly passwordStrength = computed<'none' | 'low' | 'medium' | 'high'>(() => {
    const val = this.password();
    if (!val) return 'none';
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    if (val.length < 6 || score <= 1) return 'low';
    if (score === 2 || score === 3) return 'medium';
    return 'high';
  });

  readonly passwordsMatch = computed(() => {
    const p = this.password();
    const c = this.confirmPassword();
    return p.length > 0 && c.length > 0 && p === c;
  });

  // Field validation flags
  readonly emailTouched = signal(false);
  readonly passwordTouched = signal(false);

  ngOnInit(): void {
    this.route.queryParams?.subscribe(params => {
      if (params['email']) {
        this.email.set(params['email']);
      }
      if (params['mode'] === 'signup') {
        this.setMode('signup');
      } else if (params['mode'] === 'forgot') {
        this.setMode('forgot');
      }
    });
    this.loadBrandsForOnboarding();
  }

  private loadBrandsForOnboarding(): void {
    if (typeof this.authService.getAvailableBrands === 'function') {
      this.authService.getAvailableBrands().subscribe({
        next: (brands) => {
          const list = (brands || []).map(b => ({ id: b.id, name: b.name, category: b.category }));
          this.availableBrands.set(list);
          if (list.length > 0 && !this.selectedBrandId()) {
            this.selectedBrandId.set(list[0].id);
            this.selectedBrandName.set(list[0].name);
          }
        },
        error: () => {
          // ignore if backend not started yet
        }
      });
    }
  }

  toggleBrandDropdown(): void {
    const nextOpen = !this.brandDropdownOpen();
    this.brandDropdownOpen.set(nextOpen);
    this.roleDropdownOpen.set(false);
    this.categoryDropdownOpen.set(false);
    if (nextOpen) {
      this.loadBrandsForOnboarding();
    }
  }

  selectPartnerBrand(brand: { id: number; name: string }): void {
    this.selectedBrandId.set(brand.id);
    this.selectedBrandName.set(brand.name);
    this.brandDropdownOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.showGoogleModal.set(false);
    this.showPrivacyModal.set(false);
    this.showHelpModal.set(false);
    this.roleDropdownOpen.set(false);
    this.categoryDropdownOpen.set(false);
    this.brandDropdownOpen.set(false);
  }

  private loadSystemGoogleAccounts(): SystemGoogleAccount[] {
    const defaultAccounts: SystemGoogleAccount[] = [
      {
        name: 'Chaitanya Mandviya',
        email: 'chaitanyamandviya7@gmail.com',
        avatarInitials: 'CM',
        avatarColor: '#37474f'
      },
      {
        name: 'Chaitanya Mandviya',
        email: 'chaitanyamandviya1@gmail.com',
        avatarInitials: 'C',
        avatarColor: '#0288d1'
      }
    ];
    try {
      const saved = localStorage.getItem('converge_google_accounts');
      if (saved) {
        const parsed: SystemGoogleAccount[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return defaultAccounts;
  }

  setMode(newMode: 'login' | 'signup' | 'forgot'): void {
    this.mode.set(newMode);
    this.clearMessages();
    this.confirmPassword.set('');
    this.roleDropdownOpen.set(false);
    this.categoryDropdownOpen.set(false);
    this.brandDropdownOpen.set(false);
    if (newMode === 'signup') {
      this.loadBrandsForOnboarding();
    }
  }

  private autoDismissTimer: any = null;

  showError(msg: string): void {
    this.successMessage.set('');
    this.errorMessage.set(msg);
    if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
    this.autoDismissTimer = setTimeout(() => {
      this.errorMessage.set('');
    }, 8000);
  }

  showSuccess(msg: string): void {
    this.errorMessage.set('');
    this.successMessage.set(msg);
    if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
    this.autoDismissTimer = setTimeout(() => {
      this.successMessage.set('');
    }, 8000);
  }

  dismissAlert(type: 'error' | 'success'): void {
    if (type === 'error') this.errorMessage.set('');
    if (type === 'success') this.successMessage.set('');
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  clearMessages(): void {
    if (this.errorMessage()) this.errorMessage.set('');
    if (this.successMessage()) this.successMessage.set('');
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
  }

  onEmailChange(val: string): void {
    this.email.set(val);
    if (this.errorMessage()) this.errorMessage.set('');
  }

  onPasswordChange(val: string): void {
    this.password.set(val);
    if (this.errorMessage()) this.errorMessage.set('');
  }

  selectRole(newRole: 'BRAND_MANAGER' | 'AGENCY_MANAGER'): void {
    this.role.set(newRole);
    this.roleDropdownOpen.set(false);
    if (newRole === 'AGENCY_MANAGER') {
      this.loadBrandsForOnboarding();
    }
  }

  selectCategory(cat: string): void {
    this.category.set(cat);
    this.categoryDropdownOpen.set(false);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(show => !show);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update(show => !show);
  }

  toggleRememberMe(): void {
    this.rememberMe.update(rem => !rem);
  }

  onGoogleSignIn(): void {
    this.errorMessage.set('');
    this.useAnotherGoogleAccount.set(false);
    this.showGoogleModal.set(true);
  }

  selectGoogleAccount(account: SystemGoogleAccount): void {
    this.authenticateGoogleEmail(account.email);
  }

  submitGoogleAccount(): void {
    const emailVal = this.googleEmail().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal || !emailRegex.test(emailVal)) {
      this.toast.error('Invalid Email', 'Please enter a valid personal or work Google email address.');
      return;
    }

    this.saveGoogleAccountToChooser(emailVal.split('@')[0], emailVal);
    this.authenticateGoogleEmail(emailVal);
  }

  private saveGoogleAccountToChooser(name: string, email: string): void {
    const cleanEmail = email.trim().toLowerCase();
    const initials = name
      .split(/\s+/)
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'G';

    const existing = this.systemGoogleAccounts().filter(a => a.email.toLowerCase() !== cleanEmail);
    const updated = [{ name, email: cleanEmail, avatarInitials: initials }, ...existing];
    this.systemGoogleAccounts.set(updated);
    try {
      localStorage.setItem('converge_google_accounts', JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  private authenticateGoogleEmail(emailVal: string): void {
    this.isLoading.set(true);
    this.authService.googleLogin(emailVal, this.rememberMe()).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.showGoogleModal.set(false);
        this.toast.success('Signed in with Google', `Authenticated as ${user.email}`);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toast.error('Google Sign-In Notice', err.message || 'Could not authenticate with Google.');
      }
    });
  }

  submitSupportRequest(): void {
    const msg = this.supportQuestion().trim();
    const sender = this.supportSenderEmail().trim() || this.email().trim() || 'User';
    if (!msg) {
      this.toast.error('Empty Message', 'Please enter your feedback or question.');
      return;
    }
    this.isSendingSupport.set(true);
    this.authService.submitFeedback(sender, msg).subscribe({
      next: () => {
        this.isSendingSupport.set(false);
        this.showHelpModal.set(false);
        this.supportQuestion.set('');
        this.toast.success('Feedback Sent', 'Your feedback or query has been delivered to the platform team.');
      },
      error: () => {
        this.isSendingSupport.set(false);
        this.showHelpModal.set(false);
        this.supportQuestion.set('');
        this.toast.success('Feedback Recorded', 'Your inquiry has been received by the support team.');
      }
    });
  }

  async onForgotPassword(): Promise<void> {
    const emailVal = this.email().trim();
    const newPass = this.password();
    const confPass = this.confirmPassword();

    if (!emailVal) {
      this.showError('Please enter your email address.');
      return;
    }

    if (newPass && newPass !== confPass) {
      this.showError('New password and Confirm password do not match.');
      return;
    }

    const confirmed = await this.confirmService.confirm({
      title: newPass ? 'Confirm Password Update?' : 'Send Password Recovery Email?',
      message: newPass
        ? `Save your new password for ${emailVal} and activate your workspace login?`
        : `Dispatch a password recovery link to ${emailVal}?`,
      detail: `Account: ${emailVal}`,
      confirmText: newPass ? 'Save Password' : 'Send Reset Link',
      variant: 'primary'
    });
    if (!confirmed) return;

    this.isLoading.set(true);
    this.authService.forgotPassword(emailVal, newPass).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.password.set('');
        this.confirmPassword.set('');
        this.toast.success(
          newPass ? 'Password Updated' : 'Reset Instructions Sent',
          newPass
            ? `Password updated for ${emailVal}. You can now log in.`
            : `Password recovery email dispatched to ${emailVal}.`
        );
        this.setMode('login');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showError(err.message || 'Could not reset password.');
      }
    });
  }

  async onSignUp(event: Event): Promise<void> {
    event.preventDefault();
    const emailVal = this.email().trim();
    const passVal = this.password();
    const confVal = this.confirmPassword();
    const orgVal = this.organizationName().trim();
    const nameVal = this.fullName().trim();
    const urlVal = this.websiteUrl().trim();

    if (!orgVal) {
      this.showError(
        this.role() === 'BRAND_MANAGER'
          ? 'Brand Name is mandatory.'
          : 'Agency Name is mandatory.'
      );
      return;
    }

    if (!nameVal || !emailVal || !passVal) {
      this.showError('Please complete all mandatory fields (*).');
      return;
    }

    if (emailVal.toLowerCase() === 'chaitanyamandviya7@gmail.com') {
      this.showError('Security Policy: System Administrator email cannot be used for Brand or Agency onboarding.');
      return;
    }

    if (passVal !== confVal) {
      this.showError('Password and Confirm Password do not match.');
      return;
    }

    const selectedRole = this.role();
    const bId = selectedRole === 'AGENCY_MANAGER' ? this.selectedBrandId() : undefined;
    const bName = selectedRole === 'AGENCY_MANAGER' ? this.selectedBrandName() : undefined;
    const roleLabel = selectedRole === 'BRAND_MANAGER' ? 'Brand Workspace' : 'Agency Workspace';

    const confirmed = await this.confirmService.confirm({
      title: `Submit ${roleLabel} Application?`,
      message: `Submit onboarding application for "${orgVal}" (${emailVal})?`,
      detail: selectedRole === 'AGENCY_MANAGER' && bName
        ? `Partner Brand: ${bName} · Applicant: ${nameVal}`
        : `Vertical: ${this.category()} · Applicant: ${nameVal}`,
      confirmText: 'Submit Application',
      variant: 'primary'
    });
    if (!confirmed) return;

    this.isLoading.set(true);

    this.authService.register(
      emailVal,
      passVal,
      selectedRole,
      nameVal,
      orgVal,
      this.category(),
      urlVal,
      bId,
      bName
    ).subscribe({
      next: () => {
        this.isLoading.set(false);
        const approver = selectedRole === 'BRAND_MANAGER'
          ? 'System Administrator'
          : (bName ? `Brand Manager (${bName})` : 'Brand Manager');
        this.mode.set('login');
        this.password.set('');
        this.confirmPassword.set('');
        this.showSuccess(
          `${orgVal} registered! Your account is pending approval by the ${approver}. Once approved, you can sign in.`
        );
        this.toast.success(
          'Submitted for Approval',
          `${orgVal} has been queued for ${approver} approval.`
        );
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showError(err.message || 'Could not submit onboarding application.');
      }
    });
  }

  onLogin(event: Event): void {
    event.preventDefault();
    this.emailTouched.set(true);
    this.passwordTouched.set(true);
    this.clearMessages();

    const emailVal = this.email().trim();
    const passVal = this.password();

    if (!emailVal) {
      this.showError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
      this.showError('Please enter a valid email address.');
      return;
    }

    if (!passVal) {
      this.showError('Please enter your password.');
      return;
    }

    this.isLoading.set(true);

    this.authService.login({
      email: emailVal,
      password: passVal,
      rememberMe: this.rememberMe()
    }).subscribe({
      next: (user) => {
        this.isLoading.set(false);
        this.toast.success('Welcome back', `Logged in as ${user.email}`);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showError(err.message || 'Authentication failed. Please check your credentials.');
      }
    });
  }
}
