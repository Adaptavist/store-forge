import { Deno, testDefinitions } from "@deno/shim-deno-test";

globalThis.Deno ??= Deno;

/**
 * Just enough test runner to run `Deno.test`'s inside a Forge webtrigger
 *
 * TODO: use https://github.com/denoland/dnt/blob/main/lib/test_runner/test_runner.ts
 */
export async function testRunner() {
  let pass = true;

  console.log(`Running ${testDefinitions.length} tests...`);

  for (const def of testDefinitions) {
    pass &&= await runTest(def);
  }

  return pass
    ? {
      statusCode: 200,
      body: "Success\n",
    }
    : {
      statusCode: 500,
      body: "Fail\n",
    };
}

async function runTest(def, parent) {
  let pass = true;

  if (!def.ignore) {
    const context = {
      name: def.name,
      origin: import.meta.url,
      parent,
      step: async (one, two) => {
        const def = typeof one === "object"
          ? one
          : typeof one === "string" && typeof two === "function"
          ? { name: one, fn: two }
          : typeof one === "function"
          ? { name: one.name ?? "step", fn: one }
          : undefined;
        if (def) {
          pass &&= await runTest(def, context);
        }
      },
    };

    console.log(parent ? "STEP:" : "TEST:", def.name);

    try {
      await def.fn(context);
    } catch (e) {
      pass = false;
      console.error("FAIL:", e);
    }
  }

  return pass;
}
