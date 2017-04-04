import * as Vec3Simple from '../Vec3Simple';
import {
  Size, SizeWorld, SizePower, Scale,
  VoxelCoordinates,
  VoxelBlockCoordinates, PageBlockCoordinates,
  VoxelScale, VoxelBlockScale, PageBlockScale, PageDirectoryScale,
} from './CacheTypes';

export function toPowerTwo<S extends Scale>(size: Size<S>): SizePower<S> {
  return {
    x: Math.log2(size.x),
    y: Math.log2(size.y),
    z: Math.log2(size.z),
  } as SizePower<S>;
}

export default class CacheConfig {
  public readonly voxelBlockSizePower: SizePower<VoxelBlockScale>;
  public readonly pageBlockSizePower: SizePower<PageBlockScale>;
  public readonly pageDirectorySizePower: SizePower<PageDirectoryScale>;

  constructor(public readonly pageTableSize: SizeWorld<PageBlockScale>,
              public readonly voxelCacheSize: SizeWorld<VoxelBlockScale>,
              public readonly pageBlockSize: SizeWorld<PageBlockScale>,
              public readonly voxelBlockSize: SizeWorld<VoxelBlockScale>,
              public readonly datasetSize: SizeWorld<VoxelScale>) {
    this.voxelBlockSizePower = toPowerTwo(voxelBlockSize);
    this.pageBlockSizePower = toPowerTwo(pageBlockSize);
    this.pageDirectorySizePower = Vec3Simple.add<SizePower<PageDirectoryScale>>(this.voxelBlockSizePower,
                                                                                this.pageBlockSizePower);
  }

  /* tslint:disable:no-bitwise */
  public toPageBlockCoordinates(coordinates: VoxelCoordinates): PageBlockCoordinates {
    return <PageBlockCoordinates> {
      x: coordinates.x >> this.pageDirectorySizePower.x, // >> this.voxelBlockSizePower.x >> this.pageBlockSizePower.x
      y: coordinates.y >> this.pageDirectorySizePower.y, // >> this.voxelBlockSizePower.y >> this.pageBlockSizePower.y
      z: coordinates.z >> this.pageDirectorySizePower.z, // >> this.voxelBlockSizePower.z >> this.pageBlockSizePower.z
    };
  }

  /* tslint:disable:no-bitwise */
  public toVoxelBlockCoordinates(voxelCoordinates: VoxelCoordinates): VoxelBlockCoordinates {
    return <VoxelBlockCoordinates> {
      x: voxelCoordinates.x >> this.voxelBlockSizePower.x,
      y: voxelCoordinates.y >> this.voxelBlockSizePower.y,
      z: voxelCoordinates.z >> this.voxelBlockSizePower.z,
    };
  }
}
