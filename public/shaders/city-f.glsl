#version 300 es
precision highp float;
precision highp int;

uniform float u_time;

in vec2 v_uv;
in vec3 v_position;
flat in float v_cubeID;
flat in int v_side;
flat in int v_flag;
flat in vec4 v_color;
//flat in vec3 v_normal;
flat in vec2 v_windows;
flat in vec2 v_windowSize;
flat in vec2 v_windowMargin;
flat in vec3 v_slot;

vec4 normal;

layout(location=0) out vec4 outNormal;

//layout(location=0) out vec4 outColor;
//layout(location=2) out vec3 outPosition;

const float radToDeg = 90. / 3.141;

float rand(float n){return fract(sin(n) * 43758.5453123);}

float rand2(vec2 n) { 
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

void drawWindows(){

  if(v_windows == vec2(0.))
    return;

  vec2 r = .5 - v_windowMargin;
  vec2 d = abs(v_uv - 0.5);

  if((v_flag & 1) != 0){
    d.y -= v_windowMargin.y;
  }

  bool window = all(lessThan(d, r));

  vec2 wuv;

  if(window){
    wuv = (v_uv - v_windowMargin) / (r * 2.);
    vec2 uv2 = mod(wuv, 1. / v_windows) * v_windows;
    vec2 wr = v_windowSize / 2.;
    vec2 wd = abs(uv2 - 0.5);
    window = v_side>=2 && all(lessThan(wd, wr));
  }

  if(window){
    vec2 windowId = floor(wuv * v_windows);
    bool lit = v_windows == vec2(1.) || fract(rand2(windowId*0.01 + v_cubeID + float(v_side) * 0.13) * (u_time / 1000. + 1.)) > 0.3;
    if(!lit)
      window = false;
  }

  //if(window)
    //normal = normalize(normal + rand2(floor(wuv * v_windows)) * .03);
  /*else
    normal = normalize(normal + rand2(floor(v_uv * 100.))*.1);*/

  //vec3 color = window?(v_color.rgb + vec3(0., 0.3, 0.5)) * 0.04:v_color.rgb*0.5;

  //outColor = vec4(color, v_color.a);
  
  normal.a = window?1.:0.;
}

void main() {
  //if(length(v_uv+vec2(0.5)) > 1.5){
  /*if(sin(v_uv.y * 100.) + sin(v_uv.x * 100.) > .0){
    discard;
    return;
  }*/  

  //normal.xyz = v_normal;

  drawWindows();  

  //drawUV();
  
  //outNormal.xyz = normal.xyz * (gl_FrontFacing?.5:-.5) + .5;  
  //outNormal.a = normal.a;

  outNormal.a = normal.a;

  //outPosition = v_position;
  
  //outColor = vec4(v_uv.xy, 0., 1.);
  
  //gl_FragDepth = 0.99;
}

/*void drawCog(){
  vec2 dc = v_uv - vec2(0.5);
  float a = degrees(atan(dc.x, dc.y));

  outColor = gl_FrontFacing?v_color:v_color.gbra;

  if(length(dc) < (mod(a, 60.)<30.?0.3:0.4)){    
    outColor.xyz = outColor.xyz * 2.;
  } else {
    outColor.xy = v_uv;
  }
}*/

/*void drawUV(){
  outColor = vec4(v_uv, float(v_cubeID) / 1e10, v_color.a);
}*/
