export const fragmentShader: string = `
precision highp float;
precision highp usampler3D;

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

    if (mod(float(segID), 20.0) == 1.0)
        return true;

    if (segID > uint(500) && segID < uint(1000)) {
        return true;
    }

    if (segID > uint(13000) && segID < uint(13500)) {
        return true;
    }

    if (segID > uint(23000) && segID < uint(23500)) {
        return true;
    }
    return false;
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

    vec2 rayStartStop = iRayBox(pos, dir);

    rayStartStop.x = max(0.0, rayStartStop.x);

    pos += rayStartStop.x * dir;
    if (isInsideBox(pos, vec3(-0.00001), vec3(1.00001)) == false) {
        return;
    }

    uint segID = uint(0);
    uint visibleSegID = uint(0);
    vec3 visiblePos = frontPos;

    vec3 lightDir = normalize(-dir + cross(dir, vec3(0.0, 1.0, 0.0)));
    vec4 color = ZERO4;

    while (true) {
        segID = getSegID(pos);
        float curStepsize = calcStepsize(distance(pos, frontPos));

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

        if (isInsideBox(pos, vec3(-0.00001), vec3(1.00001)) == false) {
            break;
        }
    }

    glFragColor = color;
    glFragSegID = visibleSegID;
    glFragDepth = vec4(distance(visiblePos, frontPos));

}`;
export default fragmentShader;
