export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     * - /login
     * - /api/auth (NextAuth endpoints)
     * - /_next (static files)
     * - /icons, /manifest.json, /sw.js (PWA assets)
     */
    "/((?!login|api/auth|_next/static|_next/image|icons|manifest.json|sw.js|favicon.ico).*)",
  ],
};
