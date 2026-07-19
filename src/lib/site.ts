import { headers } from "next/headers";

/**
 * Absolute site origin for building links inside emails. Prefers
 * NEXT_PUBLIC_SITE_URL; otherwise derives it from the incoming request.
 */
export async function getSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
