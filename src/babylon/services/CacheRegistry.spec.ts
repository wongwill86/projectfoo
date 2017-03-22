import CacheRegistry from './CacheRegistry';
import * as Vec3Simple from './Vec3Simple';
import { Size, VoxelCoordinates } from './CacheTypes';

const defaultPageDirectorySize = Vec3Simple.Vec3(128) as Size;
const defaultPageTableSize = Vec3Simple.Vec3(128) as Size;
const defaultVoxelCacheSize = Vec3Simple.Vec3(128) as Size;

function constructDefaultCacheRegistry() {
  return new CacheRegistry(defaultPageDirectorySize, defaultPageTableSize,
                           defaultVoxelCacheSize, Vec3Simple.Vec3(128) as Size, Vec3Simple.Vec3(128) as Size);
}

test('Construction doesn\'t throw', () => {
  expect(() => {
    constructDefaultCacheRegistry();
  }).not.toThrow();
});

test('Converts coordinates to correct voxel block coordinates', () => {
  let cacheRegistry = new CacheRegistry(defaultPageDirectorySize, defaultPageTableSize, defaultVoxelCacheSize,
                                        // (powers of 2: 7, 4)
                                        Vec3Simple.Vec3(128) as Size, Vec3Simple.Vec3(16) as Size);
  let voxelCoordinates = { x: 10500, y: 3000, z: 200 } as VoxelCoordinates;
  let expected = { x: 656, y: 187, z: 12 };
  let actual = cacheRegistry.toVoxelBlockCoordinates(voxelCoordinates);
  expect(actual).toEqual(expected);
});

test('Converts coordinates to correct page block coordinates', () => {
  let cacheRegistry = new CacheRegistry(defaultPageDirectorySize, defaultPageTableSize, defaultVoxelCacheSize,
                                        // (powers of 2: 7, 4)
                                        Vec3Simple.Vec3(128) as Size, Vec3Simple.Vec3(16) as Size);
  let voxelCoordinates = { x: 10500, y: 3000, z: 200 } as VoxelCoordinates;
  let expected = { x: 5, y: 1, z: 0 };
  let actual = cacheRegistry.toPageBlockCoordinates(voxelCoordinates);
  expect(actual).toEqual(expected);
});

/*test('Create voxelBlockLRU with correct max size', () => {*/
  //let cacheRegistry = new CacheRegistry(defaultPageDirectorySize, defaultPageTableSize, defaultVoxelCacheSize,
                                        //// (powers of 2: 7, 4)
                                        //Vec3Simple.Vec3(128) as Size, Vec3Simple.Vec3(16) as Size);
  //let lru = cacheRegistry.voxelBlockLRU;

  //let voxelBlock = {x: 1, y: 2, z: 3} as VoxelBlockCoordinates;
  //let voxelBlockInfo = {} as VoxelBlockInfo;

  //lru.set(voxelBlock, voxelBlockInfo);
  //expect(lru.length).toBe(1);

  //let voxelBlock2 = {x: 1, y: 2, z: 4} as VoxelBlockCoordinates;
  //lru.set(voxelBlock2, voxelBlockInfo);
  //expect(lru.length).toBe(1);
//});

//test('Create pagetBlockLRU with correct max size', () => {
  //let cacheRegistry = new CacheRegistry(defaultPageDirectorySize, defaultPageTableSize, defaultVoxelCacheSize,
                                        //128, 128);
  //let lru = cacheRegistry.pageBlockLRU;

  //let pageBlock = {x: 1, y: 2, z: 3} as PageBlockCoordinates;
  //let pageBlockInfo = {} as PageBlockInfo;

  //lru.set(pageBlock, pageBlockInfo);
  //expect(lru.length).toBe(1);

  //let pageTableBlock2 = {x: 1, y: 2, z: 4} as PageBlockCoordinates;
  //lru.set(pageTableBlock2, pageBlockInfo);
  //expect(lru.length).toBe(1);
//});

//test('Register voxel coordinates correctly to cache', () => {
  //let cacheRegistry = new CacheRegistry(defaultPageDirectorySize, defaultPageTableSize, defaultVoxelCacheSize,
                                        //128, 16); // (powers of 2: 7, 4)
  //let voxelCoordinates = { x: 10500, y: 3000, z: 200 } as VoxelCoordinates;
  //cacheRegistry.registerToCache(voxelCoordinates);

  /*
   *let expected = { x:5, y: 1, z: 0 };
   *let actual = cacheRegistry.toPageDirectoryBlock(voxelCoordinates);
   */

/*});*/
/*
 *  let voxelCoordinates: VoxelCoordinates = {
 *    x: 1200,
 *    y: 1300,
 *    z: 4,
 *    _voxel_coordinates_guard: true,
 *  };
 *
 *  let voxelCacheBlock: VoxelCacheBlock = {
 *    x: 1,
 *    y: 2,
 *    z: 4,
 *  };
 *
 *  let voxelCoordinates2: VoxelCoordinates = {
 *    x: 1200,
 *    y: 1300,
 *    z: 4,
 *    _voxel_coordinates_guard: true,
 *  };
 *
 */



/*
 *test('Converts coordinates to correct toPageTableBlock but not found', () => {
 *  let cacheRegistry = new CacheRegistry(defaultPageDirectorySize, defaultPageTableSize, defaultVoxelCacheSize,
 *                                        128, 16); // 7, 4
 *  let voxelCoordinates = new VoxelCoordinates(10500, 3000, 200);
 *  let expected = new PageTableBlock(10, 3, 5);
 *  let actual = cacheRegistry.toPageTableBlock(voxelCoordinates);
 *  expect(actual).toEqual(expected);
 *});
 */

/*

test('Converts coordinates to correct toVoxelCacheBlock', () => {
  let cacheRegistry = new CacheRegistry(defaultPageDirectorySize, defaultPageTableSize, defaultVoxelCacheSize,
                                        128, 16); // 7, 4
  let voxelCoordinates = new VoxelCoordinates(10500, 3000, 200);
  let expected = new VoxelCacheBlock(10, 3, 5);
  let actual = cacheRegistry.toVoxelCacheBlock(voxelCoordinates);
  expect(actual).toEqual(expected);
});
*/
