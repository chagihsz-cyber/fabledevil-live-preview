/* Motoquinha Arcade: original puzzle mechanics built on MIT FableDevil.
   Trap contract: update(dt,g), solids(), kills(), draw(). */
"use strict";

class ChaosRoom {
  constructor(x, width, type, opts={}) {
    this.x=x;this.width=width;this.type=type;
    this.y=opts.y??65;this.h=opts.h??415;
    this.label=opts.label??(type==="gravity"?"GRAVIDADE ↑":"CONTROLES ↔");
  }
  reset() {}
  update(_dt,g) {
    for(const p of gameActors(g)){
      const inside=p.x+p.w/2>this.x && p.x+p.w/2<this.x+this.width &&
        p.y+p.h>this.y && p.y<this.y+this.h;
      if(!inside)continue;
      if(p!==g.player){p.chaosRoom=this;continue;}
      if(this.type==="gravity") g.gravityDir=-1;
      if(this.type==="mirror") g.invertControls=true;
      if(this.type==="chaos") {
        g.invertControls=true;g.gravityDir=-1;
        // Belts in this room run backward too.
        g.flags.invertElements=true;
      }
    }
  }
  solids(){return []}
  kills(){return []}
  draw(){
    ctx.save();
    ctx.fillStyle=this.type==="gravity"?"rgba(97,192,240,0.10)":"rgba(242,177,83,0.12)";
    ctx.fillRect(this.x,this.y,this.width,this.h);
    ctx.setLineDash([8,8]);ctx.lineWidth=2;ctx.strokeStyle=theme.accent;
    ctx.strokeRect(this.x,this.y,this.width,this.h);
    ctx.setLineDash([]);
    ctx.font="800 13px "+FONT;ctx.textAlign="center";ctx.fillStyle=theme.accent;
    ctx.fillText(this.label,this.x+this.width/2,this.y+20);
    ctx.restore();
  }
}
class PushCrate {
  constructor(x,y=441,w=42,h=39){
    this.x=x;this.y=y;this.w=w;this.h=h;
    this.rect=R(x,y,w,h);
    this.rect.pushable=true;
    this.rect.tryPush=(dx,solids)=>this.push(dx,solids);
  }
  reset(){}
  update(dt,g){
    // Lightweight gravity for the box, independent from the player's switch.
    const solids=g.level.solids;
    const underneath=solids.some(s=>
      this.x+this.w>s.x+2&&this.x<s.x+s.w-2&&
      Math.abs(this.y+this.h-s.y)<=3);
    if(!underneath) {
      const fall=Math.min(240*dt,12);
      const landing=solids.filter(s=>s.y>=this.y+this.h&&
        this.x+this.w>s.x&&this.x<s.x+s.w)
        .sort((a,b)=>a.y-b.y)[0];
      this.y=landing?Math.min(this.y+fall,landing.y-this.h):this.y+fall;
      this.rect.y=this.y;
    }
  }
  push(dx,solids){
    if(!Number.isFinite(dx)||Math.abs(dx)<0.05)return false;
    const nx=this.x+dx;
    const after=R(nx,this.y,this.w,this.h);
    for(const s of solids) {
      if(s===this.rect)continue;
      if(aabb(after,s)) return false;
    }
    if(nx<8)return false;
    this.x=nx;this.rect.x=nx;
    return true;
  }
  solids(){return [this.rect]}
  kills(){return []}
  draw(){
    ctx.save();
    ctx.fillStyle="#ad8452";roundRect(this.x,this.y,this.w,this.h,4);ctx.fill();
    ctx.strokeStyle="#e9c998";ctx.lineWidth=3;ctx.strokeRect(this.x+5,this.y+5,this.w-10,this.h-10);
    ctx.beginPath();ctx.moveTo(this.x+7,this.y+7);ctx.lineTo(this.x+this.w-7,this.y+this.h-7);
    ctx.moveTo(this.x+this.w-7,this.y+7);ctx.lineTo(this.x+7,this.y+this.h-7);ctx.stroke();
    ctx.restore();
  }
}
class PressureBridge {
  constructor(x,y,width,plateX,opts={}){
    this.x=x;this.y=y;this.w=width;this.plateX=plateX;
    this.plateW=opts.plateW??58;
    this.extended=false;this.progress=0;
    this.rect=R(x,y,0,16);
  }
  reset(){this.extended=false;this.progress=0}
  update(dt,g){
    const box=g.level.traps.find(t=>t instanceof PushCrate&&
      t.x+t.w>this.plateX&&t.x<this.plateX+this.plateW&&
      Math.abs(t.y+t.h-480)<8);
    if(box)this.extended=true;
    // Starts retracting only on reset: puzzle cannot become impossible after activation.
    this.progress=clamp(this.progress+(this.extended?2.4:-2.4)*dt,0,1);
    this.rect.w=this.w*this.progress;
  }
  solids(){return this.progress>.02?[this.rect]:[]}
  kills(){return []}
  draw(){
    ctx.save();
    ctx.fillStyle=this.extended?theme.accent:theme.danger;
    roundRect(this.plateX,478,this.plateW,8,3);ctx.fill();
    ctx.fillStyle=theme.ink;ctx.fillRect(this.x,this.y,this.w*this.progress,16);
    ctx.strokeStyle=theme.accent;ctx.strokeRect(this.x,this.y,this.w*this.progress,16);
    ctx.restore();
  }
}
class MorphPad {
  constructor(x,kind='slim',opts={}){
    this.x=x;this.kind=kind;this.y=opts.y??473;
    this.w=opts.w??52;this.activated=false;
    this.duration=opts.duration??7;
    this.triggered=new WeakSet();
  }
  reset(){this.activated=false;this.triggered=new WeakSet()}
  update(_dt,g){
    for(const p of gameActors(g)){
      if(!this.triggered.has(p)&&aabb(p,R(this.x,this.y-11,this.w,20))){
        this.activated=true;this.triggered.add(p);
        p.morph={kind:this.kind,expires:g.time+this.duration};
        if(p===g.player)g.morph=p.morph;
        AudioFX.beep();
      }
      const morph=p.morph;
      if(morph&&morph.kind===this.kind&&g.time<morph.expires) {
        const height=this.kind==='slim'?17:this.kind==='tall'?54:32;
        const width=this.kind==='wide'?49:this.kind==='slim'?20:26;
        if(p.h!==height){p.y+=p.h-height;p.h=height;}
        p.w=width;
      } else if(morph&&morph.kind===this.kind&&g.time>=morph.expires) {
        const desired=R(p.x,p.y+p.h-32,26,32);
        if(!g.collectSolids().some(s=>aabb(desired,s))) {
          p.y+=p.h-32;p.h=32;p.w=26;p.morph=null;
          if(p===g.player)g.morph=null;
        }
      }
    }
  }
  solids(){return []}
  kills(){return []}
  draw(){
    ctx.save();
    ctx.fillStyle=this.activated?"#4d665d":"#e7bd70";
    roundRect(this.x,this.y,this.w,9,5);ctx.fill();
    ctx.fillStyle=theme.paper;ctx.font="bold 14px "+FONT;ctx.textAlign="center";
    ctx.fillText(this.kind==='slim'?'⇣':this.kind==='tall'?'⇡':'⇔',
      this.x+this.w/2,this.y-6);
    ctx.restore();
  }
}
class StretchBridge {
  constructor(x,y,w,padX){
    this.x=x;this.y=y;this.w=w;this.padX=padX;this.progress=0;
    this.rect=R(x,y,0,17);this.latched=false;
  }
  reset(){this.progress=0;this.latched=false}
  update(dt,g){
    if(gameActors(g).some(p=>aabb(p,R(this.padX,466,48,16))))this.latched=true;
    this.progress=clamp(this.progress+(this.latched?2:-2)*dt,0,1);
    this.rect.w=this.w*this.progress;
  }
  solids(){return this.rect.w>1?[this.rect]:[]}
  kills(){return []}
  draw(){
    ctx.fillStyle=this.latched?theme.accent:theme.metal;
    roundRect(this.padX,474,48,7,3);ctx.fill();
    ctx.fillStyle=theme.ink;roundRect(this.x,this.y,this.rect.w,17,3);ctx.fill();
  }
}
class SawPlatform {
  constructor(x,y,w=86){
    this.x=x;this.y=y;this.w=w;this.h=16;this.t=0;
    this.rect=R(x,y,w,16);
  }
  reset(){this.t=0}
  update(dt){this.t+=dt*9}
  solids(){return [this.rect]}
  kills(){return []}
  draw(){
    ctx.save();ctx.translate(this.x+this.w/2,this.y+8);
    ctx.fillStyle=theme.ink;roundRect(-this.w/2,-8,this.w,16,6);ctx.fill();
    for(let x=-this.w/2+14;x<this.w/2-8;x+=21) {
      ctx.save();ctx.translate(x,0);ctx.rotate(this.t);
      ctx.strokeStyle=theme.accent;ctx.lineWidth=3;
      ctx.beginPath();for(let n=0;n<=8;n++){
        const angle=n*Math.PI/4,rad=n%2?6:10;
        const xx=Math.cos(angle)*rad,yy=Math.sin(angle)*rad;
        if(n===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
      }ctx.stroke();ctx.restore();
    }
    ctx.restore();
  }
}
class PhantomFloor {
  constructor(x,y,w=115,opts={}){
    this.rect=R(x,y,w,16);this.x=x;this.y=y;this.w=w;
    this.fade=0;this.trigger=opts.trigger??x-90;
  }
  reset(){this.fade=0}
  update(dt,g){
    if(gameActors(g).some(p=>p.x>this.trigger))this.fade=clamp(this.fade+dt*4.8,0,1);
  }
  solids(){return this.fade<.42?[this.rect]:[]}
  kills(){return []}
  draw(){
    ctx.save();ctx.globalAlpha=1-this.fade*.87;
    ctx.fillStyle=theme.ink;roundRect(this.x,this.y,this.w,16,5);ctx.fill();
    ctx.restore();
  }
}
class DecoyDoor {
  constructor(x,y,action='kill',destX=100){
    this.x=x;this.y=y;this.w=38;this.h=64;this.action=action;
    this.destX=destX;this.cool=0;this.armed=false;
  }
  reset(){this.cool=0;this.armed=false}
  update(dt,g){
    this.cool=Math.max(0,this.cool-dt);
    if(this.cool>0)return;
    if(aabb(g.player,R(this.x,this.y,this.w,this.h))) {
      this.armed=true;
      if(this.action==='teleport') {
        g.player.x=this.destX;g.player.y=440;
        g.player.vx=0;g.player.vy=0;
        this.cool=.9;AudioFX.poof();
      }else this.cool=.2;
    }
  }
  solids(){return []}
  kills(){return this.action==='kill'&&this.armed?
    [R(this.x,this.y,this.w,this.h)]:[]}
  draw(){
    drawDoorShape(this.x,this.y,this.w,this.h);
    if(this.armed) {
      ctx.fillStyle=theme.danger;ctx.font="bold 15px "+FONT;
      ctx.fillText(this.action==='kill'?'✕':'↶',this.x+11,this.y-5);
    }
  }
}


// Indicador não intrusivo: evita que o jogador confunda os controles invertidos com bug.
const baseMotocaUpdatePlay=Game.updatePlay;
Game.updatePlay=function(dt) {
  baseMotocaUpdatePlay.call(this,dt);
  const effect=document.getElementById("arcade-effect");
  if(!effect)return;
  let label="";
  if(this.gravityDir<0&&this.invertControls)label="↕ GRAVIDADE + CONTROLES INVERTIDOS";
  else if(this.gravityDir<0)label="↑ GRAVIDADE INVERTIDA";
  else if(this.invertControls)label="↔ CONTROLES INVERTIDOS";
  else if(this.morph&&this.time<this.morph.expires) {
    label=this.morph.kind==="slim"?"⇣ MODO PEQUENO":
      this.morph.kind==="tall"?"⇡ MODO ESTICADO":"⇔ MODO LARGO";
  }
  effect.textContent=label;
  effect.classList.toggle("hidden",!label);
};

/** Fog chamber; actual visibility is rendered AFTER the player and platforms. */
class DarknessZone {
  constructor(x,w,opts={}) {
    this.x=x;this.w=w;this.y=opts.y??75;this.h=opts.h??405;
    this.visibility=opts.visibility??97;
  }
  reset(){}
  update(_dt,g) {
    const p=g.player;
    const inRoom=p.x+p.w/2>=this.x&&p.x+p.w/2<=this.x+this.w
      &&p.y+p.h>=this.y&&p.y<=this.y+this.h;
    if(inRoom)g.darknessActive=true;
  }
  solids(){return []}
  kills(){return []}
  draw() {
    ctx.save();ctx.fillStyle="rgba(25,34,48,.13)";
    ctx.fillRect(this.x,this.y,this.w,this.h);
    ctx.strokeStyle=theme.accent;ctx.setLineDash([5,9]);
    ctx.strokeRect(this.x,this.y,this.w,this.h);
    ctx.restore();
  }
}
