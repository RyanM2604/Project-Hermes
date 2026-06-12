---
name: Project Hermes
description: A clear, alive, and trustworthy campus discovery product for UWaterloo students.
colors:
  night-canvas: "#050505"
  night-surface: "#101014"
  night-raised: "#18181b"
  signal-blue: "#2563eb"
  signal-blue-hover: "#3b82f6"
  signal-light: "#7db5ff"
  ink-primary: "#ffffff"
  ink-secondary: "#d4d4d8"
  ink-muted: "#71717b"
  line-subtle: "#ffffff14"
  success: "#6ee7b7"
  warning: "#fdba74"
typography:
  display:
    fontFamily: "Inter, Geist, system-ui, sans-serif"
    fontSize: "3.75rem"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter, Geist, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Inter, Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  control: "12px"
  card: "20px"
  panel: "24px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.signal-blue-hover}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-secondary:
    backgroundColor: "{colors.night-raised}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  chip-selected:
    backgroundColor: "{colors.ink-primary}"
    textColor: "{colors.night-canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  chip-default:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  card-event:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.card}"
    padding: "24px"
  input-default:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "14px 16px"
---

# Design System: Project Hermes

## 1. Overview

**Creative North Star: "The Clear Campus Pulse"**

Hermes feels like a calm, high-signal view of campus life. The product uses a
deep night canvas because students often browse between classes, at events, or
late in the day, while restrained blue signals make timely actions and current
state immediately legible. The interface should feel alive through content and
freshness, not through visual noise.

The system is product-first. Repeated use should feel fast, familiar, and
trustworthy. Marketing surfaces can become more expressive, but app surfaces
prioritise scannability, clear hierarchy, conventional affordances, and
consistent interaction states. Social warmth belongs in event imagery, club
identity, active states, and moments of commitment.

Hermes explicitly rejects generic university administration interfaces, dense
calendar databases, neon social feeds, vague AI/SaaS gradients, and
transactional ticketing aesthetics.

**Key Characteristics:**

- Restrained dark surfaces with one clear blue signal
- High-signal event metadata and visible source provenance
- Soft ambient depth used selectively, never as decorative glass everywhere
- Precise, familiar controls with generous mobile tap targets
- Social energy expressed through event content rather than interface chaos

## 2. Colors

The palette is a restrained night-neutral system with a focused electric-blue
signal and semantic colors reserved for meaningful state.

### Primary

- **Signal Blue** (`#2563eb`): Primary actions, selected states, current
  navigation, and high-confidence interactive emphasis.
- **Signal Blue Hover** (`#3b82f6`): Hover and active response for primary
  controls.
- **Signal Light** (`#7db5ff`): Source indicators, secondary active labels, and
  subtle product guidance.

### Secondary

- **Success Mint** (`#6ee7b7`): Confirmed success, live state, and positive
  status.
- **Opportunity Amber** (`#fdba74`): Free food, time sensitivity, and warning
  states when paired with text or icons.

### Neutral

- **Night Canvas** (`#050505`): Primary application background.
- **Night Surface** (`#101014`): Cards, toolbars, filters, and input surfaces.
- **Night Raised** (`#18181b`): Hovered, selected, or structurally raised
  product surfaces.
- **Primary Ink** (`#ffffff`): Headings and high-priority information.
- **Secondary Ink** (`#d4d4d8`): Body copy, labels, and action text.
- **Muted Ink** (`#71717b`): Supporting metadata only when contrast remains
  compliant.
- **Subtle Line** (`#ffffff14`): Dividers and surface boundaries.

### Named Rules

**The Signal Rule.** Blue indicates an action, active state, or trusted source.
It is not ambient decoration.

**The State Needs Language Rule.** Success, warning, and selected states always
use text or iconography in addition to color.

## 3. Typography

**Display Font:** Inter with Geist and system-ui fallbacks  
**Body Font:** Inter with Geist and system-ui fallbacks  
**Label/Mono Font:** Geist Mono for technical identifiers only

**Character:** One disciplined sans-serif family keeps the product calm and
fast. Hierarchy comes from weight, size, spacing, and content order rather than
decorative type pairing.

### Hierarchy

- **Display** (800, up to `3.75rem`, `1.04`): Marketing and onboarding moments
  only. Never use display scale inside routine product workflows.
- **Headline** (700, `2.25rem`, `1.12`): Page-level product headings and major
  empty states.
- **Title** (700, `1.25rem`, `1.25`): Event titles, panel headings, and
  high-priority card content.
- **Body** (400, `1rem`, `1.625`): Explanatory copy with a maximum comfortable
  line length of 65-75 characters.
- **Label** (600, `0.875rem`, `1.25`): Buttons, filters, metadata labels, and
  navigation.

### Named Rules

**The Product Scale Rule.** App typography uses fixed, restrained steps. Fluid
display typography belongs only on the marketing landing page.

## 4. Elevation

Hermes uses a hybrid of tonal layering and restrained ambient shadows. Surfaces
are defined first by background and a subtle full border. Shadows clarify
structural elevation or interactive response; they do not create decorative
floating glass.

### Shadow Vocabulary

- **Ambient Panel** (`0 24px 70px rgba(0,0,0,0.28)`): Major cards and panels
  that sit above the page canvas.
- **Interactive Lift** (`0 12px 32px rgba(0,0,0,0.24)`): Temporary hover or
  focused elevation for actionable surfaces.
- **Inset Highlight** (`inset 0 1px 0 rgba(255,255,255,0.08)`): Subtle top edge
  definition on dark controls and cards.

### Named Rules

**The Lift Must Mean Something Rule.** A shadow indicates hierarchy or
interaction. If neither is present, use tonal layering and a subtle border.

## 5. Components

Components are restrained and operationally precise. Social warmth is reserved
for event content and active states.

### Buttons

- **Shape:** Confident rounded rectangle (`12px`), with pill buttons reserved
  for compact navigation and filters.
- **Primary:** Signal Blue background, white label, `12px 20px` padding.
- **Hover / Focus:** Brighter blue on hover; a visible, high-contrast focus
  ring that is not communicated by color alone.
- **Secondary / Ghost:** Night Raised or transparent background with a subtle
  full border. Ghost buttons retain a clear hover fill.
- **Targets:** Interactive targets are at least `44px` tall on mobile.

### Chips

- **Style:** Compact pill with a subtle full border and plain-language label.
- **State:** Selected chips use Primary Ink on Night Canvas or a clearly
  bounded Signal Blue treatment. Unselected chips remain neutral.
- **Use:** Filters, tags, and short status labels only. Do not turn all
  metadata into chips.

### Cards / Containers

- **Corner Style:** Event cards use `20px`; major panels use `24px`.
- **Background:** Night Surface with Night Raised for selected or hovered
  states.
- **Shadow Strategy:** Tonal and bordered at rest; ambient shadow only for
  major or interactive elevation.
- **Border:** A subtle full `1px` boundary. Never use a colored side stripe.
- **Internal Padding:** `20px-24px`, scaled down carefully on mobile.
- **Event Cards:** Semantically expose title, time, location, price, source,
  and actions. Cards must support keyboard and screen-reader navigation.

### Inputs / Fields

- **Style:** Night Surface background, subtle full border, `12px` radius, and
  readable placeholder contrast.
- **Focus:** Clear border and focus-ring shift using Signal Blue and a
  non-color cue.
- **Error / Disabled:** Include plain-language feedback; disabled fields remain
  legible and do not rely on opacity alone.

### Navigation

Navigation uses familiar top-bar, tabs, and mobile bottom-navigation patterns.
Active state is unmistakable, labels are never icon-only, and mobile targets
remain large enough for use while walking.

### Event Discovery Card

The signature Hermes component is a compressed decision surface. In one scan it
answers what, when, where, why it matters, who organised it, how fresh the
listing is, and what the next low-commitment action should be.

## 6. Do's and Don'ts

### Do:

- **Do** prioritise time, location, vibe, organiser, and source freshness on
  every event card.
- **Do** use Signal Blue (`#2563eb`) for primary actions, active state, and
  trusted source indicators.
- **Do** preserve familiar product controls and interaction patterns.
- **Do** use a list-first fallback for all map discovery.
- **Do** provide clear focus states, semantic cards, plain-language labels, and
  large mobile tap targets.
- **Do** make empty and error states explain what happened and what to do next.
- **Do** let social warmth come from event and club content.

### Don't:

- **Don't** make Hermes look like a Waterloo administration website or generic
  university events portal.
- **Don't** build dense calendar databases or club bulletin boards as the
  default discovery surface.
- **Don't** use a link-in-bio directory layout.
- **Don't** use neon Gen-Z social styling or excessive decorative motion.
- **Don't** use vague crypto or AI SaaS gradients and oversized slogans in
  product workflows.
- **Don't** make event discovery feel like a transactional ticketing platform.
- **Don't** build a startup marketing experience that never becomes a useful
  daily product.
- **Don't** use gradient text, colored side-stripe borders, decorative
  glassmorphism, or identical card grids as default visual scaffolding.

