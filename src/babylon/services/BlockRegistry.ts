import LRUHashString from './map/LRUCustomHash';
import * as Vec3Simple from './Vec3Simple';
import { SizeWorld, SizeCache, CacheBlock, Scaled, Scale, CacheInfo, WorldCoordinates,
  CacheCoordinates } from './CacheTypes';

export default function createBlockRegistry<
    WorldCoordinatesScaled extends WorldCoordinates & Scaled<S>,
    CacheCoordinatesScaled extends CacheCoordinates & Scaled<S>,
    Block extends CacheBlock<CacheCoordinatesScaled, CacheInfo<S>, S>,
    S extends Scale>(sizeWorld: SizeWorld | SizeCache, sizeBlock?: SizeWorld): BlockRegistry<WorldCoordinatesScaled,
    CacheCoordinatesScaled, Block, S> {

  let sizeCache: SizeCache;
  if (sizeBlock === undefined) {
    sizeCache = sizeWorld as SizeCache;
  } else {
    sizeCache = Vec3Simple.strip(Vec3Simple.divide(sizeWorld, sizeBlock)) as SizeCache;
  }

  let options  = {
    limit: sizeCache.x * sizeCache.y * sizeCache.z,
    toHash: Vec3Simple.stringify,
  };
  let blockLRU = new LRUHashString<WorldCoordinatesScaled, Block>(options);
  return new BlockRegistry<WorldCoordinatesScaled, CacheCoordinatesScaled, Block, S>(sizeCache, blockLRU);
}


export class BlockRegistry<
    WorldCoordinatesScaled extends WorldCoordinates & Scaled<S>,
    CacheCoordinatesScaled extends CacheCoordinates & Scaled<S>,
    Block extends CacheBlock<CacheCoordinatesScaled, CacheInfo<S>, S>,
    S extends Scale> {
  protected readonly freeBlocks: Block[] = [];

  constructor(public size: SizeCache, protected lru: LRUHashString<WorldCoordinatesScaled, Block>) {
    for (let x = 0; x < size.x; x ++) {
      for (let y = 0; y < size.y; y ++) {
        for (let z = 0; z < size.z; z ++) {
          this.freeBlocks.push({ block: { x, y, z } } as Block);
        }
      }
    }
  }

  public get numberFreeBlocks(): number {
    return this.freeBlocks.length;
  }

  public get numberRegisteredBlocks(): number {
    return this.lru.size;
  }

  public get(worldCoordinates: WorldCoordinatesScaled): Block | undefined {
    return this.lru.get(worldCoordinates);
  }

  /*
   * Get without updating recency
   */
  public find(worldCoordinates: WorldCoordinatesScaled): Block | undefined {
    return this.lru.find(worldCoordinates);
  }

  /*
   * update the cache with world Coordinates.
   * Returns a cacheBlock of any block that is replaced.
   */
  public set(worldCoordinates: WorldCoordinatesScaled,
             createInfo: (info?: CacheInfo<S>) => CacheInfo<S>): Block | undefined {
    let oldBlock = this.lru.get(worldCoordinates);

    // touch the coordinates in the LRU to update most recent.
    // if it exists in the lru, we can just run create info with old data and return
    if (oldBlock !== undefined) {
      // update the info with the createInfo function
      oldBlock.info = createInfo(oldBlock.info);
      return undefined;
    }

    // The coodrdinates do not exist in cache, try to find an empty block to place the coordinates in
    // First try by looking in our list of free blocks
    let freeBlock = this.freeBlocks.pop();

    // Free block was found from free block list, set free block with newly created info
    if (freeBlock !== undefined) {
      freeBlock.info = createInfo();
      this.lru.set(worldCoordinates, freeBlock);
      return undefined;
    }

    // We could not find an empty block from the free block list (usually the case), shift out an LRU block
    let shift = this.lru.shift();

    // This should not happen!
    if (shift === undefined) {
      console.error(`Free blocks out of sync with LRU. No free blocks found and no blocks could be shifted out ` +
                    `from the lru worldCoordinates ${worldCoordinates} from LRU but none were found.`);
      return undefined;
    }

    freeBlock = shift[1];

    // make a copy of this block to return
    let removedBlock = this.copy(freeBlock);

    // Don't need to createInfo a new free block, reuse old reference block and set it with newly created info
    freeBlock.info = createInfo();

    // set the free block with the new key
    this.lru.set(worldCoordinates, freeBlock);

    return removedBlock;
  }

  public delete(worldCoordinates: WorldCoordinatesScaled): Block | undefined {
    let block = this.lru.get(worldCoordinates);

    if (block !== undefined) {
      this.freeBlocks.push(block);
      this.lru.delete(worldCoordinates);
    }
    return block;
  }

  /*
   * Copy a CacheBlock superficially.
   * For now we don't need a deep copy, since we don't return a new info object
   */
  public copy(block: Block): Block {
    return { block: block.block, info: block.info } as Block;
  }

  public toString() {
    let str: string = '';
    let iter = this.lru.entries();
    // iterator requires tsconfig downlevelIteration, but only available in TS nightly currently (TS > 2.2)
    for (let i = iter.next(); !i.done; i = iter.next()) {
      str += `(${JSON.stringify(i.value[0])}: ${JSON.stringify(i.value[1])}),  `;
      console.log(i.value[1].info);
      //for (let i.value[1].info.mappedVoxelBlockCoordinates)
    }
    return str;
  }

}
