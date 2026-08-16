---
name: Clinical Excellence System
colors:
  surface: '#faf8ff'
  surface-dim: '#dbd9df'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f9'
  surface-container: '#efedf3'
  surface-container-high: '#e9e7ed'
  surface-container-highest: '#e3e2e8'
  on-surface: '#1a1b20'
  on-surface-variant: '#444650'
  inverse-surface: '#2f3035'
  inverse-on-surface: '#f2f0f6'
  outline: '#757681'
  outline-variant: '#c5c6d1'
  surface-tint: '#465c9b'
  primary: '#000c2f'
  on-primary: '#ffffff'
  primary-container: '#001f5d'
  on-primary-container: '#7389cc'
  inverse-primary: '#b4c5ff'
  secondary: '#bb0011'
  on-secondary: '#ffffff'
  secondary-container: '#e6181f'
  on-secondary-container: '#fffbff'
  tertiary: '#230400'
  on-tertiary: '#ffffff'
  tertiary-container: '#481000'
  on-tertiary-container: '#cb7458'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#2d4481'
  secondary-fixed: '#ffdad6'
  secondary-fixed-dim: '#ffb4ab'
  on-secondary-fixed: '#410002'
  on-secondary-fixed-variant: '#93000b'
  tertiary-fixed: '#ffdbd0'
  tertiary-fixed-dim: '#ffb59e'
  on-tertiary-fixed: '#3a0b00'
  on-tertiary-fixed-variant: '#76321b'
  background: '#faf8ff'
  on-background: '#1a1b20'
  surface-variant: '#e3e2e8'
typography:
  display-lg:
    fontFamily: manrope
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  body-lg:
    fontFamily: manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: workSans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: workSans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 8px
  section-padding-desktop: 120px
  section-padding-mobile: 64px
  gutter: 24px
  margin-mobile: 20px
  container-max-width: 1280px
---

## Brand & Style

The brand personality is authoritative yet empathetic, designed to instill immediate confidence in patients. It balances the sterile precision of high-end clinical environments with a warm, human-centric approach. 

The design style is **Corporate / Modern** with subtle **Minimalist** influences. It prioritizes clarity, utilizing generous whitespace to reduce cognitive load and structured information hierarchies to facilitate quick navigation. Visual interest is generated through high-quality medical photography and rhythmic repetition of geometric elements, ensuring the interface feels organized, sterile, and professional.

## Colors

The palette is anchored by **Navy Blue**, a color associated with stability and trust, used extensively for structural elements like headers and core branding. **Alpha Hill Red** serves as a high-visibility accent for critical actions, emergency indicators, and primary call-to-actions, ensuring they stand out against the calm blue and white base. 

A secondary **Light Grey-Blue** background is utilized to create tonal separation between sections, preventing the layout from feeling overly stark while maintaining a "medical-clean" aesthetic.

## Typography

This design system uses **Manrope** as the primary typeface for its modern, geometric construction that remains highly legible in clinical contexts. It strikes a balance between professional and friendly. **Work Sans** is introduced for labels and utility text to provide a more functional, grounded feel for metadata and navigation.

Headers should use heavier weights (Bold/ExtraBold) to establish a clear hierarchy, while body copy maintains a regular weight for maximum readability. Tighten letter-spacing on larger displays to maintain visual density.

## Layout & Spacing

The design system employs a **Fixed Grid** model on desktop to ensure content remains centered and readable on large monitors. A 12-column grid is used with 24px gutters.

- **Desktop:** 12 columns, 120px vertical section spacing to create an "open" and "breezy" feeling.
- **Tablet:** 8 columns, 80px vertical spacing.
- **Mobile:** 4 columns, 64px vertical spacing with 20px side margins.

Spacing follows an 8px linear scale. Large components like Hero sections should utilize the maximum container width, while text-heavy articles should be constrained to a 8-column center span to improve line-length readability.

## Elevation & Depth

Visual depth is achieved through **Tonal Layers** and **Low-contrast outlines** rather than heavy shadows. This maintains a clean, clinical look.

1.  **Level 0 (Base):** White background.
2.  **Level 1 (Subtle Depth):** Light Grey-Blue (`#EEF1F7`) surfaces used for cards or alternating section backgrounds.
3.  **Interactive Elevation:** Primary buttons and active cards use a very soft, highly diffused ambient shadow (Color: `#001F5D`, Opacity: 8%, Blur: 20px) to indicate interactivity without breaking the flat aesthetic.
4.  **Dividers:** Use 1px solid lines in a slightly darker shade of the surface color to separate content within cards.

## Shapes

The shape language is **Soft**. A 0.25rem (4px) base radius is applied to most UI elements like input fields and small buttons, conveying precision. Larger components like service cards and hero images use a `rounded-lg` (8px) radius to feel more approachable. 

Avoid fully circular buttons (pills) unless they are floating action buttons or specific notification badges; the slight rounding maintains the "professional institution" character better than overly organic shapes.

## Components

### Buttons
- **Primary:** Alpha Hill Red background, white text. Bold, uppercase labels.
- **Secondary:** Navy Blue background or outline. 
- **Tertiary:** Ghost style with Navy Blue text and a small trailing arrow icon.

### Cards
Cards should have a white background on the Light Grey-Blue surface. They feature an 8px corner radius and a 1px border (`#D1D9E6`). On hover, cards lift slightly with a subtle ambient shadow.

### Input Fields
Strict, rectangular fields with a 4px radius. Use a 1px Navy Blue border for the active state and a Light Grey-Blue background for the default state to distinguish from the page background.

### Chips/Tags
Small, rounded-sm containers with Light Grey-Blue backgrounds and Navy Blue text, used for medical categories or department labels.

### Icons
Use a consistent stroke-based icon set (2px weight). Icons within CTA areas or service highlights should use Alpha Hill Red to draw the eye.