import { Options, InternalEntry, default as HashMap } from './HashMap';
import LRUMapAdapter from './LRUMapAdapter';

export interface LRUOptions<K, H> extends Options<K, H> {
  limit: number;
}

export class LRUCustomHash<K, V, H> extends HashMap<K, V, H> {
  public toHash: (key: K) => H;

  private internalMapLRU: LRUMapAdapter<H, InternalEntry<K, V>>;

  constructor(options: LRUOptions<K, H>, internalMapLRU?: LRUMapAdapter<H, InternalEntry<K, V>>) {
    if (internalMapLRU === undefined) {
      internalMapLRU = new LRUMapAdapter<H, InternalEntry<K, V>>(options.limit);
    }
    super(options, internalMapLRU);
    this.internalMapLRU = internalMapLRU;
  }

  public shift(): [K, V] | undefined {
    let shift = this.internalMapLRU.shift();
    if (shift !== undefined) {
      return [shift[1].key, shift[1].value];
    }
    return undefined;
  }

  // Does not register recency
  public has(key: K): boolean {
    return this.internalMapLRU.has(this.toHash(key));
  }

  // Does not register recency
  public find(key: K): V | undefined {
    let internalEntry = this.internalMapLRU.find(this.toHash(key));
    if (internalEntry !== undefined) {
      return internalEntry.value;
    }
    return undefined;
  }
}

export default class LRUHashStringMap<K, V> extends LRUCustomHash<K, V, string> {
  constructor(options: LRUOptions<K, string> | number) {
    if (typeof options === 'number') {
      options = { limit: options };
    }
    if (options.toHash === undefined) {
      options.toHash = JSON.stringify;
    }
    super(options);
  }
}
