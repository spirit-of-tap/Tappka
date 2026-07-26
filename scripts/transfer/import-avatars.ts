import { readFileSync } from "node:fs";

import type { Tables } from "@/lib/supabase/database.types";

import { AVATARS_BUCKET, publicObjectPrefix, resolveTarget } from "./config";
import { patchRows, selectAll } from "./rest";
import { encodeObjectPath, headObject, mapWithConcurrency, uploadObject } from "./storage";
import { czuEmails, detectImage, parseVCards } from "./vcard";

const PRODUCTION_CONFIRM_FLAG = "--i-know-this-is-production";
const PRODUCTION_TARGET = "production";
const REPLACE_GOOGLE_FLAG = "--replace-google";
const OBJECT_PREFIX = "profile-pictures/import";
const UPLOAD_CONCURRENCY = 6;

interface Options {
  readonly target: string;
  readonly vcardPath: string;
  readonly dryRun: boolean;
  readonly replaceGoogle: boolean;
  readonly confirmProduction: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const target = argv.find((a) => a.startsWith("--target="));
  const file = argv.find((a) => a.startsWith("--file="));
  if (target === undefined) throw new Error("Missing --target=preview|production");
  if (file === undefined) throw new Error("Missing --file=<path to .vcf>");

  return {
    target: target.slice("--target=".length),
    vcardPath: file.slice("--file=".length),
    dryRun: argv.includes("--dry-run"),
    replaceGoogle: argv.includes(REPLACE_GOOGLE_FLAG),
    confirmProduction: argv.includes(PRODUCTION_CONFIRM_FLAG),
  };
}

/**
 * A picture worth keeping. Google avatars on linked accounts are live and
 * self-refreshing, so a static vCard photo from the legacy export is a
 * downgrade. Everything else — a null, or a bare SharePoint attachment filename
 * left by the legacy import — renders as nothing and is safe to replace.
 */
function hasWorkingPicture(picture: string | null): boolean {
  return picture !== null && picture.startsWith("http");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.target === PRODUCTION_TARGET && !options.confirmProduction) {
    throw new Error(`Refusing to touch production without ${PRODUCTION_CONFIRM_FLAG}`);
  }

  const target = resolveTarget(options.target);
  const publicPrefix = publicObjectPrefix(target, AVATARS_BUCKET);

  const contacts = parseVCards(readFileSync(options.vcardPath, "utf8"));
  const withPhoto = contacts.filter((c) => c.photoBase64 !== null);
  console.log(`\n=== vCard: ${options.vcardPath} ===`);
  console.log(`  contacts ${contacts.length}, with photo ${withPhoto.length}`);

  const profiles = await selectAll<Tables<"profiles">>(target, "profiles");
  const byEmail = new Map(profiles.map((p) => [p.work_email.trim().toLowerCase(), p]));

  interface Job {
    readonly profile: Tables<"profiles">;
    readonly bytes: Uint8Array<ArrayBuffer>;
    readonly contentType: string;
    readonly objectPath: string;
  }

  const jobs: Job[] = [];
  const unmatched: string[] = [];
  const undecodable: string[] = [];
  const keptGoogle: string[] = [];

  for (const contact of withPhoto) {
    const profile = czuEmails(contact)
      .map((email) => byEmail.get(email))
      .find((p): p is Tables<"profiles"> => p !== undefined);

    if (profile === undefined) {
      unmatched.push(`${contact.fullName ?? "?"} (${czuEmails(contact).join(", ") || "no czu email"})`);
      continue;
    }

    const bytes = new Uint8Array(Buffer.from(contact.photoBase64 ?? "", "base64"));
    const image = detectImage(bytes);
    if (image === null) {
      undecodable.push(`${contact.fullName ?? profile.work_email}`);
      continue;
    }

    if (!options.replaceGoogle && hasWorkingPicture(profile.picture)) {
      keptGoogle.push(profile.work_email);
      continue;
    }

    jobs.push({
      profile,
      bytes,
      contentType: image.contentType,
      objectPath: `${OBJECT_PREFIX}/${profile.id}.${image.extension}`,
    });
  }

  console.log(`\n=== Plan: ${target.name} ===`);
  console.log(`  will set picture on ${jobs.length} profiles`);
  console.log(`  photos with no matching profile: ${unmatched.length}`);
  for (const u of unmatched) console.log(`    skip ${u}`);
  console.log(`  photos of unrecognised image type: ${undecodable.length}`);
  for (const u of undecodable) console.log(`    skip ${u}`);
  console.log(
    `  left alone because a working picture is already set: ${keptGoogle.length}${
      options.replaceGoogle ? " (--replace-google given, so none)" : ""
    }`,
  );
  for (const k of keptGoogle) console.log(`    keep ${k}`);

  if (options.dryRun) {
    console.log("\nDry run — nothing was written.");
    return;
  }

  let uploaded = 0;
  let patched = 0;
  let unchanged = 0;

  await mapWithConcurrency(jobs, UPLOAD_CONCURRENCY, async (job) => {
    await uploadObject(target, job.objectPath, job.bytes, job.contentType, AVATARS_BUCKET);
    uploaded += 1;

    const url = `${publicPrefix}/${encodeObjectPath(job.objectPath)}`;
    if (job.profile.picture === url) {
      unchanged += 1;
      return;
    }
    await patchRows(target, "profiles", `id=eq.${job.profile.id}`, { picture: url });
    patched += 1;
  });

  console.log(`\n=== Result ===`);
  console.log(`  uploaded ${uploaded}, picture updated ${patched}, already correct ${unchanged}`);

  const sample = jobs.slice(0, 10);
  const heads = await Promise.all(
    sample.map((job) => headObject(target, job.objectPath, AVATARS_BUCKET)),
  );
  const missing = heads.filter((h) => !h.exists).length;
  console.log(`  sampled ${sample.length - missing}/${sample.length} avatars resolve publicly`);
  if (missing > 0) throw new Error(`${missing} uploaded avatar(s) do not resolve`);

  console.log("\nAvatar import complete.");
}

main().catch((error: unknown) => {
  console.error(`\nFATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
