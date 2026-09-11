import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes the Supabase auth session on every request and keeps the
// auth cookies in sync between the request and the response. Called from
// the root `proxy.ts` (the Next.js 16 replacement for middleware).
export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // The public participant pages (registration form, results, certificates)
  // never use a login — they read through the service role by token — so
  // there is no session to check or refresh. Let them straight through.
  if (path.startsWith("/register") || path.startsWith("/results"))
    return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Verify the session and refresh it if it's about to expire. getClaims()
  // checks the JWT signature locally against the project's cached public key,
  // so unlike getUser() it doesn't call the Auth server on every request —
  // and this runs before every page load and every link prefetch.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const isProtected = path.startsWith("/admin") || path.startsWith("/judge");
  const isAuthPage = path === "/login" || path === "/signup";

  // Keep unauthenticated users out of the app.
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed-in users shouldn't see the auth pages.
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
