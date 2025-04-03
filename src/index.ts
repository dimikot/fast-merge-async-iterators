type AsyncIter<T> = AsyncIterator<T> | AsyncIterable<T>;

type Mode = "iters-noclose" | "iters-close-nowait" | "iters-close-wait";

export default function merge<TArray extends Array<AsyncIter<any>>>(
  mode: Mode,
  ...iters: TArray
): AsyncIterableIterator<TArray extends Array<AsyncIter<infer T>> ? T : never>;

export default function merge<TArray extends Array<AsyncIter<any>>>(
  ...iters: TArray
): AsyncIterableIterator<TArray extends Array<AsyncIter<infer T>> ? T : never>;

export default async function* merge(...args: any[]) {
  const mode =
    typeof args[0] === "string" ? (args.shift() as Mode) : "iters-close-nowait";
  const iters = args;

  const promises = new Map(
    iters
      .map<AsyncIterator<any>>((iter) =>
        Symbol.asyncIterator in iter
          ? (iter as any)[Symbol.asyncIterator]()
          : iter
      )
      .map((iterator) => [iterator, next(iterator)])
  );

  try {
    while (promises.size > 0) {
      const reply = await Promise.race(promises.values());

      if (reply.length === 3) {
        const [, iterator, err] = reply;
        // Since this iterator threw, it's already ended, so we remove it.
        promises.delete(iterator);
        throw err;
      }

      const [res, iterator] = reply;

      if (res.done) {
        promises.delete(iterator);
      } else {
        // This allows the consumer of the value to delete it on its end, and
        // the value will be then garbage collected. Works only for the cases
        // when the iterators fed to merge() are plain (not async generators
        // with yield; in the latter case, you will have to add this
        // process.nextTick() cleanup there too).
        process.nextTick(() => {
          res.value = null;
        });

        // Return the value to the consumer. In the next tick, it will be
        // removed from here, so even if nobody calls .next() on the merged
        // iterator anymore, the value will be garbage collected.
        yield res.value;

        // Iterators starvation prevention. Imagine you merge two iterators, and
        // iterator1 always yields something, whilst iterator2 yields rarely. If
        // we don't delete and then re-add the Promise in the end, then
        // Promise.race() would have always returned values from iterator1 and
        // never from iterator2. With deletion and re-adding to the end, we tell
        // Promise.race() to give a fair chance to all iterators.
        promises.delete(iterator);

        // After we're back from yield (aka someone called .next() on the merged
        // iterator again), schedule the next value fetching from the same
        // iterator and re-add the Promise to the END of the set, subject for
        // Promise.race() fair pickup.
        promises.set(iterator, next(iterator));
      }
    }
  } finally {
    switch (mode) {
      case "iters-noclose":
        // Let inner iterables continue running in nowhere until they reach
        // the next yield and block on it, then garbage collected (since
        // no-one will read the result of those yields).
        break;
      case "iters-close-nowait":
        promises.forEach((_, iterator) => void iterator.return?.());
        break;
      case "iters-close-wait":
        await Promise.all(
          [...promises.keys()].map((iterator) => iterator.return?.())
        );
        (await Promise.all(promises.values())).forEach((reply) => {
          if (reply.length === 3) {
            const [, , err] = reply;
            throw err;
          }
        });
        break;
    }
  }
}

async function next<T>(iterator: AsyncIterator<T>) {
  return iterator
    .next()
    .then((res) => [res, iterator] as const)
    .catch((err) => [undefined, iterator, err] as const);
}
