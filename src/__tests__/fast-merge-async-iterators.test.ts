import merge from "../index";

test("one iterator failure propagates return to others", async () => {
  const log: string[] = [];
  const it = merge(
    "iters-close-nowait",
    (async function* first() {
      try {
        yield 1;
        await sleep(333);
        yield 11;
        await sleep(333);
        yield 111;
        await sleep(333);
        log.push("first: next yield must return instead");
        yield 1111;
        log.push("first: must never be reached");
      } finally {
        log.push("first ended");
      }
    })(),
    (async function* second() {
      try {
        yield 2;
        await sleep(555);
        yield 22;
        await sleep(555);
        log.push("second: next yield must return instead");
        yield 222;
        log.push("second: must never be reached");
      } catch (e) {
        throw e;
      } finally {
        log.push("second ended");
      }
    })(),
    (async function* third() {
      try {
        yield 3;
        await sleep(777);
        throw 42;
      } finally {
        log.push("third ended");
      }
    })()
  );

  await expect(it.next()).resolves.toEqual({ value: 1, done: false }); // 0ms
  await expect(it.next()).resolves.toEqual({ value: 2, done: false }); // 0
  await expect(it.next()).resolves.toEqual({ value: 3, done: false }); // 0
  await expect(it.next()).resolves.toEqual({ value: 11, done: false }); // 333
  await expect(it.next()).resolves.toEqual({ value: 22, done: false }); // 555
  await expect(it.next()).resolves.toEqual({ value: 111, done: false }); // 666
  await expect(it.next()).rejects.toBe(42); // 777
  await expect(it.next()).resolves.toEqual({ value: undefined, done: true });
  await expect(it.next()).resolves.toEqual({ value: undefined, done: true });

  await sleep(1000);

  expect(log).toEqual([
    "third ended",
    "first: next yield must return instead",
    "first ended",
    "second: next yield must return instead",
    "second ended",
  ]);
}, 10000);

test("caller stopping iteration causes children iterators end", async () => {
  const log: string[] = [];

  async function* iter() {
    yield* merge(
      "iters-close-wait",
      (async function* first() {
        try {
          yield 1;
          await sleep(333);
          yield 11;
          await sleep(333);
          yield 111;
          await sleep(333);
          log.push("first: next yield must return instead");
          yield 1111;
          log.push("first: must never be reached");
        } finally {
          log.push("first ended");
        }
      })(),
      (async function* second() {
        try {
          yield 2;
          await sleep(555);
          yield 22;
          await sleep(555);
          log.push("second: next yield must return instead");
          yield 222;
          log.push("first: must never be reached");
        } finally {
          log.push("second ended");
        }
      })(),
      (async function* third() {
        try {
          yield 3;
          await sleep(777);
          yield 33;
        } finally {
          log.push("third ended");
        }
      })()
    );
  }

  const it = iter();
  for await (const value of it) {
    if (value === 33) {
      break;
    }
  }

  expect(log).toEqual([
    "third ended",
    "first: next yield must return instead",
    "first ended",
    "second: next yield must return instead",
    "second ended",
  ]);
});

test("inner iterator throws during closing in iters-close-wait mode", async () => {
  async function* iter() {
    yield* merge(
      "iters-close-wait",
      (async function* first() {
        try {
          yield 1;
          await sleep(555);
          yield 11;
        } finally {
          throw "first: I failed";
        }
      })(),
      (async function* second() {
        yield 2;
        await sleep(333);
        yield 22;
      })()
    );
  }

  const it = iter();
  try {
    for await (const value of it) {
      if (value === 22) {
        break;
      }
    }
    fail("must not be here");
  } catch (e) {
    expect(e).toEqual("first: I failed");
  }
});

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
