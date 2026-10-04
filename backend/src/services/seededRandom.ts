/**
 * seededRandom.ts
 * ───────────────
 * Deterministic seeded pseudo-random number generator.
 * Same seed always produces the same sequence — this is intentional:
 * it lets the server regenerate the same puzzle for a reconnecting player
 * without storing the full puzzle state.
 *
 * Algorithm: xorshift32 seeded from a string hash.
 */

export class SeededRandom {
  private state: number;

  constructor(seed: string) {
    // Hash the seed string into a 32-bit integer
    let h = 0x12345678;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(31, h) + seed.charCodeAt(i);
      h |= 0;
    }
    this.state = h === 0 ? 0xdeadbeef : h >>> 0;
  }

  /** Returns a pseudo-random float in [0, 1) */
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return (x >>> 0) / 0x100000000;
  }

  /** Returns a pseudo-random integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a pseudo-random float in [min, max) */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Shuffles array in-place using Fisher-Yates */
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Picks n unique items from an array */
  sample<T>(arr: T[], n: number): T[] {
    return this.shuffle(arr).slice(0, n);
  }

  /** Picks one item from array */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/** Build a compound seed from player ID + challenge ID + attempt number */
export function buildSeed(userId: string, challengeId: string, attemptNumber: number): string {
  return `${userId}:${challengeId}:${attemptNumber}`;
}
