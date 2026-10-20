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
        <a
          href="/"
          className="inline-flex items-center gap-2 font-heading text-xl leading-none font-semibold tracking-tight text-foreground"
        >
          <SealMark size={24} />
          <span>{SITE.name}</span>
        </a>
      }
    >
      {children}
    </Header>
  )
}
