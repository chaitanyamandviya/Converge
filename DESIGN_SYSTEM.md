# Converge Design System & Architecture Rules

> **Version:** 2.0.0 — Executive & Apple Design Foundations  
> **Target Framework:** Angular 19+ (Standalone Components, Signals)  
> **Philosophy:** Apple Fluid Design (WWDC 2018/2026) × Executive SaaS (Stripe/Linear precision)

---

## 1. Design Philosophy & Apple Foundations

Converge follows Apple's fluid interface principles translated for enterprise web applications:

1. **Response — Kill Latency:** 
   - Instant visual response on pointer-down (`:active { transform: scale(0.97); }`), never waiting for mouse-up.
   - Eliminate artificial delays, debounces on UI feedback, and slow transitions.
2. **Behavior Over Fixed Animation (Spring Physics):**
   - Use critically damped springs (`damping: 1.0`, `response: 0.3–0.4s`) for UI transitions.
   - Reserve momentum bounces (`damping: ~0.8`) strictly for user-driven flicks or drag releases.
   - All modal and drawer transitions must be interruptible and originate from their trigger element (`transform-origin`).
3. **Materials & Translucency:**
   - Navbars, sticky headers, and modal overlays use translucent materials:
     ```css
     background: rgba(255, 255, 255, 0.82);
     backdrop-filter: blur(20px) saturate(180%);
     border-bottom: 1px solid rgba(226, 232, 240, 0.8);
     ```
   - Lighter materials draw focus; darker/heavier materials anchor structure.
4. **Optical Typography:**
   - Headings use size-dependent negative tracking (`letter-spacing: -0.025em`).
   - Financial figures and metrics use tabular numerals (`font-feature-settings: "tnum"`).
   - Zero cheap or muddy fonts. **Plus Jakarta Sans** for headings/brand, **Inter** for data grids.
5. **Restraint & Craft:**
   - Zero cartoon mascots, stickers, or fake decorative SVG lines in workspaces.
   - Every element earns its place. Statuses are muted and semantic (Emerald, Amber, Rose).

---

## 2. Design Token Definitions

Design tokens are defined centrally in [`converge-frontend/src/styles.css`](file:///C:/Converge/converge-frontend/src/styles.css) using standard CSS Custom Properties (`:root`).

### 2.1 Color Tokens (Executive Slate Palette)

```css
:root {
  /* Canvas & Surfaces (Zero Muddy Beige) */
  --color-canvas: #F8FAFC;            /* Clean crisp slate background */
  --color-surface: #FFFFFF;           /* Card & modal container background */
  --color-surface-subtle: #F1F5F9;    /* Table headers, hover rows, pill backgrounds */
  --color-surface-elevated: #FFFFFF;  /* Popovers and dropdown menus */

  /* Borders & Dividers */
  --color-border: #E2E8F0;            /* Standard 1px structural border */
  --color-border-subtle: #EDF2F7;     /* Inner dividers and row separators */
  --color-border-focus: #2563EB;      /* Interactive focus ring outline */

  /* Text & Content Hierarchy */
  --color-text-primary: #0F172A;      /* High-contrast slate black for titles & metrics */
  --color-text-secondary: #334155;    /* Body text, table data, active nav labels */
  --color-text-muted: #64748B;        /* Subtitles, table headers, breadcrumbs, hints */
  --color-text-disabled: #94A3B8;     /* Inactive controls and placeholder text */

  /* Single Brand Primary (Executive Electric Blue) */
  --color-brand-primary: #2563EB;     /* Primary actions, active links, brand accents */
  --color-brand-hover: #1D4ED8;       /* Hover state on primary actions */
  --color-brand-subtle: #EFF6FF;      /* Badge background, selected row tint */
  --color-brand-border: #BFDBFE;      /* Subtle brand borders */

  /* Semantic Statuses (Muted, Low-Saturation Backgrounds) */
  /* Active / Success / Live */
  --color-success-text: #059669;
  --color-success-bg: #ECFDF5;
  --color-success-border: #A7F3D0;

  /* Pending / Review / Warning */
  --color-warning-text: #D97706;
  --color-warning-bg: #FFFBEB;
  --color-warning-border: #FDE68A;

  /* Danger / Rejected / Critical */
  --color-danger-text: #DC2626;
  --color-danger-bg: #FEF2F2;
  --color-danger-border: #FECACA;
}
```

### 2.2 Typography Tokens

```css
:root {
  --font-family-display: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Tabular Numerals for Financial Data & INR Metrics */
  --font-features-data: "tnum" 1, "cv02" 1, "cv03" 1, "cv04" 1;

  /* Optical Tracking Scales */
  --tracking-display: -0.03em;   /* Large page titles (24px+) */
  --tracking-heading: -0.02em;   /* Section headers (16px–20px) */
  --tracking-body: -0.011em;     /* Body & table cells (13px–15px) */
  --tracking-label: 0.04em;      /* Uppercase micro-labels (10px–11px) */
}
```

### 2.3 Motion & Elevation Tokens (Apple Physics)

```css
:root {
  /* Apple WWDC Springs (Damping 1.0 = Critical, No Overshoot) */
  --spring-snappy: cubic-bezier(0.16, 1, 0.3, 1);
  --spring-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out-standard: cubic-bezier(0.2, 0, 0, 1);

  /* Durations */
  --duration-instant: 100ms;  /* Pointer-down button feedback */
  --duration-fast: 180ms;     /* Hover, tooltips, toggle pills */
  --duration-moderate: 280ms; /* Modals, dropdown menus, sheets */

  /* Micro-Elevations */
  --shadow-card: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05);
  --shadow-card-hover: 0 4px 14px -2px rgba(15, 23, 42, 0.08);
  --shadow-dropdown: 0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.05);
  --shadow-modal: 0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08);

  /* Radius System */
  --radius-xs: 4px;   /* Checkboxes, micro-tags */
  --radius-sm: 6px;   /* Badges, sub-controls */
  --radius-md: 8px;   /* Standard buttons, inputs, table cards */
  --radius-lg: 12px;  /* Metric cards, dialogs, drawers */
  --radius-xl: 16px;  /* Shell containers, outer modals */
  --radius-full: 9999px; /* Status pills, avatars */
}
```

---

## 3. Component Architecture & Patterns

Converge uses **Angular 19 Standalone Components** with Angular Signals for reactive state.

### 3.1 Component Hierarchy

```
src/app/
├── shared/                     # Reusable UI primitives
│   ├── custom-select/          # Accessible keyboard-navigable select dropdown
│   ├── confirm-dialog/         # Destructive/verification modal with spring enter/exit
│   └── toast/                  # Non-blocking top-center glass notification pill
├── dashboard/                  # Campaign overview, KPI grid, velocity chart
├── creators/                   # Talent roster table, onboarding modal
├── creator-detail/             # Influencer profile, rate setup, deliverable cards
├── agencies/                   # Partner agency management directory
├── content-library/            # Verified post and reel asset grid
├── login/                      # Executive single-card authentication
└── landing/                    # Public landing presentation
```

### 3.2 Standard Button Variants

Buttons must implement instant `:active` tactile feedback and clear focus rings:

```css
/* Base Button */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--font-family-display);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: transform var(--duration-instant) var(--spring-snappy),
              background-color var(--duration-fast) ease,
              border-color var(--duration-fast) ease,
              box-shadow var(--duration-fast) ease;
}

/* Apple Immediate Response on Pointer-Down */
.btn:active {
  transform: scale(0.97);
}

/* Primary Action */
.btn-primary {
  background-color: var(--color-text-primary);
  color: #FFFFFF;
  border-color: var(--color-text-primary);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.1);
}
.btn-primary:hover {
  background-color: #1E293B;
  border-color: #1E293B;
}

/* Secondary / Outline Action */
.btn-secondary {
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  border-color: var(--color-border);
  box-shadow: var(--shadow-card);
}
.btn-secondary:hover {
  background-color: var(--color-surface-subtle);
}

/* Danger / Destructive Action */
.btn-danger {
  background-color: var(--color-danger-bg);
  color: var(--color-danger-text);
  border-color: var(--color-danger-border);
}
.btn-danger:hover {
  background-color: #FEE2E2;
}
```

### 3.3 Status Badges & Pills

All badges adhere to a single 22px height, 6px radius or pill shape, with a 6px status dot:

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  border: 1px solid transparent;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

/* Success / Active */
.badge-success {
  background-color: var(--color-success-bg);
  color: var(--color-success-text);
  border-color: var(--color-success-border);
}
.badge-success .badge-dot { background-color: var(--color-success-text); }

/* Neutral Tag */
.badge-neutral {
  background-color: var(--color-surface-subtle);
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}
```

---

## 4. Frameworks, Libraries & Bundler

* **Framework:** Angular 19 (`@angular/core`, `@angular/router`, `@angular/forms`)
* **State Management:** Native Angular Signals (`signal()`, `computed()`) with zero external boilerplate.
* **Component Architecture:** 100% Standalone (`imports: [CommonModule, RouterLink, FormsModule]`).
* **Bundler:** Angular Application Builder with Vite & esbuild (`@angular-devkit/build-angular:application`).
* **Output Target:** Static ESM bundle output to `/dist/converge-frontend` deployed to Cloudflare Pages.
* **CSS Processor:** Modern native CSS with CSS custom variables, Flexbox, and CSS Grid.

---

## 5. Asset Management & Optimization

* **Static Assets Directory:** `converge-frontend/public/assets/`
* **Public Base URL:** `/assets/*`
* **Brand Favicon:**
  * Vector icon: `public/assets/converge-icon.svg`
  * Fallback icon: `public/favicon.ico`
  * Cache-busted link tag in `index.html`:
    ```html
    <link rel="icon" type="image/svg+xml" href="/assets/converge-icon.svg?v=2">
    ```
* **Avatar Fallbacks:** Unavatar CDN with initial generator fallback (`CR`, `JL`) when offline or blocked.

---

## 6. Icon System

* **Location:** Vector SVG markup or standalone SVGs in `converge-frontend/public/assets/`.
* **Standard Grid:** 16×16px (micro/action), 20×20px (inputs/buttons), 24×24px (nav).
* **Conventions:**
  * Outline icons use `stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"`.
  * Inherits font color via `currentColor` so hover states change seamlessly with text.

---

## 7. Data Sanitation & Robustness Rules

1. **Currency Formatting:**
   All INR figures must be run through `formatInr()` using Indian numbering system (`1,00,000` = 1 Lakh) with monospace tabular numbers.
2. **Division & Sanity Guards:**
   * Never divide by zero or unverified follower counts.
   * If `followersCount < 1000` or `deliverables === 0`, CPM and CPV must return an honest dash (`—`) rather than runaway multi-crore numbers.
3. **Notice & Toast Policy:**
   * Never stack competing success and error banners.
   * Modals clear notification state on open and close.
   * Toasts auto-dismiss after 4.5 seconds with top-center acrylic pill presentation.

---

## 8. Figma MCP Integration Map

When inspecting or generating Figma designs for Converge:

| Figma Layer / Token | Code Implementation | CSS Variable |
|---|---|---|
| `Color/Background/Canvas` | Canvas background | `--color-canvas` (`#F8FAFC`) |
| `Color/Background/Card` | Surface card | `--color-surface` (`#FFFFFF`) |
| `Color/Border/Default` | Container 1px border | `--color-border` (`#E2E8F0`) |
| `Color/Brand/Primary` | Primary button / active state | `--color-brand-primary` (`#2563EB`) |
| `Color/Text/Primary` | Page title / Metric values | `--color-text-primary` (`#0F172A`) |
| `Color/Text/Muted` | Subheaders / hints | `--color-text-muted` (`#64748B`) |
| `Typography/Display/Bold` | Page titles (24px, -0.025em) | `var(--font-family-display)`, 700 |
| `Typography/Data/Tabular` | Metric figures & Rupees | `var(--font-features-data)`, 700 |
| `Radius/Card` | Metric & table cards | `--radius-lg` (`12px`) |
| `Radius/Button` | Primary / secondary buttons | `--radius-md` (`8px`) |
