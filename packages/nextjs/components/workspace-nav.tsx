"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function WorkspaceNav() {
  const path = usePathname();
  return <nav aria-label="Workspace">{[["/", "Create a lock"], ["/my-locks", "My locks"], ["/my-locks#find-lock", "Find a lock"], ["/locks/0", "Verified example"]].map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined}><span>{label}</span><span aria-hidden="true">↗</span></Link>)}</nav>;
}
