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
uniform vec3 u_toSun;
uniform float u_near;
uniform float u_far;
uniform float u_a;
uniform float u_b;
uniform mat4 u_worldViewProjection;
uniform mat4 u_inverseWorldViewProjection;
uniform mat4 u_raycastProjection;

uniform vec3 u_citySize;
uniform float u_blockSize;

const float c_bias = .04;
const vec2 c_attenuation = vec2(1.);
const float c_sampleRadius = .05;

//uniform sampler2D u_color;
uniform sampler2D u_normal;
uniform sampler2D u_depth;
//uniform sampler2D u_position;

in vec2 v_texCoord;

out vec4 outColor;

float rand(vec2 co){
    return fract(sin(dot(co ,vec2(12.9898,78.233))) * 43758.5453);
}

vec3 normalAt(vec2 at){
  return normalize(texture(u_normal, at).xyz*2. - 1.);
}

float shinyAt(vec2 at){
  return texture(u_normal, at).a;
}

vec3 positionAt(vec2 at){
  //return texture(u_position, at).xyz;

  vec4 depth = texture(u_depth, at);
  vec4 p1 = vec4(at*2. - 1., depth.r*2. -1., 1.);
  vec4 p2 = u_inverseWorldViewProjection * p1;
  vec4 position = p2 / p2.w;
  return position.xyz;
}

float depthAt(vec2 coord){
  //return texture(u_color, v_texCoord).a;
  //return texture(u_depth, coord).r;
  //return 1. - u_b / (texture(u_depth, coord).r - u_a) * 2.;
  float fd = texture(u_depth, coord).r * 2. - 1.;
  return 1. - u_b / (fd - u_a);
}

float getOcclusionPoint(vec3 position, vec3 normal, vec2 occluderXY) {
    vec3 occluderPosition = positionAt(occluderXY);
    vec3 positionVec = occluderPosition - position;
    float intensity = max(dot(normal, normalize(positionVec)) - c_bias, 0.0);

    float attenuation = 1.0 / (c_attenuation.x + c_attenuation.y * length(positionVec));
    return intensity * attenuation;
}

float getTotalOcclusion(vec3 position, vec3 normal){
  float occlusion = 0.0;
  
  float depth = (depthAt(v_texCoord) - u_near) / (u_far - u_near);

  float kernelRadius = c_sampleRadius * (1.0 - depth);
  vec2 rand = normalize(vec2(rand(position.xy), rand(position.xy*3.141)));

  for (int i = 0; i < 4; ++i) {
      vec2 k1 = reflect(kernel[i], rand);
      vec2 k2 = vec2(k1.x * SIN45 - k1.y * SIN45, k1.x * SIN45 + k1.y * SIN45);
      k1 *= kernelRadius;
      k2 *= kernelRadius;
      occlusion += getOcclusionPoint(position, normal, v_texCoord + k1);
      occlusion += getOcclusionPoint(position, normal, v_texCoord + k2 * 0.75);
      occlusion += getOcclusionPoint(position, normal, v_texCoord + k1 * .5);
      occlusion += getOcclusionPoint(position, normal, v_texCoord + k2 * 0.25);
  }
  occlusion = clamp(occlusion / 8.0, 0.0, 1.0);  
  return occlusion;
}


vec3 skyColor(vec3 ray){
  vec3 color = (ray + 1.) * (dot(ray, u_toSun)>0.999?10.:1.);
  float aVer = degrees(atan(ray.x, ray.y));
  float aHor = degrees(atan(ray.z, length(ray.xy)));
  color *= mod(aVer, 10.) < 0.1?1.5:1.;
  color *= mod(aHor, 10.) < 0.1?1.5:1.;
  color *= mod(aVer, 5.) < 0.1?1.5:1.;
  color *= mod(aHor, 5.) < 0.1?1.5:1.;
  color *= mod(aVer, .5) < 0.05?1.5:1.;
  color *= mod(aHor, .5) < 0.05?1.5:1.;
  return color;
}

vec3 fogColor(vec3 ray){
  return vec3(0.);
  /*float aVer = degrees(atan(ray.x, ray.y));
  float aHor = degrees(atan(ray.z, length(ray.xy)));
  return vec3(mod(aVer, .5) < 0.03 || mod(aHor, .5) < 0.03?.5:0.);*/
}

void main() {

  vec4 screenPos = vec4(v_texCoord.x * 2. - 1., v_texCoord.y * 2. - 1., 0., 1.);
  vec3 ray = normalize((u_raycastProjection * screenPos).xyz);  

  vec2 scale = 1. / u_bufferSize;

  //vec4 diffuseColor = texture(u_color, v_texCoord);
  
  //diffuseColor.xyz += vec3(depth / 1000.);

  vec3 normal = normalAt(v_texCoord);
  float depth = depthAt(v_texCoord);

  //diffuseColor = vec4(normal * 2. + 1., 1.);
  //normal = vec3(0.);

  //vec4 light = vec4(1.);

  vec3 position = positionAt(v_texCoord);

  float shiny = shinyAt(v_texCoord);
  vec4 litColor = vec4(vec3(shiny), 1.);

  for(int i=0;i<4;i+=2){
    vec2 at = v_texCoord + kernel[i] / u_bufferSize[i/2] * max(2., (900. / (300. + depth)));
    float d = abs(depth - depthAt(at));
    //float dn = length(normal - normalAt(at));
    if(d > 20. /*|| dn > 0.1*/){
      //litColor *= 10.;
      //litColor.xyz *= .2;
      //litColor.xyz = vec3(10. - depth / 50.);
      litColor.xyz = vec3(10.); 
      break;
    }
  }


  litColor.xyz *= 1. - depth / 1500.;

  //float depth = (depthAt(v_texCoord) - 0.996) * 100.;
  //litColor.rgb *= depthAt(v_texCoord) / 5000.;

  /*float occlusion = getTotalOcclusion(position, normal);
  litColor -= occlusion * 10.;*/

  //litColor.xyz = normal + 1.;

  outColor = litColor;

  //outColor = vec4(vec3(position.z / 1000.), 1.);

  /*vec3 bounds = u_blockSize * u_citySize * 0.8;
  vec3 boundDepth3 = abs(ray * depth / bounds * 1.2);
  float boundDepth = min(max(max(boundDepth3.x, boundDepth3.y), boundDepth3.z), 1.);*/

  //float skyFog = (boundDepth<0.8)?0.:(boundDepth - 0.8) * 5.;

  //float skyFog = (boundDepth<0.8)?0.:(boundDepth - 0.8) * 5.;

  //outColor.xyz = outColor.xyz * (1. - skyFog) + fogColor(ray) * skyFog;

  //outColor = diffuseColor;

  //bool front = dot(normal, surfaceToView) > 0.2;
  /*bool edge = false;

  edge = dot(normal, surfaceToView) < 0.001;

  if(edge){
    litColor = vec4(litColor.xyz * .0, 1.);
  }*/

  //litColor = vec4(normal, 1.);

}

  //vec3 surfaceToLight = normalize(u_light[0].pos/* - position*/);

  /*vec3 surfaceToLight = u_toSun;
  vec3 surfaceToView = normalize(u_eye - position);
  vec3 halfVector = normalize(surfaceToLight + surfaceToView);
  
  float l = 0.5 * (dot(normal, surfaceToLight) + 1.);
  float h = 0.5 * (dot(normal, halfVector) + 1.);*/

  //bool black = length(diffuseColor.rgb)==0.;

  
  /*if((diffuseColor.rgb) != vec3(0.)){
    color = 
      u_light[0].color.xyz * (
        diffuseColor.rgb * max(l, 0.) * u_light[0].color.a + 
        diffuseColor.rgb * u_ambient.xyz * u_ambient.a  
      );
  }

  if(shiny>0.){
    //color = u_specular.rgb * (l > 0. ? pow(max(0., h), u_shininess) : 0.) * u_specular.a;
    color += skyColor(reflect(-surfaceToView, normal)) * (l > 0. ? pow(max(0., h), u_shininess) : 0.) * u_specular.a * shiny;
  }*/

