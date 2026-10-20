import type * as React from "react"
import { Header, SealMark } from "@abrycta/akari/react"

import { SITE } from "~/lib/site"

/**
 * Akari's <Header> with the site brand (server-rendered, no JS). Astro passes
 * the nav as children and the controls island through the "actions" slot.
 */
export default function HeaderBar({ children, actions }: { children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <Header
      actions={actions}
      brand={
        // The full name fits on one line at 360px in the smaller size; below that,
        // it wraps between words (never mid-name or with an ellipsis).
        <a
          href="/"
          data-testid="brand"
          className="inline-flex min-w-0 items-center gap-2 font-heading text-base leading-tight font-semibold tracking-tight text-foreground sm:text-xl sm:leading-none"
        >
          <SealMark size={24} glyph="カ" className="shrink-0" />
          <span>{SITE.name}</span>
        </a>
      }
    >
      {children}
    </Header>
  )
}
