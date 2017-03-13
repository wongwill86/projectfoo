import BABYLON from 'babylonjs';
import Hash from './HashFunction';
import { HashType } from './HashFunction';
import UInt64 from '../../../types/uint64';

interface DataTypeProperties {
  dataType: DataType;
  bytePerElement: number;

  getBufferValue(dataview: DataView, pos: number): UInt64 | undefined;
  setBufferValue(dataview: DataView, pos: number, value: UInt64): void;
  texImage2D(gl: WebGL2RenderingContext, width: number, height: number, data?: ArrayBufferView): void;
  texSubImage2D(gl: WebGL2RenderingContext, x: number, y: number, value: UInt64): void;
}

interface HashTableSize {
  level: number;
  texwidth: number;
  texheight: number;
  maxsize: number;
}

export const enum DataType {
  UInt8 = 0,
  UInt16 = 1,
  UInt32 = 2,
  UInt64 = 3,
}

export class Cuckoo {
  private static instance: number;

  // Prime numbers as hash table size might help with fast, dumb hash functions, e.g. f(n) = n
  private static readonly sizeLookup: HashTableSize[] = [
    { level: 0, texwidth:  256, texheight:  256, maxsize:    65521 }, //  256 *  256
    { level: 1, texwidth:  512, texheight:  512, maxsize:   262139 }, //  512 *  512
    { level: 2, texwidth: 1024, texheight: 1024, maxsize:  1048573 }, // 1024 * 1024
    { level: 3, texwidth: 2048, texheight: 2048, maxsize:  4194301 }, // 2048 * 2048
    { level: 4, texwidth: 4096, texheight: 4096, maxsize: 16777213 }, // 4096 * 4096
    { level: 5, texwidth: 8192, texheight: 8192, maxsize: 67108859 }, // 8192 * 8192
  ];

  private static readonly dataTypeLookup: DataTypeProperties[] = [
    {
      dataType: DataType.UInt8,
      bytePerElement: 1,

      getBufferValue: function(dataview, pos) {
        const res = dataview.getUint8(pos);
        return res === 0 ? undefined : new UInt64(res, 0);
      },
      setBufferValue: function(dataview, pos, val) {
        dataview.setUint8(pos, val.low);
      },
      texImage2D: function(gl, width, height, data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
      },
      texSubImage2D: function(gl, x, y, val) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RED_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array([val.low]));
      },
    },
    {
      dataType: DataType.UInt16,
      bytePerElement: 2,

      getBufferValue: function(dataview, pos) {
        const res = dataview.getUint16(2 * pos, true);
        return res === 0 ? undefined : new UInt64(res, 0);
      },
      setBufferValue: function(dataview, pos, val) {
        dataview.setUint16(2 * pos, val.low, true);
      },
      texImage2D: function(gl, width, height, data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, data);
      },
      texSubImage2D: function(gl, x, y, val) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RED_INTEGER, gl.UNSIGNED_SHORT, new Uint16Array([val.low]));
      },
    },
    {
      dataType: DataType.UInt32,
      bytePerElement: 4,

      getBufferValue: function(dataview, pos) {
        const res = dataview.getUint32(4 * pos, true);
        return res === 0 ? undefined : new UInt64(res, 0);
      },
      setBufferValue: function(dataview, pos, val) {
        dataview.setUint32(4 * pos, val.low, true);
      },
      texImage2D: function(gl, width, height, data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, data);
      },
      texSubImage2D: function(gl, x, y, val) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RED_INTEGER, gl.UNSIGNED_INT, new Uint32Array([val.low]));
      },
    },
    {
      dataType: DataType.UInt64,
      bytePerElement: 8,

      getBufferValue: function(dataview, pos) {
        const res = new UInt64(dataview.getUint32(8 * pos, true), dataview.getUint32(8 * pos + 4, true));
        return res.low === 0 && res.high === 0 ? undefined : res;
      },
      setBufferValue: function(dataview, pos, val) {
        dataview.setUint32(8 * pos, val.low, true);
        dataview.setUint32(8 * pos + 4, val.high || 0, true);
      },
      texImage2D: function(gl, width, height, data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32UI, width, height, 0, gl.RG_INTEGER, gl.UNSIGNED_INT, data);
      },
      texSubImage2D: function(gl, x, y, val) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RG_INTEGER, gl.UNSIGNED_INT,
          new Uint32Array([val.low, val.high || 0]));
      },
    },
  ];

  public readonly texture: BABYLON.Texture;
  public maxLoadFactor: number;
  public maxRehashAttempts: number;
  private elementCount: number;
  private type: DataTypeProperties;
  private hashTableSizes: HashTableSize;
  private table: ArrayBuffer;
  private tableView: DataView;
  private hashFunctions: [Hash, Hash];
  private seeds: BABYLON.Vector2;
  private sizes: BABYLON.Vector3;

  constructor(private scene: BABYLON.Scene, valueType: DataType, private hashFuncA: HashType = 'identity',
              private hashFuncB: HashType = 'fnv1a') {
    Cuckoo.instance = (Cuckoo.instance === undefined) ? 0 : ++Cuckoo.instance;

    this.texture = new BABYLON.Texture('', this.scene, true);
    this.texture.name = `CuckooHash_${Cuckoo.instance}`;
    this.type = Cuckoo.dataTypeLookup[valueType];
    this.hashTableSizes = Cuckoo.sizeLookup[0];
    this.elementCount = 0;
    this.table = new ArrayBuffer(this.type.bytePerElement * this.hashTableSizes.maxsize);
    this.tableView = new DataView(this.table);

    this.hashFunctions = Hash.createHashFunctions(this.hashFuncA, this.hashFuncB);
    this.seeds = new BABYLON.Vector2(this.hashFunctions[0].seed, this.hashFunctions[1].seed);
    this.sizes = new BABYLON.Vector3(this.hashTableSizes.texwidth, this.hashTableSizes.texheight,
      this.hashTableSizes.maxsize);

    this.maxLoadFactor = 0.5;
    this.maxRehashAttempts = 3;

    this.updateTexture();
  }

  public getElementCount() {
    return this.elementCount;
  }

  public getSeeds(): BABYLON.Vector2 {
    return this.seeds;
  }

  public getSizes(): BABYLON.Vector3 {
    return this.sizes;
  }

  public getLoadFactor(): number {
    return this.elementCount / this.hashTableSizes.maxsize;
  }

  public set(key: UInt64): boolean {
    let rehashAttempts = 0;
    let errors: UInt64[] = [key];
    let needRehash = false;

    // If we resize, we have to do a full rehash
    if (this.getLoadFactor() > this.maxLoadFactor) {
      if (this.resize() === true) {
        --rehashAttempts;
        needRehash = true;
      }
    }

    while (errors.length > 0 && rehashAttempts < this.maxRehashAttempts) {
      let rehashError = undefined;
      if (needRehash) {
        rehashError = this.rehash();
        ++rehashAttempts;
        if (rehashError) {
          errors.push(rehashError);
        } else {
          needRehash = false;
        }
      }

      let currentKey = errors.pop();
      let setError = this.setKey(currentKey!, 0, []);
      if (!setError.success) {
        errors.push(setError.key!);
        needRehash = true;
      }
    }

    return errors.length === 0;
  }

  public unset(key: UInt64): boolean {
    return this.hashFunctions.some((element): boolean => {
      let pos = element.compute(key) % this.hashTableSizes.maxsize;
      let oldKey = this.getBufferValue(pos);
      if (oldKey !== undefined && oldKey.low === key.low && oldKey.high === key.high) {
        this.setBufferValue(pos, new UInt64(0, 0));
        --this.elementCount;
        return true;
      }
      return false;
    });
  }

  public isSet(key: UInt64): boolean {
    return this.hashFunctions.some((element): boolean => {
      let pos = element.compute(key) % this.hashTableSizes.maxsize;
      let oldKey = this.getBufferValue(pos);
      return oldKey !== undefined && oldKey.low === key.low && oldKey.high === key.high;
    });
  }

  // TODO: Speedup - painfully slow
  private rehash(): UInt64 | undefined {
    console.log(`Rehash called!`);

    // Create new hash functions
    this.hashFunctions = Hash.createHashFunctions(this.hashFuncA, this.hashFuncB);
    this.seeds.x = this.hashFunctions[0].seed;
    this.seeds.y = this.hashFunctions[1].seed;

    // Move all elements in hash table to new places
    for (let pos = 0; pos < Cuckoo.sizeLookup[this.hashTableSizes.level].maxsize; ++pos) {
      const key = this.type.getBufferValue(this.tableView, pos);
      if (key !== undefined && this.isSet(key) === false) {
        this.type.setBufferValue(this.tableView, pos, new UInt64(0, 0));
        --this.elementCount;
        let result = this.setKey(key, 0, []);
        // Abort rehash if element couldn't be added, append to error list and return
        if (result.success === false) {
          return result.key;
        }
      }
    }

    return;
  }

  private resize(): boolean {
    const level = this.hashTableSizes.level;
    console.log(`Resize called! (Size: ${level})`);

    if (level + 1 >= Cuckoo.sizeLookup.length) {
      // Can't enlarge hash table - already at max size
      return false;
    }

    this.hashTableSizes = Cuckoo.sizeLookup[level + 1];

    // Create new empty ArrayBuffer (can't resize existing one)
    let newTable = new ArrayBuffer(this.type.bytePerElement * this.hashTableSizes.maxsize);
    let newTableView = new DataView(newTable);

    // Copy old buffer dumb way until we have ArrayBuffer.transfer()
    for (let i = 0; i < this.tableView.byteLength; ++i) {
      newTableView.setUint8(i, this.tableView.getUint8(i));
    }
    this.table = newTable;
    this.tableView = newTableView;
    this.sizes.x = this.hashTableSizes.texwidth;
    this.sizes.y = this.hashTableSizes.texheight;
    this.sizes.z = this.hashTableSizes.maxsize;

    this.updateTexture();
    return true;
  }

  private updateTexture(): void {
    const engine = this.scene.getEngine();
    const gl = engine._gl as WebGL2RenderingContext;

    if (this.texture._texture !== undefined) {
      this.texture.releaseInternalTexture();
    }

    this.texture._texture = engine.createDynamicTexture(this.hashTableSizes.texwidth, this.hashTableSizes.texheight,
      false, BABYLON.Texture.NEAREST_SAMPLINGMODE);

    gl.bindTexture(gl.TEXTURE_2D, this.texture._texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.type.texImage2D(gl, this.hashTableSizes.texwidth, this.hashTableSizes.texheight, undefined);

    gl.bindTexture(gl.TEXTURE_2D, null);

    this.texture._texture.isReady = true;
  }

  private setKey(key: UInt64, mode: number, history: { pos: number, key: UInt64 }[]):
      { success: boolean, key?: UInt64 } {
    const pos = this.hashFunctions[mode].compute(key) % this.hashTableSizes.maxsize;
    const oldKey = this.getBufferValue(pos);

    if (oldKey === undefined) {
      this.setBufferValue(pos, key);
      ++this.elementCount;
      return { success: true };
    } else if (oldKey!.low === key.low && oldKey!.high === key.high) {
      return { success: true };
    } else {
      // Check for circuit
      if (history.find((el) => { return el.pos === pos && el.key.high === key.high && el.key.low === key.low; })) {
        console.log(`Collision can\'t be resolved! (Load factor: ${this.getLoadFactor()},
          History Length: ${history.length})`);
        return { success: false, key: key };
      } else {
        this.setBufferValue(pos, key);

        // Check which seed was used for old segment and switch to alternative for new insertion
        const posOld = this.hashFunctions[mode].compute(oldKey!) % this.hashTableSizes.maxsize;

        if (posOld === pos) {
          mode = 1 - mode;
        }

        history.push({ pos: pos, key: key });
        return this.setKey(oldKey!, mode, history);
      }
    }
  }

  private getBufferValue(pos: number): UInt64 | undefined {
    return this.type.getBufferValue(this.tableView, pos);
  }

  private setBufferValue(pos: number, value: UInt64): void {
    const gl = this.scene.getEngine()._gl as WebGL2RenderingContext;

    const x_pos = pos % this.hashTableSizes.texwidth;
    const y_pos = Math.floor(pos / this.hashTableSizes.texwidth);

    this.type.setBufferValue(this.tableView, pos, value);

    gl.bindTexture(gl.TEXTURE_2D, this.texture._texture);
    this.type.texSubImage2D(gl, x_pos, y_pos, value);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}
