precision highp float;
precision highp usampler2D;
precision highp usampler3D;

uniform usampler2D selectionTex;
uniform vec2 seeds; // TODO: should be uvec2
uniform vec3 sizes; // TODO: should be uvec3

uniform usampler3D cubeTex;
uniform float fovy;

in vec3 frontPos;
in vec3 rayDir;

//layout(location = 0) out vec4 glFragColor;
layout(location = 1) out uint glFragSegID;
layout(location = 2) out vec4 glFragDepth;

const vec3 ZERO3 = vec3(0.0);
const vec4 ZERO4 = vec4(0.0);
const vec3 ONE3 = vec3(1.0);
const vec4 ONE4 = vec4(1.0);

const float SQRT2INV = 0.70710678118;
const float SQRT3INV = 0.57735026919;

const float STEPSIZE = 0.001;

const uint _murmur3_32_c1 = uint(0xcc9e2d51);
const uint _murmur3_32_c2 = uint(0x1b873593);
const uint _murmur3_32_n = uint(0xe6546b64);
const uint _murmur3_32_mix1 = uint(0x85ebca6b);
const uint _murmur3_32_mix2 = uint(0xc2b2ae35);

const uint _fnv_offset_32 = uint(0x811c9dc5);
const uint _fnv_prime_32 = uint(16777619);

// --------------------- BEGIN Cuckoo Hashing ----------------------------

uint hashCombine(uint m, uint n) {
  return m ^ (n + uint(0x517cc1b7) + (n << 6) + (n >> 2));
}

uint rol(uint m, uint n) {
  return (m << n) | (m >> (uint(32) - n));
}

uint murmur3_32(uint key, uint seed) {
  uint k = key;
  k *= _murmur3_32_c1;
  k = rol(k, uint(15));
  k *= _murmur3_32_c2;

  uint h = seed;
  h ^= k;
  h = rol(h, uint(13));
  h = h * uint(5) + _murmur3_32_n;

  h ^= uint(4);
  h ^= h >> uint(16);
  h *= _murmur3_32_mix1;
  h ^= h >> uint(13);
  h *= _murmur3_32_mix2;
  h ^= h >> uint(16);

  return h;
}

uint fnv1a_32(uint key, uint seed) {
  uint h = seed;
  h ^= (key & uint(0xFF000000)) >> 24;
  h *= _fnv_prime_32;
  h ^= (key & uint(0x00FF0000)) >> 16;
  h *= _fnv_prime_32;
  h ^= (key & uint(0x0000FF00)) >> 8;
  h *= _fnv_prime_32;
  h ^= key & uint(0x000000FF);
  h *= _fnv_prime_32;

  return h;
}

bool isVisible(uint segID) {
  if (segID == uint(0)) {
    return false;
  }
  uint hi = uint(0);

  uint hashPos = hashCombine(segID, hi) % uint(sizes.z);
  uint x = hashPos % uint(sizes.x);
  uint y = hashPos / uint(sizes.x);

  uvec2 texel = texelFetch(selectionTex, ivec2(x, y), 0).rg;
  if (texel.r == segID && texel.g == hi) {
    return true;
  }

  hashPos = hashCombine(fnv1a_32(segID, uint(seeds.y)), fnv1a_32(hi, uint(seeds.y))) % uint(sizes.z);
  x = hashPos % uint(sizes.x);
  y = hashPos / uint(sizes.x);

  texel = texelFetch(selectionTex, ivec2(x, y), 0).rg;
  if (texel.r == segID && texel.g == hi) {
    return true;
  }
}

// --------------------- END Cuckoo Hashing ----------------------------

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

uint getSegID( vec3 texCoord )
{
  return textureLod(cubeTex, texCoord, 0.0).r;
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
  uint target = getSegID(texCoord);

  if (getSegID(texCoord + stepsize * vec3(0.0, 0.0, 1.0)) != target) { gradient += 1.0000 * vec3(0.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 0.0, 0.0)) != target) { gradient += 1.0000 * vec3(-1.0, 0.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -1.0, 0.0)) != target) { gradient += 1.0000 * vec3(0.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 1.0, 0.0)) != target) { gradient += 1.0000 * vec3(0.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 0.0, 0.0)) != target) { gradient += 1.0000 * vec3(1.0, 0.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 0.0, -1.0)) != target) { gradient += 1.0000 * vec3(0.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 0.0, 1.0)) != target) { gradient += 0.7071 * vec3(-1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -1.0, 1.0)) != target) { gradient += 0.7071 * vec3(0.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 1.0, 1.0)) != target) { gradient += 0.7071 * vec3(0.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 0.0, 1.0)) != target) { gradient += 0.7071 * vec3(1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0, 0.0)) != target) { gradient += 0.7071 * vec3(-1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 1.0, 0.0)) != target) { gradient += 0.7071 * vec3(-1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -1.0, 0.0)) != target) { gradient += 0.7071 * vec3(1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 1.0, 0.0)) != target) { gradient += 0.7071 * vec3(1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 0.0, -1.0)) != target) { gradient += 0.7071 * vec3(-1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -1.0, -1.0)) != target) { gradient += 0.7071 * vec3(0.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 1.0, -1.0)) != target) { gradient += 0.7071 * vec3(0.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 0.0, -1.0)) != target) { gradient += 0.7071 * vec3(1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0, 1.0)) != target) { gradient += 0.5774 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 1.0, 1.0)) != target) { gradient += 0.5774 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -1.0, 1.0)) != target) { gradient += 0.5774 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 1.0, 1.0)) != target) { gradient += 0.5774 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0, -1.0)) != target) { gradient += 0.5774 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 1.0, -1.0)) != target) { gradient += 0.5774 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -1.0, -1.0)) != target) { gradient += 0.5774 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 1.0, -1.0)) != target) { gradient += 0.5774 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 0.0, 2.0)) != target) { gradient += 0.5000 * vec3(0.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 0.0, 0.0)) != target) { gradient += 0.5000 * vec3(-1.0, 0.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -2.0, 0.0)) != target) { gradient += 0.5000 * vec3(0.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 2.0, 0.0)) != target) { gradient += 0.5000 * vec3(0.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 0.0, 0.0)) != target) { gradient += 0.5000 * vec3(1.0, 0.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 0.0, -2.0)) != target) { gradient += 0.5000 * vec3(0.0, 0.0, -1.0); }
  
  if (getSegID(texCoord + stepsize * vec3(-1.0, 0.0, 2.0)) != target) { gradient += 0.4472 * vec3(-1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -1.0, 2.0)) != target) { gradient += 0.4472 * vec3(0.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 1.0, 2.0)) != target) { gradient += 0.4472 * vec3(0.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 0.0, 2.0)) != target) { gradient += 0.4472 * vec3(1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 0.0, 1.0)) != target) { gradient += 0.4472 * vec3(-1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -2.0, 1.0)) != target) { gradient += 0.4472 * vec3(0.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 2.0, 1.0)) != target) { gradient += 0.4472 * vec3(0.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 0.0, 1.0)) != target) { gradient += 0.4472 * vec3(1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -1.0, 0.0)) != target) { gradient += 0.4472 * vec3(-1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 1.0, 0.0)) != target) { gradient += 0.4472 * vec3(-1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -2.0, 0.0)) != target) { gradient += 0.4472 * vec3(-1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 2.0, 0.0)) != target) { gradient += 0.4472 * vec3(-1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -2.0, 0.0)) != target) { gradient += 0.4472 * vec3(1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 2.0, 0.0)) != target) { gradient += 0.4472 * vec3(1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -1.0, 0.0)) != target) { gradient += 0.4472 * vec3(1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 1.0, 0.0)) != target) { gradient += 0.4472 * vec3(1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 0.0, -1.0)) != target) { gradient += 0.4472 * vec3(-1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -2.0, -1.0)) != target) { gradient += 0.4472 * vec3(0.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 2.0, -1.0)) != target) { gradient += 0.4472 * vec3(0.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 0.0, -1.0)) != target) { gradient += 0.4472 * vec3(1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 0.0, -2.0)) != target) { gradient += 0.4472 * vec3(-1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -1.0, -2.0)) != target) { gradient += 0.4472 * vec3(0.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 1.0, -2.0)) != target) { gradient += 0.4472 * vec3(0.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 0.0, -2.0)) != target) { gradient += 0.4472 * vec3(1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0, 2.0)) != target) { gradient += 0.4082 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 1.0, 2.0)) != target) { gradient += 0.4082 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -1.0, 2.0)) != target) { gradient += 0.4082 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 1.0, 2.0)) != target) { gradient += 0.4082 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -1.0, 1.0)) != target) { gradient += 0.4082 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 1.0, 1.0)) != target) { gradient += 0.4082 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -2.0, 1.0)) != target) { gradient += 0.4082 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 2.0, 1.0)) != target) { gradient += 0.4082 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -2.0, 1.0)) != target) { gradient += 0.4082 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 2.0, 1.0)) != target) { gradient += 0.4082 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -1.0, 1.0)) != target) { gradient += 0.4082 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 1.0, 1.0)) != target) { gradient += 0.4082 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -1.0, -1.0)) != target) { gradient += 0.4082 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 1.0, -1.0)) != target) { gradient += 0.4082 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -2.0, -1.0)) != target) { gradient += 0.4082 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 2.0, -1.0)) != target) { gradient += 0.4082 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -2.0, -1.0)) != target) { gradient += 0.4082 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 2.0, -1.0)) != target) { gradient += 0.4082 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -1.0, -1.0)) != target) { gradient += 0.4082 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 1.0, -1.0)) != target) { gradient += 0.4082 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0, -2.0)) != target) { gradient += 0.4082 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 1.0, -2.0)) != target) { gradient += 0.4082 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -1.0, -2.0)) != target) { gradient += 0.4082 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 1.0, -2.0)) != target) { gradient += 0.4082 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 0.0, 2.0)) != target) { gradient += 0.3536 * vec3(-1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -2.0, 2.0)) != target) { gradient += 0.3536 * vec3(0.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 2.0, 2.0)) != target) { gradient += 0.3536 * vec3(0.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 0.0, 2.0)) != target) { gradient += 0.3536 * vec3(1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -2.0, 0.0)) != target) { gradient += 0.3536 * vec3(-1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 2.0, 0.0)) != target) { gradient += 0.3536 * vec3(-1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -2.0, 0.0)) != target) { gradient += 0.3536 * vec3(1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 2.0, 0.0)) != target) { gradient += 0.3536 * vec3(1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 0.0, -2.0)) != target) { gradient += 0.3536 * vec3(-1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -2.0, -2.0)) != target) { gradient += 0.3536 * vec3(0.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 2.0, -2.0)) != target) { gradient += 0.3536 * vec3(0.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 0.0, -2.0)) != target) { gradient += 0.3536 * vec3(1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 0.0, 3.0)) != target) { gradient += 0.3333 * vec3(0.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -1.0, 2.0)) != target) { gradient += 0.3333 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 1.0, 2.0)) != target) { gradient += 0.3333 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -2.0, 2.0)) != target) { gradient += 0.3333 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 2.0, 2.0)) != target) { gradient += 0.3333 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -2.0, 2.0)) != target) { gradient += 0.3333 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 2.0, 2.0)) != target) { gradient += 0.3333 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -1.0, 2.0)) != target) { gradient += 0.3333 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 1.0, 2.0)) != target) { gradient += 0.3333 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -2.0, 1.0)) != target) { gradient += 0.3333 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 2.0, 1.0)) != target) { gradient += 0.3333 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -2.0, 1.0)) != target) { gradient += 0.3333 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 2.0, 1.0)) != target) { gradient += 0.3333 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 0.0, 0.0)) != target) { gradient += 0.3333 * vec3(-1.0, 0.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -3.0, 0.0)) != target) { gradient += 0.3333 * vec3(0.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 3.0, 0.0)) != target) { gradient += 0.3333 * vec3(0.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 0.0, 0.0)) != target) { gradient += 0.3333 * vec3(1.0, 0.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -2.0, -1.0)) != target) { gradient += 0.3333 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 2.0, -1.0)) != target) { gradient += 0.3333 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -2.0, -1.0)) != target) { gradient += 0.3333 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 2.0, -1.0)) != target) { gradient += 0.3333 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -1.0, -2.0)) != target) { gradient += 0.3333 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 1.0, -2.0)) != target) { gradient += 0.3333 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -2.0, -2.0)) != target) { gradient += 0.3333 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 2.0, -2.0)) != target) { gradient += 0.3333 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -2.0, -2.0)) != target) { gradient += 0.3333 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 2.0, -2.0)) != target) { gradient += 0.3333 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -1.0, -2.0)) != target) { gradient += 0.3333 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 1.0, -2.0)) != target) { gradient += 0.3333 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 0.0, -3.0)) != target) { gradient += 0.3333 * vec3(0.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 0.0, 3.0)) != target) { gradient += 0.3162 * vec3(-1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -1.0, 3.0)) != target) { gradient += 0.3162 * vec3(0.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 1.0, 3.0)) != target) { gradient += 0.3162 * vec3(0.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 0.0, 3.0)) != target) { gradient += 0.3162 * vec3(1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 0.0, 1.0)) != target) { gradient += 0.3162 * vec3(-1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -3.0, 1.0)) != target) { gradient += 0.3162 * vec3(0.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 3.0, 1.0)) != target) { gradient += 0.3162 * vec3(0.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 0.0, 1.0)) != target) { gradient += 0.3162 * vec3(1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -1.0, 0.0)) != target) { gradient += 0.3162 * vec3(-1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 1.0, 0.0)) != target) { gradient += 0.3162 * vec3(-1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -3.0, 0.0)) != target) { gradient += 0.3162 * vec3(-1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 3.0, 0.0)) != target) { gradient += 0.3162 * vec3(-1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -3.0, 0.0)) != target) { gradient += 0.3162 * vec3(1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 3.0, 0.0)) != target) { gradient += 0.3162 * vec3(1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -1.0, 0.0)) != target) { gradient += 0.3162 * vec3(1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 1.0, 0.0)) != target) { gradient += 0.3162 * vec3(1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 0.0, -1.0)) != target) { gradient += 0.3162 * vec3(-1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -3.0, -1.0)) != target) { gradient += 0.3162 * vec3(0.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 3.0, -1.0)) != target) { gradient += 0.3162 * vec3(0.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 0.0, -1.0)) != target) { gradient += 0.3162 * vec3(1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 0.0, -3.0)) != target) { gradient += 0.3162 * vec3(-1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -1.0, -3.0)) != target) { gradient += 0.3162 * vec3(0.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 1.0, -3.0)) != target) { gradient += 0.3162 * vec3(0.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 0.0, -3.0)) != target) { gradient += 0.3162 * vec3(1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0, 3.0)) != target) { gradient += 0.3015 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 1.0, 3.0)) != target) { gradient += 0.3015 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -1.0, 3.0)) != target) { gradient += 0.3015 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 1.0, 3.0)) != target) { gradient += 0.3015 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -1.0, 1.0)) != target) { gradient += 0.3015 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 1.0, 1.0)) != target) { gradient += 0.3015 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -3.0, 1.0)) != target) { gradient += 0.3015 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 3.0, 1.0)) != target) { gradient += 0.3015 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -3.0, 1.0)) != target) { gradient += 0.3015 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 3.0, 1.0)) != target) { gradient += 0.3015 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -1.0, 1.0)) != target) { gradient += 0.3015 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 1.0, 1.0)) != target) { gradient += 0.3015 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -1.0, -1.0)) != target) { gradient += 0.3015 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 1.0, -1.0)) != target) { gradient += 0.3015 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -3.0, -1.0)) != target) { gradient += 0.3015 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 3.0, -1.0)) != target) { gradient += 0.3015 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -3.0, -1.0)) != target) { gradient += 0.3015 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 3.0, -1.0)) != target) { gradient += 0.3015 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -1.0, -1.0)) != target) { gradient += 0.3015 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 1.0, -1.0)) != target) { gradient += 0.3015 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -1.0, -3.0)) != target) { gradient += 0.3015 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 1.0, -3.0)) != target) { gradient += 0.3015 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -1.0, -3.0)) != target) { gradient += 0.3015 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 1.0, -3.0)) != target) { gradient += 0.3015 * vec3(1.0, 1.0, -1.0); }
  
  /*
  if (getSegID(texCoord + stepsize * vec3(-2.0, -2.0, 2.0)) != target) { gradient += 0.2887 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 2.0, 2.0)) != target) { gradient += 0.2887 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -2.0, 2.0)) != target) { gradient += 0.2887 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 2.0, 2.0)) != target) { gradient += 0.2887 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -2.0, -2.0)) != target) { gradient += 0.2887 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 2.0, -2.0)) != target) { gradient += 0.2887 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -2.0, -2.0)) != target) { gradient += 0.2887 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 2.0, -2.0)) != target) { gradient += 0.2887 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 0.0, 3.0)) != target) { gradient += 0.2774 * vec3(-1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -2.0, 3.0)) != target) { gradient += 0.2774 * vec3(0.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 2.0, 3.0)) != target) { gradient += 0.2774 * vec3(0.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 0.0, 3.0)) != target) { gradient += 0.2774 * vec3(1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 0.0, 2.0)) != target) { gradient += 0.2774 * vec3(-1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -3.0, 2.0)) != target) { gradient += 0.2774 * vec3(0.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 3.0, 2.0)) != target) { gradient += 0.2774 * vec3(0.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 0.0, 2.0)) != target) { gradient += 0.2774 * vec3(1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -2.0, 0.0)) != target) { gradient += 0.2774 * vec3(-1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 2.0, 0.0)) != target) { gradient += 0.2774 * vec3(-1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -3.0, 0.0)) != target) { gradient += 0.2774 * vec3(-1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 3.0, 0.0)) != target) { gradient += 0.2774 * vec3(-1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -3.0, 0.0)) != target) { gradient += 0.2774 * vec3(1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 3.0, 0.0)) != target) { gradient += 0.2774 * vec3(1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -2.0, 0.0)) != target) { gradient += 0.2774 * vec3(1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 2.0, 0.0)) != target) { gradient += 0.2774 * vec3(1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 0.0, -2.0)) != target) { gradient += 0.2774 * vec3(-1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -3.0, -2.0)) != target) { gradient += 0.2774 * vec3(0.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 3.0, -2.0)) != target) { gradient += 0.2774 * vec3(0.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 0.0, -2.0)) != target) { gradient += 0.2774 * vec3(1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 0.0, -3.0)) != target) { gradient += 0.2774 * vec3(-1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -2.0, -3.0)) != target) { gradient += 0.2774 * vec3(0.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 2.0, -3.0)) != target) { gradient += 0.2774 * vec3(0.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 0.0, -3.0)) != target) { gradient += 0.2774 * vec3(1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -1.0, 3.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 1.0, 3.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -2.0, 3.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 2.0, 3.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -2.0, 3.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 2.0, 3.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -1.0, 3.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 1.0, 3.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -1.0, 2.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 1.0, 2.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -3.0, 2.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 3.0, 2.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -3.0, 2.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 3.0, 2.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -1.0, 2.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 1.0, 2.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -2.0, 1.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 2.0, 1.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -3.0, 1.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 3.0, 1.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -3.0, 1.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 3.0, 1.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -2.0, 1.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 2.0, 1.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -2.0, -1.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 2.0, -1.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -3.0, -1.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 3.0, -1.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -3.0, -1.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 3.0, -1.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -2.0, -1.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 2.0, -1.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -1.0, -2.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 1.0, -2.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -3.0, -2.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 3.0, -2.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -3.0, -2.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 3.0, -2.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -1.0, -2.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 1.0, -2.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -1.0, -3.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 1.0, -3.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -2.0, -3.0)) != target) { gradient += 0.2673 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 2.0, -3.0)) != target) { gradient += 0.2673 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -2.0, -3.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 2.0, -3.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -1.0, -3.0)) != target) { gradient += 0.2673 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 1.0, -3.0)) != target) { gradient += 0.2673 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -2.0, 3.0)) != target) { gradient += 0.2425 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 2.0, 3.0)) != target) { gradient += 0.2425 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -2.0, 3.0)) != target) { gradient += 0.2425 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 2.0, 3.0)) != target) { gradient += 0.2425 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -2.0, 2.0)) != target) { gradient += 0.2425 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 2.0, 2.0)) != target) { gradient += 0.2425 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -3.0, 2.0)) != target) { gradient += 0.2425 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 3.0, 2.0)) != target) { gradient += 0.2425 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -3.0, 2.0)) != target) { gradient += 0.2425 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 3.0, 2.0)) != target) { gradient += 0.2425 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -2.0, 2.0)) != target) { gradient += 0.2425 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 2.0, 2.0)) != target) { gradient += 0.2425 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -2.0, -2.0)) != target) { gradient += 0.2425 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 2.0, -2.0)) != target) { gradient += 0.2425 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -3.0, -2.0)) != target) { gradient += 0.2425 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 3.0, -2.0)) != target) { gradient += 0.2425 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -3.0, -2.0)) != target) { gradient += 0.2425 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 3.0, -2.0)) != target) { gradient += 0.2425 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -2.0, -2.0)) != target) { gradient += 0.2425 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 2.0, -2.0)) != target) { gradient += 0.2425 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -2.0, -3.0)) != target) { gradient += 0.2425 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 2.0, -3.0)) != target) { gradient += 0.2425 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -2.0, -3.0)) != target) { gradient += 0.2425 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 2.0, -3.0)) != target) { gradient += 0.2425 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 0.0, 3.0)) != target) { gradient += 0.2357 * vec3(-1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -3.0, 3.0)) != target) { gradient += 0.2357 * vec3(0.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 3.0, 3.0)) != target) { gradient += 0.2357 * vec3(0.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 0.0, 3.0)) != target) { gradient += 0.2357 * vec3(1.0, 0.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -3.0, 0.0)) != target) { gradient += 0.2357 * vec3(-1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 3.0, 0.0)) != target) { gradient += 0.2357 * vec3(-1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -3.0, 0.0)) != target) { gradient += 0.2357 * vec3(1.0, -1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 3.0, 0.0)) != target) { gradient += 0.2357 * vec3(1.0, 1.0, 0.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 0.0, -3.0)) != target) { gradient += 0.2357 * vec3(-1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, -3.0, -3.0)) != target) { gradient += 0.2357 * vec3(0.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(0.0, 3.0, -3.0)) != target) { gradient += 0.2357 * vec3(0.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 0.0, -3.0)) != target) { gradient += 0.2357 * vec3(1.0, 0.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -1.0, 3.0)) != target) { gradient += 0.2294 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 1.0, 3.0)) != target) { gradient += 0.2294 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -3.0, 3.0)) != target) { gradient += 0.2294 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 3.0, 3.0)) != target) { gradient += 0.2294 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -3.0, 3.0)) != target) { gradient += 0.2294 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 3.0, 3.0)) != target) { gradient += 0.2294 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -1.0, 3.0)) != target) { gradient += 0.2294 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 1.0, 3.0)) != target) { gradient += 0.2294 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -3.0, 1.0)) != target) { gradient += 0.2294 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 3.0, 1.0)) != target) { gradient += 0.2294 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -3.0, 1.0)) != target) { gradient += 0.2294 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 3.0, 1.0)) != target) { gradient += 0.2294 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -3.0, -1.0)) != target) { gradient += 0.2294 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 3.0, -1.0)) != target) { gradient += 0.2294 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -3.0, -1.0)) != target) { gradient += 0.2294 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 3.0, -1.0)) != target) { gradient += 0.2294 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -1.0, -3.0)) != target) { gradient += 0.2294 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 1.0, -3.0)) != target) { gradient += 0.2294 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, -3.0, -3.0)) != target) { gradient += 0.2294 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-1.0, 3.0, -3.0)) != target) { gradient += 0.2294 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, -3.0, -3.0)) != target) { gradient += 0.2294 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(1.0, 3.0, -3.0)) != target) { gradient += 0.2294 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -1.0, -3.0)) != target) { gradient += 0.2294 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 1.0, -3.0)) != target) { gradient += 0.2294 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -2.0, 3.0)) != target) { gradient += 0.2132 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 2.0, 3.0)) != target) { gradient += 0.2132 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -3.0, 3.0)) != target) { gradient += 0.2132 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 3.0, 3.0)) != target) { gradient += 0.2132 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -3.0, 3.0)) != target) { gradient += 0.2132 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 3.0, 3.0)) != target) { gradient += 0.2132 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -2.0, 3.0)) != target) { gradient += 0.2132 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 2.0, 3.0)) != target) { gradient += 0.2132 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -3.0, 2.0)) != target) { gradient += 0.2132 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 3.0, 2.0)) != target) { gradient += 0.2132 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -3.0, 2.0)) != target) { gradient += 0.2132 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 3.0, 2.0)) != target) { gradient += 0.2132 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -3.0, -2.0)) != target) { gradient += 0.2132 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 3.0, -2.0)) != target) { gradient += 0.2132 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -3.0, -2.0)) != target) { gradient += 0.2132 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 3.0, -2.0)) != target) { gradient += 0.2132 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -2.0, -3.0)) != target) { gradient += 0.2132 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 2.0, -3.0)) != target) { gradient += 0.2132 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, -3.0, -3.0)) != target) { gradient += 0.2132 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-2.0, 3.0, -3.0)) != target) { gradient += 0.2132 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, -3.0, -3.0)) != target) { gradient += 0.2132 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(2.0, 3.0, -3.0)) != target) { gradient += 0.2132 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -2.0, -3.0)) != target) { gradient += 0.2132 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 2.0, -3.0)) != target) { gradient += 0.2132 * vec3(1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -3.0, 3.0)) != target) { gradient += 0.1925 * vec3(-1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 3.0, 3.0)) != target) { gradient += 0.1925 * vec3(-1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -3.0, 3.0)) != target) { gradient += 0.1925 * vec3(1.0, -1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 3.0, 3.0)) != target) { gradient += 0.1925 * vec3(1.0, 1.0, 1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, -3.0, -3.0)) != target) { gradient += 0.1925 * vec3(-1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(-3.0, 3.0, -3.0)) != target) { gradient += 0.1925 * vec3(-1.0, 1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, -3.0, -3.0)) != target) { gradient += 0.1925 * vec3(1.0, -1.0, -1.0); }
  if (getSegID(texCoord + stepsize * vec3(3.0, 3.0, -3.0)) != target) { gradient += 0.1925 * vec3(1.0, 1.0, -1.0); }
  */

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
  return max(0.5 / 256.0, 0.5 / 256.0 * screenDist * tan(0.5*fovy));
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

void main() {
  glFragColor = ZERO4;

  vec3 pos = frontPos;
  vec3 dir = normalize(rayDir);

  // Calculate multipliers 't' (pos + t * dir) for entry and exit points, stored in rayStartStop.x and rayStartStop.y
  vec2 rayStartStop = iRayBox(pos, dir);

  // Make sure we don't start behind the camera (negative t)
  rayStartStop.x = max(0.0, rayStartStop.x) + 0.0001;
  pos += rayStartStop.x * dir;

  // Terminate if ray never entered the box
  if (isInsideBox(pos, vec3(0.0), vec3(1.0)) == false) {
    return;
  }

  uint segID = uint(0);
  uint visibleSegID = uint(0);
  vec3 visiblePos = frontPos;

  // TODO: Set better light(s)
  vec3 lightDir = normalize(-dir + cross(dir, vec3(0.0, 1.0, 0.0)));
  vec4 color = ZERO4;

  while (true) {
    segID = getSegID(pos);
    float curStepsize = calcStepsize(distance(pos, frontPos));

    if (isVisible(segID)) {
      vec3 normal = normalize(calcGradient(pos, 0.5 / 256.0));
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

      // Break Condition: Hit a visible segment
      break;
    }
    pos += curStepsize * dir;

    // Break Condition: Left the dataset bounding box
    if (isInsideBox(pos, vec3(0.0), vec3(1.0)) == false) {
      break;
    }
  }

  glFragColor = color;
  glFragSegID = visibleSegID;
  glFragDepth = vec4(distance(visiblePos, frontPos));

}
