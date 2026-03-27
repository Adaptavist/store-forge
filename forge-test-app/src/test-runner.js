import { Deno, testDefinitions } from "@deno/shim-deno-test";

globalThis.Deno ??= Deno;

/**
 * Just enough test runner to run `Deno.test`'s inside a Forge webtrigger
 *
 * TODO: use https://github.com/denoland/dnt/blob/main/lib/test_runner/test_runner.ts
 */
export async function testRunner() {
  let pass = true;

  const output = [];

  function log(msg) {
    output.push(msg);
    console.log(msg);
  }

  log(`Running ${testDefinitions.length} tests...`);

  for (const def of testDefinitions) {
    pass &&= await runTest(def, 0, undefined, log);
  }

  output.push("");
  output.push(pass ? "Success" : "Fail");
  output.push("");

  return {
    statusCode: pass ? 200 : 500,
    contentType: "text/plain",
    body: output.join("\n"),
  };
}

async function runTest(def, depth, parent, log) {
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
          pass &&= await runTest(def, depth + 1, context, log);
        }
      },
    };

    const indent = "  ".repeat(depth);

    log(indent + (parent ? "- " : "TEST: ") + def.name);

    try {
      await def.fn(context);
    } catch (e) {
      pass = false;
      log(indent + "ERROR: " + e);
    }
  }

  return pass;
}
