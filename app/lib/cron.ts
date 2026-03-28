/** Verifies the Vercel cron secret on all cron route handlers. */
export function verifyCron(req: Request): boolean {
  return (
    req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
  );
}
