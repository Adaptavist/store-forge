import { kvs, WhereConditions } from "@forge/kvs";

export async function testRunner() {
  const count = 100;

  console.log("Starting storage performance test...");

  await bench(serialSets, count);
  await bench(parallelSets, count);
  await bench(transacts, count);
  await bench(batchSets, count);
  await bench(bigSet, count);

  await bench(serialGets, count);
  await bench(parallelGets, count);
  await bench(batchGets, count);
  await bench(queries, count);
  await bench(bigGet, count);

  console.log("Complete.");

  return { statusCode: 200, body: "done" };
}

const TTL = { ttl: { unit: "SECONDS", value: 10 } };

async function bench(fn, count) {
  const start = Date.now();
  await fn(count);
  const end = Date.now();
  const dur = end - start;
  console.log(`${fn.name} x ${count} = ${dur}ms / ${count} = ${dur / count}ms`);
}

/**
 * Perform N number of kvs.set ops in series, awaiting each before the next
 */
async function serialSets(count) {
  const prefix = `test:s${pad(count)}:`;
  for (let i = 0; i < count; i++) {
    await kvs.set(prefix + pad(i), VAL, TTL);
  }
}

/**
 * Perform N number of kvs.set ops concurrently, awaiting all to complete
 */
async function parallelSets(count) {
  const prefix = `test:p${pad(count)}:`;
  const promises = [];

  for (let i = 0; i < count; i++) {
    promises.push(kvs.set(prefix + pad(i), VAL, TTL));
  }

  await Promise.all(promises);
}

/**
 * Perform N number of set ops within batches using kvs.batchSet, upto
 * 25 items per batch, batch ops are performed concurrently
 */
async function batchSets(count) {
  const prefix = `test:b${pad(count)}:`;
  let batch = [];
  const promises = [];

  for (let i = 0; i < count; i++) {
    batch.push({ key: prefix + pad(i), value: VAL, options: TTL });

    if (batch.length === 25) {
      promises.push(kvs.batchSet(batch));
      batch = [];
    }
  }

  if (batch.length > 0) {
    promises.push(kvs.batchSet(batch));
    batch = [];
  }

  await Promise.all(promises);
}

/**
 * Perform N number of set ops within transactions using kvs.transact, upto
 * 25 items per transaction, transactions are performed concurrently
 */
async function transacts(count) {
  const prefix = `test:t${pad(count)}:`;
  let tx = kvs.transact();
  let tc = 0;
  const promises = [];

  for (let i = 0; i < count; i++) {
    tx = tx.set(prefix + pad(i), VAL, TTL);
    tc++;

    if (tc === 25) {
      promises.push(tx.execute());
      tx = kvs.transact();
      tc = 0;
    }
  }

  if (tc > 0) {
    promises.push(tx.execute());
  }

  await Promise.all(promises);
}

/**
 * Perform a single set with a value of N times the size of the other tests
 */
async function bigSet(count) {
  const prefix = `test:l${pad(count)}`;
  await kvs.set(prefix, VAL.repeat(count), TTL);
}

/**
 * Perform N kvs.get ops in series, awaiting each before the next
 */
async function serialGets(count) {
  const prefix = `test:b${pad(count)}:`;
  for (let i = 0; i < count; i++) {
    await kvs.get(prefix + pad(i));
  }
}

/**
 * Perform N kvs.get ops concurrently, awaiting all to complete
 */
async function parallelGets(count) {
  const prefix = `test:b${pad(count)}:`;
  const promises = [];

  for (let i = 0; i < count; i++) {
    promises.push(kvs.get(prefix + pad(i)));
  }

  await Promise.all(promises);
}

/**
 * Perform N number of get ops within batches using kvs.batchGet, upto
 * 25 items per batch, batch ops are performed concurrently
 */
async function batchGets(count) {
  const prefix = `test:b${pad(count)}:`;
  let batch = [];
  const promises = [];

  for (let i = 0; i < count; i++) {
    batch.push({ key: prefix + pad(i) });

    if (batch.length === 25) {
      promises.push(kvs.batchGet(batch));
      batch = [];
    }
  }

  if (batch.length > 0) {
    promises.push(kvs.batchGet(batch));
    batch = [];
  }

  await Promise.all(promises);
}

/**
 * Perform a query using a key prefix, expecting to read exactly N
 * number of items.
 */
async function queries(count) {
  const prefix = `test:b${pad(count)}:`;
  let total = 0;
  let cursor = undefined;

  let more = true;
  let nextCursor = undefined;

  while (more) {
    let query = kvs.query()
      .limit(100)
      .where("key", WhereConditions.beginsWith(prefix));

    if (nextCursor) {
      query = query.cursor(nextCursor);
    }

    const listResult = await query.getMany();

    nextCursor = listResult.nextCursor;
    more = !!nextCursor;
    total += listResult.results.length;
  }

  if (total !== count) {
    console.error(`Query returned only ${total} items, but expected ${count}`);
  }
}

/**
 * Perform a single kvs.get to read the previous written big item (from bigSet).
 */
async function bigGet(count) {
  const prefix = `test:l${pad(count)}`;
  await kvs.get(prefix);
}

function pad(n) {
  return String(n).padStart(4, "0");
}

/**
 * Some arbitrary content for the value
 */
const VAL = `import { Deno, testDefinitions } from "@deno/shim-deno-test";

globalThis.Deno ??= Deno;

/**
 * Just enough test runner to run Deno.test's inside a Forge webtrigger
 *
 * TODO: use https://github.com/denoland/dnt/blob/main/lib/test_runner/test_runner.ts
 */
export async function testRunner() {
  let pass = true;

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
`;
