import merge from "../index";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class Deferred<T> {
  resolve!: (res?: any) => void;

  promise = new Promise<T>((resolve) => {
    this.resolve = resolve;
  });
}

async function* repeat(
  value: any,
  count = Infinity,
  interval = 0,
  onDone?: () => void
) {
  try {
    for (let i = 0; i < count; i++) {
      yield value;
      await sleep(interval);
    }
  } finally {
    if (onDone) {
      onDone();
    }
  }
}

describe("merge", () => {
  test("test time intervals", async () => {
    const done = new Deferred();
    const it = merge(
      (async function* () {
        yield 1;
        await sleep(1);
        yield 2;
        await sleep(1);
        yield 2;
      })(),
      repeat(3, 5, 333),
      repeat(5, Infinity, 555, done.resolve),
      (async function* () {
        await sleep(777);
        yield 7;
      })(),
      (async function* () {
        await sleep(1777);
        throw 10;
      })()
    );
    await expect(it.next()).resolves.toEqual({ value: 1, done: false }); // 0ms
    await expect(it.next()).resolves.toEqual({ value: 3, done: false }); // 0 #3.1
    await expect(it.next()).resolves.toEqual({ value: 5, done: false }); // 0 #5.1
    await expect(it.next()).resolves.toEqual({ value: 2, done: false }); // 0
    await expect(it.next()).resolves.toEqual({ value: 2, done: false }); // 0
    await expect(it.next()).resolves.toEqual({ value: 3, done: false }); // 333 #3.2
    await expect(it.next()).resolves.toEqual({ value: 5, done: false }); // 555 #5.2
    await expect(it.next()).resolves.toEqual({ value: 3, done: false }); // 666 #3.3
    await expect(it.next()).resolves.toEqual({ value: 7, done: false }); // 777
    await expect(it.next()).resolves.toEqual({ value: 3, done: false }); // 999 #3.4
    await expect(it.next()).resolves.toEqual({ value: 5, done: false }); // 1110 #5.3
    await expect(it.next()).resolves.toEqual({ value: 3, done: false }); // 1332 #3.5
    await expect(it.next()).resolves.toEqual({ value: 5, done: false }); // 1665 #5.4
    await expect(it.next()).rejects.toBe(10); // 1777
    await expect(it.next()).resolves.toEqual({ value: undefined, done: true });
    await expect(it.next()).resolves.toEqual({ value: undefined, done: true });
    await done.promise;
  });

  test("reading ahead", async () => {
    const done = new Deferred();
    const it = merge(
      (async function* () {
        yield 1;
        await sleep(1);
        yield 2;
        await sleep(1);
        yield 2;
      })(),
      repeat(3, 5, 333),
      repeat(5, Infinity, 555, done.resolve),
      (async function* () {
        await sleep(777);
        yield 7;
      })(),
      (async function* () {
        await sleep(1777);
        throw 10;
      })()
    );
    const v = [];
    for (let i = 0; i < 16; i++) {
      v[i] = it.next();
    }
    await expect(v.shift()).resolves.toEqual({ value: 1, done: false }); // 0ms
    await expect(v.shift()).resolves.toEqual({ value: 3, done: false }); // 0 #3.1
    await expect(v.shift()).resolves.toEqual({ value: 5, done: false }); // 0 #5.1
    await expect(v.shift()).resolves.toEqual({ value: 2, done: false }); // 0
    await expect(v.shift()).resolves.toEqual({ value: 2, done: false }); // 0
    await expect(v.shift()).resolves.toEqual({ value: 3, done: false }); // 333 #3.2
    await expect(v.shift()).resolves.toEqual({ value: 5, done: false }); // 555 #5.2
    await expect(v.shift()).resolves.toEqual({ value: 3, done: false }); // 666 #3.3
    await expect(v.shift()).resolves.toEqual({ value: 7, done: false }); // 777
    await expect(v.shift()).resolves.toEqual({ value: 3, done: false }); // 999 #3.4
    await expect(v.shift()).resolves.toEqual({ value: 5, done: false }); // 1110 #5.3
    await expect(v.shift()).resolves.toEqual({ value: 3, done: false }); // 1332 #3.5
    await expect(v.shift()).resolves.toEqual({ value: 5, done: false }); // 1665 #5.4
    await expect(v.shift()).rejects.toBe(10); // 1777
    await expect(v.shift()).resolves.toEqual({ value: undefined, done: true });
    await expect(v.shift()).resolves.toEqual({ value: undefined, done: true });
    await done.promise;
  });

  describe("test functionality", () => {
    test("merges empty list", async () => {
      await expect(merge().next()).resolves.toEqual({
        done: true,
        value: undefined,
      });
    });

    test("merges list of empties", async () => {
      await expect(
        merge(
          (async function* () {})(),
          (async function* () {
            return "ok";
          })()
        ).next()
      ).resolves.toEqual({
        done: true,
        value: undefined,
      });
    });

    test("rethrow", async () => {
      const it = merge(
        (async function* () {
          throw 10;
        })()
      );
      await expect(it.next()).rejects.toBe(10);
    });

    test("no extra yield after break", async () => {
      let extraYield = false;
      for await (const _ of merge(
        (async function* () {
          yield 1;
          extraYield = true;
          yield 2;
        })()
      )) {
        break;
      }
      expect(extraYield).toBe(false);
    });

    test("no extra yield after break: async body", async () => {
      let extraYield = false;
      for await (const _ of merge(
        (async function* () {
          yield 1;
          extraYield = true;
          yield 2;
        })()
      )) {
        await sleep(20);
        break;
      }
      expect(extraYield).toBe(false);
    });

    test("no extra yield after break: promise, async body", async () => {
      let extraYield = false;
      for await (const _ of merge(
        (async function* () {
          yield new Promise((resolve) => setTimeout(resolve, 20));
          extraYield = true;
          yield 2;
        })()
      )) {
        await sleep(20);
        break;
      }
      expect(extraYield).toBe(false);
    });

    test("throwing error after yield", async () => {
      const error = new Error();
      let thrown;
      try {
        for await (const _ of merge(
          (async function* () {
            yield 1;
            yield 2;
            throw error;
          })()
        )) {
          // pass
        }
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBe(error);
    });

    test("early throwing error", async () => {
      const error = new Error();
      let thrown;
      try {
        for await (const x of merge(
          (async function* () {
            throw error;
          })()
        )) {
          // pass
        }
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBe(error);
    });
  });
});
