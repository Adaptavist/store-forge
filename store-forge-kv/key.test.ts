import { assertEquals } from "@std/assert";
import { decodeForgeKey, encodeForgeKey } from "./key.ts";

Deno.test("encodeForgeKey() separates using :", () => {
  assertEquals(encodeForgeKey(["a", "b", "c"]), "a:b:c");
});

Deno.test("encodeForgeKey() with asPrefix concats a trailing :", () => {
  assertEquals(encodeForgeKey(["a", "b", "c"], true), "a:b:c:");
});

Deno.test("encodeForgeKey() allows all valid chars", () => {
  assertEquals(
    encodeForgeKey([
      "abcdefghijklmnopqrstuvwxyz",
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      "0123456789",
      "-_.",
    ]),
    "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:-_.",
  );
});

Deno.test("encodeForgeKey() encodes segment containing :", () => {
  assertEquals(
    encodeForgeKey(["one", ":two:", "three"]),
    "one:#OnR3bzo:three",
  );
});

Deno.test("encodeForgeKey() encodes segment containing #", () => {
  assertEquals(
    encodeForgeKey(["one", "#two#", "three"]),
    "one:#I3R3byM:three",
  );
});

Deno.test("encodeForgeKey() encodes segment containing other invalid Forge key chars", () => {
  assertEquals(
    encodeForgeKey(["one", "two 🍻", "three"]),
    "one:#dHdvIPCfjbs:three",
  );
});

Deno.test("encodeForgeKey() encodes blank spaces", () => {
  assertEquals(
    encodeForgeKey(["   "]),
    "#ICAg",
  );
});

Deno.test("decodeForgeKey() decodes plain segments", () => {
  assertEquals(
    decodeForgeKey("one:two:three"),
    ["one", "two", "three"],
  );
});

Deno.test("decodeForgeKey() decodes encoded segments", () => {
  assertEquals(
    decodeForgeKey("two:#OnR3bzo:#I3R3byM:#dHdvIPCfjbs:#ICAg"),
    ["two", ":two:", "#two#", "two 🍻", "   "],
  );
});
