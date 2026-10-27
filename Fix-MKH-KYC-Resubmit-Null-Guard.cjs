#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const routePath = path.join(root, 'app', 'api', 'vendor', 'kyc-resubmit', 'route.ts');
function stop(message) {
  console.error(`Patch stopped safely: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(routePath)) stop(`Route not found: ${routePath}. No files were changed.`);
let source = fs.readFileSync(routePath, 'utf8');
const newline = source.includes('\r\n') ? '\r\n' : '\n';

const target = /    \} else \{\r?\n      updateResult = await adminClient\r?\n        \.from\("vendor_kyc"\)\r?\n        \.update\(\{\r?\n          cac_url: body\.cacPath,\r?\n          national_id_url: body\.idPath,\r?\n          selfie_url: body\.selfiePath,\r?\n          status: "pending",\r?\n        \}\)\r?\n        \.eq\("id", kyc\.id\)\r?\n        \.eq\("status", kyc\.status\)/g;
const matches = [...source.matchAll(target)];
if (matches.length !== 1) {
  if (source.includes('if (!kyc) {') && source.includes('.eq("id", kyc.id)')) {
    stop('A null guard already appears to exist, but the expected source block did not match. No files were changed.');
  }
  stop(`Expected exactly one vendor_kyc update block, found ${matches.length}. No files were changed.`);
}

const match = matches[0][0];
const guard = [
  '    } else {',
  '      if (!kyc) {',
  '        return jsonError("The current KYC submission could not be confirmed. Refresh the dashboard and try again.", 409);',
  '      }',
  '      updateResult = await adminClient',
  '        .from("vendor_kyc")',
  '        .update({',
  '          cac_url: body.cacPath,',
  '          national_id_url: body.idPath,',
  '          selfie_url: body.selfiePath,',
  '          status: "pending",',
  '        })',
  '        .eq("id", kyc.id)',
  '        .eq("status", kyc.status)',
].join(newline);

const backupRoot = process.env.MKH_BACKUP_DIR || 'C:\\MKH\\backups';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(backupRoot, `mkh-kyc-resubmit-null-guard-${timestamp}`);
try {
  fs.mkdirSync(backupDir, { recursive: true });
  const relative = path.relative(root, routePath);
  const backupPath = path.join(backupDir, relative);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.copyFileSync(routePath, backupPath);
  source = source.replace(target, guard);
  if (!source.includes('if (!kyc) {') || !source.includes('.eq("id", kyc.id)')) {
    stop('Post-edit verification failed. The source file was not written. Backup was retained.');
  }
  fs.writeFileSync(routePath, source, 'utf8');
  console.log('Added a null guard before updating the vendor_kyc record.');
  console.log('Changed: app\\api\\vendor\\kyc-resubmit\\route.ts');
  console.log(`Backup: ${backupDir}`);
  console.log('No SQL, database, Git, or deployment operations were performed.');
} catch (error) {
  console.error(`Patch failed: ${error.message}`);
  console.error(`Backup directory (if created): ${backupDir}`);
  process.exit(1);
}
