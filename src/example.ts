import merge from ".";

async function* iterable(name: string, dt: number) {
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
  yield* merge("iters-close-wait", iterable("A", 222), iterable("B", 555));
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
