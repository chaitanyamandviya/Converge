import { Component, ElementRef, HostListener, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CountryOption {
  iso: string;
  dial: string;
  label: string;
  name: string;
  minDigits: number;
  maxDigits: number;
  placeholder: string;
}

export const COUNTRY_CODES: CountryOption[] = [
  { iso: 'IN', dial: '+91', label: 'IN +91', name: 'India', minDigits: 10, maxDigits: 10, placeholder: '9876543210' },
  { iso: 'US', dial: '+1', label: 'US +1', name: 'United States', minDigits: 10, maxDigits: 10, placeholder: '5550000000' },
  { iso: 'UK', dial: '+44', label: 'UK +44', name: 'United Kingdom', minDigits: 10, maxDigits: 11, placeholder: '7700900077' },
  { iso: 'AE', dial: '+971', label: 'AE +971', name: 'UAE', minDigits: 9, maxDigits: 9, placeholder: '501234567' },
  { iso: 'SG', dial: '+65', label: 'SG +65', name: 'Singapore', minDigits: 8, maxDigits: 8, placeholder: '81234567' },
  { iso: 'AU', dial: '+61', label: 'AU +61', name: 'Australia', minDigits: 9, maxDigits: 9, placeholder: '412345678' },
  { iso: 'CA', dial: '+1', label: 'CA +1', name: 'Canada', minDigits: 10, maxDigits: 10, placeholder: '4165550199' },
  { iso: 'DE', dial: '+49', label: 'DE +49', name: 'Germany', minDigits: 10, maxDigits: 12, placeholder: '15123456789' },
  { iso: 'FR', dial: '+33', label: 'FR +33', name: 'France', minDigits: 9, maxDigits: 9, placeholder: '612345678' },
  { iso: 'JP', dial: '+81', label: 'JP +81', name: 'Japan', minDigits: 10, maxDigits: 10, placeholder: '9012345678' }
];

export function findCountryByIso(iso: string): CountryOption {
  return COUNTRY_CODES.find(c => c.iso === iso) || COUNTRY_CODES[0];
}

export function splitPhoneNumber(fullPhone?: string | null): { iso: string; local: string } {
  const raw = (fullPhone || '').trim();
  if (!raw) return { iso: 'IN', local: '' };
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (raw.startsWith(c.dial)) {
      const digits = raw.slice(c.dial.length).replace(/\D/g, '').slice(0, c.maxDigits);
      return { iso: c.iso, local: digits };
    }
  }
  return { iso: 'IN', local: raw.replace(/\D/g, '').slice(0, 10) };
}

export function validatePhoneDigits(iso: string, localValue: string, required = true): string {
  const digits = localValue.replace(/\D/g, '');
  if (!digits) return required ? 'Required' : '';
  const c = findCountryByIso(iso);
  if (c.minDigits === c.maxDigits && digits.length !== c.minDigits) {
    return `Enter ${c.minDigits} digits`;
  }
  if (digits.length < c.minDigits || digits.length > c.maxDigits) {
    return `${c.minDigits}-${c.maxDigits} digits`;
  }
  return '';
}

export function enforcePhoneKeydown(event: KeyboardEvent, currentDigits: string, maxDigits: number) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const allowedNav = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End', 'Enter'];
  if (allowedNav.includes(event.key)) return;
  if (!/^[0-9]$/.test(event.key)) {
    event.preventDefault();
    return;
  }
  const input = event.target as HTMLInputElement;
  const hasSelection = (input.selectionEnd ?? 0) > (input.selectionStart ?? 0);
  if (!hasSelection && currentDigits.length >= maxDigits) {
    event.preventDefault();
  }
}

@Component({
  selector: 'app-country-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative shrink-0">
      <button
        type="button"
        (click)="toggle()"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        aria-label="Country dialing code"
        class="h-7 px-2 rounded-[3px] bg-[#242424] hover:bg-[#2c2c2c] border border-white/[0.14] text-xs font-medium text-[#fff6e8] flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap focus:outline-none focus:border-[#f54e26]">
        <span class="tabular-nums">{{ selected().label }}</span>
        <svg class="w-3 h-3 text-[#a7a9be] transition-transform duration-150"
             [class.rotate-180]="open()"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      @if (open()) {
        <div
          role="listbox"
          class="absolute left-0 top-full mt-1.5 w-44 max-h-56 overflow-y-auto rounded-[4px] bg-[#161616] border border-white/[0.18] shadow-[4px_4px_0px_#f54e26] py-1 z-50">
          @for (c of countries; track c.iso) {
            <button
              type="button"
              role="option"
              [attr.aria-selected]="c.iso === iso()"
              (click)="selectCountry(c.iso)"
              class="w-full px-3 py-1.5 text-left text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
              [ngClass]="c.iso === iso()
                ? 'bg-[#fff6e8] text-[#111111] font-semibold'
                : 'text-[#fff6e8] hover:bg-white/[0.08]'">
              <span class="truncate">{{ c.name }}</span>
              <span class="tabular-nums shrink-0"
                    [ngClass]="c.iso === iso() ? 'text-[#111111]' : 'text-[#a7a9be]'">{{ c.label }}</span>
            </button>
          }
        </div>
      }
    </div>
  `
})
export class CountryPickerComponent {
  iso = input<string>('IN');
  isoChange = output<string>();

  readonly countries = COUNTRY_CODES;
  open = signal(false);
  selected = computed(() => findCountryByIso(this.iso()));

  constructor(private host: ElementRef<HTMLElement>) {}

  toggle() {
    this.open.update(v => !v);
  }

  selectCountry(nextIso: string) {
    this.open.set(false);
    this.isoChange.emit(nextIso);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.open()) this.open.set(false);
  }
}
