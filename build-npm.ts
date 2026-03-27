import { build, emptyDir } from "@deno/dnt";

interface DenoConfig {
  name: string;
  version: string;
}

async function buildNpm(dir: string) {
  Deno.chdir(dir);

  const { name, version } = JSON.parse(
    await Deno.readTextFile(`./deno.json`),
  ) as DenoConfig;

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
    declaration: false,
    scriptModule: false,
  });
}

await buildNpm("store-forge-kv");
