import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Agency } from '../services/api.service';
import {
  CountryPickerComponent,
  enforcePhoneKeydown,
  findCountryByIso,
  splitPhoneNumber,
  validatePhoneDigits
} from './country-picker.component';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export interface AgencyFormPayload {
  name: string;
  contactName: string;
  contactEmail: string;
  contactNumber: string;
  status: 'CONNECTED' | 'DRAFT';
}

@Component({
  selector: 'app-agency-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, CountryPickerComponent],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 bg-cv-backdrop backdrop-blur-xs flex items-center justify-center p-4 animate-pop-in" (click)="close.emit()">
        <div
          class="bg-cv-card rounded-[6px] max-w-xl w-full p-6 border border-cv-border-strong shadow-[6px_6px_0px_#f54e26]"
          [class.animate-shake]="shake()"
          (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between pb-3.5 border-b border-cv-border mb-4">
            <div>
              <h3 class="font-headline uppercase text-2xl font-bold text-cv-ink tracking-[0.02em] leading-none">
                {{ agency() ? 'EDIT AGENCY DETAILS' : 'NEW PARTNER AGENCY' }}
              </h3>
              <p class="text-xs text-cv-ink-muted mt-1">
                {{ agency() ? 'Update agency organization and manager contact details.' : 'Onboard a partner agency and assign its agency manager.' }}
              </p>
            </div>
            <button type="button" (click)="close.emit()" class="w-8 h-8 rounded-[4px] hover:bg-cv-hover-pill flex items-center justify-center text-cv-ink-muted hover:text-cv-ink cursor-pointer">✕</button>
          </div>

          @if (localError() || errorMsg()) {
            <div class="mb-4 px-3.5 py-2.5 rounded-[4px] bg-cv-danger-bg border border-[#ff5c5c]/40 text-xs text-cv-danger-ink font-medium flex items-center gap-2 animate-pop-in">
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v4"/>
                <circle cx="12" cy="16" r="0.6" fill="currentColor"/>
              </svg>
              <span>{{ localError() || errorMsg() }}</span>
            </div>
          }

          <form (ngSubmit)="submit(agency() ? existingStatus() : 'CONNECTED')" novalidate class="space-y-4">
            <!-- Row 1: Agency Organization Name + Agency Manager Name -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between h-4">
                  <label for="ag-org-name" class="text-xs text-cv-ink font-medium">Agency organization name</label>
                  @if ((nameTouched() || duplicateName()) && nameError()) {
                    <span class="text-xs text-cv-red-soft font-medium">{{ nameError() }}</span>
                  }
                </div>
                <div
                  class="group flex items-center gap-2.5 px-3 h-10 rounded-[4px] bg-cv-well border transition-colors duration-150"
                  [ngClass]="(nameTouched() || duplicateName()) && nameError()
                    ? 'border-[#ff5c5c]'
                    : (nameValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                  <svg class="doodle-svg w-4 h-4 shrink-0"
                       [ngClass]="(nameTouched() || duplicateName()) && nameError() ? 'text-[#ff5c5c]' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]'"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="4" y="4.5" width="16" height="15" rx="2.5"/>
                    <path d="M9 9h2M13 9h2M9 13h2M13 13h2M10 19.5v-3h4v3"/>
                  </svg>
                  <input
                    id="ag-org-name"
                    [ngModel]="orgName()"
                    (ngModelChange)="onFieldChange(orgName, $event)"
                    (blur)="nameTouched.set(true)"
                    name="agencyOrgName"
                    autocomplete="off"
                    placeholder="e.g. Studio North"
                    type="text"
                    class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                  @if (nameValid()) {
                    <svg class="w-4 h-4 text-cv-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="9" class="opacity-25" fill="currentColor"/>
                      <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                    </svg>
                  }
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between h-4">
                  <label for="ag-mgr-name" class="text-xs text-cv-ink font-medium">Agency manager name</label>
                  @if (mgrNameTouched() && mgrNameError()) {
                    <span class="text-xs text-cv-red-soft font-medium">{{ mgrNameError() }}</span>
                  }
                </div>
                <div
                  class="group flex items-center gap-2.5 px-3 h-10 rounded-[4px] bg-cv-well border transition-colors duration-150"
                  [ngClass]="mgrNameTouched() && mgrNameError()
                    ? 'border-[#ff5c5c]'
                    : (mgrNameValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                  <svg class="doodle-svg w-4 h-4 shrink-0"
                       [ngClass]="mgrNameTouched() && mgrNameError() ? 'text-[#ff5c5c]' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]'"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="8.5" r="3.6"/>
                    <path d="M5.5 19.5c1-3.2 3.3-4.8 6.5-4.8s5.5 1.6 6.5 4.8"/>
                  </svg>
                  <input
                    id="ag-mgr-name"
                    [ngModel]="mgrName()"
                    (ngModelChange)="onFieldChange(mgrName, $event)"
                    (blur)="mgrNameTouched.set(true)"
                    name="agencyMgrName"
                    autocomplete="off"
                    placeholder="Manager full name"
                    type="text"
                    class="w-full min-w-0 bg-transparent text-sm text-cv-ink placeholder:text-cv-ink-subtle focus:outline-none"/>
                  @if (mgrNameValid()) {
                    <svg class="w-4 h-4 text-cv-green shrink-0 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="9" class="opacity-25" fill="currentColor"/>
                      <path d="M8 12.5l2.7 2.7 5.5-6" class="doodle-check-path"/>
                    </svg>
                  }
                </div>
              </div>
            </div>

            <!-- Row 2: Agency Manager Email + Contact Number with Country Picker -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between h-4">
                  <label for="ag-mgr-email" class="text-xs text-cv-ink font-medium">Agency manager email</label>
                  @if (emailTouched() && emailError()) {
                    <span class="text-xs text-cv-red-soft font-medium">{{ emailError() }}</span>
                  }
                </div>
                <div
                  class="group flex items-center gap-2.5 px-3 h-10 rounded-[4px] bg-cv-well border transition-colors duration-150"
                  [ngClass]="emailTouched() && emailError()
                    ? 'border-[#ff5c5c]'
                    : (emailValid() ? 'border-[#007656] focus-within:border-[#f54e26]' : 'border-cv-border focus-within:border-[#f54e26]')">
                  <svg class="doodle-svg w-4 h-4 shrink-0"
                       [ngClass]="emailTouched() && emailError() ? 'text-[#ff5c5c]' : 'text-cv-ink-muted group-focus-within:text-[#f54e26]'"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/>
                    <path d="M5 7.5l7 5.2 7-5.2"/>
                  </svg>
                  <input
                    id="ag-mgr-email"
                    [ngModel]="mgrEmail()"
                    (ngModelChange)="onFieldChange(mgrEmail, $event)"
                    (blur)="emailTouched.set(true)"
                    name="agencyMgrEmail"
                    autocomplete="off"
                    placeholder="manager@agency.com"
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
                  <label for="ag-contact" class="text-xs text-cv-ink font-medium">Contact number</label>
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
                    id="ag-contact"
                    [value]="phoneLocal()"
                    (input)="onPhoneInput($event)"
                    (keydown)="onPhoneKeydown($event)"
                    (blur)="phoneTouched.set(true)"
                    [attr.maxlength]="selectedCountry().maxDigits"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    name="agencyContactNumber"
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

            <div class="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-cv-border-soft">
              @if (!agency()) {
                <button type="button" (click)="submit('DRAFT')" [disabled]="busy()"
                        class="h-10 px-5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover text-cv-ink-muted hover:text-cv-ink text-xs font-semibold border border-cv-border cursor-pointer transition-colors">
                  Save as Draft
                </button>
              } @else {
                <button type="button" (click)="close.emit()" [disabled]="busy()"
                        class="h-10 px-5 rounded-[4px] bg-cv-control hover:bg-cv-control-hover text-cv-ink-muted hover:text-cv-ink text-xs font-semibold border border-cv-border cursor-pointer transition-colors">
                  Cancel
                </button>
              }
              <button type="submit" [disabled]="busy()"
                      class="h-10 flex items-center justify-center gap-2 px-6 rounded-[4px] bg-[#f54e26] hover:bg-[#ff643e] text-[#111111] font-headline uppercase tracking-[0.03em] text-lg font-bold transition-colors cursor-pointer disabled:opacity-60">
                @if (busy()) {
                  <span>SAVING...</span>
                } @else {
                  <span>{{ agency() ? 'SAVE CHANGES ↗' : 'ONBOARD AGENCY ↗' }}</span>
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `
})
export class AgencyFormModalComponent implements OnChanges {
  open = input<boolean>(false);
  agency = input<Agency | null>(null);
  existingAgencies = input<Agency[]>([]);
  busy = input<boolean>(false);
  errorMsg = input<string>('');

  save = output<AgencyFormPayload>();
  close = output<void>();

  orgName = signal('');
  mgrName = signal('');
  mgrEmail = signal('');
  countryIso = signal('IN');
  phoneLocal = signal('');

  nameTouched = signal(false);
  mgrNameTouched = signal(false);
  emailTouched = signal(false);
  phoneTouched = signal(false);
  localError = signal('');
  shake = signal(false);

  selectedCountry = computed(() => findCountryByIso(this.countryIso()));

  existingStatus = computed<'CONNECTED' | 'DRAFT'>(() =>
    this.agency()?.status === 'DRAFT' ? 'DRAFT' : 'CONNECTED'
  );

  duplicateName = computed(() => {
    const clean = this.orgName().trim().toLowerCase();
    if (!clean) return false;
    const editingId = this.agency()?.id;
    return this.existingAgencies().some(a => a.id !== editingId && a.name.trim().toLowerCase() === clean);
  });

  nameError = computed(() => {
    const v = this.orgName().trim();
    if (!v) return 'Required';
    if (v.length < 2) return 'Min 2 chars';
    if (this.duplicateName()) return 'Already exists';
    return '';
  });
  nameValid = computed(() => this.orgName().trim().length >= 2 && !this.duplicateName());

  mgrNameError = computed(() => {
    const v = this.mgrName().trim();
    if (!v) return 'Required';
    if (v.length < 2) return 'Min 2 chars';
    return '';
  });
  mgrNameValid = computed(() => this.mgrName().trim().length >= 2);

  emailError = computed(() => {
    const v = this.mgrEmail().trim();
    if (!v) return 'Required';
    if (!EMAIL_REGEX.test(v)) return 'Invalid email';
    return '';
  });
  emailValid = computed(() => EMAIL_REGEX.test(this.mgrEmail().trim()));

  phoneError = computed(() => validatePhoneDigits(this.countryIso(), this.phoneLocal(), !this.agency()));
  phoneValid = computed(() => this.phoneLocal().length > 0 && !this.phoneError());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['agency']) {
      if (this.open()) {
        const ag = this.agency();
        this.orgName.set(ag?.name || '');
        this.mgrName.set(ag?.contactName || '');
        this.mgrEmail.set(ag?.contactEmail || '');
        const split = splitPhoneNumber(ag?.contactNumber);
        this.countryIso.set(split.iso);
        this.phoneLocal.set(split.local);
        this.nameTouched.set(false);
        this.mgrNameTouched.set(false);
        this.emailTouched.set(false);
        this.phoneTouched.set(false);
        this.localError.set('');
      }
    }
  }

  onFieldChange(target: { set: (val: string) => void }, val: string) {
    target.set(val);
    this.localError.set('');
  }

  onCountryChange(iso: string) {
    this.countryIso.set(iso);
    const max = this.selectedCountry().maxDigits;
    const trimmed = this.phoneLocal().replace(/\D/g, '').slice(0, max);
    this.phoneLocal.set(trimmed);
    if (trimmed) this.phoneTouched.set(true);
  }

  onPhoneKeydown(event: KeyboardEvent) {
    enforcePhoneKeydown(event, this.phoneLocal(), this.selectedCountry().maxDigits);
  }

  onPhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const max = this.selectedCountry().maxDigits;
    const digitsOnly = input.value.replace(/\D/g, '').slice(0, max);
    if (input.value !== digitsOnly) input.value = digitsOnly;
    this.phoneLocal.set(digitsOnly);
    this.localError.set('');
  }

  private triggerShake() {
    this.shake.set(false);
    setTimeout(() => this.shake.set(true), 10);
    setTimeout(() => this.shake.set(false), 400);
  }

  submit(status: 'CONNECTED' | 'DRAFT') {
    this.localError.set('');
    this.nameTouched.set(true);
    this.mgrNameTouched.set(true);
    this.emailTouched.set(true);
    if (status === 'CONNECTED' && !this.agency()) {
      this.phoneTouched.set(true);
    }

    const requirePhone = status === 'CONNECTED' && !this.agency();
    const phoneErr = validatePhoneDigits(this.countryIso(), this.phoneLocal(), requirePhone);
    if (this.nameError() || this.mgrNameError() || this.emailError() || phoneErr) {
      if (phoneErr) this.phoneTouched.set(true);
      this.triggerShake();
      this.localError.set(
        this.duplicateName()
          ? 'An agency with this name is already linked to this brand.'
          : 'Please fix the highlighted fields before continuing.'
      );
      return;
    }

    const rawPhone = this.phoneLocal().replace(/\D/g, '');
    const formattedPhone = rawPhone ? `${this.selectedCountry().dial} ${rawPhone}` : '';

    this.save.emit({
      name: this.orgName().trim(),
      contactName: this.mgrName().trim(),
      contactEmail: this.mgrEmail().trim().toLowerCase(),
      contactNumber: formattedPhone,
      status
    });
  }
}
