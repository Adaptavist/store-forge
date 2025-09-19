import {
  open,
  testClearItems,
  testCopyItems,
  testGetItem,
  testHasItem,
  testIsWritable,
  testListItems,
  testMoveItems,
  testRemoveItem,
  testSetItem,
} from "@jollytoad/store-common/test-storage-module";
import * as store from "./mod.ts";

Deno.test("store-forge-kv", async (t) => {
  try {
    await open(t, store);
    // The url isn't available when running in forge!
    // await testUrl(t, store, "store-forge-kv");
    await testIsWritable(t, store);
    await testSetItem(t, store);
    await testHasItem(t, store);
    await testGetItem(t, store);
    await testListItems(t, store);
    await testRemoveItem(t, store);
    await testClearItems(t, store);
    await testCopyItems(t, store);
    await testMoveItems(t, store);
    // Ordering is not currently supported in Forge KV
    // await testOrdering(t, store);
  } finally {
    await store.close();
  }
});
