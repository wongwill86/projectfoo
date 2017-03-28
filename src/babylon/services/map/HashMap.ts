/*
 * This is Map that allows for a custom hash functions.
 * Default uses a standard ES6 Map
 */
export interface Options<K, H> {
  toHash?: (key: K) => H;
}

export interface InternalEntry<K, V> {
  key: K;
  value: V;
}


class InternalKeyIterator<K> implements IterableIterator<K> {
  public next: () => IteratorResult<K>;
  constructor(public internalIter: Iterator<InternalEntry<K, any>>) {
    this.next = () => {
      let iterReturn = this.internalIter.next();
      if (iterReturn.done) {
        return { done: true, value: undefined!};
      } else {
        return { done: false, value: iterReturn.value.key };
      }
    };
  }

  public [Symbol.iterator]() {
    return this;
  }
}

class InternalValueIterator<V> implements IterableIterator<V> {
  public next: () => IteratorResult<V>;
  constructor(public internalIter: Iterator<InternalEntry<any, V>>) {
    this.next = () => {
      let iterReturn = this.internalIter.next();
      if (iterReturn.done) {
        return { done: true, value: undefined!};
      } else {
        return { done: false, value: iterReturn.value.value };
      }
    };
  }

  public [Symbol.iterator]() {
    return this;
  }
}

class InternalEntryIterator<K, V> implements IterableIterator<[K, V]> {
  public next: () => IteratorResult<[K, V]>;
  constructor(public internalIter: Iterator<InternalEntry<K, V>>) {
    this.next = () => {
      let iterReturn = this.internalIter.next();
      if (iterReturn.done) {
        return { done: true, value: undefined!};
      } else {
        return { done: false, value: [ iterReturn.value.key, iterReturn.value.value ] };
      }
    };
  }

  public [Symbol.iterator]() {
    return this;
  }
}

export default class HashMap<K, V, H> implements Map<K, V> {
  public readonly [Symbol.toStringTag]: 'Map';

  public toHash: (key: K) => H;
  public romHash: (hash: H) => K;

  protected internalMap: Map<H, InternalEntry<K, V>>;

  constructor(options: Options<K, H>, internalMap: Map<H, InternalEntry<K, V>> = new Map<H, InternalEntry<K, V>>()) {
    if (options.toHash) {
      this.toHash = options.toHash;
    }
    this.internalMap = internalMap;
  }

  public set(key: K, value: V): this {
    this.internalMap.set(this.toHash(key), { key, value });
    return this;
  }

  public get(key: K): V | undefined {
    let internalEntry = this.internalMap.get(this.toHash(key));
    if (internalEntry !== undefined) {
      return internalEntry.value;
    }
    return undefined;
  }

  public has(key: K): boolean {
    return this.internalMap.has(this.toHash(key));
  }

  // Does not register recency
  public find(key: K): V | undefined {
    let internalEntry = this.internalMap.get(this.toHash(key));
    if (internalEntry !== undefined) {
      return internalEntry.value;
    }
    return undefined;
  }

  public delete(key: K): boolean {
    return this.internalMap.delete(this.toHash(key));
  }

  public clear(): void {
    this.internalMap.clear();
  }

  public keys(): IterableIterator<K> {
    return new InternalKeyIterator<K>(this.internalMap.values());
  }

  public values(): IterableIterator<V> {
    return new InternalValueIterator<V>(this.internalMap.values());
  }

  public entries(): IterableIterator<[K, V]> {
    return new InternalEntryIterator<K, V>(this.internalMap.values());
  }

  public [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  public forEach(iter: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg: any = this): void {
    this.internalMap.forEach((internalEntry: InternalEntry<K, V>, key: H, m: Map<H, InternalEntry<K, V>>) => {
      iter.call(thisArg, internalEntry.value, internalEntry.key, this);
    }, this.internalMap);
  }

  public get size(): number {
    return this.internalMap.size;
  }
}

export  class HashStringMap<K, V> extends HashMap<K, V, string> {
  constructor(options: Options<K, string> = {}) {
    if (options.toHash === undefined) {
      options.toHash = JSON.stringify;
    }
    super(options);
  }
}
