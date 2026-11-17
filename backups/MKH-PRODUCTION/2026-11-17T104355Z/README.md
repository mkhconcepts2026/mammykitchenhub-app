# MKH-Production checkpoint — 17 November 2026

**Checkpoint ID:** `MKH-PROD-DATA-STAMP-2026-11-17T104355Z`  
**Captured:** `2026-11-17T10:43:55.191997Z`  
**Environment:** MKH-Production  
**Supabase project ref:** `ujjxnexhuuekrbrnnwcg`  
**Application repository:** `mkhconcepts2026/mammykitchenhub-app`  
**Application commit at checkpoint:** `d12457a977d8577383087ebe209c83b2444c251d`  
**Production deployment:** `dpl_AqfossLhWm2iCfUGmKxixM2NdJZL`  
**Deployment state:** READY  
**Official Production URL:** https://app.mammykitchenhub.com

## Contents

- `DATA-STAMP.json` — aggregate row counts, migration versions and schema/function fingerprints captured from MKH-Production.
- `../../docs/policies/MKH-DATABASE-RECOVERY-AND-TESTING-POLICY-v1.0.md` — proposed recovery, backup, testing, promotion and pre-launch data-cleaning policy.
- The branch base commit pins the application source to the Production release commit listed above.

## Important backup status

<badge>Source + data stamp checkpoint</badge>

This GitHub branch is a source-code snapshot plus a non-sensitive data stamp. It is **not a full database export** and is not sufficient by itself to restore customer, financial, wallet, payout, order or operational data.

No raw production records, personal details, bank account numbers, Paystack recipient codes, API secrets or encryption keys are stored in this GitHub checkpoint.

A separate encrypted database backup/PITR restore point must be created and successfully restored into the protected `MKH-PRODUCTION BACKUP` Supabase project before this checkpoint can be marked **FULL DATABASE BACKUP VERIFIED**.

## Verification note

The captured data stamp records 88 public tables and 977 public columns, with schema and function fingerprints. It also records one known critical security advisory: RLS disabled on `public.spatial_ref_sys`. See the policy and stamp for detail.

Do not move this branch to a newer commit. Create a new timestamped checkpoint for the next release.
