---
name: Hermes
description: An editorial campus guide for Waterloo students.
colors:
  paper: "#f1f3ef"
  paper-deep: "#e6ebe5"
  card: "#fafbf8"
  ink: "#242922"
  muted: "#5a655c"
  line: "#c8d2ca"
  gold: "#e5a92f"
  gold-light: "#f4d779"
  copper: "#a34e29"
  forest: "#3f5945"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "6rem"
    fontWeight: 560
    lineHeight: 0.98
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "3.75rem"
    fontWeight: 560
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 550
    lineHeight: 1.12
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 750
    lineHeight: 1.3
rounded:
  control: "4px"
  card: "4px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  section: "120px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
  button-secondary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
  card-event:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "24px"
---

# Hermes design system

## Direction

Hermes is a pocket guide to the campus day. It should feel collected, useful, and human: a page someone would keep in their bag, opened on a phone between classes. Cool mineral paper gives the interface daylight and breathing room. Amber suggests discovery and momentum; copper adds a richer editorial note. The reference is a well made city guide, not an illustration of the Greek god.

The product surfaces are **Operate**: students scan, filter, inspect, and decide quickly. The landing page is **Persuade**, with more expressive type and a guide cover composition. The same colors, type, and rules carry across both.

## Color roles

| Token | Value | Use |
| --- | --- | --- |
| Paper | `#f1f3ef` | Page background |
| Paper deep | `#e6ebe5` | Quiet inset areas and guide-cover underlayer |
| Card | `#fafbf8` | Raised forms when needed |
| Ink | `#242922` | Headings, body, primary controls |
| Muted | `#5a655c` | Supporting copy, metadata |
| Line | `#c8d2ca` | Separators and input borders |
| Gold | `#e5a92f` | Primary invitation and guide moments |
| Gold light | `#f4d779` | Hover and secondary highlight |
| Copper | `#a34e29` | Editorial emphasis and active navigation |
| Forest | `#3f5945` | Restrained category variation |

Gold is a deliberate signal. Keep long reading text in Ink. Use Copper for short emphasis only. Category colors are pale solid stock colors, not luminous gradients. Status and selection always have a text or shape cue as well as color.

### Light and dark modes

Light is cool mineral paper for daytime browsing. Dark is deep green-black with pale mineral type, muted sage rules, and brighter copper emphasis. The gold guide cover and pale event cards keep dark ink text in both modes; their color communicates the same thing against either page background.

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#f1f3ef` | `#171c19` |
| Inset | `#e6ebe5` | `#202822` |
| Form surface | `#fafbf8` | `#263029` |
| Primary text | `#242922` | `#eef2eb` |
| Supporting text | `#5a655c` | `#b7c6b8` |
| Rule | `#c8d2ca` | `#4b5a4e` |
| Gold action | `#e5a92f` | `#e5a92f` |
| Copper emphasis | `#a34e29` | `#e5a579` |

Follow the device color preference until the visitor chooses a mode. Store that choice locally and apply it before the page paints. The navigation control names the mode it will switch to. Keep both modes equally legible in forms, feed rows, guide pages, focus rings, and empty states.

## Typography

Fraunces is the display and title voice. Use it for a small number of expressive moments, event titles, and section headings. DM Sans carries body copy, navigation, controls, and metadata. Keep display tracking between `-0.02em` and `-0.035em`, body line length near 70 characters, and labels readable at 12–14px. Major headings stay upright; copper can mark a short phrase. Balance heading lines and avoid stranded final words in supporting copy.

## Layout and components

- Use a 1240px maximum content width with 32px desktop gutters and 18px mobile gutters.
- On wide screens, the day-page heading stays in view while Today, Tonight, and This week pass over one another. At 900px and below, use a horizontal, touch-scrollable row with visible next-page context. Never pin the mobile viewport or intercept the wheel.
- Product content is organized by rules and whitespace. Avoid repeated floating boxes. Event cards are rows with a date rail, title and source context, and one clear detail affordance.
- Corners are 4px on controls and editorial tiles. The square guide cover sits above one mineral paper underlayer. Pills are reserved for a genuinely compact status.
- The primary gold button is for invitation or commitment. Ink buttons suit routine actions; outlined buttons suit secondary actions. Every mobile action has a target of at least 44px.
- Filters are short labeled tabs with a count. Selected state is Ink filled, supported by `aria-current`.
- Source attribution remains visible before commitment. Time, location, and organizer precede social signals in the scan order.
- Use one strong line to separate sections and lighter lines between related records. Do not put borders and shadows on the same surface by default.

## Motion and browser details

The landing page has one authored arrival: the headline and invitation settle in as the gold guide cover comes into place. That cover is the visual anchor; do not split every word or repeat this sequence throughout the product. Intro, method, and join content may enter once as the reader reaches each section. The day pages stack as the reader scrolls. Routine product pages use shorter, quieter entrances for headings or a details panel, never for every event row.

Use `power3.out` for the focal arrival (roughly 0.75–1.2 seconds) and `power2.out` for scroll entrances (0.52–0.85 seconds). The landing headline, invitation, and gold guide begin fully transparent and travel 20–55px into place. Landing sections enter from 22px on mobile or 36px on desktop as they reach the reading area. The day-page stack uses a small scroll-linked scale and rotation on the page being passed. Product entrances stay within 12–18px and remain quieter. Other scroll triggers play once. The browser owns scrolling; anchor links use native smooth scrolling. Keep all content visible in the default HTML and skip GSAP movement under `prefers-reduced-motion: reduce`; the day pages become a static list.

Hover may lift an editorial tile by 2–5px or change ink color. Selection, caret, scrollbars, focus rings, empty states, and loading states should share the palette. Focus uses a clearly visible Copper outline with offset. Numerical date and time information should stay legible at a glance.

## Boundaries

Keep the Hermes wing logo and campus specific language. Avoid gradient text, blue glow, glass panels, oversized round cards, emoji as product iconography, invented event photos, and generic dashboard widgets. The user supplied construction worker illustration is the interim asset for under construction pages.

The source of truth for live implementation tokens is `src/app/hermes.css`. The machine readable companion is `.impeccable/design.json`.
