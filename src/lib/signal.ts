/** 1台だけを敵（または空き）にする。直前と同じ端末は、他があれば選ばない。 */
export function pickLone(ids: string[], previous: string | null, rng: () => number): string {
  const pool = previous ? ids.filter((id) => id !== previous) : ids;
  const choices = pool.length > 0 ? pool : ids;
  const index = Math.min(choices.length - 1, Math.floor(rng() * choices.length));
  return choices[Math.max(0, index)];
}
