import { LRUMap } from 'lru_map';

export interface Options<K, H> {
  limit: number;
  toHash?: (key: K) => H;
}

export class LRUCustomHash<K, V, H>  {
  public toHash: (key: K) => H;
  public romHash: (hash: H) => K;

  private valuesLRU: LRUMap<H, V>;
  private keysLRU: LRUMap<H, K>;

  constructor(options: Options<K, H>) {
    this.valuesLRU = new LRUMap<H, V>(options.limit);
    this.keysLRU = new LRUMap<H, K>(options.limit);

    if (options.toHash) {
      this.toHash = options.toHash;
    }
  }

  public set(key: K, value: V) {
    this.keysLRU.set(this.toHash(key), key);
    this.valuesLRU.set(this.toHash(key), value);
  }

  public shift(): [K, V] | undefined {
    let keyShift = this.keysLRU.shift();
    let valueShift = this.valuesLRU.shift();
    if (keyShift !== undefined && valueShift !== undefined) {
      if (keyShift[0] !== valueShift[0]) {
        console.error(`LRUCustomHash not in sync, shifted key ${keyShift} and value ${valueShift}`);
      }
      return [keyShift[1], valueShift[1]];
    }
    return undefined;
  }

  public get(key: K): V | undefined {
    this.keysLRU.get(this.toHash(key));
    return this.valuesLRU.get(this.toHash(key));
  }

  // Does not register recent-cy
  public has(key: K): boolean {
    return this.valuesLRU.has(this.toHash(key));
  }

  // Does not register recent-cy
  public find(key: K): V | undefined {
    return this.valuesLRU.find(this.toHash(key));
  }

  public delete(key: K): V | undefined {
    this.keysLRU.delete(this.toHash(key));
    return this.valuesLRU.delete(this.toHash(key));
  }

  public clear(): void {
    this.keysLRU.clear();
    this.valuesLRU.clear();
  }

  public keys(): Iterator<K> {
    return this.keysLRU.values();
  }

  public values(): Iterator<V> {
    return this.valuesLRU.values();
  }

  public forEach(iter: (value: V, key: K, map: LRUCustomHash<K, H, V>) => void, thisArg: any = this): void {
    this.valuesLRU.forEach((value: V, key: H, m: LRUMap<H, V>) => {
      let originalKey = this.keysLRU.find(key);
      if (originalKey === undefined) {
        console.error(`Unable to process ${key}, because hashKey was not found`);
      } else {
        iter.call(thisArg, value, originalKey, this);
      }
    }, this.valuesLRU);
  }
}

export default class LRUHashString<K, V> extends LRUCustomHash<K, V, string> {
  constructor(options: Options<K, string> | number) {
    if (typeof options === 'number') {
      options = { limit: options };
    }
    if (options.toHash === undefined) {
      options.toHash = JSON.stringify;
    }
    super(options);
  }
}
