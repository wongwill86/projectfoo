import CacheRegistry from './CacheRegistry';
import * as Vec3Simple from './Vec3Simple';
import { SizeWorld,
  VoxelCoordinates,
  VoxelBlockCoordinates, PageBlockCoordinates,
} from './CacheTypes';

const defaultSize = 128;
const defaultPageTableSize = Vec3Simple.Vec3(defaultSize) as SizeWorld;
const defaultVoxelCacheSize = Vec3Simple.Vec3(defaultSize) as SizeWorld;
const defaultPageBlockSize = Vec3Simple.Vec3(defaultSize) as SizeWorld;
const defaultVoxelBlockSize = Vec3Simple.Vec3(defaultSize) as SizeWorld;

function constructDefaultCacheRegistry() {
  return new CacheRegistry(defaultPageTableSize, defaultVoxelCacheSize,
                           defaultPageBlockSize, defaultVoxelBlockSize);
}

test('Construction doesn\'t throw', () => {
  expect(() => {
    constructDefaultCacheRegistry();
  }).not.toThrow();
});

test('Converts coordinates to correct voxel block coordinates', () => {
  let pageBlockSize = 32;
  let voxelBlockSize = 16;
  let cacheRegistry = new CacheRegistry(defaultPageTableSize, defaultVoxelCacheSize,
                                        Vec3Simple.Vec3(pageBlockSize) as SizeWorld,
                                        Vec3Simple.Vec3(voxelBlockSize) as SizeWorld);
  let voxelCoordinates = { x: 10500, y: 3000, z: 200 } as VoxelCoordinates;
  let expected = { x: 656, y: 187, z: 12 };
  let actual = cacheRegistry.toVoxelBlockCoordinates(voxelCoordinates);
  expect(actual).toEqual(expected);
});

test('Converts coordinates to correct page block coordinates', () => {
  let pageBlockSize = 32;
  let voxelBlockSize = 16;
  let cacheRegistry = new CacheRegistry(defaultPageTableSize, defaultVoxelCacheSize,
                                        Vec3Simple.Vec3(pageBlockSize) as SizeWorld,
                                        Vec3Simple.Vec3(voxelBlockSize) as SizeWorld);
  let voxelCoordinates = { x: 10500, y: 3000, z: 200 } as VoxelCoordinates;
  let expected = { x: 20, y: 5, z: 0 };
  let actual = cacheRegistry.toPageBlockCoordinates(voxelCoordinates);
  expect(actual).toEqual(expected);
});

test('Create voxelBlockLRU with correct max size', () => {
  let pageBlockSize = 32;
  let voxelBlockSize = 16;
  let cacheRegistry = new CacheRegistry(defaultPageTableSize, defaultVoxelCacheSize,
                                        Vec3Simple.Vec3(pageBlockSize) as SizeWorld,
                                        Vec3Simple.Vec3(voxelBlockSize) as SizeWorld);
  expect(cacheRegistry.voxelBlockLRU.numberFreeBlocks).toBe((defaultSize / voxelBlockSize) ** 3);
});

test('Create pageTableLRU with correct max size', () => {
  let pageBlockSize = 32;
  let voxelBlockSize = 16;
  let cacheRegistry = new CacheRegistry(defaultPageTableSize, defaultVoxelCacheSize,
                                        Vec3Simple.Vec3(pageBlockSize) as SizeWorld,
                                        Vec3Simple.Vec3(voxelBlockSize) as SizeWorld);
  expect(cacheRegistry.pageTableLRU.numberFreeBlocks).toBe((defaultSize / pageBlockSize) ** 3);
});

test('Register 1 voxel block to 1 page table no overflow', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates...
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  // Expected Coordinates...
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);

  // TEST!!!
  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);
  expect(voxelLRU.find(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);
});

test('Registering 2 voxel blocks for 1 pagetable no overflow', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, remains in same page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  cacheRegistry.registerToCache(voxelCoordinates2);

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  // page table cache block should have both first and second voxel block coordinates
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(2);

  // both voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(2);
});

test('Registering 2 voxel blocks for 2 pagetable no overflow', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

   // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 2, new page table
  // Expected Coordinates
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  cacheRegistry.registerToCache(voxelCoordinates2);

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.find(expectedPageBlockCoordinates2)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(2);

  // page table cache block should only have 1 entry each
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  let pageTableCacheBlock2 = pageLRU.get(expectedPageBlockCoordinates2);
  expect(pageTableCacheBlock2!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(pageTableCacheBlock2!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  // both voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(2);
});

test('Registering 2 voxel block to 1 pagetable but overflows voxel cache', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, remains in same page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  cacheRegistry.registerToCache(voxelCoordinates2);

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  // page table cache block should have both first and second voxel block coordinates
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  // only second voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);
});

test('Registering register 2 voxel block to 2 pagetable but overflows page table cache', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, remains in same page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  cacheRegistry.registerToCache(voxelCoordinates2);

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates2)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  // page table cache block should have both first and second voxel block coordinates
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates2);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  // only second voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);
});

test('Registering register 2 voxel block to 2 pagetable but overflows both voxel and page table cache', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, remains in same page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  cacheRegistry.registerToCache(voxelCoordinates2);

  // TEST !!!
  expect(pageLRU.find(expectedPageBlockCoordinates2)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  // page table cache block should have both first and second voxel block coordinates
  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates2);

  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  // only second voxel block coordinates should be stored in the voxel cache
  expect(voxelLRU.find(expectedVoxelBlockCoordinates2)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);
});

test('Registering many to overflow both voxel and page table cache', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(2) as SizeWorld,
                                        Vec3Simple.Vec3(1) as SizeWorld);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Fill up entire voxel and page table cache
  for (let x = 0; x < 2; x ++) {
    for (let y = 0; y < 2; y ++) {
      for (let z = 0; z < 2; z ++) {
        cacheRegistry.registerToCache({ x, y, z } as VoxelCoordinates);
      }
    }
  }

  expect(voxelLRU.numberFreeBlocks).toBe(0);
  expect(pageLRU.numberFreeBlocks).toBe(0);

  // Overflow both pagetable and voxel at the same time
  cacheRegistry.registerToCache({ x: 2, y: 2, z: 2 } as VoxelCoordinates);

  // Expected Coordinates
  let expectedPageBlockCoordinates = { x: 1, y: 1, z: 1 } as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = { x: 2, y: 2, z: 2 } as VoxelBlockCoordinates;

  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  expect(voxelLRU.numberRegisteredBlocks).toBe(1);
});
