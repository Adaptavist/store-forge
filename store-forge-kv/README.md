# Forge KV Storage Module

See [@jollytoad/store](https://jsr.io/@jollytoad/store) for the bigger picture.

This package provides an implementation of the storage module interface.

Uses the
[Forge Key-Value Storage](https://developer.atlassian.com/platform/forge/runtime-reference/storage-api-basic/)
API for storage.

**Example**

```ts
import * as store from "@adaptavist/store-forge-kv";
import { assertEquals } from "@std/assert";

await store.setItem(["foo", "hello"], "world");

assertEquals(await store.hasItem(["foo", "hello"]), true);
assertEquals(await store.getItem(["foo", "hello"]), "world");

await store.clearItems(["foo"]);
assertEquals(await store.hasItem(["foo", "hello"]), false);
```
