import * as Vec3Simple from '../Vec3Simple';
import { SizeWorld,
  VoxelCoordinates,
  VoxelBlockScale, PageBlockScale, VoxelScale,
} from './CacheTypes';
import CacheConfig from './CacheConfig';

const defaultSize = 128;
const defaultPageTableSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<PageBlockScale>;
const defaultVoxelCacheSize = Vec3Simple.Vec3(defaultSize) as SizeWorld<VoxelBlockScale>;
const defaultPageBlockSize = Vec3Simple.Vec3(32) as SizeWorld<PageBlockScale>;
const defaultVoxelBlockSize = Vec3Simple.Vec3(16) as SizeWorld<VoxelBlockScale>;
const defaultDatasetSize = Vec3Simple.Vec3(defaultSize * defaultSize * 8) as SizeWorld<VoxelScale>;

function getTestConfig(pageTableSize: SizeWorld<PageBlockScale> = defaultPageTableSize,
                       voxelCacheSize: SizeWorld<VoxelBlockScale> = defaultVoxelCacheSize,
                       pageBlockSize: SizeWorld<PageBlockScale> = defaultPageBlockSize,
                       voxelBlockSize: SizeWorld<VoxelBlockScale> = defaultVoxelBlockSize) {
  return new CacheConfig(pageTableSize, voxelCacheSize, pageBlockSize, voxelBlockSize, defaultDatasetSize);
}

test('Converts coordinates to correct voxel block coordinates', () => {
  let config = getTestConfig();

  let voxelCoordinates = { x: 10500, y: 3000, z: 200 } as VoxelCoordinates;
  let expected = { x: 656, y: 187, z: 12 };
  let actual = config.toVoxelBlockCoordinates(voxelCoordinates);
  expect(actual).toEqual(expected);
});

test('Converts coordinates to correct page block coordinates', () => {
  let config = getTestConfig();

  let voxelCoordinates = { x: 10500, y: 3000, z: 200 } as VoxelCoordinates;
  let expected = { x: 20, y: 5, z: 0 };
  let actual = config.toPageBlockCoordinates(voxelCoordinates);
  expect(actual).toEqual(expected);
});

