---
name: Kinetic Logic
colors:
  surface: '#131315'
  surface-dim: '#131315'
  surface-bright: '#39393b'
  surface-container-lowest: '#0e0e10'
  surface-container-low: '#1c1b1d'
  surface-container: '#201f22'
  surface-container-high: '#2a2a2c'
  surface-container-highest: '#353437'
  on-surface: '#e5e1e4'
  on-surface-variant: '#bccbb9'
  inverse-surface: '#e5e1e4'
  inverse-on-surface: '#313032'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#4ae176'
  primary: '#4be277'
  on-primary: '#003915'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#006e2f'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#ffba61'
  on-tertiary: '#472a00'
  tertiary-container: '#ef9900'
  on-tertiary-container: '#5c3800'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#131315'
  on-background: '#e5e1e4'
  surface-variant: '#353437'
typography:
  timer-display:
    fontFamily: JetBrains Mono
    fontSize: 120px
    fontWeight: '700'
    lineHeight: 120px
    letterSpacing: -0.05em
  timer-display-mobile:
    fontFamily: JetBrains Mono
    fontSize: 72px
    fontWeight: '700'
    lineHeight: 72px
    letterSpacing: -0.05em
  scramble-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: 0.1em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  table-data:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  touch-target-min: 48px
---

## Brand & Style

The design system is engineered for the high-intensity, high-precision environment of professional speedcubing. The aesthetic follows a **"Cockpit" Modernism**—a blend of utility-first minimalism and technical sophistication. It prioritizes the "flow state" of the athlete, ensuring that the UI recedes when the cube is in motion and provides clinical clarity during post-solve analysis.

The visual language focuses on high-speed information processing. It avoids decorative elements, favoring structural integrity and functional density. The interface should feel like a specialized instrument rather than a general-purpose application, utilizing deep blacks to minimize glare and maximize the vibrancy of the cube's facets.

## Colors

The palette is strictly dark-mode to ensure high contrast against the bright plastic colors of a physical or digital speed cube.

- **Surface:** #09090b (True Dark) – used for the primary background to eliminate light bleed.
- **Container:** #18181b (Deep Gray) – used for panels, sidebar, and secondary navigation modules.
- **Primary (Action/Success):** #22c55e (Vibrant Green) – signals the "Ready" state of the timer, successful personal bests (PBs), and active Bluetooth connections.
- **Secondary (Info):** #3b82f6 (Electric Blue) – used for interactive elements, link highlights, and reconstruction steps.
- **Tertiary (Warning/Alert):** #f59e0b (Amber) – used for DNF (Did Not Finish) or +2 penalty indicators.

## Typography

The system utilizes two distinct typefaces to separate UI navigation from solve data.

- **Geist (Sans-Serif):** Used for all functional UI elements, navigation, and settings. It provides a clean, technical look that maintains legibility even at small sizes in high-density tables.
- **JetBrains Mono (Monospace):** Used for all solve-related data, including the timer, scramble algorithms, and CFOP split times. The tabular nature of the font prevents "number jumping" as the timer runs and ensures that reconstruction moves (R, U', L2) align vertically for quick scanning.

**Hierarchy Note:** The Scramble display must use generous letter spacing to ensure no ambiguity between moves during the high-speed preparation phase.

## Layout & Spacing

This design system uses a **Fixed Grid** approach for data views and a **Dynamic Cockpit** approach for the timer view. 

- **The Timer View:** A centered layout where the 3D cube is the hero, surrounded by "instrument" widgets (splits, scramble, session average). 
- **The Data View:** A 12-column grid with 16px gutters. Tables occupy the central 8-10 columns to prevent eye-strain across ultra-wide monitors.
- **Touch Targets:** Since users interact with the screen while holding a cube, all interactive buttons must adhere to a minimum 48px touch target. 
- **Responsive Behavior:** On mobile, the 3D cube moves to the top third, with the timer occupying the center and history moving to a bottom-sheet pattern.

## Elevation & Depth

To maintain the "instrument panel" feel, the system uses **Tonal Layering** rather than shadows. 

- **Level 0 (Surface):** #09090b. This is the "void" where the 3D cube sits.
- **Level 1 (Container):** #18181b. Used for sidebar cards, history lists, and secondary widgets.
- **Level 2 (Active/Floating):** #27272a. Used for hover states or active modal dialogs.
- **Outlines:** Instead of shadows, use 1px "ghost borders" (#27272a) to define the boundaries of containers. This maintains a crisp, digital aesthetic that works well in low-light environments.

## Shapes

The design system uses **Soft (0.25rem)** roundedness. This provides a subtle modern touch without compromising the "precision tool" aesthetic. 

- **Buttons & Inputs:** 4px (0.25rem) corner radius.
- **Cards & Larger Containers:** 8px (0.5rem) corner radius.
- **Status Indicators:** Fully circular (pill) for Bluetooth and Battery icons to distinguish them from interactive buttons.

## Components

- **Timer Display:** Large, monospaced digits. Color shifts from White (Default) to Primary Green (Ready) to Primary Green (Running/Pulse).
- **Scramble Display:** A dedicated panel at the top of the UI. Background should be slightly lighter than the surface (#18181b) to separate it from the 3D cube. Text is mono-spaced and large.
- **High-Density Data Tables:** Used for solve history. Row height should be compact (32-40px). Hover states should use a subtle gray highlight (#27272a). Use "—" as an empty state rather than "0.00" to avoid confusion with actual data.
- **3D Cube Container:** A borderless area with a subtle radial gradient behind the cube to provide a sense of depth without distracting from the facets.
- **Status Indicators:** Small icons (Bluetooth/Battery) located in the top-right "Utility Bar". Use Primary Green for connected/full, Amber for low battery/searching, and Neutral Gray for disconnected.
- **Action Buttons:** Large, high-contrast blocks. Primary actions (Save Solve) use a solid Primary Green fill with Black text. Secondary actions (Delete/Penalty) use outlined buttons with colored text.