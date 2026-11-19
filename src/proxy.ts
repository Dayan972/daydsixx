import { NextResponse, type NextRequest } from "next/server";

/**
 * Domaines personnels : une requête sur maboutique.fr/x est servie par /s/maboutique.fr/x.
 * Les hôtes de la plateforme (PLATFORM_HOSTS, séparés par des virgules) ne sont pas réécrits.
 */
const PLATFORM_HOSTS = (process.env.PLATFORM_HOSTS ?? "localhost,127.0.0.1")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (!host || PLATFORM_HOSTS.includes(host) || PLATFORM_HOSTS.some((h) => host.endsWith(`.${h}`))) {
    return NextResponse.next();
  }
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/") || pathname.startsWith("/s/")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/s/${host}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
