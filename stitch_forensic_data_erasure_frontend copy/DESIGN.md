---
name: ForensicGuard
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1b1b1d'
  surface-container: '#1f1f21'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e4e2e4'
  on-surface-variant: '#c0c6d6'
  inverse-surface: '#e4e2e4'
  inverse-on-surface: '#303032'
  outline: '#8b91a0'
  outline-variant: '#414754'
  surface-tint: '#aac7ff'
  primary: '#aac7ff'
  on-primary: '#003064'
  primary-container: '#3e90ff'
  on-primary-container: '#002957'
  inverse-primary: '#005db8'
  secondary: '#c2c1ff'
  on-secondary: '#1800a7'
  secondary-container: '#3630bf'
  on-secondary-container: '#b1b1ff'
  tertiary: '#e9b3ff'
  on-tertiary: '#510074'
  tertiary-container: '#c863fb'
  on-tertiary-container: '#460066'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aac7ff'
  on-primary-fixed: '#001b3e'
  on-primary-fixed-variant: '#00468d'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c2c1ff'
  on-secondary-fixed: '#0c006b'
  on-secondary-fixed-variant: '#332dbc'
  tertiary-fixed: '#f6d9ff'
  tertiary-fixed-dim: '#e9b3ff'
  on-tertiary-fixed: '#310048'
  on-tertiary-fixed-variant: '#7200a3'
  background: '#131315'
  on-background: '#e4e2e4'
  surface-variant: '#353437'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 24px
---

## Brand & Style
The design system is engineered for the high-stakes environment of digital forensics and data sanitization. The brand personality is **authoritative, surgical, and impenetrable**. It targets cybersecurity experts and forensic investigators who require absolute clarity and zero distractions.

The visual style is **Modern Professional with a Technical Edge**. It utilizes a "Dark Mode First" architecture to reduce eye strain during long investigation cycles. The aesthetic borrows from high-end developer tools and command-line interfaces: high-density layouts, subtle glow effects for active processes, and a strict adherence to a logic-driven hierarchy. Every pixel must communicate security and precision.

## Colors
The palette is centered on a "Deep Charcoal" base to provide a stable, low-distraction environment. 

- **Primary (Forensic Blue):** Used for core actions, active scanning states, and focal points.
- **Danger (Sanitization Red):** Reserved strictly for destructive actions like permanent data wiping and critical security breaches.
- **Warning (Integrity Amber):** Indicates hash mismatches, potential file corruption, or incomplete audit trails.
- **Success (Verification Green):** Confirms successful data sanitization and integrity validation.

Neutral tones follow a strict "Elevated Slate" scale. Surface layers use higher hex values to indicate hierarchy, while borders utilize a medium-grey to define structure without visual noise.

## Typography
The system utilizes **Inter** for all UI elements to ensure maximum legibility across dense data visualizations. For technical strings, hashes (SHA-256), and file paths, **JetBrains Mono** is employed to prevent character confusion (e.g., distinguishing '0' from 'O').

- **Headlines:** Should be concise. Use bold weights to anchor page sections.
- **Body:** Optimized for reading long logs and forensic reports.
- **Labels:** Uppercase labels with slight tracking are used for metadata headers and table columns to differentiate them from actual data values.
- **Mobile:** Scale large headlines down by 20% on devices smaller than 768px.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. The sidebar and toolbars are fixed to provide constant access to forensic utilities, while the main workspace is a fluid 12-column grid that expands to reveal data-heavy tables.

- **Rhythm:** A 4px baseline grid ensures technical precision in component alignment.
- **Density:** This is a "High Density" system. Use `sm` and `md` spacing tokens for internal card padding to maximize information density.
- **Breakpoints:**
  - Desktop: 12 columns, 24px margins.
  - Tablet: 8 columns, 16px margins.
  - Mobile: 4 columns, 16px margins, stacking all side-by-side technical stats.

## Elevation & Depth
In this system, depth is communicated through **Tonal Layering** rather than traditional shadows. Shadows are inefficient for high-density forensic tools.

- **Level 0 (Background):** Base layer (#0F0F10).
- **Level 1 (Surface):** Default container color (#1C1C1E).
- **Level 2 (Overlay):** Used for modals and dropdowns (#2C2C2E) with a subtle 1px border.
- **Accents:** Use a **Subtle Glow** (Inner shadow or low-spread outer drop shadow) in Primary Blue to indicate a running forensic process or a selected active file.
- **Borders:** Every surface must have a high-contrast 1px border (#2C2C2E) to maintain structural definition in the dark environment.

## Shapes
The system uses a **Soft-Sharp** geometry. While pure sharp corners feel dated, excessive rounding feels too casual for forensic software. 

- **Standard Elements:** Buttons, inputs, and cards use a 4px (0.25rem) radius.
- **Technical Tags:** Small status chips use the same 4px radius, never pill-shaped.
- **Icons:** Use linear, 2px stroke icons with square terminals to match the font's technical character.

## Components
- **Buttons:** Primary buttons use a solid Blue fill. Destructive buttons (Sanitize) use a 1px Red border with a faint red tint on hover to prevent accidental clicks.
- **Data Tables:** These are the core of the UI. Use zebra-striping with a very subtle variance in grey. Headers must be "Sticky" and use the `label-caps` type style.
- **Status Chips:** Small, rectangular indicators. "Scanning" should have a subtle pulse animation; "Verified" is static Green.
- **Input Fields:** Use dark fills with high-contrast borders. On focus, the border transitions to Primary Blue with a 2px outer glow.
- **Activity Feed:** A monospaced vertical list showing real-time system logs, with timestamps color-coded in neutral-grey.
- **Progress Bars:** Thin, 4px height bars. For sanitization, use a segmented progress bar to indicate "passes" (e.g., DoD 5220.22-M 3-pass wipe).