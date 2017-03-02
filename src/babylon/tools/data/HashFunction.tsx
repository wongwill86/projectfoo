export type hashtype = 'murmur' | 'fnv1a' | 'identity';

export default class HashFunction {
  /* Constants */
  // Murmur3
  private static readonly _murmur3_32_c1 = 0xcc9e2d51;
  private static readonly _murmur3_32_c2 = 0x1b873593;
  private static readonly _murmur3_32_n = 0xe6546b64;
  private static readonly _murmur3_32_mix1 = 0x85ebca6b;
  private static readonly _murmur3_32_mix2 = 0xc2b2ae35;

  // FNV-1a
  private static readonly _fnv_offset_32 = 0x811c9dc5;
  private static readonly _fnv_prime_32 = 16777619;

  private _hashfunc: (lo: number, hi: number) => number;

  public static createHashFunctions(a: hashtype, b: hashtype): [HashFunction, HashFunction] {
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
    k = this._x86Multiply(k, this._murmur3_32_c1);
    k = this._x86Rotl(k, 15);
    k = this._x86Multiply(k, this._murmur3_32_c2);

    let h = seed;
    h ^= k;
    h = this._x86Rotl(h, 13);
    h = this._x86Multiply(h, 5) + this._murmur3_32_n;

    h ^= 4;
    h ^= h >>> 16;
    h = this._x86Multiply(h, this._murmur3_32_mix1);
    h ^= h >>> 13;
    h = this._x86Multiply(h, this._murmur3_32_mix2);
    h ^= h >>> 16;

    return h >>> 0;
  }

  // FNV-1a (with seed)
  // https://en.wikipedia.org/wiki/Fowler-Noll-Vo_hash_function
  public static fnv1a_32(k: number, seed: number = this._fnv_offset_32): number {
    let h = seed;
    h ^= (k & 0xFF000000) >>> 24;
    h = this._x86Multiply(h, this._fnv_prime_32);
    h ^= (k & 0x00FF0000) >>> 16;
    h = this._x86Multiply(h, this._fnv_prime_32);
    h ^= (k & 0x0000FF00) >>> 8;
    h = this._x86Multiply(h, this._fnv_prime_32);
    h ^= (k & 0x000000FF) >>> 0;
    h = this._x86Multiply(h, this._fnv_prime_32);

    return h >>> 0;
  }

  public static combineUInt32(m: number, n: number) {
    return (m ^ (n + 0x517cc1b7 + (n << 6) + (n >>> 2))) >>> 0;
  }

  private static _x86Multiply(m: number, n: number) {
    return ((m & 0xffff) * n) + ((((m >>> 16) * n) & 0xffff) << 16);
  }

  private static _x86Rotl(m: number, n: number) {
    return (m << n) | (m >>> (32 - n));
  }
  /* tslint:enable:no-bitwise */

  /* Hash Object */
  constructor(private _mode: hashtype, private _seed: number = Math.floor(Math.random() * 0x01000000)) {
    if (this._mode === 'murmur') {
      this._hashfunc = (lo, hi): number => {
        return HashFunction.combineUInt32(
          HashFunction.murmur3_32(lo, this._seed), HashFunction.murmur3_32(hi, this._seed));
      };
    } else if (this._mode === 'fnv1a') {
      this._hashfunc = (lo, hi): number => {
        return HashFunction.combineUInt32(
          HashFunction.fnv1a_32(lo, this._seed), HashFunction.fnv1a_32(hi, this._seed));
      };
    } else if (this._mode === 'identity') {
      this._hashfunc = (lo, hi): number => {
        return HashFunction.combineUInt32(
          HashFunction.identity_32(lo), HashFunction.identity_32(hi));
      };
    }
  }

  public compute(lo: number, hi: number = 0): number {
    return this._hashfunc(lo, hi);
  }

  get seed() {
    return this._seed;
  }


}
