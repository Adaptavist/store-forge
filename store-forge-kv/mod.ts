import type {
  ListItemsOptions,
  StorageKey,
  StorageModule,
} from "@storage/common/types";
import { kvs, WhereConditions } from "@forge/kvs";
import { decodeForgeKey, encodeForgeKey } from "./key.ts";
import { config } from "./config.ts";

export type { StorageKey, StorageModule };

({
  isWritable,
  hasItem,
  getItem,
  setItem,
  removeItem,
  listItems,
  clearItems,
  close,
  url,
}) satisfies StorageModule;

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
 * Set a value for the given key.
 */
export async function setItem<T>(key: StorageKey, value: T): Promise<void> {
  await kvs.set<T>(encodeForgeKey(key), value);
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

/**
 * Close all associated resources.
 * This isn't generally required in most situations, it's main use is within test cases.
 */
export async function close(): Promise<void> {
}
