/** Approximate USD per token. Used only for the "cost of this answer" display, not for billing. */
interface Price { input: number; output: number; cacheRead: number }

const PER_M = (inp: number, out: number, cacheRead: number): Price => ({ input: inp / 1e6, output: out / 1e6, cacheRead: cacheRead / 1e6 });

const PRICES: Record<string, Price> = {
  "claude-opus-5-5": PER_M(4, 20, 0.2),
  "claude-sonnet-5-5": PER_M(2, 10, 0.2),
  "claude-haiku-5-5": PER_M(0.1, 0.5, 0.01), // cache-read price is an assumption (10% of input)
};

export interface Usage { input: number; output: number; cacheRead: number; cacheWrite: number }

export function estimateCost(model: string, u: Usage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.input * 1.25;
}
