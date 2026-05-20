import { testStore } from "@storage/test";
import * as store from "./mod.ts";
import { batch } from "@storage/fns/batch";
import { removeItem } from "@storage/fns/remove-item";
import { getItems } from "@storage/fns/get-items";
import { assert } from "@std/assert/assert";

Deno.test("store-forge-kv", async (t) => {
  await testStore(t, store, {
    batchAtomic: [undefined, "preferred"],
    extraTests: [
      async (t, store) => {
        await t.step("non-existent keys", async (t) => {
          await t.step("getItems", async () => {
            const results = await Array.fromAsync(getItems(store, [
              ["non", "existent", "item", "here"],
              ["another", "non", "existent", "key"],
            ]));

            assert(results.length === 0, "Expected no results");
          });

          await t.step("removeItem", async () => {
            await removeItem(store, ["non", "existent", "item", "here"]);
          });

          await t.step("removeItem in batch (atomic: preferred)", async () => {
            await batch(store, async () => {
              await removeItem(store, ["non", "existent", "item", "here"]);
            }, { atomic: "preferred" });
          });

          await t.step("removeItem in batch (atomic: undefined)", async () => {
            await batch(store, async () => {
              await removeItem(store, ["non", "existent", "item", "here"]);
            });
          });
        });
      },
    ],
  });
});
