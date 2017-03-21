import * as LRU from 'lru-cache';

/*
 * TODO Investigate using custom LRU using ES6 maps (may have better performance)
 * TODO May 2017 TS 2.3 Default generics! <K, V, H = string>
 */
export interface Options<K, V> extends LRU.Options<V> {
  toHash?: (key: K) => any;
  fromHash?: (hash: any) => K;
}

export default class LRUMap<K, V> extends LRU<V> {
  public toHash: (key: K) => any;
  public fromHash: (hash: any) => K;

  constructor(options: Options<K, V> | number) {
    super(options);
    this.toHash = JSON.stringify;
    this.fromHash = JSON.parse;

    if (typeof options !== 'number') {
      if (options.toHash) {
        this.toHash = options.toHash;
      }
      if (options.fromHash) {
        this.fromHash = options.fromHash;
      }
    }
  }

  public set(key: K, value: V, maxAge?: number) {
    super.set(this.toHash(key), value, maxAge);
  }

  public get(key: K) {
    return super.get(this.toHash(key));
  }

  public peek(key: K) {
    return super.peek(this.toHash(key));
  }

  public has(key: K) {
    return super.has(this.toHash(key));
  }

  public del(key: K) {
    return super.del(this.toHash(key));
  }

  public forEach(iter: (value: V, key: K, cache: LRU.Cache<V>) => void, thisp?: any) {
    super.forEach((value: V, key: string, cache: LRU.Cache<V>) => {
      iter(value, JSON.parse(key), cache);
    }, thisp);
  }

  public rforEach(iter: (value: V, key: K, cache: LRU.Cache<V>) => void, thisp?: any) {
    super.rforEach((value: V, key: string, cache: LRU.Cache<V>) => {
      iter(value, JSON.parse(key), cache);
    }, thisp);
  }
}
