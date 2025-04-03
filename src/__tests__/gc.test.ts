import { randomBytes } from "crypto";
import merge from "../index";
import { sleep } from "./internal/sleep";

type Slot = readonly [string, Buffer];

const weakRefs: Array<WeakRef<Slot>> = [];

beforeEach(() => {
  weakRefs.splice(0);
});

test("iterators are not queried until we start iteratinhg", async () => {
  let _it = merge(createIterator("first"));
  await gc();
  expect(weakRefsAlive()).toEqual([]);
});

test("value emitted can be consumed and thus garbage collected", async () => {
  let it = merge(createIterator("first"));

  let { value } = await it.next();

  await gc();
  expect(weakRefsAlive()).toEqual(["first0"]);

  value = null;

  await gc();
  expect(weakRefsAlive()).toHaveLength(0);
});

test("no magic: values of other iterators are retained in memory", async () => {
  let it = merge(
    createIterator("first"),
    createIterator("second"),
    createIterator("third")
  );

  await it.next();

  await gc();
  expect(weakRefsAlive()).toEqual(["second0", "third0"]);
});

function createIterator(name: string): AsyncIterator<Slot> {
  let i = 0;
  return {
    next: async () => {
      await sleep(2);
      if (i >= 10) {
        return { value: undefined, done: true };
      } else {
        const value: Slot = [name + i, randomBytes(1024 * 1024)];
        i++;
        weakRefs.push(new WeakRef(value));
        return { value, done: false };
      }
    },
  };
}

async function gc() {
  await sleep(10);
  global.gc!();
}

function weakRefsAlive() {
  return weakRefs.map((r) => r.deref()?.[0]).filter(Boolean);
}
