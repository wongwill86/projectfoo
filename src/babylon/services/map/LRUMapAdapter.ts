import { LRUMap } from 'lru_map';

/*
 * LRUMapAdapter
 *
 * Adapt LRUMap to implement official es6 Map interface
 *
 * Differences between LRUMap and es6 Map:
 * set: es6Map returns this
 *      LRUMap returns void
 * delete: es6Map returns boolean (true if item existed)
 *         LRUMap returns value (if existed)
 */
export default class LRUMapAdapter<K, V> implements Map<K, V> {
  public readonly [Symbol.toStringTag]: 'Map';

  public lru: LRUMap<K, V>;

  constructor(limit: number, lru?: LRUMap<K, V>) {
    if (lru === undefined) {
      this.lru = new LRUMap<K, V>(limit);
    }
  };

  /*
   * Delegation functions for LRUMap
   */
  public clear = () => this.lru.clear();
  public get = (key: K) =>  this.lru.get(key);
  public has = (key: K) =>  this.lru.has(key);
  public get size() { return this.lru.size; }

  /*
   * Delegate to LRUMap but retype return for Map compatibiilty
   */
  public keys(): IterableIterator<K> {
    return this.lru.keys() as IterableIterator<K>;
  }
  public values(): IterableIterator<V> {
    return this.lru.values() as IterableIterator<V>;
  }
  public entries(): IterableIterator<[K, V]> {
    return this.lru.entries() as IterableIterator<[K, V]>;
  }
  public [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.lru[Symbol.iterator]() as IterableIterator<[K, V]>;
  }
  public forEach(iter: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg: any = this): void {
    this.lru.forEach(iter, thisArg);
  }

  /*
   * Redefine LRUMap definitions
   */
  public set(key: K, value: V): this {
    this.lru.set(key, value);
    return this;
  }
  public delete(key: K): boolean {
    return this.lru.delete(key) !== undefined;
  }

  /*
   * delegate internal LRU specific functions
   */
  public shift = () => this.lru.shift();
  public find = (key: K) => this.lru.find(key);
}
