import * as Vec3Simple from './Vec3Simple';
import { HashStringMap } from './map/HashMap';
import { default as createBlockRegistry, BlockRegistry } from './BlockRegistry';
import { SizeWorld, SizePower, toPowerTwo,
  VoxelCoordinates,
  VoxelBlockCoordinates, PageBlockCoordinates,
  VoxelCacheBlockCoordinates, PageTableCacheBlockCoordinates,
  VoxelCacheBlock, PageTableCacheBlock,
  VoxelCacheInfo, PageTableInfo,
  VoxelBlockScale, PageBlockScale, PageDirectoryScale,
} from './CacheTypes';


export interface CacheDelta {
  addedVoxelCache?: [VoxelCacheBlockCoordinates, VoxelBlockCoordinates];
  addedPageTable?: [PageTableCacheBlockCoordinates, [VoxelCacheBlockCoordinates, VoxelBlockCoordinates]];
  removedVoxelCache?: VoxelCacheBlockCoordinates[];
  removedPageTable?: [PageTableCacheBlockCoordinates, VoxelBlockCoordinates | boolean][];
}

export default class CacheRegistry {
  public readonly voxelBlockLRU: BlockRegistry<
    VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>;
  public readonly pageTableLRU: BlockRegistry<
    PageBlockCoordinates, PageTableCacheBlockCoordinates, PageTableCacheBlock, PageBlockScale>;

  private toVoxelBlockPower: SizePower;
  private toPageBlockPower: SizePower;

  public static getVoxelCreateInfoFunction = (pageBlockCoordinates: PageBlockCoordinates,
                                              voxelBlockCoordinates: VoxelBlockCoordinates) =>
    (info?: VoxelCacheInfo): VoxelCacheInfo => ({ pageBlockCoordinates, voxelBlockCoordinates } as VoxelCacheInfo);

  public static getPageCreateInfoFunction = (voxelBlockCoordinates: VoxelBlockCoordinates) =>
    (info: PageTableInfo = {} as PageTableInfo): PageTableInfo => {
      let mappedVoxelBlockCoordinates: HashStringMap<VoxelBlockCoordinates, boolean>;

      if (info.mappedVoxelBlockCoordinates === undefined) {
        mappedVoxelBlockCoordinates = new HashStringMap<VoxelBlockCoordinates, boolean>();
      } else {
        mappedVoxelBlockCoordinates = info.mappedVoxelBlockCoordinates;
      }

      mappedVoxelBlockCoordinates.set(voxelBlockCoordinates, true);

      return { mappedVoxelBlockCoordinates } as PageTableInfo;
    }

  constructor(public readonly pageTableSize: SizeWorld<PageBlockScale>,
              public readonly voxelCacheSize: SizeWorld<VoxelBlockScale>,
              public readonly pageBlockSize: SizeWorld<PageBlockScale>,
              public readonly voxelBlockSize: SizeWorld<VoxelBlockScale>,
              public readonly datasetSize?: SizeWorld<PageDirectoryScale>) {
    // TODO verify all sizes are powers of 2!
    // TODO verify pagetableblocksize actually fits in page table size!

    this.toVoxelBlockPower = toPowerTwo(voxelBlockSize);
    this.toPageBlockPower = Vec3Simple.add(this.toVoxelBlockPower, toPowerTwo(pageBlockSize));

    this.voxelBlockLRU = createBlockRegistry<
      VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
      voxelCacheSize, voxelBlockSize);
    this.pageTableLRU = createBlockRegistry<
      PageBlockCoordinates, PageTableCacheBlockCoordinates, PageTableCacheBlock, PageBlockScale>(
      pageTableSize, pageBlockSize);
  }

  public registerToCache(position: VoxelCoordinates): CacheDelta {
    let voxelBlockCoordinates = this.toVoxelBlockCoordinates(position);
    let pageBlockCoordinates = this.toPageBlockCoordinates(position);

    // Voxel block already in cache, just update the lru recency and return
    if (this.voxelBlockLRU.find(voxelBlockCoordinates) !== undefined) {
      this.voxelBlockLRU.set(voxelBlockCoordinates);
      this.pageTableLRU.set(pageBlockCoordinates);
      return {};
    }

    // set up return values
    let cacheDelta: CacheDelta = {};

    let voxelCreateInfoFunction = CacheRegistry.getVoxelCreateInfoFunction(pageBlockCoordinates, voxelBlockCoordinates);
    let pageCreateInfoFunction = CacheRegistry.getPageCreateInfoFunction(voxelBlockCoordinates);

    let oldVoxelCacheBlock = this.voxelBlockLRU.set(voxelBlockCoordinates, voxelCreateInfoFunction);
    let oldPageTableCacheBlock = this.pageTableLRU.set(pageBlockCoordinates, pageCreateInfoFunction);

    let voxelCacheBlockCoordinates: VoxelCacheBlockCoordinates;
    let pageTableCacheBlockCoordinates: PageTableCacheBlockCoordinates;

    // We had replaced an existing voxel block, try to remove it from the page table cache
    if (oldVoxelCacheBlock !== undefined) {
      let updatedPageTableCacheBlock = this.pageTableLRU.find(oldVoxelCacheBlock.info.pageBlockCoordinates);
      if (updatedPageTableCacheBlock !== undefined) {
        // remove the entire page table if this is the only entry
        if (cacheDelta.removedPageTable === undefined) {
          cacheDelta.removedPageTable = [];
        }
        if (updatedPageTableCacheBlock.info.mappedVoxelBlockCoordinates.size === 1) {
          this.pageTableLRU.delete(oldVoxelCacheBlock.info.pageBlockCoordinates);
          cacheDelta.removedPageTable.push([updatedPageTableCacheBlock.block, true]);
        } else {
          updatedPageTableCacheBlock.info.mappedVoxelBlockCoordinates.delete(
            oldVoxelCacheBlock.info.voxelBlockCoordinates);
          cacheDelta.removedPageTable.push(
            [updatedPageTableCacheBlock.block, oldVoxelCacheBlock.info.voxelBlockCoordinates]);
        }
      }
      voxelCacheBlockCoordinates = oldVoxelCacheBlock.block;
    } else {
      voxelCacheBlockCoordinates = this.voxelBlockLRU.find(voxelBlockCoordinates)!.block;
    }

    // We had replaced an existing page table, try to remove all the voxel blocks it references
    if (oldPageTableCacheBlock !== undefined) {
      if (cacheDelta.removedPageTable === undefined) {
        cacheDelta.removedPageTable = [];
      }
      cacheDelta.removedPageTable.push([oldPageTableCacheBlock.block, true]);

      cacheDelta.removedVoxelCache = [];
      // iterator requires tsconfig downlevelIteration, but only available in TS nightly (currently TS > 2.2)
      // for (let oldVoxelBlockCoordinates of oldPageTableCacheBlock.info.mappedVoxelBlockCoordinates.keys()) {
      let iterable =  oldPageTableCacheBlock.info.mappedVoxelBlockCoordinates.keys();
      for (let iterValue = iterable.next(); !iterValue.done; iterValue = iterable.next()) {
        let removedVoxelBlock = this.voxelBlockLRU.delete(iterValue.value);
        if (removedVoxelBlock !== undefined) {
          cacheDelta.removedVoxelCache.push(removedVoxelBlock.block);
        }
      }
      pageTableCacheBlockCoordinates = oldPageTableCacheBlock.block;
    } else {
      pageTableCacheBlockCoordinates = this.pageTableLRU.find(pageBlockCoordinates)!.block;
    }

    cacheDelta.addedVoxelCache = [voxelCacheBlockCoordinates , voxelBlockCoordinates];
    cacheDelta.addedPageTable = [pageTableCacheBlockCoordinates, [voxelCacheBlockCoordinates, voxelBlockCoordinates]];
    return cacheDelta;
  }

  /*
   *public isCached(position: VoxelCoordinates): boolean {
   *  let voxelBlock = this.toVoxelBlock(position);
   *  return this.voxelBlockLRU.has(
   *}
   */

  /* tslint:disable:no-bitwise */
  public toPageBlockCoordinates(coordinates: VoxelCoordinates): PageBlockCoordinates {
    return <PageBlockCoordinates> {
      x: coordinates.x >> this.toPageBlockPower.x,
      y: coordinates.y >> this.toPageBlockPower.y,
      z: coordinates.z >> this.toPageBlockPower.z,
    };
  }

  /* tslint:disable:no-bitwise */
  public toVoxelBlockCoordinates(voxelCoordinates: VoxelCoordinates): VoxelBlockCoordinates {
    return <VoxelBlockCoordinates> {
      x: voxelCoordinates.x >> this.toVoxelBlockPower.x,
      y: voxelCoordinates.y >> this.toVoxelBlockPower.y,
      z: voxelCoordinates.z >> this.toVoxelBlockPower.z,
    };
  }

}
