# Forward accounts: activation and verification

This branch implements a separate account workspace at `accounts.html` while preserving the existing browser-only class demo. The main website offers the account link only after `accounts/config.js` is enabled. It is deliberately disabled until a real backend has been connected and tested. Local interface fixtures are not a live authentication service.

## Connect the owner’s Supabase project

1. The owner has connected Supabase and selected `eku2101's Org`. The `Forward` project is `dssxuobdjxqhvslbskkv`, in `us-east-1`, on the organization's free plan. Reuse it; do not create a duplicate. Do not put database passwords, service-role keys, SMTP passwords, or access tokens into chat, source control, browser files, or build output.
2. The database migrations `20261112061305_forward_accounts.sql` and `20261112062331_forward_draft_conflict_response.sql` are already applied. Do not reapply them to this project. They add the account, draft, publication, document metadata, and sharing tables, and return a prompt HTTP 409 response for stale saves. All tables have row-level security. Privileged routines and private answer snapshots live in the unexposed `forward_private` schema. The résumé bucket is private and has no direct client access policies.
3. The `resume` Edge Function is deployed as version 1 with `verify_jwt = false`, as declared in `supabase/config.toml`. This is intentional: the function independently verifies the bearer token using Supabase Auth `getUser()` on every request. It does not trust unverified JWT payloads. Its default allowed origin is exactly `https://eku2101.github.io`; `FORWARD_ORIGIN` can override that for a separate test deployment. Built-in Supabase URL, anon key, and service-role key stay in the function runtime.
4. Enable email/password sign-in, email confirmation, a minimum 12-character password, appropriate Auth rate limits, and production email delivery. Supabase’s built-in SMTP is limited to authorized project-team addresses; it does **not** enable general applicant sign-ups. Configure the owner’s SMTP provider before enabling this feature for real visitors. A project with existing production mail settings can reuse them.
5. Configure the site URL and exact email redirect URL as `https://eku2101.github.io/candidate-profile-demo/accounts.html`. Do not add wildcard or arbitrary redirect URLs. Keep verification enabled.
6. Fill `accounts/config.js` with the project HTTPS URL and a **publishable** key (`sb_publishable_…`). These values are intentionally public; row policies and the authenticated file function provide access control. Set `enabled: true` only after the acceptance checks below pass. Never use a service-role or secret key in this file.
7. Deploy through the existing GitHub Pages workflow after review. No personal applicant records or documents belong in this repository.

## Behavior and boundaries

- An account chooses one role after confirming its email. A browser-supplied ID or mutable auth metadata cannot choose another person’s role or records.
- Applicant and manager drafts are separate from sharing snapshots. Saving a draft does not expose its edits. Applicants explicitly save a sharing version, choose a published manager, review the recipient, and grant access. Existing grants receive later explicitly published versions.
- Separate contact fields and applicant questionnaire answers are omitted by the server from the shared snapshot. The original résumé can contain contact details; the sharing confirmation explains that it is included.
- Applicants see manager profiles and all team answers. Preference differences generate questions and never exclude or rank someone. Manager descriptions and jobs are self-reported, not independently verified.
- Shared managers receive discussion prompts derived from the applicant’s last explicitly published preference snapshot. They cannot read that snapshot or the applicant’s private answers. Later private edits do not change those prompts until republished. Withdrawal also blocks the prompt endpoint.
- Files are validated for type signatures and a 10 MB limit, then stored privately. The authenticated download function checks row-level access on every new download; managers cannot mint permanent storage links. Withdrawal cannot retrieve previously downloaded copies. This implementation does not provide malware scanning.
- Existing demo profiles remain local unless someone explicitly reviews and imports them into their account. The import copies profile fields, work preferences, highlights, and the résumé, but not the demo photo or session-only messages. Account sessions are stored in sessionStorage; changing accounts clears the workspace. Passwords are never stored by application code.
- Concurrent draft saves use a version check. A stale device receives an error instead of overwriting a newer draft. The user can reload the saved version after reviewing the warning.
- There is a limit of ten stored résumé files per applicant. Unused files can be removed from the document manager. The database prevents deleting a file used by a published profile. Storage deletion failures can leave inaccessible orphaned objects; operators should reconcile those with document metadata.
- This first account version does not implement employer verification, messaging, application tracking, automated assessments, payments, or account deletion. It does provide real profiles and controlled résumé sharing once activated.

## Tests

From `accounts/`, install the lockfile dependencies with pnpm, then run:

```text
pnpm install --frozen-lockfile --ignore-scripts
node --test tests/model.test.mjs tests/database.test.mjs
node build-vendor.mjs
```

The database tests run the actual SQL migration in PGlite/PostgreSQL, with separate `anon`, `authenticated`, and `service_role` roles and an Auth test shim. They check anonymous denial, account isolation, immutable roles, private draft isolation, publication allowlists, recipient-specific sharing, withdrawal, file ownership, incomplete-profile rejection, stale saves, and unpublishing. They do not substitute for hosted Supabase Auth/Storage integration tests. The vendor client is pinned by `pnpm-lock.yaml` and bundled locally for browser delivery.

Also run the existing six root test files before merging. The class demo must continue working when accounts are disabled.

The opt-in `tests/hosted-acceptance.mjs` script ran successfully against the connected project using disposable fictional accounts, real Auth sessions, and generated PDF/PNG files. It requires `FORWARD_RUN_HOSTED_TESTS` to equal the intended project ID and `FORWARD_TEST_ACCOUNTS` to point to an untracked fixture JSON file containing `run` and `users` (`applicant`, `otherApplicant`, `manager`, `otherManager`, `unconfirmed`, each with `id`, `email`, `password`). Never commit that fixture or use real applicants for this workflow. The script removes uploaded files and signs out sessions; the operator must remove the fixture users afterward and verify cleanup. This does not test real email delivery or confirmation/reset links.

## Hosted acceptance checks required before launch

Use fictional applicant A, applicant B, manager M, and unrelated manager N in a test project:

1. Complete real sign-up, email verification, sign-in, sign-out, and password recovery. An unconfirmed email must not create a profile. Check session expiry and unavailable email delivery.
2. Sign into A on two independent browsers/devices. Save a profile, questionnaire, three featured roles, and an actual PDF; confirm restoration on the other device. Test a stale save from the first device.
3. Confirm B and N cannot read A’s draft, publication, or file through direct REST or function requests with their own tokens. Anonymous requests must fail. Spoofed role metadata must confer no access.
4. Publish M’s profile; verify A can read M’s answers. A explicitly shares with M. M sees the complete shared profile and downloads the exact original PDF bytes. The private contact fields and questionnaire answers stay absent from the shared row.
5. Withdraw M’s access. Both direct profile requests and new file downloads must be denied. Old file identifiers must not grant access. Republishing alone must not restore withdrawn grants.
6. Check actual image/PDF upload and download, malformed file rejection, storage errors, offline saves, refresh, mobile navigation, and that switching accounts never displays the previous account’s data.

References: [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [private Storage downloads](https://supabase.com/docs/guides/storage/serving/downloads), and [production email delivery](https://supabase.com/docs/guides/auth/auth-smtp).
