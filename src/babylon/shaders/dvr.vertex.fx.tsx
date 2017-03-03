const vertexShader: string = `
precision highp float;

uniform mat4 view;
uniform mat4 worldViewProjection;
uniform vec3 distortionCorrection;

in vec2 uv;
out vec3 frontPos;
out vec3 rayDir;

vec3 unproj(vec3 ndc) {
    vec4 pos = inverse(worldViewProjection) * vec4(ndc, 1.0);
    return pos.xyz / pos.w;
}

void main() {
    vec2 ndcXY = 2.0 * uv - 1.0; // [-1..1]

    rayDir = normalize(unproj(vec3(ndcXY, 1.0)) - unproj(vec3(ndcXY, -1.0)));
    rayDir *= distortionCorrection;

    frontPos = 0.5 * unproj(vec3(view[3][0], view[3][1], 0.0)); // not sure, 0.5 makes it the same size as in the
                                                                // Two-Pass Render Version (our reference)
    frontPos *= distortionCorrection;                           // fixes distortion caused by dataset and voxel size
    frontPos += 0.5;                                            // camera rotation around center of cube

    // Scale the billboard plane to exactly cover the screen [-1, 1]
    gl_Position = vec4(ndcXY, 0.0, 1.0);
}`;
export default vertexShader;
