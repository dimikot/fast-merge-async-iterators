import merge from "../index";
import { PassThrough } from "stream";

async function* fromArray<T>(array: T[]) {
  yield* array;
}

async function* numbers() {
  yield 4;
  yield 5;
  yield 6;
}

async function* slowNumbers() {
  await promiseImmediate();
  await promiseImmediate();
  yield 1;
  await promiseImmediate();
  await promiseImmediate();
  yield 2;
  await promiseImmediate();
  await promiseImmediate();
  yield 3;
}

async function* strings() {
  yield "Borekh-Habo";
  yield "Wilkomme";
  yield "Benvenuto";
}

async function* fastStrings() {
  await promiseImmediate();
  yield "Borekh-Habo";
  await promiseImmediate();
  yield "Wilkomme";
  await promiseImmediate();
  yield "Benvenuto";
}

describe("merge", () => {
  it("iterates sync iterators", async () => {
    const values: any[] = [];
    const merged = merge(numbers(), strings());
    for await (const val of merged) {
      values.push(val);
    }
    expect(values).toEqual([4, "Borekh-Habo", 5, "Wilkomme", 6, "Benvenuto"]);
  });

  it("iterates async iterators", async () => {
    const values: any[] = [];
    const merged = merge(slowNumbers(), fastStrings());
    for await (const val of merged) {
      values.push(val);
    }
    expect(values).toEqual(["Borekh-Habo", 1, "Wilkomme", "Benvenuto", 2, 3]);
  });

  it("iterates iterables", async () => {
    const values: any[] = [];
    const merged = merge(
      fromArray([1, 2, 3]),
      fromArray(["Borekh-Habo", "Wilkomme", "Benvenuto"])
    );
    for await (const val of merged) {
      values.push(val);
    }
    expect(values).toEqual([1, "Borekh-Habo", 2, "Wilkomme", 3, "Benvenuto"]);
  });

  it("a mix of sync and async iterators and iterables", async () => {
    const values: any[] = [];
    const merged = merge(slowNumbers(), numbers(), fastStrings());
    for await (const val of merged) {
      values.push(val);
    }
    expect(values).toEqual([
      4,
      5,
      6,
      "Borekh-Habo",
      1,
      "Wilkomme",
      "Benvenuto",
      2,
      3,
    ]);
  });

  it("works with node streams", async () => {
    const stream = new PassThrough();
    const stream2 = new PassThrough();
    const itr = merge(fromStream(stream), fromStream(stream2));
    stream.end();
    stream2.end();
    for await (const val of itr) {
      throw new Error(`there should be no value here ${val}`);
    }
  });
});

function promiseImmediate<T>(data?: T) {
  return new Promise<T | undefined>((resolve) =>
    setImmediate(() => resolve(data))
  ) as Promise<T>;
}

interface ReadableStreamish {
  once: any;
  read: any;
}

async function onceReadable(stream: ReadableStreamish) {
  return new Promise<void>((resolve) => {
    stream.once("readable", () => {
      resolve();
    });
  });
}

async function* _fromStream(stream: ReadableStreamish) {
  while (true) {
    const data = stream.read();
    if (data !== null) {
      yield data;
      continue;
    }
    if ((stream as any)._readableState.ended) {
      break;
    }
    await onceReadable(stream);
  }
}

function fromStream<T>(stream: ReadableStreamish): AsyncIterable<T> {
  if (Symbol.asyncIterator in stream) {
    return stream as any;
  }

  return _fromStream(stream) as AsyncIterable<T>;
}
