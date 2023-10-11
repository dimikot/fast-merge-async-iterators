# fast-merge-async-iterators: merge AsyncIterables with all corner cases covered

The idea is to build a ES2018+ compatible module which _really_ covers all the
features of AsyncIterator, AsyncIterable, AsyncGenerator and <a
href="https://stackoverflow.com/questions/50585456/how-can-i-interleave-merge-async-iterables">doesn't
throw the baby out with the bathwater</a>.

```ts
async function* gen1() { ... yield ... }
async function* gen2() { ... yield ... }
async function* gen3() { ... yield ... }
...
for await (merge(gen1(), gen2(), gen3())) { ... }
...
for await (merge("iters-close-wait", gen1(), gen2(), gen3())) { ... }
```

- Interleaves the values yielded by the inner AsyncIterables as soon as they
  arrive.
- Supports exceptions propagation down the stack: if an inner iterator throws,
  then all other iterators will be closed (with or without waiting), and then
  the exception will be delivered to the caller.
- Works fast and with no <a href="https://github.com/nodejs/node/issues/17469">memory leak in Promise.race()</a>.
- Closes merging iterators correctly once the caller stops iterating the merged
  iterator: calls `.return()` for them which effectively triggers all their
  `finally {}` blocks.

<a href="https://imgflip.com/i/4d7gwx"><img src="https://i.imgflip.com/4d7gwx.jpg" title="made at imgflip.com"/></a>

## Usage Example

```ts
import merge from "fast-merge-async-iterators";

async function* generator(name: string, dt: number) {
  try {
    for (let i = 0; ; i++) {
      console.log(`${name} yielded ${i}`);
      yield `${name}: ${i}`;
      await new Promise((resolve) => setTimeout(resolve, dt));
    }
  } finally {
    console.log(`Closing ${name} (doing some cleanup)`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function* caller() {
  // JS does a good job of propagating iterator close operation (i.e.
  // calling `.return()` an iterator is used in `yield*` or `for await`).
  yield* merge("iters-close-wait", generator("A", 222), generator("B", 555));
  // Available modes:
  // - "iters-noclose" (does not call inner iterators' `return` method)
  // - "iters-close-nowait" (calls `return`, but doesn't await nor throw)
  // - "iters-close-wait" (calls `return` and awaits for inners to finish)
}

(async () => {
  for await (const message of caller()) {
    if (message.includes("2")) {
      // This `break` closes the merged iterator, and the signal is
      // propagated to all inner iterators.
      break;
    }
    console.log(`Received from ${message}`);
  }
  console.log("Finishing");
})();
```

Result:

```
A yielded 0
B yielded 0
Received from A: 0
Received from B: 0
A yielded 1
Received from A: 1
A yielded 2
Closing A (doing some cleanup)
B yielded 1
Closing B (doing some cleanup)
Finishing
```

## Inspired by

The alternative libraries mentioned below have one or more flaws. Mostly it's
about inability to close the inner iterators once the merged iterator is closed,
having a memory leak when one iterator finishes early, and about having an
overcomplicated/slow code.

- https://github.com/reconbot/streaming-iterables/blob/master/lib/parallel-merge.ts
- https://github.com/fraxken/combine-async-iterators/blob/master/index.js
- https://github.com/vadzim/mergeiterator/blob/master/src/mergeiterator.ts
- https://github.com/hesher/mergen/blob/master/mergen.js
- https://github.com/ReactiveX/IxJS/blob/master/src/asynciterable/merge.ts
- https://github.com/laggingreflex/merge-async-iterators/blob/master/index.js

Situation: There are 6 different libraries to merge AsyncIterables with different bugs and corner cases.

Cueball: 6?! Ridiculous! We need to develop one universal library that covers everyone's use cases.

Ponytail: Yeah!

(Soon) Situation: There are 7 different libraries to merge AsyncIterables.
