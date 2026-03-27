import { testStore } from "@storage/test";
import * as store from "./mod.ts";

Deno.test("store-forge-kv", async (t) => {
  await testStore(t, store, {
    batchAtomic: [undefined, "preferred"],
  });
});
