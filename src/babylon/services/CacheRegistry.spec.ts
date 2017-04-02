import CacheRegistry from './CacheRegistry';
import * as Vec3Simple from './Vec3Simple';
import { SizeWorld,
  VoxelCoordinates,
  VoxelBlockCoordinates, PageBlockCoordinates,
  VoxelBlockScale, PageBlockScale, PageDirectoryScale,
} from './CacheTypes';

const defaultSize = 128;
const defaultPageTableSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<PageBlockScale>;
const defaultVoxelCacheSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<VoxelBlockScale>;
const defaultPageBlockSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<PageBlockScale>;
const defaultVoxelBlockSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<VoxelBlockScale>;

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
  let pageBlockSize = Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>;
  let voxelBlockSize = Vec3Simple.Vec3(16) as SizeWorld<VoxelBlockScale>;
  let cacheRegistry = new CacheRegistry(defaultPageTableSize, defaultVoxelCacheSize, pageBlockSize, voxelBlockSize);
  let voxelCoordinates = { x: 10500, y: 3000, z: 200 } as VoxelCoordinates;
  let expected = { x: 656, y: 187, z: 12 };
  let actual = cacheRegistry.toVoxelBlockCoordinates(voxelCoordinates);
  expect(actual).toEqual(expected);
});

test('Converts coordinates to correct page block coordinates', () => {
  let pageBlockSize = Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>;
  let voxelBlockSize = Vec3Simple.Vec3(16) as SizeWorld<VoxelBlockScale>;
  let cacheRegistry = new CacheRegistry(defaultPageTableSize, defaultVoxelCacheSize, pageBlockSize, voxelBlockSize);
  let voxelCoordinates = { x: 10500, y: 3000, z: 200 } as VoxelCoordinates;
  let expected = { x: 20, y: 5, z: 0 };
  let actual = cacheRegistry.toPageBlockCoordinates(voxelCoordinates);
  expect(actual).toEqual(expected);
});

test('Create voxelBlockLRU with correct max size', () => {
  let pageBlockSize = Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>;
  let voxelBlockSize = Vec3Simple.Vec3(16) as SizeWorld<VoxelBlockScale>;
  let cacheRegistry = new CacheRegistry(defaultPageTableSize, defaultVoxelCacheSize, pageBlockSize, voxelBlockSize);

  expect(cacheRegistry.voxelBlockLRU.numberFreeBlocks).toBe((defaultSize / voxelBlockSize) ** 3);
});

test('Create pageTableLRU with correct max size', () => {
  let pageBlockSize = Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>;
  let voxelBlockSize = Vec3Simple.Vec3(16) as SizeWorld<VoxelBlockScale>;
  let cacheRegistry = new CacheRegistry(defaultPageTableSize, defaultVoxelCacheSize, pageBlockSize, voxelBlockSize);

  expect(cacheRegistry.pageTableLRU.numberFreeBlocks).toBe((defaultSize / pageBlockSize) ** 3);
});

test('Register 1 voxel block for 1 page table no overflow', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates...
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  // Expected Coordinates...
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;

  // Setup Data
  let delta = cacheRegistry.registerToCache(voxelCoordinates);

  // TEST!!!
  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);
  expect(voxelLRU.find(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(voxelLRU.numberRegisteredBlocks).toBe(1);

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.removedVoxelCache).toBeUndefined();
  expect(delta.removedPageTable).toBeUndefined();
});

test('Registering 2 voxel blocks for 1 pagetable no overflow', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 2, same page table
  // Expected Coordinates
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  let delta = cacheRegistry.registerToCache(voxelCoordinates2);

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

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.removedVoxelCache).toBeUndefined();
  expect(delta.removedPageTable).toBeUndefined();
});

test('Registering 2 voxel blocks for 2 pagetables no overflow', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

   // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 1, new page table
  // Expected Coordinates
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  let delta = cacheRegistry.registerToCache(voxelCoordinates2);

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

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.removedVoxelCache).toBeUndefined();
  expect(delta.removedPageTable).toBeUndefined();
});

test('Registering 2 voxel blocks to 1 pagetable but overflows voxel cache', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 2, same page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;
  // these should be removed
  let expectedVoxelBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  let delta = cacheRegistry.registerToCache(voxelCoordinates2);

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

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.removedVoxelCache).toBeUndefined();
  expect(delta.removedPageTable).toBeDefined();
  expect(delta.removedPageTable![0][0]).toMatchObject(expectedPageBlockCoordinates);
  expect(delta.removedPageTable![0][1]).toMatchObject(expectedVoxelBlockCoordinates);
});

test('Registering 2 voxel blocks to 2 pagetables but overflows voxel cache', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 1, new page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  let removedPageBlockCoordinates = pageLRU.find(Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates)!.block;
  let delta = cacheRegistry.registerToCache(voxelCoordinates2);

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

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.removedVoxelCache).toBeUndefined();
  expect(delta.removedPageTable).toBeDefined();
  expect(delta.removedPageTable![0][0]).toMatchObject(removedPageBlockCoordinates);
  expect(delta.removedPageTable![0][1]).toBe(true);
});

test('Registering register 2 voxel block to 2 pagetables but overflows page table cache', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 1, new page table
  // Expected Coordinates
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  let removedPageBlockCoordinates = pageLRU.find({ x: 0, y: 0, z: 0 } as PageBlockCoordinates)!.block;
  let replacedVoxelBlockCacheCoordinates = voxelLRU.find({ x: 0, y: 0, z: 0 } as VoxelBlockCoordinates)!.block;
  let delta = cacheRegistry.registerToCache(voxelCoordinates2);

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

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.removedVoxelCache).toBeDefined();
  expect(delta.removedVoxelCache![0]).toMatchObject(replacedVoxelBlockCacheCoordinates);
  expect(delta.removedPageTable).toBeDefined();
  expect(delta.removedPageTable![0][0]).toMatchObject(removedPageBlockCoordinates);
  expect(delta.removedPageTable![0][1]).toBe(true);
});

test('Registering 2 voxel blocks to 2 pagetables but overflows both voxel and page table cache', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  let voxelCoordinates = { x: 0, y: 0, z: 0 } as VoxelCoordinates;
  let voxelCoordinates2 = { x: 1, y: 1, z: 1 } as VoxelCoordinates; // offset by 1, block size 1, same page table!
  // Expected Coordinates
  let expectedPageBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates2 = Vec3Simple.strip(voxelCoordinates2) as VoxelBlockCoordinates;
  // This should be removed
  let expectedPageBlockCoordinates = Vec3Simple.strip(voxelCoordinates) as PageBlockCoordinates;

  // Setup Data
  cacheRegistry.registerToCache(voxelCoordinates);
  let delta = cacheRegistry.registerToCache(voxelCoordinates2);

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

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates2);
  expect(delta.removedVoxelCache).toBeDefined();
  expect(delta.removedVoxelCache).toHaveLength(0); // this is only the case because the size of the vx cache is 1
  expect(delta.removedPageTable).toBeDefined();
  expect(delta.removedPageTable).toHaveLength(1); // this is only the case because the size of the vx cache is 1
  expect(delta.removedPageTable![0][0]).toMatchObject(expectedPageBlockCoordinates);
  expect(delta.removedPageTable![0][1]).toBe(true);
});

test('Registering full voxel and page table cache and overflow both to overflow the same cache LRU, vx cache 1', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Registering Coordinates!
  for (let x = 0; x < 2; x ++) {
    for (let y = 0; y < 2; y ++) {
      for (let z = 0; z < 2; z ++) {
        cacheRegistry.registerToCache({ x, y, z } as VoxelCoordinates);
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
  let delta = cacheRegistry.registerToCache({ x: 2, y: 2, z: 2 } as VoxelCoordinates);

  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(1);

  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  expect(voxelLRU.numberRegisteredBlocks).toBe(1);

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.removedVoxelCache).toBeDefined();
  expect(delta.removedVoxelCache).toHaveLength(7);
  expect(delta.removedPageTable).toBeDefined();
  expect(delta.removedPageTable).toHaveLength(1); // this is only the case because the size of the vx cache is 1
  expect(delta.removedPageTable![0][0]).toMatchObject(replacedPageBlockCoordinates);
  expect(delta.removedPageTable![0][1]).toBe(true);
});

test('Register full voxel and page table cache and new vx/pt with overflow but replace only 1 LRU page table', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(4) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(4) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  for (let x = 0; x < 4; x ++) {
    for (let y = 0; y < 4; y ++) {
      for (let z = 0; z < 4; z ++) {
        cacheRegistry.registerToCache({ x, y, z } as VoxelCoordinates);
      }
    }
  }
  // Expected Coordinates
  let expectedPageBlockCoordinates = { x: 2, y: 2, z: 2 } as PageBlockCoordinates;
  let expectedVoxelBlockCoordinates = { x: 4, y: 4, z: 4 } as VoxelBlockCoordinates;

  let replacedPageBlockCoordinates = pageLRU.find({ x: 0, y: 0, z: 0 } as PageBlockCoordinates)!.block;
  let delta = cacheRegistry.registerToCache({ x: 4, y: 4, z: 4 } as VoxelCoordinates);

  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(2 ** 3);

  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  expect(voxelLRU.numberRegisteredBlocks).toBe(4 ** 3 - (2 ** 3 - 1));

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.removedVoxelCache).toBeDefined();
  expect(delta.removedVoxelCache).toHaveLength(7);
  expect(delta.removedPageTable).toBeDefined();
  expect(delta.removedPageTable).toHaveLength(1); // this is only the case because the size of the vx cache is 1
  expect(delta.removedPageTable![0][0]).toMatchObject(replacedPageBlockCoordinates);
  expect(delta.removedPageTable![0][1]).toBe(true);
});

test('Register full voxel and page table cache but 2 different page table lru', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(4) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(4) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(2) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(1) as SizeWorld<VoxelBlockScale>);
  let voxelLRU = cacheRegistry.voxelBlockLRU;
  let pageLRU = cacheRegistry.pageTableLRU;

  // Fill every voxel backwards from 3 .. 0
  for (let x = 3; x >= 0; x --) {
    for (let y = 3; y >= 0; y --) {
      for (let z = 3; z >= 0; z --) {
        cacheRegistry.registerToCache({ x, y, z } as VoxelCoordinates);
      }
    }
  }
  // Fill every first block in each page table forward from 0 .. 1
  for (let x = 0; x < 4; x += 2) {
    for (let y = 0; y < 4; y += 2) {
      for (let z = 0; z < 4; z += 2) {
        cacheRegistry.registerToCache({ x, y, z } as VoxelCoordinates);
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
  let delta = cacheRegistry.registerToCache({ x: 4, y: 4, z: 4 } as VoxelCoordinates);

  expect(pageLRU.find(expectedPageBlockCoordinates)).toBeTruthy();
  expect(pageLRU.numberRegisteredBlocks).toBe(2 ** 3);

  let pageTableCacheBlock = pageLRU.get(expectedPageBlockCoordinates);
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.has(expectedVoxelBlockCoordinates)).toBeTruthy();
  expect(pageTableCacheBlock!.info.mappedVoxelBlockCoordinates.size).toBe(1);

  expect(voxelLRU.numberRegisteredBlocks).toBe(4 ** 3 - (2 ** 3));

  expect(delta.addedVoxelCache).toBeDefined();
  expect(delta.addedVoxelCache![1]).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.addedPageTable).toBeDefined();
  expect(delta.addedPageTable![1][1]).toMatchObject(expectedVoxelBlockCoordinates);
  expect(delta.removedVoxelCache).toBeDefined();
  expect(delta.removedVoxelCache).toHaveLength(8);
  expect(delta.removedPageTable).toBeDefined();
  expect(delta.removedPageTable).toHaveLength(2); // this is only the case because the size of the vx cache is 1
  expect(delta.removedPageTable![0][0]).toMatchObject(replacedPageBlockCoordinates);
  expect(delta.removedPageTable![0][1]).toMatchObject(replacedVoxelBlockCoordinates);
  expect(delta.removedPageTable![1][0]).toMatchObject(removedPageBlockCoordinates);
  expect(delta.removedPageTable![1][1]).toBe(true);

});

test('Timeit 1 block 100x!', () => {
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(512) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(512) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(32) as SizeWorld<VoxelBlockScale>);
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
        cacheRegistry.registerToCache({ x, y, z } as VoxelCoordinates);
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
  let cacheRegistry = new CacheRegistry(Vec3Simple.Vec3(512) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(512) as SizeWorld<VoxelBlockScale>,
                                        Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>,
                                        Vec3Simple.Vec3(32) as SizeWorld<VoxelBlockScale>);
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
        cacheRegistry.registerToCache({ x, y, z } as VoxelCoordinates);
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
