/**
 * FOLIO NEUMORPHIC DESIGN SYSTEM
 *
 * A white-base design system with double-ridge borders and neumorphic shadows.
 *
 * Key Principles:
 * 1. White base — The warmth comes from shadows and accent, not background color
 * 2. Double ridge — Every elevated element has outer border + inner ::before border
 * 3. Neumorphic depth — Light source from top-left (dark shadow bottom-right, light shadow top-left)
 * 4. Editorial typography — Cormorant Garamond for headlines/quotes gives magazine feel
 * 5. Functional body — Instrument Sans for UI keeps it professional/platform-like
 *
 * Design Tokens (CSS Variables):
 * - Typography: --font-logo, --font-headline, --font-body
 * - Base: --bg-base (#FFFFFF), --bg-elevated (#FAFAF9)
 * - Text: --text-primary, --text-secondary, --text-tertiary
 * - Accent (functional): --folio-gold (#B8845C), --folio-gold-hover (#A67548)
 * - Accent (ornament):   --folio-gold-ornament (#C9A96E) — never use for text or interactive elements
 * - Shadows: --neu-raised, --neu-raised-lg, --neu-inset, --neu-inset-sm
 * - Ridge: --ridge-outer, --ridge-inner, --ridge-dark
 */

// Core Components
export {
  RidgeCard,
  RidgeCardHeader,
  RidgeCardTitle,
  RidgeCardDescription,
  RidgeCardContent,
  RidgeCardFooter,
  StatsCard,
} from './ridge-card';

// Buttons
export {
  Button,
  AccentButton,
  RidgeButton,
  PillButton,
} from './button';

// Form Inputs
export {
  Input,
  RidgeInput,
} from './input';

export {
  Textarea,
  RidgeTextarea,
} from './textarea';

// Toggle Group
export {
  RidgeToggleGroup,
  RidgeToggleItem,
} from './ridge-toggle';

// Card (with ridge variant)
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './card';

/**
 * Typography Classes (use in className):
 *
 * Headlines (Cormorant Garamond):
 * - folio-logo-text: 22px, uppercase, letter-spacing 0.18em
 * - folio-h1: 48px, medium weight
 * - folio-h2: 36px, medium weight
 * - folio-h3: 28px, medium weight
 * - folio-quote: 24px, italic
 *
 * Body (Instrument Sans):
 * - folio-body: 15px, regular
 * - folio-ui: 14px, medium
 * - folio-meta: 13px, tertiary color
 * - folio-stat: 28px, semibold
 * - folio-stat-lg: 32px, semibold
 */

/**
 * Component Classes (use in className):
 *
 * Cards:
 * - ridge-card: Base elevated surface
 * - ridge-card-sm: Small border radius variant
 * - ridge-card-lg: Large variant with bigger shadows
 *
 * Buttons:
 * - accent-btn: Primary CTA with warm accent color
 * - ridge-btn: Secondary button with ridge border
 * - pill-btn: Add to ridge-btn for pill shape
 *
 * Inputs:
 * - ridge-input: Inset neumorphic input field
 *
 * Toggle Groups:
 * - ridge-toggle-group: Container with inset styling
 * - ridge-toggle-item: Individual toggle option
 * - ridge-toggle-item.active: Active state styling
 *
 * Stats:
 * - stats-card: Wrapper for stats cards
 * - stats-value: Large number display
 * - stats-label: Small uppercase label
 */

/**
 * Tailwind Classes (use with tw- prefix):
 *
 * Colors:
 * - bg-neu-base, bg-neu-elevated
 * - text-neu-text, text-neu-text-secondary, text-neu-text-tertiary
 * - text-neu-accent, bg-neu-accent
 *
 * Border Radius:
 * - rounded-neu (16px), rounded-neu-sm (12px), rounded-neu-lg (20px)
 * - rounded-neu-btn (10px), rounded-neu-pill (50px)
 *
 * Shadows:
 * - shadow-neu-raised, shadow-neu-raised-lg
 * - shadow-neu-inset, shadow-neu-inset-sm
 *
 * Typography:
 * - font-headline, font-body, font-logo
 * - text-folio-h1, text-folio-h2, text-folio-h3
 * - text-folio-body, text-folio-ui, text-folio-meta
 */
