import merge from ".";

async function* generator(name: string) {
  for (let i = 0; ; i++) {
    yield name + i;
    await new Promise((resolve) => process.nextTick(resolve));
  }
}

async function* ticker() {
  for (let i = 0; ; i++) {
    yield "tick";
    // Rarely ticking generator is evil, because it may cause reusing of the
    // same Promise in Promise.race() thousands of times which produces a
    // slowdown and memory leaks: https://github.com/nodejs/node/issues/17469
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function* caller() {
  yield* merge(generator("A"), generator("B"), generator("C"));
}

async function* callerWithTicker() {
  yield* merge(generator("A"), generator("B"), generator("C"), ticker());
}

async function bench(func: () => AsyncGenerator<string>, max: number) {
  let count = 0;
  const t = Date.now();
  for await (const msg of func()) {
    if (count >= max) {
      break;
    }
    count++;
  }
  const rate = Math.round((max / (Date.now() - t)) * 1000);
  console.log(`${func.name}: ${rate} yields/s; count=${count}`);
}

(async () => {
  const MAX = 500000;
  await bench(caller, MAX);
  await bench(callerWithTicker, MAX);
})();
