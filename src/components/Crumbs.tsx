import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@abrycta/akari/react"
import { Fragment } from "react"

/** Akari's <Breadcrumb>, server-rendered (no JS): the look lives in Akari, not here. */
export default function Crumbs({ trail, current }: { trail: { href: string; label: string }[]; current: string }) {
  return (
    <Breadcrumb aria-label="Breadcrumb">
      <BreadcrumbList>
        {trail.map((c) => (
          <Fragment key={c.href}>
            <BreadcrumbItem>
              <BreadcrumbLink href={c.href}>{c.label}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
