export const IMAGES_BUCKET = "images";

export type TargetName = "preview" | "production";

const TARGET_NAMES = ["preview", "production"] as const;

export interface Endpoint {
  readonly restUrl: string;
  readonly storageApiUrl: string;
  readonly publicImagePrefix: string;
  readonly serviceKey: string;
}

export function buildEndpoint(baseUrl: string, serviceKey: string): Endpoint {
  const base = baseUrl.replace(/\/+$/, "");
  return {
    restUrl: `${base}/rest/v1`,
    storageApiUrl: `${base}/storage/v1`,
    publicImagePrefix: `${base}/storage/v1/object/public/${IMAGES_BUCKET}`,
    serviceKey,
  };
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required env var ${key} — set it in .env.transfer.local`);
  }
  return value.trim();
}

export function resolveSource(env: NodeJS.ProcessEnv = process.env): Endpoint {
  return buildEndpoint(
    requireEnv(env, "LOCAL_SUPABASE_URL"),
    requireEnv(env, "LOCAL_SERVICE_ROLE_KEY"),
  );
}

export function resolveTarget(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): Endpoint & { readonly name: TargetName } {
  if (!TARGET_NAMES.includes(name as TargetName)) {
    throw new Error(
      `Unknown target "${name}" — expected one of ${TARGET_NAMES.join(", ")}`,
    );
  }
  const targetName = name as TargetName;
  const prefix = targetName.toUpperCase();
  return {
    name: targetName,
    ...buildEndpoint(
      requireEnv(env, `${prefix}_SUPABASE_URL`),
      requireEnv(env, `${prefix}_SERVICE_ROLE_KEY`),
    ),
  };
}
