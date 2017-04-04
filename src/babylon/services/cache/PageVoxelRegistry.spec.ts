import {default as createPageVoxelRegistry } from './PageVoxelRegistry';
import * as Vec3Simple from '../Vec3Simple';
import { MapState, SizeWorld,
  VoxelCoordinates,
  VoxelBlockCoordinates, PageBlockCoordinates,
  VoxelBlockScale, PageBlockScale, VoxelScale,
} from './types/CacheTypes';
import CacheConfig from './CacheConfig';

const defaultSize = 128;
const defaultPageTableSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<PageBlockScale>;
const defaultVoxelCacheSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<VoxelBlockScale>;
const defaultPageBlockSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<PageBlockScale>;
const defaultVoxelBlockSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<VoxelBlockScale>;
const defaultDatasetSize = Vec3Simple.Vec3(defaultSize * defaultSize * 8) as SizeWorld<VoxelScale>;

function getTestRegistryConfig(pageTableSize: SizeWorld<PageBlockScale> = defaultPageTableSize,
                               voxelCacheSize: SizeWorld<VoxelBlockScale> = defaultVoxelCacheSize,
                               pageBlockSize: SizeWorld<PageBlockScale> = defaultPageBlockSize,
                               voxelBlockSize: SizeWorld<VoxelBlockScale> = defaultVoxelBlockSize) {
  return new CacheConfig(pageTableSize, voxelCacheSize, pageBlockSize, voxelBlockSize, defaultDatasetSize);
}

test('Construction doesn\'t throw', () => {
  expect(() => {
    createPageVoxelRegistry(getTestRegistryConfig());
  }).not.toThrow();
});

test('Create voxelBlockLRU with correct max size', () => {
  let pageBlockSize = Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>;
  let voxelBlockSize = Vec3Simple.Vec3(16) as SizeWorld<VoxelBlockScale>;
  let config = getTestRegistryConfig(defaultPageTableSize, defaultVoxelCacheSize, pageBlockSize, voxelBlockSize);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  expect(pageVoxelRegistry.voxelBlockLRU.numberFreeBlocks).toBe((defaultSize / voxelBlockSize.x) ** 3);
});

test('Create pageTableLRU with correct max size', () => {
  let pageBlockSize = Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>;
  let voxelBlockSize = Vec3Simple.Vec3(16) as SizeWorld<VoxelBlockScale>;
  let config = getTestRegistryConfig(defaultPageTableSize, defaultVoxelCacheSize, pageBlockSize, voxelBlockSize);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  expect(pageVoxelRegistry.pageTableLRU.numberFreeBlocks).toBe((defaultSize / pageBlockSize.x) ** 3);
});

test('Register 1 voxel block for 1 page table no overflow', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  // Registering Coordinates...
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  // Expected Coordinates...
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;

  // Setup Data
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                                config.toVoxelBlockCoordinates(voxelCoordinates));

  // TEST!!!
  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);
  expect(voxelLRU.find(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(1);
  expect(delta.pageTable![0].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![0].data.entry).toBeDefined(); // some arbitrary block location
  expect(delta.pageTable![0].data.location).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(1);
  expect(delta.voxelCache![0].data.entry).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.voxelCache![0].data.state).toBe(MapState.Mapped);
});

test('Registering 2 voxel blocks for 1 pagetable no overflow', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(2) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);
  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 2, same page table
  // Expected Coordinates
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                    config.toVoxelBlockCoordinates(voxelCoordinates));
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates2),
                                                config.toVoxelBlockCoordinates(voxelCoordinates2));

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  // page table cache block should have both first and second voxel block coordinates
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates2)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(2);

  // both voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(2);

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(1);
  expect(delta.pageTable![0].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![0].data.entry).toBeDefined(); // some arbitrary block location
  expect(delta.pageTable![0].data.location).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(1);
  expect(delta.voxelCache![0].data.entry).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.voxelCache![0].data.state).toBe(MapState.Mapped);
});

test('Registering 2 voxel blocks for 2 pagetables no overflow', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(2) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

   // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 1, new page table
  // Expected Coordinates
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                    config.toVoxelBlockCoordinates(voxelCoordinates));
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates2),
                                                config.toVoxelBlockCoordinates(voxelCoordinates2));

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.find(expectedPageBlockCoordinates2)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(2);

  // page table cache block should only have 1 entry each
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  let pageTableCacheBlock2 = pageLRU.get(expectedPageBlockCoordinates2);
  expect(pageTableCacheBlock2!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(pageTableCacheBlock2!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  // both voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(2);

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(1);
  expect(delta.pageTable![0].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![0].data.entry).toBeDefined(); // some arbitrary block location
  expect(delta.pageTable![0].data.location).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(1);
  expect(delta.voxelCache![0].data.entry).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.voxelCache![0].data.state).toBe(MapState.Mapped);
});

test('Registering 2 voxel blocks for 1 pagetable but overflows voxel cache', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 2, same page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;
  // these should be removed
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;

  // Setup Data
  pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                    config.toVoxelBlockCoordinates(voxelCoordinates));
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates2),
                                                config.toVoxelBlockCoordinates(voxelCoordinates2));

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  // page table cache block should have both first and second voxel block coordinates
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates2)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  // only second voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(2);
  expect(delta.pageTable![0].data.state).toBe(MapState.NotMapped);
  expect(delta.pageTable![0].data.entry).toBeUndefined(); // entire page table is removed
  expect(delta.pageTable![0].data.location).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.pageTable![0].cacheBlock).toMatchObject(expectedPageBlockCoordinates);
  expect(delta.pageTable![1].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![1].data.entry).toBeDefined(); // some arbitrary block location
  expect(delta.pageTable![1].data.location).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(1);
  expect(delta.voxelCache![0].data.state).toBe(MapState.Mapped);
  expect(delta.voxelCache![0].data.entry).toMatchObject(expectedVoxelBlockCoordinates2);

});

test('Registering 2 voxel blocks for 2 pagetables but overflows voxel cache', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 1, new page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                    config.toVoxelBlockCoordinates(voxelCoordinates));
  let removedPageBlockCoordinates = pageLRU.find(Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates)!.block;
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates2),
                                                config.toVoxelBlockCoordinates(voxelCoordinates2));

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates2)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  // page table cache block should have both first and second voxel block coordinates
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates2);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates2)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  // only second voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(2);
  expect(delta.pageTable![0].cacheBlock).toMatchObject(removedPageBlockCoordinates);
  expect(delta.pageTable![0].data.state).toBe(MapState.NotMapped);
  expect(delta.pageTable![0].data.entry).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![0].data.location).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![1].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![1].data.entry).toBeDefined(); // arbitrary block location
  expect(delta.pageTable![1].data.location).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(1);
  expect(delta.voxelCache![0].data.entry).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.voxelCache![0].data.state).toBe(MapState.Mapped);
});

test('Registering register 2 voxel block to 2 pagetables but overflows page table cache', () => {
  let config = getTestRegistryConfig(Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 1, new page table
  // Expected Coordinates
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                    config.toVoxelBlockCoordinates(voxelCoordinates));
  let removedPageBlockCoordinates = pageLRU.find({ x: 0, y: 0, z: 0 } as PageBlockCoordinates)!.block;
  let replacedVoxelBlockCacheCoordinates = voxelLRU.find({ x: 0, y: 0, z: 0 } as VoxelBlockCoordinates)!.block;
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates2),
                                                config.toVoxelBlockCoordinates(voxelCoordinates2));

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates2)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  // page table cache block should have both first and second voxel block coordinates
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates2);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates2)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  // only second voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(2);
  expect(delta.pageTable![0].cacheBlock).toMatchObject(removedPageBlockCoordinates);
  expect(delta.pageTable![0].data.state).toBe(MapState.NotMapped);
  expect(delta.pageTable![0].data.entry).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![0].data.location).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![1].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![1].data.entry).toBeDefined(); // some arbitrary block location
  expect(delta.pageTable![1].data.location).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(2);
  expect(delta.voxelCache![0].data.state).toBe(MapState.NotMapped);
  expect(delta.voxelCache![0].cacheBlock).toMatchObject(replacedVoxelBlockCacheCoordinates);
  expect(delta.voxelCache![0].data.entry).toBeUndefined();
  expect(delta.voxelCache![1].data.state).toBe(MapState.Mapped);
  expect(delta.voxelCache![1].data.entry).toMatchObject(expectedVoxelBlockCoordinates2);
});

test('Registering 2 voxel blocks for 2 pagetables but overflows both voxel and page table cache, vx cache is 1', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 1, same page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;
  // This should be removed
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;

  // Setup Data
  pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                    config.toVoxelBlockCoordinates(voxelCoordinates));
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates2),
                                                config.toVoxelBlockCoordinates(voxelCoordinates2));

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates2)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  // page table cache block should have both first and second voxel block coordinates
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates2);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates2)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  // only second voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(2);
  expect(delta.pageTable![0].cacheBlock).toMatchObject(expectedPageBlockCoordinates);
  expect(delta.pageTable![0].data.state).toBe(MapState.NotMapped);
  expect(delta.pageTable![0].data.entry).toBeUndefined(); // removing
  expect(delta.pageTable![0].data.location).toBeUndefined; // removing entire page table bc size vx cache is 1
  expect(delta.pageTable![1].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![1].data.entry).toBeDefined(); // some arbitrary block location
  expect(delta.pageTable![1].data.location).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(1); // no specific unmapping needed because size of vx cache is 1
  expect(delta.voxelCache![0].data.state).toBe(MapState.Mapped);
  expect(delta.voxelCache![0].data.entry).toMatchObject(expectedVoxelBlockCoordinates2);
});

test('Registering full voxel and page table cache and overflow both to overflow the same page table cache LRU', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(2) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  // Registering Coordinates!
  for (let x = 0; x < 2; x ++) {
    for (let y = 0; y < 2; y ++) {
      for (let z = 0; z < 2; z ++) {
        let voxelCoordinates = { x, y, z } as VoxelCoordinates;
        pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                          config.toVoxelBlockCoordinates(voxelCoordinates));
      }
    }
  }
  // Expected Coordinates
  let expectedPageBlockCoordinates = { x: 1, y: 1, z: 1 } as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = { x: 2, y: 2, z: 2 } as VoxelBlockCoordinates;

  expect(voxelLRU.numberFreeBlocks).toBe(0);
  expect(pageLRU.numberFreeBlocks).toBe(0);

  // Overflow both pagetable and voxel at the same time
  let replacedPageBlockCoordinates = pageLRU.find({ x: 0, y: 0, z: 0 } as PageBlockCoordinates)!.block;
  let voxelCoordinates = { x: 2, y: 2, z: 2 } as VoxelCoordinates;
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                                config.toVoxelBlockCoordinates(voxelCoordinates));

  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  expect(voxelLRU.numberRegisteredBlocks).toBe(1);

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(2);
  expect(delta.pageTable![0].cacheBlock).toMatchObject(replacedPageBlockCoordinates);
  expect(delta.pageTable![0].data.state).toBe(MapState.NotMapped);
  expect(delta.pageTable![0].data.entry).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![0].data.location).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![1].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![1].data.entry).toBeDefined(); // some arbitrary block location
  expect(delta.pageTable![1].data.location).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(8); // too many, just check the last one which should be the add
  expect(delta.voxelCache![7].data.state).toBe(MapState.Mapped);
  expect(delta.voxelCache![7].data.entry).toMatchObject(expectedVoxelBlockCoordinates);
});

test('Register full voxel and page table cache and new vx/pt with overflow but replace only 1 LRU page table', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(4) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(4) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  for (let x = 0; x < 4; x ++) {
    for (let y = 0; y < 4; y ++) {
      for (let z = 0; z < 4; z ++) {
        let voxelCoordinates = { x, y, z } as VoxelCoordinates;
        pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                          config.toVoxelBlockCoordinates(voxelCoordinates));
      }
    }
  }
  // Expected Coordinates
  let expectedPageBlockCoordinates = { x: 2, y: 2, z: 2 } as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = { x: 4, y: 4, z: 4 } as VoxelBlockCoordinates;

  let replacedPageBlockCoordinates = pageLRU.find({ x: 0, y: 0, z: 0 } as PageBlockCoordinates)!.block;
  let voxelCoordinates = { x: 4, y: 4, z: 4 } as VoxelCoordinates;
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                                config.toVoxelBlockCoordinates(voxelCoordinates));

  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(2 ** 3);

  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  expect(voxelLRU.numberRegisteredBlocks).toBe(4 ** 3 - (2 ** 3 - 1));

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(2);
  expect(delta.pageTable![0].cacheBlock).toMatchObject(replacedPageBlockCoordinates);
  expect(delta.pageTable![0].data.state).toBe(MapState.NotMapped);
  expect(delta.pageTable![0].data.entry).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![0].data.location).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![1].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![1].data.entry).toBeDefined(); // some arbitrary block location
  expect(delta.pageTable![1].data.location).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(8); // too many, just check the last one which should be the add
  expect(delta.voxelCache![7].data.state).toBe(MapState.Mapped);
  expect(delta.voxelCache![7].data.entry).toMatchObject(expectedVoxelBlockCoordinates);
});

test('Register full voxel and page table cache but 2 different page table lru', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(4) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(4) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  // Fill every voxel backwards from 3 .. 0
  for (let x = 3; x >= 0; x --) {
    for (let y = 3; y >= 0; y --) {
      for (let z = 3; z >= 0; z --) {
        let voxelCoordinates = { x, y, z } as VoxelCoordinates;
        pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                          config.toVoxelBlockCoordinates(voxelCoordinates));
      }
    }
  }
  // Fill every first block in each page table forward from 0 .. 1
  for (let x = 0; x < 4; x += 2) {
    for (let y = 0; y < 4; y += 2) {
      for (let z = 0; z < 4; z += 2) {
        let voxelCoordinates = { x, y, z } as VoxelCoordinates;
        pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                          config.toVoxelBlockCoordinates(voxelCoordinates));
      }
    }
  }
  // Expected Coordinates
  let expectedPageBlockCoordinates = { x: 2, y: 2, z: 2 } as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = { x: 4, y: 4, z: 4 } as VoxelBlockCoordinates;

  // first page block touched by going backwards
  let replacedPageBlockCoordinates = pageLRU.find({ x: 1, y: 1, z: 1 } as PageBlockCoordinates)!.block;
  let replacedVoxelBlockCoordinates = { x: 3, y: 3, z: 3 } as VoxelBlockCoordinates;
  // first page block touched by going forwards filling every first block in each page table
  let removedPageBlockCoordinates = pageLRU.find({ x: 0, y: 0, z: 0 } as PageBlockCoordinates)!.block;
  let voxelCoordinates = { x: 4, y: 4, z: 4 } as VoxelCoordinates;
  let delta = pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                                config.toVoxelBlockCoordinates(voxelCoordinates));

  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(2 ** 3);

  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.get(expectedVoxelBlockCoordinates)).toBe(
    MapState.Mapped);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  expect(voxelLRU.numberRegisteredBlocks).toBe(4 ** 3 - (2 ** 3));

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable).toHaveLength(3);
  expect(delta.pageTable![0].cacheBlock).toMatchObject(replacedPageBlockCoordinates);
  expect(delta.pageTable![0].data.state).toBe(MapState.NotMapped);
  expect(delta.pageTable![0].data.entry).toBeUndefined(); // removing an individual entry
  expect(delta.pageTable![0].data.location).toMatchObject(replacedVoxelBlockCoordinates); // removing entire page table
  expect(delta.pageTable![1].cacheBlock).toMatchObject(removedPageBlockCoordinates);
  expect(delta.pageTable![1].data.state).toBe(MapState.NotMapped);
  expect(delta.pageTable![1].data.entry).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![1].data.location).toBeUndefined(); // removing entire page table
  expect(delta.pageTable![2].data.state).toBe(MapState.Mapped);
  expect(delta.pageTable![2].data.entry).toBeDefined(); // some arbitrary block location
  expect(delta.pageTable![2].data.location).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache).toHaveLength(9); // too many, just check the last one which should be the add
  expect(delta.voxelCache![8].data.state).toBe(MapState.Mapped);
  expect(delta.voxelCache![8].data.entry).toMatchObject(expectedVoxelBlockCoordinates);
});

test('Mark Empty Page Block no page table entry', () => {
  let config = getTestRegistryConfig();
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let pageBlockCoordinates = config.toPageBlockCoordinates(voxelCoordinates);

  let delta = pageVoxelRegistry.markEmptyPageBlock(pageBlockCoordinates);

  expect(delta).toMatchObject({});
});

test('Mark Empty Page Block with 1 entry', () => {
  let config = getTestRegistryConfig();
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let pageBlockCoordinates = config.toPageBlockCoordinates(voxelCoordinates);
  let voxelBlockCoordinates = config.toVoxelBlockCoordinates(voxelCoordinates);

  // TODO use real mocking
  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  pageVoxelRegistry.registerToCache(pageBlockCoordinates, voxelBlockCoordinates);

  let delta = pageVoxelRegistry.markEmptyPageBlock(pageBlockCoordinates);

  expect(voxelLRU.find(voxelBlockCoordinates)).toBeUndefined();
  expect(pageLRU.find(pageBlockCoordinates)).toBeUndefined();

  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache!.length).toBe(1);
  expect(delta.voxelCache![0].data.state).toBe(MapState.Empty);
  expect(delta.voxelCache![0].data.entry).toBeUndefined();

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable!.length).toBe(1);
  expect(delta.pageTable![0].data.state).toBe(MapState.Empty);
  expect(delta.pageTable![0].data.entry).toBeUndefined();
  expect(delta.pageTable![0].data.location).toBeUndefined();
});

test('Mark Empty page block with multiple entries', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(8) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(8) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(4) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let pageBlockCoordinates = config.toPageBlockCoordinates(voxelCoordinates);
  let voxelBlockCoordinates = config.toVoxelBlockCoordinates(voxelCoordinates);
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates;
  let pageBlockCoordinates2 = config.toPageBlockCoordinates(voxelCoordinates2);
  let voxelBlockCoordinates2 = config.toVoxelBlockCoordinates(voxelCoordinates2);
  let voxelCoordinates3 = { x: 2, y: 2, z: 2 } as VoxelCoordinates;
  let pageBlockCoordinates3 = config.toPageBlockCoordinates(voxelCoordinates3);
  let voxelBlockCoordinates3 = config.toVoxelBlockCoordinates(voxelCoordinates3);

  // TODO use real mocking
  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  pageVoxelRegistry.registerToCache(pageBlockCoordinates, voxelBlockCoordinates);
  pageVoxelRegistry.registerToCache(pageBlockCoordinates2, voxelBlockCoordinates2);
  pageVoxelRegistry.registerToCache(pageBlockCoordinates3, voxelBlockCoordinates3);

  let delta = pageVoxelRegistry.markEmptyPageBlock(pageBlockCoordinates);

  expect(voxelLRU.find(voxelBlockCoordinates)).toBeUndefined();
  expect(pageLRU.find(pageBlockCoordinates)).toBeUndefined();
  expect(voxelLRU.find(voxelBlockCoordinates2)).toBeUndefined();
  expect(pageLRU.find(pageBlockCoordinates2)).toBeUndefined();
  expect(voxelLRU.find(voxelBlockCoordinates3)).toBeUndefined();
  expect(pageLRU.find(pageBlockCoordinates3)).toBeUndefined();

  console.log(delta);
  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache!.length).toBe(3);
  expect(delta.voxelCache![0].data.state).toBe(MapState.Empty);
  expect(delta.voxelCache![0].data.entry).toBeUndefined();
  expect(delta.voxelCache![1].data.state).toBe(MapState.Empty);
  expect(delta.voxelCache![1].data.entry).toBeUndefined();
  expect(delta.voxelCache![2].data.state).toBe(MapState.Empty);
  expect(delta.voxelCache![2].data.entry).toBeUndefined();

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable!.length).toBe(1);
  expect(delta.pageTable![0].data.state).toBe(MapState.Empty);
  expect(delta.pageTable![0].data.entry).toBeUndefined();
  expect(delta.pageTable![0].data.location).toBeUndefined();
});

test('Mark Empty Voxel Block', () => {
  let config = getTestRegistryConfig();
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let pageBlockCoordinates = config.toPageBlockCoordinates(voxelCoordinates);
  let voxelBlockCoordinates = config.toVoxelBlockCoordinates(voxelCoordinates);

  // TODO use real mocking
  let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
  let pageLRU = pageVoxelRegistry.pageTableLRU;

  pageVoxelRegistry.registerToCache(pageBlockCoordinates, voxelBlockCoordinates);

  let delta = pageVoxelRegistry.markEmptyVoxelBlock(pageBlockCoordinates, voxelBlockCoordinates);

  expect(voxelLRU.find(voxelBlockCoordinates)).toBeUndefined();
  expect(pageLRU.find(pageBlockCoordinates)).toBeDefined();
  expect(pageLRU.find(pageBlockCoordinates)!.info.mappedVoxelBlockCoordinates.get(voxelBlockCoordinates)).toBe(
    MapState.Empty);

  expect(delta.voxelCache).toBeDefined();
  expect(delta.voxelCache!.length).toBe(1);
  expect(delta.voxelCache![0].data.state).toBe(MapState.Empty);
  expect(delta.voxelCache![0].data.entry).toBeUndefined();

  expect(delta.pageTable).toBeDefined();
  expect(delta.pageTable!.length).toBe(1);
  expect(delta.pageTable![0].data.state).toBe(MapState.Empty);
  expect(delta.pageTable![0].data.entry).toBeUndefined();
  expect(delta.pageTable![0].data.location).toMatchObject(voxelBlockCoordinates);
});

test('Returns empty for empty blocks', () => {
  let config = getTestRegistryConfig();
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let pageBlockCoordinates = config.toPageBlockCoordinates(voxelCoordinates);
  let voxelBlockCoordinates = config.toVoxelBlockCoordinates(voxelCoordinates);

  // TODO use real mocking
  pageVoxelRegistry.registerToCache(pageBlockCoordinates, voxelBlockCoordinates);
  pageVoxelRegistry.markEmptyVoxelBlock(pageBlockCoordinates, voxelBlockCoordinates);

  expect(pageVoxelRegistry.isEmptyVoxelBlock(pageBlockCoordinates, voxelBlockCoordinates)).toBe(true);
});

test('Returns not empty for not empty blocks', () => {
  let config = getTestRegistryConfig();
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let pageBlockCoordinates = config.toPageBlockCoordinates(voxelCoordinates);
  let voxelBlockCoordinates = config.toVoxelBlockCoordinates(voxelCoordinates);

  // TODO use real mocking
  pageVoxelRegistry.registerToCache(pageBlockCoordinates, voxelBlockCoordinates);

  expect(pageVoxelRegistry.isEmptyVoxelBlock(pageBlockCoordinates, voxelBlockCoordinates)).toBe(false);
});

test('Timeit 1 block 100x!', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(512) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(512) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(32) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  /*
   *let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
   *let pageLRU = pageVoxelRegistry.pageTableLRU;
   */
  /*
   *console.log(voxelLRU.numberFreeBlocks);
   *console.log(pageLRU.numberFreeBlocks);
   */

  let calls = 0;
  /*
   *console.time('1 block 102400x');
   */
  let z = 0;
  for (let t = 0; t < 100; t ++) {
    for (let x = 0; x < 32; x ++ ) {
      for (let y = 0; y < 32; y ++ ) {
        let voxelCoordinates = { x, y, z } as VoxelCoordinates;
        pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                          config.toVoxelBlockCoordinates(voxelCoordinates));
        calls ++;
      }
    }
  }
  /*
   *console.log('made ', calls, 'calls');
   *console.log(voxelLRU.numberRegisteredBlocks);
   *console.log(pageLRU.numberRegisteredBlocks);
   *console.timeEnd('1 block 102400x');
   */
});

test('Timeit 100 separate blocks!', () => {
  let config = getTestRegistryConfig(
    Vec3Simple.Vec3(512) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(512) as SizeWorld<VoxelBlockScale>,
    Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>, Vec3Simple.Vec3(32) as SizeWorld<VoxelBlockScale>);
  let pageVoxelRegistry = createPageVoxelRegistry(config);

  /*
   *let voxelLRU = pageVoxelRegistry.voxelBlockLRU;
   *let pageLRU = pageVoxelRegistry.pageTableLRU;
   */
  /*
   *console.log(voxelLRU.numberFreeBlocks);
   *console.log(pageLRU.numberFreeBlocks);
   */

  let calls = 0;
  /*
   *console.time('102400 block 1x');
   */
  for (let x = 0; x < 512 * 32; x += 512 ) {
    for (let y = 0; y < 512 * 32; y += 512 ) {
      for (let z = 0; z < 512 * 100; z += 512 ) {
        let voxelCoordinates = { x, y, z } as VoxelCoordinates;
        pageVoxelRegistry.registerToCache(config.toPageBlockCoordinates(voxelCoordinates),
                                          config.toVoxelBlockCoordinates(voxelCoordinates));
        calls ++;
      }
    }
  }
  /*
   *console.log('made ', calls, 'calls');
   *console.log(voxelLRU.numberRegisteredBlocks);
   *console.log(pageLRU.numberRegisteredBlocks);
   *console.timeEnd('102400 block 1x');
   */
});
