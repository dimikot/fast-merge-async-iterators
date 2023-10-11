import merge from "../index";

const FIX = [
  "first_0",
  "first_1",
  "first_2",
  "second_0",
  "second_1",
  "second_2",
].sort();

async function* getValues(id: any) {
  for (let count = 0; count < 3; count++) {
    const ms = Math.ceil(Math.random() * 1000);
    await new Promise((resolve) => setTimeout(resolve, ms));
    yield `${id}_${count}`;
  }
}

async function* getThrow(_id: any) {
  throw new Error("oh no!");
}

test("all values must be retrieved (but not in sequence)", async () => {
  const first = getValues("first");
  const second = getValues("second");

  const retrievedValues = [];
  for await (const value of merge(first, second)) {
    expect(typeof value).toEqual("string");
    retrievedValues.push(value);
  }

  expect(retrievedValues.length).toEqual(6); // "We must retrieve 6 values
  const sorted = retrievedValues.slice(0).sort();
  expect(sorted.toString()).toEqual(FIX.toString());
  expect(retrievedValues.toString()).not.toEqual(sorted.toString());
}, 10000);

test("combineAsyncIterators must close all iterators when it throw", async () => {
  const first = getThrow("first");
  const second = getThrow("second");

  try {
    for await (const _value of merge(first, second)) {
      // Do nothing (it throw).
    }
  } catch (err: any) {
    expect(err.message).toEqual("oh no!");
    const result = await Promise.all([first.next(), second.next()]);
    expect(result.every((row) => row.done === true)).toBeTruthy();
  }
});
