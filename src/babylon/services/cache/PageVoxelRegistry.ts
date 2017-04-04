import { HashStringMap } from '../map/HashMap';
import { default as createBlockRegistry, BlockRegistry } from './BlockRegistry';
import { CacheDelta } from './types/CacheDelta';
import CacheConfig from './CacheConfig';
import {
  MapState,
  VoxelBlockCoordinates, PageBlockCoordinates,
  VoxelCacheBlockCoordinates, PageTableCacheBlockCoordinates,
  VoxelCacheBlock, PageTableCacheBlock,
  VoxelCacheInfo, PageTableInfo,
  VoxelBlockScale, PageBlockScale,
} from './types/CacheTypes';

export default function createPageVoxelRegistry(config: CacheConfig): PageVoxelRegistry {
    let voxelBlockLRU = createBlockRegistry<
      VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>(
      config.voxelCacheSize, config.voxelBlockSize);
    let pageTableLRU = createBlockRegistry<
      PageBlockCoordinates, PageTableCacheBlockCoordinates, PageTableCacheBlock, PageBlockScale>(
      config.pageTableSize, config.pageBlockSize);
    return new PageVoxelRegistry(voxelBlockLRU, pageTableLRU);
}

export class PageVoxelRegistry {
  public static getVoxelCreateInfoFunction = (pageBlockCoordinates: PageBlockCoordinates,
                                              voxelBlockCoordinates: VoxelBlockCoordinates) =>
    (info?: VoxelCacheInfo): VoxelCacheInfo => ({ pageBlockCoordinates, voxelBlockCoordinates } as VoxelCacheInfo);

  public static getPageCreateInfoFunction = (voxelBlockCoordinates: VoxelBlockCoordinates) =>
    (info: PageTableInfo = {} as PageTableInfo): PageTableInfo => {
      let mappedVoxelBlockCoordinates: HashStringMap<VoxelBlockCoordinates, MapState>;

      if (info.mappedVoxelBlockCoordinates === undefined) {
        mappedVoxelBlockCoordinates = new HashStringMap<VoxelBlockCoordinates, MapState>();
      } else {
        mappedVoxelBlockCoordinates = info.mappedVoxelBlockCoordinates;
      }

      // anything MapState.NotMapped simply won't have an entry in the lru!
      mappedVoxelBlockCoordinates.set(voxelBlockCoordinates, MapState.Mapped);

      return { mappedVoxelBlockCoordinates } as PageTableInfo;
    }

  constructor(
      public readonly voxelBlockLRU: BlockRegistry<
        VoxelBlockCoordinates, VoxelCacheBlockCoordinates, VoxelCacheBlock, VoxelBlockScale>,
      public readonly pageTableLRU: BlockRegistry<
        PageBlockCoordinates, PageTableCacheBlockCoordinates, PageTableCacheBlock, PageBlockScale>) {
  }

  public registerToCache(pageBlockCoordinates: PageBlockCoordinates,
                         voxelBlockCoordinates: VoxelBlockCoordinates): CacheDelta {
    // Voxel block already in cache, just update the lru recency and return
    if (this.voxelBlockLRU.find(voxelBlockCoordinates) !== undefined) {
      this.voxelBlockLRU.get(voxelBlockCoordinates);
      this.pageTableLRU.get(pageBlockCoordinates);
      return {};
    }

    // set up return values
    let cacheDelta: CacheDelta = {};
    cacheDelta.pageTable = [];
    cacheDelta.voxelCache = [];

    let voxelCreateInfoFunction = PageVoxelRegistry.getVoxelCreateInfoFunction(pageBlockCoordinates,
                                                                             voxelBlockCoordinates);
    let pageCreateInfoFunction = PageVoxelRegistry.getPageCreateInfoFunction(voxelBlockCoordinates);

    let oldVoxelCacheBlock = this.voxelBlockLRU.set(voxelBlockCoordinates, voxelCreateInfoFunction);
    let oldPageTableCacheBlock = this.pageTableLRU.set(pageBlockCoordinates, pageCreateInfoFunction);

    let voxelCacheBlockCoordinates: VoxelCacheBlockCoordinates;
    let pageTableCacheBlockCoordinates: PageTableCacheBlockCoordinates;

    // We had replaced an existing voxel block, try to remove it from the page table cache
    if (oldVoxelCacheBlock !== undefined) {
      let updatedPageTableCacheBlock = this.pageTableLRU.find(oldVoxelCacheBlock.info.pageBlockCoordinates);
      if (updatedPageTableCacheBlock !== undefined) {
        // remove the entire page table if this is the only entry
        if (updatedPageTableCacheBlock.info.mappedVoxelBlockCoordinates.size === 1) {
          this.pageTableLRU.delete(oldVoxelCacheBlock.info.pageBlockCoordinates);
          // delta to remove entire page table entry
          cacheDelta.pageTable.push({
            cacheBlock: updatedPageTableCacheBlock.block,
            data: { state: MapState.NotMapped },
          });
        } else {
          updatedPageTableCacheBlock.info.mappedVoxelBlockCoordinates.delete(
            oldVoxelCacheBlock.info.voxelBlockCoordinates);
          // delta to remove mark only one entry in page table block as unmapped
          cacheDelta.pageTable.push({
            cacheBlock: updatedPageTableCacheBlock.block,
            data: { location: oldVoxelCacheBlock.info.voxelBlockCoordinates, state: MapState.NotMapped },
          });
        }
      }
      voxelCacheBlockCoordinates = oldVoxelCacheBlock.block;
    } else {
      voxelCacheBlockCoordinates = this.voxelBlockLRU.find(voxelBlockCoordinates)!.block;
    }

    // We had replaced an existing page table, try to remove all the voxel blocks it references
    if (oldPageTableCacheBlock !== undefined) {
      // delta to remove entire page table entry
      cacheDelta.pageTable.push({
        cacheBlock: oldPageTableCacheBlock.block,
        data: { state: MapState.NotMapped },
      });

      // iterator requires tsconfig downlevelIteration, but only available in TS nightly (currently TS > 2.2)
      // for (let oldVoxelBlockCoordinates of oldPageTableCacheBlock.info.mappedVoxelBlockCoordinates.keys())
      let iterable =  oldPageTableCacheBlock.info.mappedVoxelBlockCoordinates.keys();
      for (let iterValue = iterable.next(); !iterValue.done; iterValue = iterable.next()) {
        let removedVoxelBlock = this.voxelBlockLRU.delete(iterValue.value);
        if (removedVoxelBlock !== undefined) {
          // delta to remove the voxel block
          cacheDelta.voxelCache.push({
            cacheBlock: removedVoxelBlock.block,
            data: { state: MapState.NotMapped },
          });
        }
      }
      pageTableCacheBlockCoordinates = oldPageTableCacheBlock.block;
    } else {
      pageTableCacheBlockCoordinates = this.pageTableLRU.find(pageBlockCoordinates)!.block;
    }

    // delta to add voxel block to cache
    cacheDelta.voxelCache.push({
      cacheBlock: voxelCacheBlockCoordinates,
      data: { state: MapState.Mapped, entry: voxelBlockCoordinates },
    });

    // delta to add voxel block entry into page table
    cacheDelta.pageTable.push({
      cacheBlock: pageTableCacheBlockCoordinates,
      data: { state: MapState.Mapped, entry: voxelCacheBlockCoordinates, location: voxelBlockCoordinates },
    });
    return cacheDelta;
  }

  /*
   * Force mark an entire page block to be empty and remove any associated voxel blocks to be removed from cache
   * Warning, this **only** updates an **existing** page table entry; it does not create a new one.
   */
  public markEmptyPageBlock(pageBlockCoordinates: PageBlockCoordinates): CacheDelta {
    // remove the entire entry, empty-ness should be marked in the page directory separately
    let pageTableEntry = this.pageTableLRU.delete(pageBlockCoordinates);

    if (pageTableEntry === undefined) {
      return {};
    }

    let cacheDelta: CacheDelta = {};
    cacheDelta.pageTable = [];
    cacheDelta.voxelCache = [];

    // delta to remove entire page block
    cacheDelta.pageTable.push({
      cacheBlock: pageTableEntry.block,
      data: {
        state: MapState.Empty,
      },
    });

    // Remove any mapped blocks in this page block
    // iterator requires tsconfig downlevelIteration, but only available in TS nightly (currently TS > 2.2)
    // for (let oldVoxelBlockCoordinates of oldPageTableCacheBlock.info.mappedVoxelBlockCoordinates.keys())
    let iterable =  pageTableEntry.info.mappedVoxelBlockCoordinates.keys();

    for (let iterValue = iterable.next(); !iterValue.done; iterValue = iterable.next()) {
      let removedVoxelBlock = this.voxelBlockLRU.delete(iterValue.value);
      if (removedVoxelBlock !== undefined) {
        // delta to remove entire voxel block
        cacheDelta.voxelCache.push({
          cacheBlock: removedVoxelBlock.block,
          data: { state: MapState.Empty },
        });
      }
    }

    return cacheDelta;
  }

  /*
   * Force mark an individual voxel block to be empty
   * Warning, this **only** updates an **existing** page table entry; it does not create a new one.
   */
  public markEmptyVoxelBlock(pageBlockCoordinates: PageBlockCoordinates,
                             voxelBlockCoordinates: VoxelBlockCoordinates): CacheDelta {
    let pageTableEntry = this.pageTableLRU.find(pageBlockCoordinates);

    // a voxel block can only be in the cache if it is mapped in the page table
    if (pageTableEntry === undefined) {
      return {};
    }

    let cacheDelta: CacheDelta = {};
    cacheDelta.pageTable = [];
    cacheDelta.voxelCache = [];

    // set page table entry value to be empty
    pageTableEntry.info.mappedVoxelBlockCoordinates.set(voxelBlockCoordinates, MapState.Empty);
    // delta to mark page table entry for voxel block as empty
    cacheDelta.pageTable.push({
      cacheBlock: pageTableEntry.block,
      data: {
        state: MapState.Empty,
        location: voxelBlockCoordinates,
      },
    });

    let previousVoxelBlock = this.voxelBlockLRU.delete(voxelBlockCoordinates)!;

    if (previousVoxelBlock !== undefined) {
      // delta to remove voxel block from cache if it existed
      cacheDelta.voxelCache.push({
        cacheBlock: previousVoxelBlock.block,
        data: {
          state: MapState.Empty,
        },
      });
    }

    return cacheDelta;
  }

  public isEmptyVoxelBlock(pageBlockCoordinates: PageBlockCoordinates, voxelBlockCoordinates: VoxelBlockCoordinates) {
    let entry = this.pageTableLRU.find(pageBlockCoordinates);
    return entry !== undefined && entry.info.mappedVoxelBlockCoordinates.get(voxelBlockCoordinates) === MapState.Empty;
  }
}
