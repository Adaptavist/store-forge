import type { StorageKey } from "@jollytoad/store-common/types";
import { decodeBase64Url, encodeBase64Url } from "@std/encoding/base64url";

/**
 * The permitted regex for Forge keys is:
 * /^(?!\s+$)[a-zA-Z0-9:._\s-#]+$/
 *
 * but we will reserve : as a segment separator and # to indicate a segment was encoded
 */
const SEGMENT_REGEX = /^[a-zA-Z0-9._\- ]+$/;
const ENCODED_PREFIX = "#";
const SEPARATOR = ":";

/**
 * Encode a `StorageKey` as a valid Forge KV key.
 *
 * Key segments will separated by `:`, if a segment contains invalid characters
 * for Forge KV it will be base64Url encoded and prefixed with a `#`.
 */
export function encodeForgeKey(key: StorageKey, asPrefix = false): string {
  return key.map(encodeSegment).join(SEPARATOR) + (asPrefix ? SEPARATOR : "");
}

/**
 * Decode a Forge KV key back to a `StorageKey`
 * @param key
 * @returns
 */
export function decodeForgeKey(key: string): StorageKey {
  return key.split(SEPARATOR).map(decodeSegment);
}

/**
 * Encode a segment of a hierarchical Forge key, where segments are
 * separated by `:`.
 */
function encodeSegment(val: string | number | boolean): string {
  if (typeof val !== "string") {
    val = String(val);
  }
  if (SEGMENT_REGEX.test(val)) {
    return val;
  } else {
    return ENCODED_PREFIX + encodeBase64Url(val);
  }
}

/**
 * Decode a segment of a hierarchical Forge key, where segments are
 * separated by `:`.
 */
function decodeSegment(val: string): string | number | boolean {
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^\d+$/.test(val)) {
    const n = Number.parseInt(val);
    if (Number.isSafeInteger(n)) return n;
  }
  if (val.startsWith(ENCODED_PREFIX)) {
    return new TextDecoder().decode(decodeBase64Url(val.slice(1)));
  }
  return val;
}
