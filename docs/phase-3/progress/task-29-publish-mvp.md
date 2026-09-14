# Task 29: Publish MVP

> 📌 **Doc status: CURRENT** — one file in the
> [Phase 3 Progress Log](./README.md).

Date: 2026-09-14

Deploys the static build to Vercel, per the plan
([../../project-plan.md](../../project-plan.md#deployment)): no backend or
Vercel-specific runtime code, Vite defaults (`npm ci` / `npm run build` /
`dist`). Preceded by
[pre-launch-file-and-ui-audit.md](./pre-launch-file-and-ui-audit.md) and,
separately, a source-grounded security review (checked for secrets,
dependency vulnerabilities, XSS vectors, and service-worker scoping before
deciding what - if anything - a launch needed).

## What shipped

### 1. `vercel.json` security headers

No `vercel.json` existed before this - a fresh Vercel deployment ships
with no custom headers at all. Added a Content-Security-Policy plus 5
other headers (`X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`),
each directive checked against the actual source rather than assumed:

- `script-src 'self'` - confirmed no inline `<script>` content and no
  third-party script tags anywhere in [index.html](../../../index.html).
- `style-src 'self' 'unsafe-inline'` - the `'unsafe-inline'` is
  specifically because `DragGhost.tsx` sets one inline `style` attribute
  (the drag ghost's live x/y position); everything else comes from the one
  bundled stylesheet.
- `img-src 'self' blob:` - the `blob:` is specifically because PNG export
  (`lib/svg-export.ts`'s `rasterizeCanvasToPngBlob`) loads its serialized
  SVG into an `<img>` via `URL.createObjectURL` before drawing it to a
  canvas - without this, Export PNG would silently break under the CSP.
- `worker-src 'self'` - the hand-written service worker
  ([public/sw.js](../../../public/sw.js), task 23).
- `connect-src 'self'`, `manifest-src 'self'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`,
  `upgrade-insecure-requests` - standard hardening; nothing in this app
  needs a looser value for any of them (no external fetches anywhere in
  `src/`, confirmed by grep).

### 2. Vercel CLI install, auth, link, deploy

- Installed globally (`npm install -g vercel`, CLI 59.16.0) and
  authenticated via the device-authorization flow - verified independently
  with `vercel whoami` (returned the actual account handle) rather than
  trusting the CLI's own "signed in" message alone.
- `vercel link --yes` created a new Vercel project
  (`p-leidel/instruction_builder`), auto-detecting the Vite framework and
  build settings correctly. It also appended `.vercel` and `.env*` to
  [.gitignore](../../../.gitignore) automatically - the downloaded
  `.env.local` (a `VERCEL_OIDC_TOKEN`) never risked being committed.
- Attempting to auto-connect the GitHub repository during link failed:
  "You need to add a Login Connection to your GitHub account first" (400) -
  an account-level GitHub OAuth link that only the user can grant in their
  own browser, not something a CLI/agent can complete. Deploy proceeded
  without it; Git-based push-to-deploy is a follow-up (see "What's next").
- `vercel deploy` built and deployed successfully. Vercel assigns a
  brand-new project's *first* deployment to production automatically
  (regardless of the `--prod` flag), so this went live immediately at
  <https://instructionbuilder-seven.vercel.app> rather than landing as a
  preview first.

## Verification

Checked directly against the live URL, in a real (headless) browser - not
assumed from a 200 response:

- `curl -I` against the production URL confirms all 6 configured headers
  are actually present and match `vercel.json` exactly.
- Loaded the live app: renders correctly, zero console errors, zero
  CSP-violation errors.
- **Exercised the one flow that specifically depends on the CSP's `blob:`
  allowance**: added a step and a token, then Export PNG - a real file
  downloaded (17,113 bytes), confirming the header is correctly scoped,
  not merely present.
- Service worker registers and reaches `active` state on the live domain;
  the web app manifest fetches successfully - PWA/offline support
  (task 23) is intact under the new headers.
- `npm run lint`/`typecheck`/`test` (118 tests)/`build` all still pass
  locally (unchanged by this task - no source code changed, only
  `vercel.json` was added).

### 3. Git-based push-to-deploy connected

Connecting the GitHub Login Connection alone wasn't enough - the first
`vercel git connect` retry still failed ("Make sure there aren't any
typos and that you have access to the repository"), because Vercel's
GitHub *App* (separate from the account-level Login Connection) still
needed to be installed with access to this specific repo. Done via the
dashboard (Project → Settings → Git → Connect Git Repository, which
drives the GitHub App installation/permission screen directly), after
which `vercel git connect` reported "already connected." Verified
independently, not just from that CLI message: queried the Vercel API
directly (`GET /v9/projects/:id`) and confirmed the project's `link`
object shows `type: "github"`, the correct repo, and
`productionBranch: "main"` - every future push to `main` now triggers an
automatic production deployment, no manual `vercel deploy` needed.

## What's next

See [README.md](./README.md) for Phase 3's overall status. Task 30 (Test
Real Users) is next.
