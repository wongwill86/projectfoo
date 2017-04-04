import { HashStringMap } from '../map/HashMap';
import { default as createBlockRegistry, BlockRegistry } from './BlockRegistry';
import { CacheDelta, VoxelCacheDelta, PageTableDelta } from './types/CacheDelta';
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
          cacheDelta.pageTable.push({
            cacheBlock: updatedPageTableCacheBlock.block,
            data: { state: MapState.NotMapped },
          });
        } else {
          updatedPageTableCacheBlock.info.mappedVoxelBlockCoordinates.delete(
            oldVoxelCacheBlock.info.voxelBlockCoordinates);
          cacheDelta.pageTable.push({
            cacheBlock: updatedPageTableCacheBlock.block,
            data: { location: oldVoxelCacheBlock.info.voxelBlockCoordinates, state: MapState.NotMapped }
          });
        }
      }
      voxelCacheBlockCoordinates = oldVoxelCacheBlock.block;
    } else {
      voxelCacheBlockCoordinates = this.voxelBlockLRU.find(voxelBlockCoordinates)!.block;
    }

    // We had replaced an existing page table, try to remove all the voxel blocks it references
    if (oldPageTableCacheBlock !== undefined) {
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

    cacheDelta.voxelCache.push({
      cacheBlock: voxelCacheBlockCoordinates,
      data: { state: MapState.Mapped, entry: voxelBlockCoordinates },
    });

    cacheDelta.pageTable.push({
      cacheBlock: pageTableCacheBlockCoordinates,
      data: { state: MapState.Mapped, entry: voxelCacheBlockCoordinates, location: voxelBlockCoordinates },
    });
    return cacheDelta;
  }

  public markEmptyPageBlock(pageBlockCoordinates: PageBlockCoordinates): CacheDelta {
    let cacheDelta: CacheDelta = {};
    let pageTableEntry = this.pageTableLRU.find(pageBlockCoordinates);
    if (pageTableEntry !== undefined) {
      cacheDelta.removedVoxelCache = [];
      // iterator requires tsconfig downlevelIteration, but only available in TS nightly (currently TS > 2.2)
      // for (let oldVoxelBlockCoordinates of oldPageTableCacheBlock.info.mappedVoxelBlockCoordinates.keys())
      let iterable =  pageTableEntry.info.mappedVoxelBlockCoordinates.keys();
      for (let iterValue = iterable.next(); !iterValue.done; iterValue = iterable.next()) {
        let removedVoxelBlock = this.voxelBlockLRU.delete(iterValue.value);
        if (removedVoxelBlock !== undefined) {
          cacheDelta.removedVoxelCache.push(removedVoxelBlock.block);
        }
      }
    }
    this.pageTableLRU.delete(pageBlockCoordinates);
    return cacheDelta;
  }

  public markEmptyVoxelBlock(voxelBlockCoordinates: VoxelBlockCoordinates): CacheDelta {
    let previousVoxelBlock = this.voxelBlockLRU.delete(voxelBlockCoordinates);
    // if it exists, update the page table info to show it as empty
    if (previousVoxelBlock !== undefined) {
      let updatedPageTableCacheBlock = this.pageTableLRU.find(previousVoxelBlock.info.pageBlockCoordinates);
      if (updatedPageTableCacheBlock !== undefined) {
        updatedPageTableCacheBlock.info.mappedVoxelBlockCoordinates.set(
          previousVoxelBlock.info.voxelBlockCoordinates, MapState.Empty);
        cacheDelta.removedPageTable.push(
          [updatedPageTableCacheBlock.block, oldVoxelCacheBlock.info.voxelBlockCoordinates]);
      }
    }
    voxelCacheBlockCoordinates = oldVoxelCacheBlock.block;
  }

  public isEmpty(pageBlockCoordinates: PageBlockCoordinates, voxelBlockCoordinates: VoxelBlockCoordinates) {
    let entry = this.pageTableLRU.find(pageBlockCoordinates);
    return entry !== undefined && entry.info.mappedVoxelBlockCoordinates.get(voxelBlockCoordinates) === MapState.Empty;
  }
}
