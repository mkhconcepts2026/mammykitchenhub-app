/**
 * Copies existing kitchen photo files from vendor-documents to
 * vendor-kitchen-images and updates vendor_applications.kitchen_photo_url.
 * Originals are never deleted. Default mode is a no-write dry run.
 *
 * Run from repo root:
 *   node --env-file=.env.local scripts/migrate-vendor-kitchen-images.mjs
 *   node --env-file=.env.local scripts/migrate-vendor-kitchen-images.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { basename } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const APPLY = process.argv.includes("--apply");
const SOURCE_BUCKET = "vendor-documents";
const TARGET_BUCKET = "vendor-kitchen-images";
const MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function oldSourcePath(reference) {
  if (!reference) return null;
  if (/^https?:\/\//i.test(reference)) {
    const pathname = new URL(reference).pathname;
    const markers = [
      `/object/public/${SOURCE_BUCKET}/`,
      `/object/sign/${SOURCE_BUCKET}/`,
      `/object/authenticated/${SOURCE_BUCKET}/`,
    ];
    const marker = markers.find((item) => pathname.includes(item));
    if (!marker) return null;
    const path = decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
    return path.startsWith("kitchens/") && !path.includes("..") ? path : null;
  }
  const path = String(reference).replace(/^\/+/, "").split("?")[0];
  return path.startsWith("kitchens/") && !path.includes("..") ? path : null;
}

function targetPathFromReference(reference) {
  if (!reference || !/^https?:\/\//i.test(reference)) return null;
  const pathname = new URL(reference).pathname;
  const marker = `/object/public/${TARGET_BUCKET}/`;
  if (!pathname.includes(marker)) return null;
  const path = decodeURIComponent(pathname.slice(pathname.indexOf(marker) + marker.length));
  return path.startsWith("kitchens/") && !path.includes("..") ? path : null;
}

function mimeFromName(name) {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return null;
}

const { data: rows, error: rowsError } = await supabase
  .from("vendor_applications")
  .select("id,kitchen_photo_url")
  .not("kitchen_photo_url", "is", null)
  .neq("kitchen_photo_url", "");
if (rowsError) {
  console.error("Could not read vendor application kitchen photo references:", rowsError.message);
  process.exit(1);
}

const work = [];
const sourcePaths = new Set();
for (const row of rows ?? []) {
  const currentTargetPath = targetPathFromReference(row.kitchen_photo_url);
  if (currentTargetPath) {
    work.push({ id: row.id, ref: row.kitchen_photo_url, targetPath: currentTargetPath, alreadyMigrated: true });
    continue;
  }
  const sourcePath = oldSourcePath(row.kitchen_photo_url);
  if (!sourcePath) {
    console.error(`Stopped safely: application ${row.id} has a kitchen-photo reference that does not match a known storage path.`);
    console.error("No database references or files were changed by this dry-run.");
    process.exit(1);
  }
  sourcePaths.add(sourcePath);
  work.push({ id: row.id, ref: row.kitchen_photo_url, sourcePath, targetPath: `kitchens/${basename(sourcePath)}`, alreadyMigrated: false });
}

console.log(`Applications with kitchen photo references: ${work.length}`);
console.log(`Distinct source kitchen image files to copy: ${sourcePaths.size}`);
console.log(`Already using ${TARGET_BUCKET}: ${work.filter((item) => item.alreadyMigrated).length}`);
console.log("Original files will be preserved; no storage objects are deleted.");

if (!APPLY) {
  console.log("DRY RUN ONLY. No bucket, file, or database changes were made.");
  console.log("After reviewing this summary, rerun with --apply to perform the copy and update references.");
  process.exit(0);
}

const rl = createInterface({ input: stdin, output: stdout });
const confirmation = await rl.question("Type MIGRATE-KITCHEN-PHOTOS to copy the files and update application references: ");
rl.close();
if (confirmation !== "MIGRATE-KITCHEN-PHOTOS") {
  console.log("Cancelled. No changes were made.");
  process.exit(0);
}

const { data: existingBuckets, error: bucketsError } = await supabase.storage.listBuckets();
if (bucketsError) throw new Error(`Could not list storage buckets: ${bucketsError.message}`);
const targetBucketExists = (existingBuckets ?? []).some((bucket) => bucket.name === TARGET_BUCKET || bucket.id === TARGET_BUCKET);
if (!targetBucketExists) {
  const { error } = await supabase.storage.createBucket(TARGET_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: MIME_TYPES,
  });
  if (error) throw new Error(`Could not create ${TARGET_BUCKET}: ${error.message}`);
} else {
  const { error } = await supabase.storage.updateBucket(TARGET_BUCKET, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: MIME_TYPES,
  });
  if (error) throw new Error(`Could not configure ${TARGET_BUCKET}: ${error.message}`);
}

const copiedPath = new Map();
for (const sourcePath of sourcePaths) {
  const { data: file, error: downloadError } = await supabase.storage.from(SOURCE_BUCKET).download(sourcePath);
  if (downloadError || !file) throw new Error(`Could not download a source kitchen image (${basename(sourcePath)}): ${downloadError?.message ?? "No file returned"}`);

  const targetPath = `kitchens/${basename(sourcePath)}`;
  const contentType = MIME_TYPES.includes(file.type) ? file.type : mimeFromName(sourcePath);
  if (!contentType || !MIME_TYPES.includes(contentType)) {
    throw new Error(`Unsupported kitchen image type for ${basename(sourcePath)}. No source file was deleted.`);
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`Kitchen image ${basename(sourcePath)} exceeds the new 10 MB limit. No source file was deleted.`);
  }

  const { error: uploadError } = await supabase.storage.from(TARGET_BUCKET).upload(targetPath, file, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });
  if (uploadError) throw new Error(`Could not copy a kitchen image (${basename(sourcePath)}): ${uploadError.message}`);

  const { data: verification, error: verifyError } = await supabase.storage.from(TARGET_BUCKET).download(targetPath);
  if (verifyError || !verification || verification.size !== file.size) {
    throw new Error(`Destination verification failed for ${basename(sourcePath)}. Source files were preserved.`);
  }
  copiedPath.set(sourcePath, targetPath);
}

// All distinct source files are copied and verified before any application row is updated.
for (const item of work) {
  if (item.alreadyMigrated) continue;
  const targetPath = copiedPath.get(item.sourcePath);
  if (!targetPath) throw new Error(`No verified destination for application ${item.id}.`);
  const { data: publicData } = supabase.storage.from(TARGET_BUCKET).getPublicUrl(targetPath);
  const { error: updateError } = await supabase
    .from("vendor_applications")
    .update({ kitchen_photo_url: publicData.publicUrl })
    .eq("id", item.id);
  if (updateError) throw new Error(`Copied files but could not update one application reference (${item.id}): ${updateError.message}. Rerun with --apply to resume safely.`);
}

console.log(`Migration helper finished: ${copiedPath.size} distinct kitchen images copied/verified; ${work.filter((item) => !item.alreadyMigrated).length} application references updated.`);
console.log("The original vendor-documents files remain in place. Apply the SQL privacy migration next, only after reviewing this report.");
