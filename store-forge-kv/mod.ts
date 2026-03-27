import type {
  BatchedOperation,
  BatchOptions,
  GetItemsOptions,
  ListItemsOptions,
  SetItemOptions,
  StorageKey,
  StorageModule,
  StorageProvider,
} from "@storage/types";
import { decodeForgeKey, encodeForgeKey } from "./key.ts";
import { config } from "./config.ts";
import { pooledMap } from "@std/async/pool";
import { chunk } from "@std/collections/chunk";
import { kvs, WhereConditions } from "@forge/kvs";
import type { BatchResult, SetOptions } from "@forge/kvs";

export type { StorageKey, StorageModule };

type BatchSetItem = Parameters<typeof kvs.batchSet>[0][number];
type BatchDeleteItem = Parameters<typeof kvs.batchDelete>[0][number];

({
  isWritable,
  hasItem,
  getItem,
  setItem,
  removeItem,
  listItems,
  clearItems,
  url,
}) satisfies StorageProvider;

/**
 * Maximum operations per Forge KV transaction
 */
const MAX_OPS_PER_TRANSACT = 25;

/**
 * Maximum operations per Forge KV batch
 */
const MAX_OPS_PER_BATCH = 25;

/**
 * Default concurrency for Forge KV requests
 */
const DEFAULT_CONCURRENCY = 10;

/**
 * Returns the `import.meta.url` of the module.
 */
export function url(): Promise<string> {
  return Promise.resolve(import.meta.url);
}

/**
 * Check whether the storage is writable in general, or at or below a particular key.
 * There still may be some sub-keys that differ.
 */
export function isWritable(_key?: StorageKey): Promise<boolean> {
  return Promise.resolve(true);
}

/**
 * Determine whether a value is set for the given key.
 */
export async function hasItem<T>(key: StorageKey): Promise<boolean> {
  return await kvs.get(encodeForgeKey(key)) !== undefined;
}

/**
 * Get a value for the given key.
 */
export async function getItem<T>(key: StorageKey): Promise<T | undefined> {
  return await kvs.get<T>(encodeForgeKey(key));
}

/**
 * Get many values for the given keys, using batched requests.
 */
export async function* getItems<T>(
  keys: Iterable<StorageKey>,
  options?: GetItemsOptions,
): AsyncIterable<[StorageKey, T]> {
  const keyBatches = asBatches(keys, MAX_OPS_PER_BATCH);
  const resultBatches = pooledMap(
    options?.concurrency ?? DEFAULT_CONCURRENCY,
    keyBatches,
    applyBatchGet<T>,
  );

  for await (const items of resultBatches) {
    yield* items;
  }
}

async function applyBatchGet<T>(
  keys: StorageKey[],
): Promise<[StorageKey, T][]> {
  const result = await kvs.batchGet<T>(
    keys.map((key) => ({ key: encodeForgeKey(key) })),
  );
  return result.successfulKeys.map((
    { key, value },
  ) => [decodeForgeKey(key), value]);
}

/**
 * Set a value for the given key.
 * Supports the `expireIn` option (rounded up from milliseconds to nearest second).
 */
export async function setItem<T>(
  key: StorageKey,
  value: T,
  options?: SetItemOptions,
): Promise<void> {
  await kvs.set<T>(encodeForgeKey(key), value, asSetOptions(options));
}

/**
 * Map SetItemOptions to Forge SetOptions
 */
function asSetOptions(options?: SetItemOptions): SetOptions | undefined {
  return options?.expireIn !== undefined && options.expireIn >= 0
    ? {
      ttl: { unit: "SECONDS", value: Math.ceil(options.expireIn / 1000) },
    }
    : undefined;
}

/**
 * Remove the value with the given key.
 */
export async function removeItem(key: StorageKey): Promise<void> {
  if (key.length) {
    await kvs.delete(encodeForgeKey(key));
  }
}

/**
 * List all items beneath the given key prefix.
 * Ordering is not guaranteed, and reverse is not supported.
 */
export async function* listItems<T>(
  prefix: StorageKey = [],
  options?: ListItemsOptions,
): AsyncIterable<[StorageKey, T]> {
  let more = true;
  let nextCursor: string | undefined = undefined;

  while (more) {
    let query = kvs.query()
      .limit(options?.pageSize ?? config.defaultListItemsPageSize)
      .where("key", WhereConditions.beginsWith(encodeForgeKey(prefix, true)));

    if (nextCursor) {
      query = query.cursor(nextCursor);
    }

    const listResult = await query.getMany<T>();

    nextCursor = listResult.nextCursor;
    more = !!nextCursor;

    for (const { key, value } of listResult.results) {
      yield [decodeForgeKey(key), value];
    }
  }
}

/**
 * Delete item and sub items recursively and clean up.
 */
export async function clearItems(prefix: StorageKey): Promise<void> {
  if (prefix.length) {
    await kvs.delete(encodeForgeKey(prefix));
  }

  let more = true;
  let nextCursor: string | undefined = undefined;

  const promises: Promise<void>[] = [];

  while (more) {
    let query = kvs.query()
      .limit(config.defaultClearItemsPageSize)
      .where("key", WhereConditions.beginsWith(encodeForgeKey(prefix, true)));

    if (nextCursor) {
      query = query.cursor(nextCursor);
    }

    const listResult = await query.getMany();

    nextCursor = listResult.nextCursor;
    more = !!nextCursor;

    for (const { key } of listResult.results) {
      promises.push(kvs.delete(key));
    }
  }

  await Promise.allSettled(promises);
}

export async function* commit(
  ops: Iterable<BatchedOperation>,
  batchOptions?: BatchOptions,
): AsyncIterable<void> {
  if (batchOptions?.atomic === "preferred") {
    yield* commitAsTransactions(ops, batchOptions);
  } else {
    yield* commitAsBatches(ops, batchOptions);
  }
}

async function* commitAsTransactions(
  ops: Iterable<BatchedOperation>,
  batchOptions?: BatchOptions,
): AsyncIterable<void> {
  const batches = asBatches(ops, MAX_OPS_PER_TRANSACT);

  yield* pooledMap(
    batchOptions?.concurrency ?? DEFAULT_CONCURRENCY,
    batches,
    async (batch) => {
      let transact = kvs.transact();

      for await (const [opName, key, value, options] of batch) {
        switch (opName) {
          case "setItem":
            transact = transact.set(
              encodeForgeKey(key),
              value,
              undefined,
              asSetOptions(options),
            );
            break;
          case "removeItem":
            transact = transact.delete(encodeForgeKey(key));
            break;
        }
      }

      await transact.execute();
    },
  );
}

async function* commitAsBatches(
  ops: Iterable<BatchedOperation>,
  batchOptions?: BatchOptions,
): AsyncIterable<void> {
  type GroupedOps = {
    removeItem?: BatchedOperation<"removeItem">[];
    setItem?: BatchedOperation<"setItem">[];
  };

  const groupedOps = Object.groupBy(ops, ([opName]) => opName) as GroupedOps;

  const deleteErrors = (await Array.fromAsync(applyBatches(
    groupedOps.removeItem?.map(asBatchDeleteItem),
    async (batch) => handleBatchResult(await kvs.batchDelete(batch)),
    batchOptions,
  ))).flat();

  const setErrors = (await Array.fromAsync(applyBatches(
    groupedOps.setItem?.map(asBatchSetItem),
    async (batch) => handleBatchResult(await kvs.batchSet(batch)),
    batchOptions,
  ))).flat();

  if (deleteErrors.length || setErrors.length) {
    throw new AggregateError([...deleteErrors, ...setErrors]);
  }

  yield;
}

async function* applyBatches<T>(
  items: T[] | undefined,
  iteratorFn: (batch: T[]) => Promise<Error[]>,
  options?: BatchOptions,
): AsyncIterable<Error[]> {
  if (items?.length) {
    const batches = chunk(items, MAX_OPS_PER_BATCH);

    yield* pooledMap(
      options?.concurrency ?? DEFAULT_CONCURRENCY,
      batches,
      iteratorFn,
    );
  }
}

function handleBatchResult(result: BatchResult): Error[] {
  return result.failedKeys?.map((failed) => new Error(failed.error.message)) ??
    [];
}

function asBatchSetItem(
  [_, key, value, options]: BatchedOperation<"setItem">,
): BatchSetItem {
  return {
    key: encodeForgeKey(key),
    value,
    options: asSetOptions(options),
  };
}

function asBatchDeleteItem(
  [_, key]: BatchedOperation<"removeItem">,
): BatchDeleteItem {
  return {
    key: encodeForgeKey(key),
  };
}

async function* asBatches<T>(
  items: Iterable<T> | AsyncIterable<T>,
  batchSize: number,
): AsyncIterable<T[]> {
  let batch: T[] = [];

  for await (const item of items) {
    batch.push(item);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }

  if (batch.length) {
    yield batch;
  }
}
