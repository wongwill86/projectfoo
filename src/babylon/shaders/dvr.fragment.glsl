precision highp float;
precision highp usampler3D;
precision highp int;

uniform float fovy;
// R16UI - (R: SegmentID)
uniform lowp usampler3D voxelCache;
// RGBA8UI - (R: VoxelCacheBlockX, G: VoxelCacheBlockY, B: VoxelCacheBlockZ, A: Mapping Flag)
uniform lowp usampler3D pageTable;
// RGBA8UI UInt16 - (R: PageTableBlockX, G: PageTableBlockY, B: PageTableBlockZ, A: Mapping Flag)
uniform lowp usampler3D pageDirectory;

in vec3 frontPos;
in vec3 rayDir;

//layout(location = 0) out vec4 glFragColor;
layout(location = 1) out uint glFragSegID;
layout(location = 2) out vec4 glFragDepth;
// RGBA32UI - (R: PageTableBlockX, G: PageTableBlockY, B: PageTableBlockZ, A: (CacheLevel << 5 + LevelOfDetail))
layout(location = 3) out uvec4 glCacheState;

const vec3 ZERO3 = vec3(0.0);
const vec4 ZERO4 = vec4(0.0);
const vec3 ONE3 = vec3(1.0);
const vec4 ONE4 = vec4(1.0);
const vec4 RED = vec4(1.0, 0.0, 0.0, 1.0);
const vec4 GREEN = vec4(0.0, 1.0, 0.0, 1.0);
const vec4 BLUE = vec4(0.0, 0.0, 1.0, 1.0);

const float SQRT2INV = 0.70710678118;
const float SQRT3INV = 0.57735026919;

const float STEPSIZE = 0.001;

// TODO move this to uniforms!
const bool DEBUG = true;
const float DATASET_SIZE = 4096.0;
const float BLOCK_SIZE_VOXEL = 32.0;
const float BLOCK_SIZE_PAGE = 32.0;
const float TABLE_SIZE_VOXEL = 16.0;
const float TABLE_SIZE_PAGE = 16.0;
const float TOTAL_SIZE_PAGE_DIRECTORY = 4.0;
const float TOTAL_SIZE_PAGE_TABLES = BLOCK_SIZE_PAGE * TABLE_SIZE_VOXEL;
const float TOTAL_SIZE_VOXEL_TABLE = BLOCK_SIZE_VOXEL * TABLE_SIZE_PAGE;

const uint NOT_MAPPED = uint(0);
const uint MAPPED = uint(1);
const uint EMPTY = uint(2);

const uint PAGE_DIRECTORY = uint(4);
const uint PAGE_TABLE = uint(8);
const uint VOXEL_BLOCK = uint(12);

// --------------------- BEGIN Voxel Lookup ----------------------------

/*
 * Get the Voxel Coordinates from Normalized Device Coordinates
 *
 * @param position Coordinates in NDC: [0,1]
 *
 * @return coordinates in voxel space
 */
vec3 getVoxelCoordinates(vec3 position) {
  return position * DATASET_SIZE;
}

/*
 * Look up an entry from the Page Directory
 *
 * @param positionVoxel The actual raw position in the dataset we are looking at in voxel space
 * 
 * @return PageDirectoryEntry (RGBA8 uint) :
 *                        R - x coordinate in Page Table
 *                        G - y coordinate in Page Table
 *                        B - z coordinate in Page Table
 *                        A - Mapping flag indicates mapping status
 */
uvec4 getDirectoryEntry(vec3 positionVoxel) {
  // Get bits representing page directory ( lop off page table and voxel table bits )
  vec3 positionPageDirectory = positionVoxel / BLOCK_SIZE_PAGE / BLOCK_SIZE_VOXEL;

  // Use bits to index into page directory
  return textureLod(pageDirectory, positionPageDirectory / TOTAL_SIZE_PAGE_DIRECTORY, 0.0);
}

/*
 * Look up an  from the Page Table
 *
 * @param offset The offset page table block we are looking at ( still needs conversion to texture space )
 * @param positionVoxel The actual raw position in the dataset we are looking at in voxel space
 *
 * @return PageTableEntry (RGBA8 uint):
 *                        R - x coordinate in Voxel Cache
 *                        G - y coordinate in Page Table
 *                        B - z coordinate in Page Table
 *                        A - Mapping flag indicates mapping status
 */
uvec4 getPageEntry(vec3 offset, vec3 positionVoxel) {
  // Get bits representing page table ( between page directory and voxel table bits )
  vec3 positionPageTablePosition = mod(positionVoxel / BLOCK_SIZE_VOXEL, BLOCK_SIZE_PAGE);
  vec3 positionPageTableOffset = offset * BLOCK_SIZE_PAGE;
  vec3 positionPageTable = positionPageTableOffset + positionPageTablePosition;

  // use bits to index into page table
  return textureLod(pageTable, positionPageTable / TOTAL_SIZE_PAGE_TABLES, 0.0);
}

/*
 * Look up a voxel's id from the Voxel Cache
 *
 * @param offset The offset Voxel block we are looking at ( still needs conversion to texture space )
 * @param positionVoxel The actual raw position in the dataset we are looking at in voxel space
 *
 * @return VoxelBlockEntry (R16 uint): TODO allow 64 bit segmentids
 *                        R - SegmentId
 *                        G - 0
 *                        B - 0
 *                        A - 0
 */
uvec4 getVoxelEntry(vec3 offset, vec3 positionVoxel) {
  // Get bits representing voxel table ( lop off everything before voxel table bits )
  vec3 positionVoxelTablePosition = mod(positionVoxel, BLOCK_SIZE_VOXEL);
  vec3 positionVoxelTableOffset = offset * BLOCK_SIZE_VOXEL;
  vec3 positionVoxelTable = positionVoxelTableOffset + positionVoxelTablePosition;

  // use bits to index into voxel table
  return textureLod(voxelCache, positionVoxelTable / TOTAL_SIZE_VOXEL_TABLE, 0.0);
}

/*
 * Lookup the segment id for a position
 *
 * @param positionVoxel The position to look up in dataset voxel space
 *
 * @return SegmentID and Mapping State(uvec4): TODO allow 64 bit segmentids
 *                        R - SegmentID (32 upper bits)
 *                        G - SegmentID (32 lower bits)
 *                        B - Flag (EMPTY/MAPPED/NOT_MAPPED)
 *                        A - CacheLevel (PAGE_DIRECTORY/PAGE_TABLE/VOXEL_BLOCK)
 */
uvec4 getSegIDMapping(vec3 positionVoxel) {

  uvec4 entryDirectory = getDirectoryEntry(positionVoxel);
  if (entryDirectory.a != MAPPED) {
    return uvec4(0, 0, entryDirectory.a, PAGE_DIRECTORY);
  }

  uvec4 entryTable = getPageEntry(vec3(entryDirectory.rgb), positionVoxel);
  if (entryTable.a != MAPPED) {
    return uvec4(0, 0, entryTable.a, PAGE_TABLE);
  }

  uvec4 entryVoxel = getVoxelEntry(vec3(entryTable.rgb), positionVoxel);
  if (entryTable.a != MAPPED) {
    return uvec4(0, 0, entryVoxel.a, VOXEL_BLOCK);
  }

  return uvec4(0, entryVoxel.r, MAPPED, VOXEL_BLOCK);
}

/*
 * Same as getSegIDMapping(), this returns only the segID portion
 *
 * @param position The actual raw positon in the dataset we are looking at in object space: (0,1)
 *
 * @return SegmentID (
 */
uint getSegID(vec3 position) {
  vec3 positionVoxel = getVoxelCoordinates(position);
  return getSegIDMapping(positionVoxel).g; 
}

// --------------------- END Voxel Lookup ----------------------------

// good enough for now, don't use for serious stuff (beware lowp)
float rand(vec2 co){
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

// true if v is inside the box, otherwise false
bool isInsideBox(vec3 v, vec3 blf, vec3 trb) {
  return dot(step(blf, v), step(v, trb)) > 2.99;
}

vec2 iRayBox(vec3 pos, vec3 dir) {
  if (any(equal(dir, ZERO3))) {
    dir += 0.000001;
    dir = normalize(dir);
  }

  vec3 tmin3 = (ZERO3 - pos) / dir;
  vec3 tmax3 = (ONE3 - pos) / dir;

  vec3 tenter3 = min(tmin3, tmax3);
  vec3 texit3 = max(tmin3, tmax3);

  float tenter = max(tenter3.x, max(tenter3.y, tenter3.z));
  float texit = min(texit3.x, min(texit3.y, texit3.z));

  return vec2(tenter, texit);
}

bool isVisible(uint segID) {

  /*
   *if (mod(float(segID), 20.0) == 1.0)
   *  return true;
   */

  if (segID > uint(500) && segID < uint(1000)) {
    return true;
  }

  /*
   *if (segID > uint(13000) && segID < uint(13500)) {
   *  return true;
   *}
   */

  if (segID > uint(23000) && segID < uint(23500)) {
    return true;
  }
  return false;
}

vec4 segColor(uint segID) {
  float fsegID = float(segID);
  return vec4(rand(vec2(fsegID / 255.0, 0.123)),
        rand(vec2(fsegID / 255.0, 0.456)),
        rand(vec2(fsegID / 255.0, 0.789)),
        1.0);
}

vec4 segColorIfVisible(uint segID) {
  if (!isVisible(segID)) {
    return vec4(0.0);
  }
  return segColor(segID);
}

vec4 mixColorsIfVisible(vec4 col1, vec4 col2, float ratio) {
  if (col1.a == 0.0) {
    return col2;
  } else if (col2.a == 0.0) {
    return col1;
  } else {
    return mix(col1, col2, ratio);
  }
}

vec4 calcSmoothColor(vec3 texCoord, float stepsize) {
  vec3 ratio = fract(texCoord * 256.0 - 0.5);
  texCoord -= 0.5 * stepsize;

  vec4 colorCorners[8];
  vec4 colorMixed[6];

  colorCorners[0] = segColorIfVisible(getSegID(vec3(texCoord.x, texCoord.y, texCoord.z)));
  colorCorners[1] = segColorIfVisible(getSegID(vec3(texCoord.x, texCoord.y, texCoord.z + stepsize)));
  colorCorners[2] = segColorIfVisible(getSegID(vec3(texCoord.x + stepsize, texCoord.y, texCoord.z)));
  colorCorners[3] = segColorIfVisible(getSegID(vec3(texCoord.x + stepsize, texCoord.y, texCoord.z + stepsize)));
  colorCorners[4] = segColorIfVisible(getSegID(vec3(texCoord.x, texCoord.y + stepsize, texCoord.z)));
  colorCorners[5] = segColorIfVisible(getSegID(vec3(texCoord.x, texCoord.y + stepsize, texCoord.z + stepsize)));
  colorCorners[6] = segColorIfVisible(getSegID(vec3(texCoord.x + stepsize, texCoord.y + stepsize, texCoord.z)));
  colorCorners[7] = segColorIfVisible(getSegID(vec3(texCoord.x + stepsize, texCoord.y + stepsize,
    texCoord.z + stepsize)));

  colorMixed[0] = mixColorsIfVisible(colorCorners[0], colorCorners[1], ratio.z);
  colorMixed[1] = mixColorsIfVisible(colorCorners[2], colorCorners[3], ratio.z);
  colorMixed[2] = mixColorsIfVisible(colorCorners[4], colorCorners[5], ratio.z);
  colorMixed[3] = mixColorsIfVisible(colorCorners[6], colorCorners[7], ratio.z);

  colorMixed[4] = mixColorsIfVisible(colorMixed[0], colorMixed[1], ratio.x);
  colorMixed[5] = mixColorsIfVisible(colorMixed[2], colorMixed[3], ratio.x);

  return mixColorsIfVisible(colorMixed[4], colorMixed[5], ratio.y);
}

vec3 calcGradient(vec3 texCoord, float stepsize) {
  vec3 gradient = ZERO3;
  uint centerSegID = getSegID(texCoord);

  // 6 face adjacent voxels
  if (getSegID(texCoord + stepsize * vec3(-1.0,  0.0,  0.0)) != centerSegID)  { gradient += vec3(-1.0,  0.0,  0.0); }
  if (getSegID(texCoord + stepsize * vec3( 1.0,  0.0,  0.0)) != centerSegID)  { gradient += vec3( 1.0,  0.0,  0.0); }
  if (getSegID(texCoord + stepsize * vec3( 0.0, -1.0,  0.0)) != centerSegID)  { gradient += vec3( 0.0, -1.0,  0.0); }
  if (getSegID(texCoord + stepsize * vec3( 0.0,  1.0,  0.0)) != centerSegID)  { gradient += vec3( 0.0,  1.0,  0.0); }
  if (getSegID(texCoord + stepsize * vec3( 0.0,  0.0, -1.0)) != centerSegID)  { gradient += vec3( 0.0,  0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3( 0.0,  0.0,  1.0)) != centerSegID)  { gradient += vec3( 0.0,  0.0,  1.0); }

  // 12 edge adjacent voxels
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0,  0.0)) != centerSegID)
    { gradient += vec3(-SQRT2INV, -SQRT2INV,  0.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0,  1.0,  0.0)) != centerSegID)
    { gradient += vec3(-SQRT2INV,  SQRT2INV,  0.0); }
  if (getSegID(texCoord + stepsize * vec3( 1.0, -1.0,  0.0)) != centerSegID)
    { gradient += vec3( SQRT2INV, -SQRT2INV,  0.0); }
  if (getSegID(texCoord + stepsize * vec3( 1.0,  1.0,  0.0)) != centerSegID)
    { gradient += vec3( SQRT2INV,  SQRT2INV,  0.0); }

  if (getSegID(texCoord + stepsize * vec3(-1.0,  0.0, -1.0)) != centerSegID)
    { gradient += vec3(-SQRT2INV,  0.0, -SQRT2INV); }
  if (getSegID(texCoord + stepsize * vec3(-1.0,  0.0,  1.0)) != centerSegID)
    { gradient += vec3(-SQRT2INV,  0.0,  SQRT2INV); }
  if (getSegID(texCoord + stepsize * vec3( 1.0,  0.0, -1.0)) != centerSegID)
    { gradient += vec3( SQRT2INV,  0.0, -SQRT2INV); }
  if (getSegID(texCoord + stepsize * vec3( 1.0,  0.0,  1.0)) != centerSegID)
    { gradient += vec3( SQRT2INV,  0.0,  SQRT2INV); }

  if (getSegID(texCoord + stepsize * vec3( 0.0, -1.0, -1.0)) != centerSegID)
    { gradient += vec3( 0.0, -SQRT2INV, -SQRT2INV); }
  if (getSegID(texCoord + stepsize * vec3( 0.0, -1.0,  1.0)) != centerSegID)
    { gradient += vec3( 0.0, -SQRT2INV,  SQRT2INV); }
  if (getSegID(texCoord + stepsize * vec3( 0.0,  1.0, -1.0)) != centerSegID)
    { gradient += vec3( 0.0,  SQRT2INV, -SQRT2INV); }
  if (getSegID(texCoord + stepsize * vec3( 0.0,  1.0,  1.0)) != centerSegID)
    { gradient += vec3( 0.0,  SQRT2INV,  SQRT2INV); }

  // 8 corner adjacent voxels
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0, -1.0)) != centerSegID)
    { gradient += vec3(-SQRT3INV, -SQRT3INV, -SQRT3INV); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0,  1.0)) != centerSegID)
    { gradient += vec3(-SQRT3INV, -SQRT3INV,  SQRT3INV); }
  if (getSegID(texCoord + stepsize * vec3(-1.0,  1.0, -1.0)) != centerSegID)
    { gradient += vec3(-SQRT3INV,  SQRT3INV, -SQRT3INV); }
  if (getSegID(texCoord + stepsize * vec3(-1.0,  1.0,  1.0)) != centerSegID)
    { gradient += vec3(-SQRT3INV,  SQRT3INV,  SQRT3INV); }
  if (getSegID(texCoord + stepsize * vec3( 1.0, -1.0, -1.0)) != centerSegID)
    { gradient += vec3( SQRT3INV, -SQRT3INV, -SQRT3INV); }
  if (getSegID(texCoord + stepsize * vec3( 1.0, -1.0,  1.0)) != centerSegID)
    { gradient += vec3( SQRT3INV, -SQRT3INV,  SQRT3INV); }
  if (getSegID(texCoord + stepsize * vec3( 1.0,  1.0, -1.0)) != centerSegID)
    { gradient += vec3( SQRT3INV,  SQRT3INV, -SQRT3INV); }
  if (getSegID(texCoord + stepsize * vec3( 1.0,  1.0,  1.0)) != centerSegID)
    { gradient += vec3( SQRT3INV,  SQRT3INV,  SQRT3INV); }

  return gradient;
}

vec3 phongBlinn(vec3 normal, vec3 eyeDir, vec3 lightDir, vec3 ambientCol, vec3 diffuseCol, vec3 specularCol,
  float shininess) {
  // Ambient
  vec3 color = ambientCol;

  // Diffuse
  float lambert = max(0.0, dot(lightDir, normal));
  if (lambert > 0.0) {
    color += lambert * diffuseCol;

    // Specular (Blinn)
    vec3 halfDir = normalize(eyeDir + lightDir);
    float spec = pow(max(0.0, dot(halfDir, normal)), shininess);
    color += spec * specularCol;
  }

  return color;
}

vec3 gammaCorrect(vec3 linearColor, float gamma) {
  return pow(linearColor, vec3(1.0 / gamma));
}

float calcStepsize(float screenDist) {
  return max(0.5 / DATASET_SIZE, 0.5 / DATASET_SIZE * screenDist * tan(0.5*fovy));
  //return max(0.5 / 256.0, scale); //Nyquist
}

bool inShadow(vec3 pos, vec3 lightDir) {
  float stepsize = max(5.0 * STEPSIZE, calcStepsize(distance(pos, frontPos)));

  vec3 shadowPos = pos + stepsize * lightDir;
  while (isInsideBox(shadowPos, ZERO3, ONE3) == true) {
    if (isVisible(getSegID(shadowPos)) == true) {
      return true;
    }
    shadowPos += stepsize * lightDir;
  }
  return false;
}

float occlusion(vec3 pos, float stepsize) {
  float occl = 0.0;

  if (isVisible(getSegID(pos + stepsize * vec3(-1.0,  0.0,  0.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 1.0,  0.0,  0.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 0.0, -1.0,  0.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 0.0,  1.0,  0.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 0.0,  0.0, -1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 0.0,  0.0,  1.0))))  { occl += 1.0; }

  // 12 edge adjacent voxels
  if (isVisible(getSegID(pos + stepsize * vec3(-1.0, -1.0,  0.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3(-1.0,  1.0,  0.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 1.0, -1.0,  0.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 1.0,  1.0,  0.0))))  { occl += 1.0; }

  if (isVisible(getSegID(pos + stepsize * vec3(-1.0,  0.0, -1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3(-1.0,  0.0,  1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 1.0,  0.0, -1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 1.0,  0.0,  1.0))))  { occl += 1.0; }

  if (isVisible(getSegID(pos + stepsize * vec3( 0.0, -1.0, -1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 0.0, -1.0,  1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 0.0,  1.0, -1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 0.0,  1.0,  1.0))))  { occl += 1.0; }

  // 8 corner adjacent voxels
  /*if (isVisible(getSegID(pos + stepsize * vec3(-1.0, -1.0, -1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3(-1.0, -1.0,  1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3(-1.0,  1.0, -1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3(-1.0,  1.0,  1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 1.0, -1.0, -1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 1.0, -1.0,  1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 1.0,  1.0, -1.0))))  { occl += 1.0; }
  if (isVisible(getSegID(pos + stepsize * vec3( 1.0,  1.0,  1.0))))  { occl += 1.0; }*/

  return 1.0 - 2.5 * max(0.0, occl / 18.0 - 0.60);
}
// super ugly hack to get MRT for now
layout(location = 0)
void main() {
  glFragColor = ZERO4;

  vec3 pos = frontPos;
  vec3 dir = normalize(rayDir);

  vec2 rayStartStop = iRayBox(pos, dir) + .0001; // add epsilon to move slightly inside the box

  rayStartStop.x = max(0.001, rayStartStop.x);

  pos += rayStartStop.x * dir;
  if (isInsideBox(pos, vec3(0.0), vec3(1.0)) == false) {
    return;
  }

  uint segID = uint(0);
  uint visibleSegID = uint(0);
  uvec4 cacheState = uvec4(0, 0, 0, MAPPED);
  vec3 visiblePos = frontPos;

  vec3 lightDir = normalize(-dir + cross(dir, vec3(0.0, 1.0, 0.0)));
  vec4 color = ZERO4;

  while (true) {
    float curStepsize = calcStepsize(distance(pos, frontPos));

    vec3 positionVoxel = getVoxelCoordinates(pos);

    uvec4 segIDMapping = getSegIDMapping(positionVoxel);

    if (segIDMapping.b != MAPPED) {
      // TODO jump appropriate distance or try going up 1 mip level instead of breaking out
      if (segIDMapping.b == NOT_MAPPED) {
        cacheState.rgb = uvec3(positionVoxel);
        cacheState.a = segIDMapping.a  << 5; // + LevelOfDetail which is 0 for now
      }


      if (DEBUG) {
        if (segIDMapping.a == PAGE_DIRECTORY) {
          color = RED;
        } else if (segIDMapping.a == PAGE_TABLE) {
          color = GREEN;
        } else {
          color = BLUE;
        }
      }
      break;
    }
    // TODO proper uint64 conversion
    uint segID = segIDMapping.g;

    if (isVisible(segID)) {
      vec3 normal = normalize(calcGradient(pos, 1.0 * curStepsize));
      vec3 camDir = -dir;
      //vec3 basecol = calcSmoothColor(pos, 1.0 / 256.0).rgb;
      vec3 basecol = segColor(segID).rgb;
    
      color.rgb = 0.07 * basecol * 1.0; //occlusion(pos, 2.0 * curStepsize);
      //if (!inShadow(pos, lightDir)) {
        color.rgb = phongBlinn(normal, camDir, lightDir, 0.07 * basecol, 1.0*basecol, vec3(0.5), 16.0);
      //}
      color.rgb = gammaCorrect(color.rgb, 2.2);
      color.a = 1.0;

      visibleSegID = segID;
      visiblePos = pos;
      break;
    }
    pos += curStepsize * dir;

    if (isInsideBox(pos, vec3(0.0), vec3(1.0)) == false) {
      break;
    }
  }

  glFragColor = color;
  glFragSegID = visibleSegID;
  glFragDepth = vec4(distance(visiblePos, frontPos));
  glCacheState = cacheState;
}
