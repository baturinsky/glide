import { canvas, prepareRender } from "./render";
import Keyboard from "./Keyboard";
import { m4, v3 } from "./twgl/twgl-full";
import { Vec3 } from "./twgl/v3";
import zzfxInit from "./zzfx";
import { V2 } from "./v2";

let volume = 1;

let sfxDefs = {
  playerExplode: [10,.1,0,.8,.05,.7,4.6,21.2,.4],
  explode: [30,.1,1811,.8,.01,1.9,3,.5,.04],
  powerup: [10,.1,240,.2,.85,5.7,.8,0,.77],
  shieldDest: [10,.1,1750,.7,.05,.1,1.8,.3,.18],
  blast: [10,.1,5000,1.7,.01,0,4,0,.45],

  ponk:[.5, .1, 1549, .1, 0, 0, 1.2, 48.9, .17],
  
  //UNUSED BUT COOL
  boom: [10,.1,3000,1.5,.01,0,4,0,.48],		
  rumble: [10,.1,200,.7,.1,0,5,.1,.36],
  sad: [10,.1,264,1.1,.53,0,0,.1,.94],
  vwom: [10,.1,1,1,.11,0,0,69.2,.95],
  pop: [10,.1,21,.1,.46,9,.1,5.7,.12],
  swipe: [10,.1,866,.1,.5,0,1.6,.4,.98],
  ow: [10,.1,1682,.2,.66,3,0,1.2,.69],
  wave: [10,.1,1825,1,.2,0,5,.2,.3],
  bobbleUp: [1,.1,17,1,.26,.2,.1,8,.66],
};

let zzfx:Function;

function sfx(def:string){
  if(!zzfx)
    zzfx = zzfxInit();
  zzfx(sfxDefs[def][0] * volume, ...sfxDefs[def].slice(1))
}

type Memory = {
  pos: Vec3;
  time: number;
  orb: number;
  vel: number;
  rot: [number, number];
};

let rad = Math.PI / 180;

let pos: Vec3;
let vel: number;
let rot: V2
let mouseDelta: V2;
let smoothRot: V2;
let time = 0;
let collected = new Uint8Array(1000);
let collectedAmount = 0;
let history: Memory[] = [];
const initialPos = [600, 300, 250];
const initialVel = 30;
const acc = 300;
const heightToSpeed = 0.3;
const drag = 0.03;
const orbSpeedBonus = 10;
const minimumVelocity = 10;
const accPerClick = 30;
const slowPerClick = 30;
const orbsToCollect = 100;

function active() {
  return document.pointerLockElement == canvas && !won();
}

function won() {
  return collectedAmount >= orbsToCollect;
}

function eject() {
  collectedAmount = Math.max(0, collectedAmount - 5);
  if (collectedAmount == 0) time = 0;
  pos[2] = 300;
  vel = initialVel;
}

function crash() {
  console.log("crash");
  sfx("bobbleUp");
  //rewind();
  eject();
}

function remember(orb = -1) {
  history.push({ pos, time, orb, vel, rot });
}

function collect(orb: number) {
  if (collected[orb]) return;
  sfx("ponk");
  collectedAmount++;
  vel += orbSpeedBonus;
  if (orb >= 0) collected[orb] = 1;
  history.push({ pos, time, orb, vel, rot });
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

function rewind(steps = -1) {
  if (steps < 0) steps = penaltySteps;
  let memoriesRemained = Math.max(1, history.length - penaltySteps);
  history = history.slice(0, memoriesRemained);
  let lastMemory = history[history.length - 1];
  collected = new Uint8Array(1000);
  collectedAmount = 0;

  for (let m of history) {
    if (m.orb >= 0) {
      collectedAmount++;
    }
    collected[m.orb] = 1;
  }
  pos = lastMemory.pos;
  time = lastMemory.time;
  vel = lastMemory.vel;
  rot = lastMemory.rot;
  smoothRot = rot.slice() as [number, number];
  mouseDelta = [0,0];
}

window.onload = async e => {
  let renderHQ = await prepareRender(crash, collect, collected, 1);
  let renderLQ = await prepareRender(crash, collect, collected, 0.5);

  let render = renderHQ;

  let statsDiv = document.getElementById("stats");
  let orbsDiv = document.getElementById("orbs");
  let pauseDiv = document.getElementById("pause");
  let winDiv = document.getElementById("win");

  //canvas.requestPointerLock();
  const keyboard = new Keyboard(document);

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.code == "Space") {
      if (!active()) canvas.requestPointerLock();
      else document.exitPointerLock();
    }

    if (e.code == "KeyR") {
      rewind(1e6);
      return;
    }

    if (e.code == "KeyQ") {
      render = render==renderHQ?renderLQ:renderHQ;
      return;
    }

  });

  canvas.addEventListener("mousedown", e => {
    if (!active()) canvas.requestPointerLock();
    else {
      if (e.button == 0 && collectedAmount > 0) {
        collectedAmount--;
        vel += accPerClick;
      }
      if (e.button == 2) {
        vel = Math.max(vel - slowPerClick, minimumVelocity * 2);
      }
    }
  });

  canvas.addEventListener("mousemove", (e: MouseEvent) => {
    mouseDelta[0] = e.movementX;
    mouseDelta[1] = e.movementY;
  });

  let lastTime = 0;

  vel = initialVel;
  pos = initialPos;
  rot = [0, 0];
  smoothRot = [0, 0];
  mouseDelta = [0, 0];
  let dir: Vec3 = [1, 0, 0];

  remember();
  //rewind();

  let loops = 0;

  function loop(frameTime: number) {
    pauseDiv.style.visibility = !active() && !won() ? "visible" : "hidden";

    winDiv.style.visibility = won() ? "visible" : "hidden";
    if (won()) {
      winDiv.innerHTML = `<h2>Congaturaleishuns!</h2> You have collected <b>${collectedAmount}</b> orbs in <b>${Math.floor(
        time
      )} seconds!</b><br/><br/> Press <b>R</b> to restart.`;
      return;
    }

    if (!active() && loops > 0) {
      window.requestAnimationFrame(loop);
      return;
    }

    let dTime = (frameTime - lastTime) / 1000;

    if (dTime > 0.1) dTime = 0.1;

    lastTime = frameTime;

    time += dTime;

    mouseDelta = mouseDelta.map(d => Math.sign(d) * Math.min(30, Math.abs(d) * dTime * 60)) as V2;
    
    rot[0] = rot[0] - mouseDelta[0] * 0.1;
    rot[1] = Math.max(-90, Math.min(90, rot[1] - mouseDelta[1] * 0.1));

    //lastRot = [0,0];

    let turn = Math.min(1, dTime * 30)

    smoothRot = smoothRot.map((prevSmooth, i) => prevSmooth * (1 - turn) + rot[i] * turn ) as V2;

    //smoothRot = rot.slice() as V2;

    /*console.log("-");
    console.log(...mouseDelta);
    console.log(...rot);*/

    let [yaw,pitch] = smoothRot.map(v => v * rad);

    dir = v3.normalize([
      Math.cos(pitch) * Math.cos(yaw),
      Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch)
    ]);

    mouseDelta = [0,0];

    if (keyboard.pressed["KeyO"]) {
      vel += acc * dTime;
    }

    if (keyboard.pressed["KeyL"]) {
      vel = Math.max(0, vel - acc * dTime);
    }

    vel *= 1 - drag * dTime;

    if (vel <= minimumVelocity) {
      let drop = minimumVelocity - vel / 100;
      pos[2] -= drop * heightToSpeed;
      vel += drop;
    }

    let delta = v3.mulScalar(dir, vel * dTime);
    vel -= delta[2] * heightToSpeed;
    pos = v3.add(pos, delta);
    statsDiv.innerText = `Time: ${Math.floor(time)} Position: ${pos
      .map(n => Math.round(n))
      .join(",")} Velocity: ${Math.floor(vel)}`;
    orbsDiv.innerText = `Orbs: ${collectedAmount}/${orbsToCollect}`;
    render(time, pos, dir);
    loops++;
    window.requestAnimationFrame(loop);
  }

  window.requestAnimationFrame(loop);
};
