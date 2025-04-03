import { randomBytes } from "crypto";
import merge from "../index";
import { sleep } from "./internal/sleep";

test("iterators are not queried until we start iteratinhg", async () => {
  const SAMPLES = 1000;

  const it = merge(
    generator("first"),
    generator("second"),
    generator("third"),
    generator("fourth")
  );

  const names: Map<string, number> = new Map();
  let i = 0;
  for await (const name of it) {
    names.set(name, (names.get(name) ?? 0) + 1);
    await sleep(1);
    if (i++ > SAMPLES) {
      break;
    }
  }

  const percents = new Map(
    [...names.entries()].map(([name, count]) => [name, (count / SAMPLES) * 100])
  );

  expect(percents.get("first")).toBeGreaterThan(20);
  expect(percents.get("second")).toBeGreaterThan(20);
  expect(percents.get("third")).toBeGreaterThan(20);
  expect(percents.get("fourth")).toBeGreaterThan(20);
});

async function* generator(name: string): AsyncGenerator<string> {
  for (let i = 0; ; i++) {
    yield name;
  }
}
