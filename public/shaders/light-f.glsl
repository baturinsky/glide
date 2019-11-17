#version 300 es
precision highp float;

const vec2 kernel[4] = vec2[](vec2(1,0), vec2(-1,0), vec2(0,1), vec2(0,-1));
#define SIN45 0.707107

struct Light{
  vec3 pos;
  vec4 color;
};

uniform Light u_light[1];
uniform vec4 u_ambient;
uniform vec4 u_specular;
uniform float u_shininess;
uniform vec2 u_bufferSize;
uniform vec3 u_eye;
uniform mat4 u_worldViewProjection;
uniform mat4 u_inverseWorldViewProjection;

uniform float u_bias;
uniform vec2 u_attenuation;
uniform vec2 u_depthRange;
uniform float u_sampleRadius;

uniform sampler2D u_color;
uniform sampler2D u_normal;
uniform sampler2D u_depth;

in vec2 v_texCoord;

out vec4 outColor;

float rand(vec2 co){
    return fract(sin(dot(co ,vec2(12.9898,78.233))) * 43758.5453);
}

vec3 normalAt(vec2 at){
  return normalize(texture(u_normal, at).xyz*2. - 1.);
}

vec3 positionAt(vec2 at){
  vec4 depth = texture(u_depth, at);
  vec4 p1 = vec4(at*2. - 1., depth.r*2. -1., 1.);
  vec4 p2 = u_inverseWorldViewProjection * p1;
  vec4 position = p2 / p2.w;
  return position.xyz;
}

float getOcclusionPoint(vec3 position, vec3 normal, vec2 occluderXY) {
    vec3 occluderPosition = positionAt(occluderXY);
    vec3 positionVec = occluderPosition - position;
    float intensity = max(dot(normal, normalize(positionVec)) - u_bias, 0.0);

    float attenuation = 1.0 / (u_attenuation.x + u_attenuation.y * length(positionVec));
    return intensity * attenuation;
}

float depthAt(vec2 coord){
  return texture(u_depth, coord).r;
  //return texture(u_color, v_texCoord).a;
}

float getTotalOcclusion(vec3 position, vec3 normal){
  float occlusion = 0.0;
  
  float depth = texture(u_depth, v_texCoord).r;

  float kernelRadius = u_sampleRadius * (1.0 - depth);

  for (int i = 0; i < 4; ++i) {
      vec2 k1 = reflect(kernel[i], vec2(rand(position.xy), rand(position.xy*3.141)));
      vec2 k2 = vec2(k1.x * SIN45 - k1.y * SIN45, k1.x * SIN45 + k1.y * SIN45);
      k1 *= kernelRadius / u_bufferSize;
      k2 *= kernelRadius / u_bufferSize;
      occlusion += getOcclusionPoint(position, normal, v_texCoord + k1);
      occlusion += getOcclusionPoint(position, normal, v_texCoord + k2 * 0.75);
      occlusion += getOcclusionPoint(position, normal, v_texCoord + k1 * 0.5);
      occlusion += getOcclusionPoint(position, normal, v_texCoord + k2 * 0.25);
  }
  occlusion = clamp(occlusion / 16.0, 0.0, 1.0);  
  return occlusion;
}

void main() {

  vec2 scale = 1. / u_bufferSize;

  float depth = depthAt(v_texCoord);
  vec4 diffuseColor = texture(u_color, v_texCoord);

  diffuseColor.xyz += vec3(depth / 1000.);

  vec3 normal = normalAt(v_texCoord);

  if(length(normal) == 0.){
    outColor = diffuseColor;
  } else {
    vec4 light = vec4(1.);

    vec3 position = positionAt(v_texCoord);

    //vec3 surfaceToLight = normalize(u_light[0].pos/* - position*/);
    vec3 surfaceToLight = vec3(0., 0., 1.);
    vec3 surfaceToView = normalize(u_eye - position);
    vec3 halfVector = normalize(surfaceToLight + surfaceToView);
    
    float l = 0.5 * (dot(normal, surfaceToLight) + 1.);
    float h = 0.5 * (dot(normal, halfVector) + 1.);

    vec4 litColor = vec4(
      (u_light[0].color * (
        diffuseColor * max(l, 0.) + 
        diffuseColor * u_ambient * u_ambient.a + 
        u_specular * (l > 0. ? pow(max(0., h), u_shininess) : 0.) * u_specular.a)
      ).rgb,
      diffuseColor.a);
    outColor = litColor;  
  }

  //bool front = dot(normal, surfaceToView) > 0.2;
  /*bool edge = false;

  edge = dot(normal, surfaceToView) < 0.001;

  if(edge){
    litColor = vec4(litColor.xyz * .0, 1.);
  }*/

  //litColor = vec4(normal, 1.);

  //litColor.xyz = vec3(depth * 2.);

}