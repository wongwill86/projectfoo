import UInt64 from '../../../types/uint64';
export type HashType = 'murmur' | 'fnv1a' | 'identity';

export default class HashFunction {
  /* Constants */
  // Murmur3
  private static readonly murmur3_32_c1 = 0xcc9e2d51;
  private static readonly murmur3_32_c2 = 0x1b873593;
  private static readonly murmur3_32_n = 0xe6546b64;
  private static readonly murmur3_32_mix1 = 0x85ebca6b;
  private static readonly murmur3_32_mix2 = 0xc2b2ae35;

  // FNV-1a
  private static readonly fnv_offset_32 = 0x811c9dc5;
  private static readonly fnv_prime_32 = 16777619;

  private hashFunc: (key: UInt64) => number;

  public static createHashFunctions(a: HashType, b: HashType): [HashFunction, HashFunction] {
    return [new HashFunction(a), new HashFunction(b)];
  }

  /* tslint:disable:no-bitwise */
  /* Hash Functions */
  // Simple
  // This fine-tuned hash function was higly optimized for GPU lookup speed :D
  public static identity_32(k: number): number {
    return k >>> 0;
  }

  // Murmur3
  // https://en.wikipedia.org/wiki/MurmurHash
  public static murmur3_32(k: number, seed: number): number {
    k = this.x86Multiply(k, this.murmur3_32_c1);
    k = this.x86Rotl(k, 15);
    k = this.x86Multiply(k, this.murmur3_32_c2);

    let h = seed;
    h ^= k;
    h = this.x86Rotl(h, 13);
    h = this.x86Multiply(h, 5) + this.murmur3_32_n;

    h ^= 4;
    h ^= h >>> 16;
    h = this.x86Multiply(h, this.murmur3_32_mix1);
    h ^= h >>> 13;
    h = this.x86Multiply(h, this.murmur3_32_mix2);
    h ^= h >>> 16;

    return h >>> 0;
  }

  // FNV-1a (with seed)
  // https://en.wikipedia.org/wiki/Fowler-Noll-Vo_hash_function
  public static fnv1a_32(k: number, seed: number = this.fnv_offset_32): number {
    let h = seed;
    h ^= (k & 0xFF000000) >>> 24;
    h = this.x86Multiply(h, this.fnv_prime_32);
    h ^= (k & 0x00FF0000) >>> 16;
    h = this.x86Multiply(h, this.fnv_prime_32);
    h ^= (k & 0x0000FF00) >>> 8;
    h = this.x86Multiply(h, this.fnv_prime_32);
    h ^= (k & 0x000000FF) >>> 0;
    h = this.x86Multiply(h, this.fnv_prime_32);

    return h >>> 0;
  }

  public static combineUInt32(m: number, n: number) {
    return (m ^ (n + 0x517cc1b7 + (n << 6) + (n >>> 2))) >>> 0;
  }

  private static x86Multiply(m: number, n: number) {
    return ((m & 0xffff) * n) + ((((m >>> 16) * n) & 0xffff) << 16);
  }

  private static x86Rotl(m: number, n: number) {
    return (m << n) | (m >>> (32 - n));
  }
  /* tslint:enable:no-bitwise */

  /* Hash Object */
  constructor(public readonly mode: HashType, public readonly seed: number = Math.floor(Math.random() * 0x01000000)) {
    if (this.mode === 'murmur') {
      this.hashFunc = (key): number => {
        return HashFunction.combineUInt32(
          HashFunction.murmur3_32(key.low, this.seed), HashFunction.murmur3_32(key.high, this.seed));
      };
    } else if (this.mode === 'fnv1a') {
      this.hashFunc = (key): number => {
        return HashFunction.combineUInt32(
          HashFunction.fnv1a_32(key.low, this.seed), HashFunction.fnv1a_32(key.high, this.seed));
      };
    } else if (this.mode === 'identity') {
      this.hashFunc = (key): number => {
        return HashFunction.combineUInt32(
          HashFunction.identity_32(key.low), HashFunction.identity_32(key.high));
      };
    }
  }

  public compute(key: UInt64): number {
    return this.hashFunc(key);
  }

}
