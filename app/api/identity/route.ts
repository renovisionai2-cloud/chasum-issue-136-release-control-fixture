export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public allowlist only. Never spread process.env or echo request input.
export function GET() {
  return Response.json({
    fixture: 'chasum-issue-136-disposable',
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    FIXTURE_ENV_NAME: process.env.FIXTURE_ENV_NAME ?? 'local',
    ...(process.env.VERCEL_URL ? { VERCEL_URL: process.env.VERCEL_URL } : {}),
  }, {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
