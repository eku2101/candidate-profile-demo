# Implementation status

Prepared for review; **not activated on the public website**.

- Implemented email/password sign-in, sign-up confirmation, password recovery, role-specific workspaces, private profile drafts, questionnaire, résumé import review, three featured roles, manager discovery, explicit sharing, withdrawal, and protected file handling.
- Added PostgreSQL row-level access rules, server-validated publication, account-owned file metadata, version checks for concurrent edits, and per-recipient discussion prompts that do not expose the applicant’s answers.
- Verified 62 local automated tests: 43 existing demo tests and 19 account/database/file tests.
- Checked the interface through a browser using a clearly labeled local fixture: applicant onboarding, blank profile, pasted résumé import, same-person confirmation, explicit publication, manager review, sharing and withdrawal, returning to saved data, switching roles through separate fictional accounts, and mobile layout. No console errors were observed. This test did not contact Supabase or send email.
- Required activation work: connect the owner’s Supabase project, apply the migration, deploy the authenticated file function, configure real email delivery and redirects, run the hosted acceptance checks in SETUP.md with separate accounts/devices, then enable and merge the website entry point.

The current `main` deployment remains the browser-only demo. No existing applicant data has been uploaded or migrated.
