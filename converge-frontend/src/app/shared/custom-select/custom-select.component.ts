import { Component, ElementRef, forwardRef, HostListener, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOption {
  label: string;
  value: any;
}

@Component({
  selector: 'app-custom-select',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true
    }
  ],
  template: `
    <div class="custom-select-wrapper" [class.is-open]="isOpen()" [class.is-disabled]="disabled">
      <button
        type="button"
        class="select-trigger"
        (click)="toggleOpen($event)"
        [disabled]="disabled"
        [attr.aria-expanded]="isOpen()"
      >
        <span class="trigger-label" [class.placeholder]="!selectedLabel()">
          {{ selectedLabel() || placeholder }}
        </span>
        <svg class="chevron-icon" [class.rotated]="isOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      @if (isOpen()) {
        <div class="options-menu" (click)="$event.stopPropagation()">
          @for (opt of normalizedOptions(); track opt.value) {
            <div
              class="option-item"
              [class.selected]="isSelected(opt.value)"
              (click)="selectOption(opt, $event)"
            >
              <span class="option-text">{{ opt.label }}</span>
              @if (isSelected(opt.value)) {
                <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .custom-select-wrapper {
      position: relative;
      width: 100%;
      user-select: none;
      font-family: inherit;
    }

    .custom-select-wrapper.is-open {
      z-index: 50;
    }

    .select-trigger {
      width: 100%;
      height: 42px;
      padding: 0 14px;
      background: #FFFFFF;
      border: 1.5px solid rgba(36, 63, 130, 0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      color: #243F82;
      transition: all 0.18s ease;
      box-sizing: border-box;
    }

    .select-trigger:hover:not(:disabled) {
      border-color: #243F82;
      background: #FAF9F5;
    }

    .custom-select-wrapper.is-open .select-trigger {
      border-color: #243F82;
      box-shadow: 0 0 0 3px rgba(36, 63, 130, 0.12);
      background: #FFFFFF;
    }

    .trigger-label {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .trigger-label.placeholder {
      color: rgba(36, 63, 130, 0.45);
      font-weight: 500;
    }

    .chevron-icon {
      width: 16px;
      height: 16px;
      color: #243F82;
      flex-shrink: 0;
      transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .chevron-icon.rotated {
      transform: rotate(180deg);
    }

    .options-menu {
      position: absolute;
      top: calc(100% + 5px);
      left: 0;
      width: 100%;
      box-sizing: border-box;
      max-height: 250px;
      overflow-y: auto;
      background: #FFFFFF;
      border: 1px solid rgba(36, 63, 130, 0.16);
      border-radius: 10px;
      box-shadow: 0 12px 30px rgba(36, 63, 130, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04);
      padding: 5px;
      z-index: 1000;
      animation: menuPopIn 0.16s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .options-menu::-webkit-scrollbar {
      width: 6px;
    }
    .options-menu::-webkit-scrollbar-thumb {
      background: rgba(36, 63, 130, 0.2);
      border-radius: 999px;
    }

    .option-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 9px 12px;
      margin: 2px 0;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: #243F82;
      transition: all 0.12s ease;
    }

    .option-item:hover {
      background: rgba(36, 63, 130, 0.08);
      color: #243F82;
    }

    .option-item.selected {
      background: #243F82;
      color: #F6F4EC;
    }

    .option-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .check-icon {
      width: 14px;
      height: 14px;
      color: #F6F4EC;
      flex-shrink: 0;
    }

    @keyframes menuPopIn {
      from {
        opacity: 0;
        transform: translateY(-4px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .is-disabled {
      opacity: 0.6;
      pointer-events: none;
    }
  `]
})
export class CustomSelectComponent implements ControlValueAccessor {
  @Input() set options(val: Array<string | SelectOption>) {
    this._rawOptions = val || [];
  }
  @Input() placeholder = 'Select an option';
  @Input() disabled = false;

  private _rawOptions: Array<string | SelectOption> = [];
  value: any = null;
  readonly isOpen = signal(false);

  private onChange: (v: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private elementRef: ElementRef) {}

  normalizedOptions(): SelectOption[] {
    return this._rawOptions.map(opt => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt };
      }
      return opt;
    });
  }

  selectedLabel(): string {
    const found = this.normalizedOptions().find(o => this.isSelected(o.value));
    return found ? found.label : (this.value !== null && this.value !== undefined ? String(this.value) : '');
  }

  isSelected(optVal: any): boolean {
    if (this.value === optVal) return true;
    if ((this.value === null || this.value === undefined) && (optVal === null || optVal === undefined)) return true;
    return false;
  }

  toggleOpen(evt: MouseEvent): void {
    evt.stopPropagation();
    if (this.disabled) return;
    this.isOpen.update(o => !o);
    if (this.isOpen()) {
      this.onTouched();
    }
  }

  selectOption(opt: SelectOption, evt: MouseEvent): void {
    evt.stopPropagation();
    this.value = opt.value;
    this.onChange(this.value);
    this.isOpen.set(false);
  }

  writeValue(val: any): void {
    this.value = val;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isOpen.set(false);
  }
}