import { render, canvas, prepareRender } from "./render";
import Keyboard from "./Keyboard";
import { m4, v3 } from "./twgl/twgl-full";
import { Vec3 } from "./twgl/v3";

type Memory ={
  pos: Vec3
  time: number
  orb: number
  vel: number
  rot: [number, number]
};

let rad = Math.PI / 180;

let pos: Vec3;
let vel: number;
let rot: [number, number];
let time = 0;
let collected = new Uint8Array(1000);
let collectedAmount = 0;
let history:Memory[] = [];
const initialPos = [600, 300, 250];
const initialVel = 30;
const acc = 300;
const heightToSpeed = 0.3;
const drag = 0.03;
const orbSpeedBonus = 10;
const minimumVelocity = 10;
const accPerClick = 30;
const slowPerClick = 30;

function active(){
  return document.pointerLockElement == canvas;
}

function eject(){
  collectedAmount = Math.max(0, collectedAmount - 5);
  if(collectedAmount == 0)
    time = 0;
  pos[2] = 300;
  vel = initialVel;
}

function crash() {
  console.log("crash");
  //rewind();
  eject();
}

function remember(orb = -1){
  history.push({pos, time, orb, vel, rot})
}

function collect(orb:number) {
  if(collected[orb])  
    return;
  collectedAmount ++;
  vel += orbSpeedBonus;
  if(orb >=0)
    collected[orb] = 1;
  history.push({pos, time, orb, vel, rot})
}

function fract(n) {
  return n - Math.floor(n);
}

function hash(p: [number, number]) {
  return fract(
    1e4 *
      Math.sin(17.0 * p[0] + p[1] * 0.1) *
      (0.1 + Math.abs(Math.sin(p[1] * 13.0 + p[0])))
  );
}

const penaltySteps = 3;

function rewind(steps=-1){
  if(steps<0)
    steps = penaltySteps;
  let memoriesRemained = Math.max(1, history.length - penaltySteps);
  history = history.slice(0, memoriesRemained);
  let lastMemory = history[history.length - 1];
  collected = new Uint8Array(1000);
  collectedAmount = 0;

  for(let m of history){
    if(m.orb>=0){
      collectedAmount ++;
    }
    collected[m.orb] = 1;
  }
  pos = lastMemory.pos;
  time = lastMemory.time;
  vel = lastMemory.vel;
  rot = lastMemory.rot;
}

window.onload = async e => {
  await prepareRender(crash, collect, collected);

  let debugDiv = document.getElementById("debug");
  canvas.requestPointerLock();
  const keyboard = new Keyboard(document);

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.code == "Space") {
      if(!active())
        canvas.requestPointerLock();
      else
        document.exitPointerLock();
    }
  });

  canvas.addEventListener("mousedown", e => {
    if (!active()) canvas.requestPointerLock();
    else {
      if(e.button == 0 && collectedAmount >0){
        collectedAmount--;
        vel += accPerClick;
      }
      if(e.button == 2){
        vel = Math.max(vel - slowPerClick, minimumVelocity * 2);
      }      
    }
  });

  canvas.addEventListener("mousemove", (e: MouseEvent) => {
    rot[0] += e.movementX;
    rot[1] += e.movementY;
  });

  let lastTime = 0;

  vel = initialVel;
  pos = initialPos;
  rot = [0, 0];
  let pitch = 0;
  let yaw = 0;
  let dir: Vec3 = [1, 0, 0];

  remember();
  //rewind();

  function loop(frameTime: number) {
    console.log(active());
    
    if(!active()){
      window.requestAnimationFrame(loop);
      return;
    }

    const dTime = (frameTime - lastTime) / 1000;
    lastTime = frameTime;

    time += dTime;

    rot = rot.map(d => Math.sign(d) * Math.min(30, Math.abs(d))) as [number, number];
    yaw = (yaw - rot[0] * 0.1 + 360) % 360;
    pitch = Math.max(-90, Math.min(90, pitch - rot[1] * 0.1));

    dir = v3.normalize([
      Math.cos(pitch * rad) * Math.cos(yaw * rad),
      Math.cos(pitch * rad) * Math.sin(yaw * rad),
      Math.sin(pitch * rad)
    ]);

    rot = [0, 0];

    if (keyboard.pressed["KeyO"]) {
      vel += acc * dTime;
    }
    if (keyboard.pressed["KeyL"]) {
      vel = Math.max(0, vel - acc * dTime);
    }

    vel *= ( 1 - drag * dTime);

    if(vel <= minimumVelocity){
      let drop = minimumVelocity - vel / 100;
      pos[2] -= drop * heightToSpeed;      
      vel += drop;
    }

    let delta = v3.mulScalar(dir, vel * dTime);
    vel -= delta[2] * heightToSpeed;
    pos = v3.add(pos, delta);
    debugDiv.innerText = `Position: ${pos.map(n => Math.round(n)).join(",")} Time: ${Math.floor(time)} Velocity: ${Math.floor(vel)} Orbs: ${collectedAmount} `;
    render(time, pos, dir);
    window.requestAnimationFrame(loop);
  }

  window.requestAnimationFrame(loop);
};
