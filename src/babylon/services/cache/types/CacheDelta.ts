import {
  CacheCoordinates, Scale, MapState,
  VoxelBlockCoordinates, VoxelCacheBlockCoordinates,
  VoxelBlockScale, PageBlockScale,
} from './CacheTypes';

export interface SingleCacheDelta<S extends Scale> {
  cacheBlock: CacheCoordinates<S>;
  data?: any;
}

export interface VoxelCacheDelta extends SingleCacheDelta<VoxelBlockScale> {
  data: {
    state: MapState;
    entry?: VoxelBlockCoordinates; // defined only when we are mapping
  };
}

export interface PageTableDelta extends SingleCacheDelta<PageBlockScale> {
  data: {
    state: MapState;
    entry?: VoxelCacheBlockCoordinates; // defined only when we are mapping an individual entry in the table
    location?: VoxelBlockCoordinates; // defined when we are mapping or unmapping an individual entry in the table
  };
}
export interface PageDirectoryDelta extends SingleCacheDelta<PageBlockScale> {
  data: MapState;
}

export interface CacheDelta {
  voxelCache?: VoxelCacheDelta[];
  pageTable?: PageTableDelta[];
  pageDirectory?: PageDirectoryDelta[];
}

