import BABYLON from 'babylonjs';
import Hash from './HashFunction';
import { hashtype } from './HashFunction';

export const enum DataType {
  UInt8 = 0,
  UInt16 = 1,
  UInt32 = 2,
  UInt64 = 3,
  Float32 = 4,
}

interface DataTypeProperties {
  dataType: DataType;
  bytePerElement: number;

  getBufferValue(dataview: DataView, pos: number): [number, number];
  setBufferValue(dataview: DataView, pos: number, lo: number, hi?: number): void;
  texImage2D(gl: WebGL2RenderingContext, width: number, height: number, data?: ArrayBufferView): void;
  texSubImage2D(gl: WebGL2RenderingContext, x: number, y: number, lo: number, hi?: number): void;
}

interface HashTableSize {
  level: number;
  texwidth: number;
  texheight: number;
  maxsize: number;
}

export class Cuckoo {
  private static _instance: number;

  // Prime numbers as hash table size might help with fast, dumb hash functions, e.g. f(n) = n
  private static readonly _sizeLookup: HashTableSize[] = [
    { level: 0, texwidth:  256, texheight:  256, maxsize:    65521 }, //  256 *  256
    { level: 1, texwidth:  512, texheight:  512, maxsize:   262139 }, //  512 *  512
    { level: 2, texwidth: 1024, texheight: 1024, maxsize:  1048573 }, // 1024 * 1024
    { level: 3, texwidth: 2048, texheight: 2048, maxsize:  4194301 }, // 2048 * 2048
    { level: 4, texwidth: 4096, texheight: 4096, maxsize: 16777213 }, // 4096 * 4096
    { level: 5, texwidth: 8192, texheight: 8192, maxsize: 67108859 }, // 8192 * 8192
  ];

  private static readonly _dataTypeLookup: DataTypeProperties[] = [
    {
      dataType: DataType.UInt8,
      bytePerElement: 1,

      getBufferValue: function(dataview, pos) {
        return [dataview.getUint8(pos), 0];
      },
      setBufferValue: function(dataview, pos, val) {
        dataview.setUint8(pos, val);
      },
      texImage2D: function(gl, width, height, data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
      },
      texSubImage2D: function(gl, x, y, val) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RED_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array([val]));
      },
    },
    {
      dataType: DataType.UInt16,
      bytePerElement: 2,

      getBufferValue: function(dataview, pos) {
        return [dataview.getUint16(2 * pos, true), 0];
      },
      setBufferValue: function(dataview, pos, val) {
        dataview.setUint16(2 * pos, val, true);
      },
      texImage2D: function(gl, width, height, data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, data);
      },
      texSubImage2D: function(gl, x, y, val) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RED_INTEGER, gl.UNSIGNED_SHORT, new Uint16Array([val]));
      },
    },
    {
      dataType: DataType.UInt32,
      bytePerElement: 4,

      getBufferValue: function(dataview, pos) {
        return [dataview.getUint32(4 * pos, true), 0];
      },
      setBufferValue: function(dataview, pos, val) {
        dataview.setUint32(4 * pos, val, true);
      },
      texImage2D: function(gl, width, height, data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, width, height, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, data);
      },
      texSubImage2D: function(gl, x, y, val) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RED_INTEGER, gl.UNSIGNED_INT, new Uint32Array([val]));
      },
    },
    {
      dataType: DataType.UInt64,
      bytePerElement: 8,

      getBufferValue: function(dataview, pos) {
        return [dataview.getUint32(8 * pos, true), dataview.getUint32(8 * pos + 4, true)];
      },
      setBufferValue: function(dataview, pos, lo, hi) {
        dataview.setUint32(8 * pos, lo, true);
        dataview.setUint32(8 * pos + 4, hi || 0, true);
      },
      texImage2D: function(gl, width, height, data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32UI, width, height, 0, gl.RG_INTEGER, gl.UNSIGNED_INT, data);
      },
      texSubImage2D: function(gl, x, y, lo, hi) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RG_INTEGER, gl.UNSIGNED_INT, new Uint32Array([lo, hi || 0]));
      },
    },
    {
      dataType: DataType.Float32,
      bytePerElement: 4,

      getBufferValue: function(dataview, pos) {
        return [dataview.getFloat32(4 * pos, true), 0];
      },
      setBufferValue: function(dataview, pos, val) {
        dataview.setFloat32(4 * pos, val, true);
      },
      texImage2D: function(gl, width, height, data) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, data);
      },
      texSubImage2D: function(gl, x, y, val) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RED, gl.FLOAT, new Float32Array([val]));
      },
    },
  ];

  private _texture: BABYLON.Texture;
  private _type: DataTypeProperties;
  private _sizes: HashTableSize;
  private _setElements: number;
  private _lastInsertError: { lo: number, hi: number };
  private _table: ArrayBuffer;
  private _tableView: DataView;
  private _hashfunctions: [Hash, Hash];

  constructor(private _scene: BABYLON.Scene, valueType: DataType, private _hashFuncA: hashtype = 'identity',
              private _hashFuncB: hashtype = 'fnv1a') {
    Cuckoo._instance = (Cuckoo._instance === undefined) ? 0 : ++Cuckoo._instance;

    this._texture = new BABYLON.Texture('', this._scene, true);
    this._texture.name = `CuckooHash_${Cuckoo._instance}`;
    this._type = Cuckoo._dataTypeLookup[valueType];
    this._sizes = Cuckoo._sizeLookup[0];
    this._setElements = 0;
    this._lastInsertError = { lo: 0, hi: 0 };
    this._table = new ArrayBuffer(this._type.bytePerElement * this._sizes.maxsize);
    this._tableView = new DataView(this._table);

    this._hashfunctions = Hash.createHashFunctions(this._hashFuncA, this._hashFuncB);
    this._updateTexture();
  }

  get texture(): BABYLON.Texture {
    return this._texture;
  }

  get seeds(): BABYLON.Vector2 {
    return new BABYLON.Vector2(this._hashfunctions[0].seed, this._hashfunctions[1].seed);
  }

  get sizes(): BABYLON.Vector3 {
    return new BABYLON.Vector3(this._sizes.texwidth, this._sizes.texheight, this._sizes.maxsize);
  }

  get loadFactor(): number {
    return this._setElements / this._sizes.maxsize;
  }

  public clearLastInsertError() {
    this._lastInsertError.lo = 0;
    this._lastInsertError.hi = 0;
  }

  public getLastInsertError(): { lo: number, hi: number } {
    return { lo: this._lastInsertError.lo, hi: this._lastInsertError.hi };
  }

  public set(lo: number, hi: number = 0): boolean {
    if (this._set(lo, hi, 0, []) === false) {
      return this._rehash();
    }
    return true;
  }

  public unset(lo: number, hi: number = 0): boolean {
    let pos = this._hashfunctions[0].compute(lo, hi) % this._sizes.maxsize;
    let [loOld, hiOld] = this._getValue(pos);
    if (loOld === lo && hiOld === hi) {
      this._setValue(pos, 0, 0);
      --this._setElements;
      return true;
    }

    pos = this._hashfunctions[1].compute(lo, hi) % this._sizes.maxsize;
    [loOld, hiOld] = this._getValue(pos);
    if (loOld === lo && hiOld === hi) {
      this._setValue(pos, 0, 0);
      --this._setElements;
    }

    return true;
  }

  public isset(lo: number, hi: number = 0): boolean {
    let pos = this._hashfunctions[0].compute(lo, hi) % this._sizes.maxsize;
    let [loOld, hiOld] = this._getValue(pos);
    if (loOld === lo && hiOld === hi) {
      return true;
    }

    pos = this._hashfunctions[1].compute(lo, hi) % this._sizes.maxsize;
    [loOld, hiOld] = this._getValue(pos);
    if (loOld === lo && hiOld === hi) {
      return true;
    }

    return false;
  }

  // TODO: Speedup - painfully slow
  private _rehash(): boolean {
    let retries = 0;
    let tmp = this.getLastInsertError();

    while (retries < 3) {
      // Create new hash functions
      this._hashfunctions = Hash.createHashFunctions(this._hashFuncA, this._hashFuncB);

      // If last rehash failed, insert the causative element first to ensure every element is represented once.
      if (tmp.lo > 0 || tmp.hi > 0) {
        if (this._set(tmp.lo, tmp.hi, 0, []) === false) {
          ++retries;
        }
        tmp = this.getLastInsertError();
      }

      if (tmp.lo === 0 && tmp.hi === 0) {
        for (let pos = 0; pos < Cuckoo._sizeLookup[this._sizes.level].maxsize; ++pos) {
          const [lo, hi] = this._type.getBufferValue(this._tableView, pos);
          if ((lo > 0 || hi > 0) && this.isset(lo, hi) === false) {
            this._type.setBufferValue(this._tableView, pos, 0, 0);
            --this._setElements;
            if (this._set(lo, hi, 0, []) === false) {
              ++retries;
              tmp = this.getLastInsertError();
              break;
            }
          }
        }
      }

      if (tmp.lo === 0 && tmp.hi === 0) {
        return true;
      }
    }
    return this._resize();
  }

  private _resize(): boolean {
    const level = this._sizes.level;

    if (level + 1 < Cuckoo._sizeLookup.length) {
      this._sizes = Cuckoo._sizeLookup[level + 1];

      // Create new empty ArrayBuffer (can't resize existing one)
      let newTable = new ArrayBuffer(this._type.bytePerElement * this._sizes.maxsize);
      let newTableView = new DataView(newTable);

      // Copy old buffer dumb way until we have ArrayBuffer.transfer()
      for (let i = 0; i < this._tableView.byteLength; ++i) {
        newTableView.setUint8(i, this._tableView.getUint8(i));
      }
      this._table = newTable;
      this._tableView = newTableView;

      this._updateTexture();

      // Rehash all elements
      return this._rehash();
    }

    // Can't enlarge hash table - already at max size
    return false;
  }

  private _updateTexture(): void {
    const engine = this._scene.getEngine();
    const gl = engine._gl as WebGL2RenderingContext;

    if (this._texture._texture !== undefined) {
      this._texture.releaseInternalTexture();
    }

    this._texture._texture = engine.createDynamicTexture(this._sizes.texwidth, this._sizes.texheight, false,
      BABYLON.Texture.NEAREST_SAMPLINGMODE);

    gl.bindTexture(gl.TEXTURE_2D, this._texture._texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this._type.texImage2D(gl, this._sizes.texwidth, this._sizes.texheight, undefined);

    gl.bindTexture(gl.TEXTURE_2D, null);

    this._texture._texture.isReady = true;
  }

  private _set(lo: number, hi: number, mode: number, history: { pos: number, lo: number, hi: number }[]): boolean {
    const pos = this._hashfunctions[mode].compute(lo, hi) % this._sizes.maxsize;
    const [loOld, hiOld] = this._getValue(pos);

    if (loOld === 0 && hiOld === 0) {
      this.clearLastInsertError();

      this._setValue(pos, lo, hi);
      ++this._setElements;
      if (this.loadFactor > 0.5 && this._sizes.level + 1 < Cuckoo._sizeLookup.length) {
        return this._resize();
      }
      return true;
    } else if (loOld === lo && hiOld === hi) {
      return true;
    } else {
      // Check for circuit
      if (history.find((el) => { return el.pos === pos && el.hi === hi && el.lo === lo; })) {
        console.log(`Collision can\'t be resolved! (Load factor: ${this.loadFactor})`);
        this._lastInsertError = { lo: lo, hi: hi };
        return false;
      } else {
        this._setValue(pos, lo, hi);

        // Check which seed was used for old segment and switch to alternative for new insertion
        const posOld = this._hashfunctions[mode].compute(loOld, hiOld) % this._sizes.maxsize;

        if (posOld === pos) {
          mode = 1 - mode;
        }

        history.push({ pos: pos, lo: lo, hi: hi });
        return this._set(loOld, hiOld, mode, history);
      }
    }
  }

  private _getValue(pos: number): [number, number] {
    return this._type.getBufferValue(this._tableView, pos);
  }

  private _setValue(pos: number, lo: number, hi: number = 0): void {
    const gl = this._scene.getEngine()._gl as WebGL2RenderingContext;

    const x_pos = pos % this._sizes.texwidth;
    const y_pos = Math.floor(pos / this._sizes.texwidth);

    this._type.setBufferValue(this._tableView, pos, lo, hi);

    gl.bindTexture(gl.TEXTURE_2D, this._texture._texture);
    this._type.texSubImage2D(gl, x_pos, y_pos, lo, hi);
    gl.bindTexture(gl.TEXTURE_2D, null);

  }
}
