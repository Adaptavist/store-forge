import { build, emptyDir } from "@deno/dnt";

interface DenoConfig {
  name: string;
  version: string;
  exports: Record<string, string>;
}

async function buildNpm(dir: string) {
  Deno.chdir(dir);

  const config = JSON.parse(
    await Deno.readTextFile(`./deno.json`),
  ) as DenoConfig;
  const name = config.name as string;
  const version = config.version as string;

  const outDir = `./.npm`;

  await emptyDir(outDir);

  await build({
    entryPoints: [
      { name: ".", path: "./mod.ts" },
      { name: "./test", path: "./store.forge-test.ts" },
    ],
    outDir,
    shims: {},
    typeCheck: false,
    test: false,
    package: {
      name,
      version,
    },
    packageManager: "pnpm",
  });
}

await buildNpm("store-forge-kv");
