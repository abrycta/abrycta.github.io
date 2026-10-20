/** Build-time views over Akari's tokens for the showcase page. Values are read, never re-typed. */
import { color, contrast, font, primitives, radius, space, themes } from "@abrycta/akari/tokens"

export const FAMILIES = [
  { key: "washi", ja: "和紙", name: "washi", role: "Warm paper whites: light backgrounds" },
  { key: "sumi", ja: "墨", name: "sumi", role: "Ink blacks: text, and the dark theme" },
  { key: "ai", ja: "藍", name: "ai", role: "Indigo: the primary, links and focus" },
  { key: "shu", ja: "朱", name: "shu", role: "Vermilion: the seal, used sparingly" },
  { key: "nezumi", ja: "鼠", name: "nezumi", role: "Mouse greys: lines and secondary text" },
] as const

/** Primitive swatches per traditional family, light to dark by their numeric step. */
export function familySwatches(family: string): { id: string; step: string; hex: string }[] {
  const prefix = `primitive.color.${family}.`
  return Object.entries(primitives as Record<string, { value: string }>)
    .filter(([id]) => id.startsWith(prefix))
    .map(([id, t]) => ({ id, step: id.slice(prefix.length), hex: t.value }))
    .sort((a, b) => parseFloat(b.step) - parseFloat(a.step) || a.step.localeCompare(b.step))
}

export const THEMES = themes
export const THEME_LABEL: Record<(typeof themes)[number], string> = {
  light: "Light",
  dark: "Dark",
  "light-hc": "Light · high contrast",
  "dark-hc": "Dark · high contrast",
}

type Role = keyof (typeof color)["light"]
export const ROLES: { role: Role; note: string }[] = [
  { role: "bg", note: "Page" },
  { role: "surface", note: "Cards, inputs" },
  { role: "text", note: "Body text" },
  { role: "text-muted", note: "Secondary text" },
  { role: "primary", note: "藍 actions" },
  { role: "accent", note: "朱 seal" },
  { role: "text-link", note: "Links" },
  { role: "border-strong", note: "Control borders" },
  { role: "focus", note: "Focus ring" },
]
export const semantic = (theme: (typeof themes)[number], role: Role): string => color[theme][role]

/** Key pairs, checked with Akari's own contrast() (WCAG 2.x). AA everywhere; AAA targets in high contrast. */
const PAIRS: { fg: Role; bg: Role; kind: "text" | "ui"; note: string }[] = [
  { fg: "text", bg: "bg", kind: "text", note: "Body text on page" },
  { fg: "text-muted", bg: "surface-subtle", kind: "text", note: "Muted text on subtle surface" },
  { fg: "text-link", bg: "bg", kind: "text", note: "Link on page" },
  { fg: "text-accent", bg: "surface", kind: "text", note: "朱 small text on surface" },
  { fg: "on-primary", bg: "primary", kind: "text", note: "Primary button label" },
  { fg: "border-strong", bg: "surface", kind: "ui", note: "Control border" },
  { fg: "focus", bg: "bg", kind: "ui", note: "Focus ring" },
  { fg: "accent", bg: "bg", kind: "ui", note: "Seal mark" },
]

export function contrastRows() {
  return PAIRS.map((p) => ({
    ...p,
    results: themes.map((t) => {
      const ratio = contrast(color[t][p.fg], color[t][p.bg])
      const hc = t.endsWith("hc")
      const target = p.kind === "text" ? (hc ? 7 : 4.5) : hc ? 4.5 : 3
      return { theme: t, ratio, target, pass: ratio >= target, fg: color[t][p.fg], bg: color[t][p.bg] }
    }),
  }))
}

const px = (v: string) => parseFloat(v)
export const typeScale = Object.entries(font.size)
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => px(b.value) - px(a.value))
export const fontFamilies = font.family
export const spaceScale = Object.entries(space)
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => px(a.value) - px(b.value))
export const radii = Object.entries(radius).map(([name, value]) => ({ name, value }))
