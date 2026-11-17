# MKH Database Recovery, Backup and Testing Policy

**Policy ID:** MKH-DBR-001  
**Version:** 1.0  
**Issued:** 17 November 2026  
**Policy owner:** MKH Product / Technical Operations  
**Applies to:** All MKH developers, database administrators, release engineers, contractors and future maintainers  
**Status:** Proposed operating policy for adoption

---

## 1. Purpose

This policy defines how MKH databases and application releases are tested, backed up, promoted, restored and cleaned before and after launch.

Its objectives are to:

1. Protect customer, vendor, rider, wallet, payout, order, financial-ledger and operational records.
2. Make every release traceable to an exact Git commit, database migration set and deployment.
3. Ensure the backup environment is genuinely restorable, not merely a second project with an old copy of data.
4. Prevent developers from testing destructive changes directly against the wrong environment.
5. Establish a predictable recovery procedure for failed migrations, deployments, accidental data changes and security incidents.

This policy supplements, and does not replace, MKH's approved payment, commission, delivery-allocation, rider-dispatch, vendor, territory and wallet business rules.

## 2. MKH environments and their authority

### 2.1 Current pre-launch testing phase

Until MKH formally authorises the live-business launch:

- **MKH-Production** (Supabase project ref: `ujjxnexhuuekrbrnnwcg`) is the canonical working database and current integration/UAT test database.
- The GitHub repository's **main** branch is the source branch connected to the MKH Production Vercel deployment.
- The official application address is **https://app.mammykitchenhub.com**.
- The existing project named **MKH-PRODUCTION BACKUP** is a separate recovery/test destination. It must not be assumed current or synchronised with MKH-Production.
- Database changes intended for the current pre-launch integration test are applied to MKH-Production only after source review, migration validation and a recorded backup/recovery checkpoint.
- Application changes are developed on a named feature/fix branch, reviewed through a pull request, built in Vercel Preview, then merged to main. The main-branch deployment is the release used for MKH-Production integration testing.

The fact that the application is hosted at the Production URL does not authorise live-money activity during this phase. Payment credentials and any payout tools must remain in the explicitly approved test configuration. Never infer the payment mode from a screen label; verify the server-side secret mode without exposing the secret.

### 2.2 After the live-business launch

After MKH approves go-live and signs off the pre-launch data-cleaning exercise:

- MKH-Production becomes the live system of record.
- MKH-PRODUCTION BACKUP becomes the first-stop environment for routine feature development, fine-tuning, migration rehearsal and acceptance testing.
- A feature is promoted only after it has passed the backup-environment tests and the release has been approved.
- The exact tested application commit and reviewed database migration set are then promoted to MKH-Production. Developers must not re-create the change by hand or deploy a different commit.
- Emergency production fixes are the exception: they require explicit incident approval, a current recovery point and a documented back-port to the backup/testing workflow immediately afterwards.

### 2.3 Environment inventory

Every project must be recorded in the secure MKH environment register with:

- Environment name and purpose.
- Supabase project reference and region.
- Vercel project and environment scope.
- Git repository and branch/deployment connection.
- Credential names and scope (never credential values).
- Backup owner, backup schedule/retention and last successful restore-test date.
- Data classification and whether the environment contains real personal or financial records.

A project called “BACKUP” is not proof of a recent backup. Its source timestamp, migration level and restore verification must be checked.

## 3. Source control and release traceability

1. All application source changes must be committed to GitHub.
2. Every task must use a descriptive feature or fix branch. Do not make untracked local-only production changes.
3. Each change must be submitted through a pull request. The PR must state its purpose, impacted routes/tables/functions, migration requirements, test evidence, rollback notes and any known limitation.
4. Do not merge while the required Vercel build, TypeScript checks or relevant automated checks are failing.
5. Production releases must be traceable to the exact Git commit SHA and Vercel deployment ID.
6. Database migrations must be committed to the repository and matched to the migration history in the target Supabase project.
7. Do not rename, edit or replay a migration that has already been applied to an environment. Correct it with a new forward migration.
8. A release manifest must record: UTC timestamp, repository, branch, commit SHA, PR number, Vercel deployment ID/state, Supabase project reference, latest migration version, data-stamp reference and release approvers.
9. Keep one immutable source-backup branch or release tag for each approved recovery checkpoint. Do not move an earlier checkpoint to a newer commit.

## 4. Database backup requirements

### 4.1 Required backup layers

A complete MKH recovery checkpoint consists of all of the following:

**A. Source-code backup**
- A GitHub branch or release tag pinned to the exact deployed commit.
- The applicable migrations, application source, configuration templates and deployment metadata.
- No secret values, customer personal data, raw bank-account numbers, Paystack recipient codes or encryption keys.

**B. Database backup**
- A provider-managed backup/PITR restore point or encrypted logical database dump covering the required database objects and records.
- The recovery copy must be held in an access-controlled location or the designated protected MKH-PRODUCTION BACKUP project.
- Backup encryption keys and database credentials must be stored separately in MKH's approved secrets vault, not in GitHub.
- The backup record must identify its creation time, source project, schema/migration level, storage location, encryption status, retention and responsible operator.

**C. Data stamp**
- A timestamped, non-sensitive record of core table row counts, important status counts, schema/function fingerprints, migration versions and the deployed application commit.
- The data stamp is for comparison and integrity checking. It is **not** a substitute for a database backup.

### 4.2 When backups are mandatory

Create and verify a recovery point:

- Before every production schema migration or data migration.
- Before any purge, bulk update, bulk delete, reset, restore or other destructive operation.
- Before promoting a release that changes database functions, triggers, RLS, permissions, financial records or authentication flows.
- At every formal release checkpoint.
- Before go-live data cleaning.
- Before and after any major recovery operation.

A provider's automated backups/PITR should be enabled where available and retained according to the approved plan. The backup owner must record the actual retention window; never promise a retention period that has not been verified.

### 4.3 Backup verification

A backup is not marked **VERIFIED** until an authorised operator has:

1. Confirmed the backup completed and is readable.
2. Restored it into a separate recovery target or isolated restore instance.
3. Confirmed the expected migration history and schema fingerprint.
4. Compared core row counts and business-critical status totals with the source data stamp.
5. Checked important foreign keys, sequences, indexes, triggers, functions, extensions, RLS settings and grants.
6. Verified that authentication and required storage objects are present when included in the backup scope.
7. Run the approved read-only integrity checks and selected application smoke tests.
8. Recorded the restore result, differences, failures, operator and UTC timestamp.

Never restore over the only remaining copy of the source environment. Restore into an isolated target first, compare and approve before any cutover.

## 5. Migration and database-change controls

Before a migration is approved:

1. Read the relevant existing schema, constraints, trigger/function definitions, RLS policies, grants and migration history.
2. Prepare a read-only impact report that identifies affected tables, expected row impact, dependencies and business rules.
3. Confirm whether the migration is additive, data-changing or destructive.
4. Preserve existing records and historical financial snapshots unless an approved business requirement explicitly calls for a change.
5. Prefer additive, backwards-compatible changes. Use explicit transactions where appropriate.
6. Make data migrations repeat-safe where possible and include clear preconditions and postconditions.
7. Validate the migration against a restored copy or the currently designated test environment.
8. Run database security advisors and review all changes to functions, triggers, views, RLS, grants and SECURITY DEFINER code.
9. Record the rollback or forward-recovery strategy. Some data migrations cannot be safely reversed; document that before approval.
10. Obtain approval from the designated MKH release/database owner before applying a destructive migration.

Never use an unrestricted `TRUNCATE ... CASCADE`, broad `DELETE`, manual table replacement or schema reset as a shortcut. Never use SQL to read server files or secrets.

## 6. Current test workflow — before launch

For the current pre-launch phase, the approved sequence is:

1. Developer creates a feature/fix branch from the current main commit.
2. Developer makes and commits the changes; no direct untracked edits are accepted.
3. Open a PR and document impacted areas, migrations, test cases and recovery plan.
4. Run the Vercel Preview build and code checks.
5. Validate database changes against MKH-Production in accordance with the approved pre-launch test procedure, after recording a recovery checkpoint.
6. Run authenticated end-to-end tests using clearly identified test accounts and test payment credentials.
7. Verify database results, audit trails and wallet/ledger integrity using read-only queries.
8. Obtain the release owner's approval and merge the PR to main.
9. Verify that the main-branch Vercel deployment is READY and the official alias points to that deployment.
10. Run the Production smoke-test checklist and create a new GitHub source backup plus a data stamp.

During this phase, do not assume that the existing MKH-PRODUCTION BACKUP project is the active test environment. It remains the separate recovery destination until the post-launch process takes effect.

## 7. Post-launch development and promotion workflow

After formal go-live approval:

1. Record the current MKH-Production release manifest and data stamp.
2. Take a full encrypted database backup of MKH-Production.
3. Restore that backup into MKH-PRODUCTION BACKUP, or use an approved controlled refresh procedure that results in an equivalent verified copy.
4. Confirm the backup project's schema and migration history match the production recovery point. Check the required data and object counts.
5. Develop the next enhancement on a feature branch. Connect it only to the approved backup/testing environment for database work.
6. Apply and test the migrations in the backup environment; run application, security, financial and role-specific acceptance tests.
7. Record the exact tested code commit and migration set.
8. Obtain release approval.
9. Promote the same code commit and same reviewed migrations to MKH-Production. Do not change the code or SQL between test and promotion, except for an explicitly reviewed release correction.
10. Verify the Production deployment, schema/migration state, smoke tests, financial controls and audit logs.
11. Create the post-release source backup and data stamp.

If the backup environment cannot be restored or validated, stop promotion. Do not use an old backup copy as evidence that a new feature is safe.

## 8. Pre-launch backup, data cleaning and go-live

Before MKH changes from pre-launch testing to live-business operation:

1. Freeze feature merges and non-essential database writes for the final cutover window.
2. Take a full encrypted backup of the complete MKH-Production dataset and create a GitHub source backup at the final tested commit.
3. Restore the database backup into MKH-PRODUCTION BACKUP and verify it.
4. Prepare an explicit data-cleaning plan. It must list each table/object to be cleaned, its current row count, the exact test-data criteria, expected rows affected, dependencies and retained records.
5. Separate disposable test data from records that must remain for go-live. This distinction must be approved by the business/data owner.
6. Preserve required production master data and configuration, including approved vendors, menu catalogues, territories, zones, verified locations, active staff/rider/vendor relationships, approved business rules, rate cards, financial allocation configuration, security configuration and required audit history.
7. Identify all test-only orders, payment intents, wallet transactions, payouts, rider/vendor test records and related child/audit rows that are genuinely approved for removal. Do not infer test status merely from a row's age or amount.
8. Run a dry-run report that lists the exact rows and totals that would be affected. Reconcile it with Finance and Operations.
9. Obtain written approval from the MKH business owner and the authorised database/release owner.
10. Execute the approved purge using a reviewed, logged and transaction-safe script, in a controlled maintenance window. Do not run a blanket reset or delete the entire database.
11. Verify retained records, foreign keys, balances, ledgers, sequences, operational access, audit policy and application workflows.
12. Confirm live payment credentials and webhook configuration only at the formally approved go-live point.
13. Release customer traffic only after the final smoke tests and sign-off.

If the business decision is to remove more than test transactions, produce a separate retention/deletion schedule and legal/compliance review before deleting those records.

## 9. Incident recovery procedure

For a suspected data loss, bad migration, failed deployment or accidental mutation:

1. Declare the incident and appoint an incident lead.
2. Stop or restrict affected writes, payouts, webhooks and automated jobs where doing so is safe.
3. Preserve logs, deployment IDs, commit SHAs, migration history and the latest known-good data stamp.
4. Do not run additional corrective SQL until the scope and cause are understood.
5. Identify the most recent verified database backup and its source migration level.
6. Restore into a separate recovery target first; never overwrite the only remaining source copy.
7. Compare schema fingerprints, row counts, status totals, financial ledgers, wallet balances and critical business relationships.
8. Reconcile payments and transfers with Paystack/provider records. Do not retry an ambiguous payment or payout until its result is established.
9. Obtain approval for the recovery cutover.
10. Point the application to the recovered target only after smoke tests pass and the release owner approves.
11. Re-open writes and scheduled jobs in a controlled order.
12. Create a post-recovery data stamp, record any data gaps and complete a documented incident review.

When a transfer result is uncertain, preserve the payout reservation and reconcile it. Never automatically release or resubmit funds without verified provider status and an auditable decision.

## 10. Security, privacy and financial-data handling

- Do not commit `service_role` keys, Paystack secret keys, encryption keys, passwords, tokens or raw environment files to GitHub.
- Do not commit raw production database dumps or customer/rider/vendor personal data to a general source repository.
- Do not expose bank account numbers or Paystack recipient codes in logs, data stamps or screenshots.
- Store bank account numbers encrypted at rest and display only approved masked digits.
- Use TEST Paystack credentials for test transactions. A TEST bank recipient must never be mistaken for a valid live recipient.
- No real payout, transfer or customer charge is to be initiated as a test.
- Keep RLS enabled on exposed schemas and ensure each policy implements appropriate access control. Review security advisor warnings; do not enable RLS blindly without designing required policies.

## 11. Roles and approvals

| Role | Responsibility |
|---|---|
| Developer | Branch, commit, document, test and submit PR; no unapproved destructive SQL |
| Database/recovery operator | Backups, migration review, restore validation, data stamps and integrity checks |
| Finance owner | Validate wallet, payout, payment and ledger effects; approve financial test-data cleanup |
| Operations owner | Validate riders, vendors, zones, orders and operational readiness |
| MKH release owner | Approve release, environment promotion, destructive changes and go-live cutover |

For destructive data changes, restoration, bulk financial changes and final go-live purge, require two-person approval: the accountable business owner plus the authorised technical/database operator.

## 12. Required release and backup record

Every checkpoint must store a manifest containing at least:

- Checkpoint ID and UTC timestamp.
- Environment and Supabase project reference.
- GitHub repository, branch and immutable commit SHA.
- PR number and Vercel deployment ID/state.
- Applied migration versions.
- Aggregate table counts and status totals for critical domains.
- Schema and function fingerprints.
- Backup location, encryption state and backup completion status.
- Restore-test target, result, timestamp and operator.
- Known warnings, exceptions and approvals.

A checkpoint with only a source branch and data stamp must be labelled **SOURCE + DATA STAMP COMPLETE / DATABASE BACKUP NOT VERIFIED**. It must never be called a full database backup.

## 13. Current known open items

The following issues must be visible in release records until resolved:

- The current MKH-Production data stamp reports RLS disabled on `public.spatial_ref_sys`. This is a critical Supabase security advisory. Review the required PostGIS access model and policies before enabling RLS; do not apply a blanket remediation without confirming required access.
- The existing MKH-PRODUCTION BACKUP project must be checked for freshness and must undergo a verified restore/refresh before it becomes the post-launch testing destination.
- The Zenith TEST bank update for `customer7777@mkh.com` must complete through the authenticated rider bank-verification flow using a Paystack TEST secret. A database stamp or source-code change does not constitute proof that the bank recipient was changed.
- A GitHub source backup plus aggregate data stamp is not a full database backup. A full encrypted backup and successful restore test remain mandatory before final go-live or a destructive purge.

---

**Approval record**

This is Version 1.0, proposed for formal MKH adoption. The MKH business owner and technical release owner must record their names, approval date and any amendments before it is treated as the binding company procedure.
