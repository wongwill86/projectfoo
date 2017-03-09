precision highp float;
precision highp usampler2D;
precision highp sampler2D;

in vec2 vUV;
//uniform sampler2D textureSampler;
uniform sampler2D segColorTex;
uniform usampler2D segIDTex;
uniform sampler2D segDepthTex;
uniform usampler2D cacheStateTex;

//out vec4 glFragColor;

void main(void) {

  glFragColor.rgb = vec3(texture(segColorTex, vUV).rgb);
  //glFragColor.rgb = vec3(texture(segIDTex, vUV).r);
  glFragColor.rgb = vec3(texture(segDepthTex, vUV).r) / 10.0;
  glFragColor.rgb = vec3(texture(cacheStateTex, vUV).rgb) ;
  /*
   *glFragColor.rgb = vec3(texture(segDepthTex, vUV).r) / 10.0;
   *glFragColor.rgb = vec3(texture(segIDTex, vUV).r) / 65336.0;
   */

  glFragColor.a = 1.0;
}
