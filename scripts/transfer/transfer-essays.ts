import { resolveSource, resolveTarget } from "./config";
import { assertTargetEmpty, formatPlan, gatherPlan } from "./preflight";

const PRODUCTION_CONFIRM_FLAG = "--i-know-this-is-production";

export interface CliOptions {
  readonly target: string;
  readonly dryRun: boolean;
  readonly resume: boolean;
  readonly rollback: boolean;
  readonly confirmProduction: boolean;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  const targetArg = argv.find((arg) => arg.startsWith("--target="));
  if (targetArg === undefined) {
    throw new Error("Missing --target=preview|production");
  }
  return {
    target: targetArg.slice("--target=".length),
    dryRun: argv.includes("--dry-run"),
    resume: argv.includes("--resume"),
    rollback: argv.includes("--rollback"),
    confirmProduction: argv.includes(PRODUCTION_CONFIRM_FLAG),
  };
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const source = resolveSource();
  const target = resolveTarget(options.target);

  if (target.name === "production" && !options.confirmProduction) {
    throw new Error(
      `Refusing to touch production without ${PRODUCTION_CONFIRM_FLAG}`,
    );
  }

  section(`Preflight: local -> ${target.name}`);
  const plan = await gatherPlan(source, target);
  console.log(formatPlan(plan));

  if (options.dryRun) {
    console.log("\nDry run — nothing was written.");
    return;
  }

  assertTargetEmpty(plan.targetCounts, options.resume);

  console.log("\nStages not yet implemented.");
}

main().catch((error: unknown) => {
  console.error(`\nFATAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
