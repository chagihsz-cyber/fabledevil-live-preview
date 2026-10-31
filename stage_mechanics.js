/* Motoquinha Arcade — fresh authored puzzle mechanisms, MIT.
   All traps implement update/solids/kills/draw; no commercial game levels used. */
"use strict";

class DropPortal {
  constructor(x,y,toX,toY,opts={}) {
    this.x=x;this.y=y;this.toX=toX;this.toY=toY;
    this.kind=opts.kind||"drop";this.cool=0;this.activated=false;
  }
  reset(){this.cool=0;this.activated=false}
  update(dt,g){
    this.cool=Math.max(0,this.cool-dt);
    if(this.cool>0||g.state!=="play")return;
    const p=g.player;
    if(aabb(p,R(this.x,this.y,42,64))){
      this.cool=1.15;this.activated=true;
      if(this.kind==="kill"){g.die(p.x+p.w/2,p.y+p.h/2);return;}
      p.x=this.toX;p.y=this.toY;
      p.vx=0;p.vy=this.kind==="launch"?-570:320;
      p.grounded=false;p.coyote=0;
      if(this.kind==="reverse"){g.reverseUntil=g.time+3;}
      AudioFX.poof();
    }
  }
  solids(){return []}
  kills(){return []}
  draw(){
    ctx.save();
    ctx.fillStyle=this.kind==="kill"?theme.danger:"#4c95c8";
    ctx.strokeStyle=this.kind==="kill"?"#fa6553":"#b4e2ff";
    ctx.lineWidth=4;
    ctx.beginPath();ctx.ellipse(this.x+21,this.y+32,20,32,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.globalAlpha=.4;ctx.fillStyle=theme.paper;
    ctx.beginPath();ctx.ellipse(this.x+21,this.y+32,9,19,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}
class GrowthTimer {
  constructor(padX,switchX,opts={}){
    this.padX=padX;this.switchX=switchX;this.switchY=opts.switchY??352;
    this.rate=opts.rate??56;this.maxHeight=opts.maxHeight??125;
    this.started=false;this.off=false;this.done=false;
  }
  reset(){this.started=false;this.off=false;this.done=false}
  update(dt,g){
    const p=g.player;
    if(!this.started&&aabb(p,R(this.padX,463,54,18))){
      this.started=true;AudioFX.beep();
    }
    if(!this.started||this.done)return;
    // High switch can only be hit after growing tall enough.
    if(aabb(p,R(this.switchX,this.switchY,48,20))){
      this.done=true;g.flags.growthOff=true;AudioFX.win();
      // Restoring normal proportions doesn't relocate the player's feet.
      p.y+=p.h-32;p.h=32;p.w=26;return;
    }
    const height=Math.min(this.maxHeight,p.h+this.rate*dt);
    p.y+=p.h-height;p.h=height;
  }
  solids(){return []}
  kills(){return []}
  draw(){
    ctx.save();
    ctx.fillStyle=this.started?theme.danger:theme.accent;
    ctx.fillRect(this.padX,471,54,9);
    ctx.fillStyle=this.done?"#79e6a4":"#e7b77b";
    roundRect(this.switchX,this.switchY,48,17,5);ctx.fill();
    ctx.strokeStyle=theme.accent;ctx.setLineDash([5,5]);
    ctx.strokeRect(this.switchX-6,this.switchY-12,60,42);
    ctx.restore();
  }
}
class SurpriseWall {
  constructor(triggerX,wallX,opts={}){
    this.triggerX=triggerX;this.x=wallX;
    this.w=opts.w??34;this.maxH=opts.height??72;
    this.speed=opts.speed??170;this.drag=opts.drag??0;
    this.h=0;this.armed=false;
    this.rect=R(this.x,480,0,0);
  }
  reset(){this.h=0;this.armed=false}
  update(dt,g){
    const p=g.player;
    if(p.x>=this.triggerX)this.armed=true;
    if(this.armed)this.h=Math.min(this.maxH,this.h+this.speed*dt);
    this.rect.x=this.x;this.rect.y=480-this.h;
    this.rect.w=this.w;this.rect.h=this.h;
    if(this.drag&&this.h>25&&aabb(p,this.rect)){
      p.x+=this.drag*dt;
    }
  }
  solids(){return this.h>2?[this.rect]:[]}
  kills(){return []}
  draw(){
    if(this.h<=1)return;
    ctx.fillStyle=theme.ink;
    ctx.fillRect(this.x,480-this.h,this.w,this.h);
    ctx.fillStyle=theme.accent;
    for(let y=480-this.h;y<480;y+=20)ctx.fillRect(this.x+5,y,this.w-10,3);
  }
}
class ShiftingHole {
  constructor(x0,x1,opts={}){
    this.x0=x0;this.x1=x1;
    this.w=opts.w??88;this.speed=opts.speed??105;
    this.x=opts.start??((x0+x1)/2);this.dir=1;
  }
  reset(){this.dir=1}
  update(dt){
    this.x+=this.dir*this.speed*dt;
    if(this.x>this.x1-this.w){this.x=this.x1-this.w;this.dir=-1;}
    if(this.x<this.x0){this.x=this.x0;this.dir=1;}
  }
  solids(){
    return [R(this.x0,480,Math.max(0,this.x-this.x0),60),
      R(this.x+this.w,480,Math.max(0,this.x1-this.x-this.w),60)];
  }
  kills(){return []}
  draw(){
    ctx.fillStyle=theme.ink;
    for(const s of this.solids())ctx.fillRect(s.x,s.y,s.w,s.h);
    ctx.save();ctx.strokeStyle=theme.danger;ctx.setLineDash([7,7]);
    ctx.strokeRect(this.x,480,this.w,55);ctx.restore();
  }
}
class ReverseButton {
  constructor(x,type="controls",duration=3){
    this.x=x;this.type=type;this.duration=duration;this.cool=0;
  }
  reset(){this.cool=0}
  update(dt,g){
    this.cool=Math.max(0,this.cool-dt);
    if(this.cool<=0&&aabb(g.player,R(this.x,464,49,16))){
      this.cool=2;g.reverseUntil=g.time+this.duration;
      g.reverseType=this.type;AudioFX.beep();
    }
    if(g.reverseUntil&&g.time<g.reverseUntil){
      if(g.reverseType==="gravity")g.gravityDir=-1;
      else g.invertControls=true;
    }
  }
  solids(){return []}
  kills(){return []}
  draw(){
    ctx.fillStyle=this.type==="gravity"?"#86c6ef":"#efc36d";
    roundRect(this.x,470,49,10,4);ctx.fill();
    ctx.fillStyle=theme.ink;ctx.font="800 17px "+FONT;ctx.textAlign="center";
    ctx.fillText(this.type==="gravity"?"↑":"↔",this.x+24,461);
  }
}
class RemotePortal {
  constructor(x,target,opts={}){
    this.x=x;this.target=target;this.px=x+40;
    this.active=false;this.done=false;this.speed=opts.speed??270;
    this.y=408;
  }
  reset(){this.px=this.x+40;this.active=false;this.done=false}
  update(dt,g){
    if(this.done)return;
    const p=g.player;
    if(!this.active&&aabb(p,R(this.x,412,38,65))){
      this.active=true;AudioFX.poof();
    }
    if(!this.active)return;
    g.remoteLock=true;
    if(heldRight())this.px+=this.speed*dt;
    if(heldLeft())this.px-=this.speed*dt;
    this.px=clamp(this.px,this.x+32,this.target+10);
    if(this.px>=this.target){
      this.done=true;this.active=false;g.remoteLock=false;
      p.x=this.target+25;p.y=440;p.vx=0;p.vy=0;
      AudioFX.poof();
    }
  }
  solids(){return []}
  kills(){return []}
  draw(){
    ctx.save();ctx.strokeStyle=this.active?"#a9edb0":"#88bedf";
    ctx.lineWidth=4;ctx.beginPath();
    ctx.ellipse(this.x+19,443,18,32,0,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.ellipse(this.px,443,17,30,0,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=theme.accent;ctx.font="700 12px "+FONT;ctx.textAlign="center";
    if(this.active)ctx.fillText("CONTROLE O PORTAL →",this.px,397);
    ctx.restore();
  }
}
class CoinPickup {
  constructor(x,y=426,value=5){this.x=x;this.y=y;this.value=value;this.picked=false}
  reset(){this.picked=false}
  update(_dt,g){
    if(this.picked)return;
    if(aabb(g.player,R(this.x-10,this.y-10,20,20))){
      this.picked=true;
      if(typeof g.awardCoins==="function")g.awardCoins(this.value);
      AudioFX.pop();
    }
  }
  solids(){return []}
  kills(){return []}
  draw(){
    if(this.picked)return;
    ctx.save();ctx.fillStyle="#f4c64b";ctx.strokeStyle="#ad7832";ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(this.x,this.y,10,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle="#7d531f";ctx.font="bold 12px "+FONT;ctx.textAlign="center";
    ctx.fillText("$",this.x,this.y+4);ctx.restore();
  }
}
class ZombieHorde {
  constructor(opts={}){
    // Speeds differ significantly, but interception keeps both challenging.
    this.speed=opts.speed??155;
    this.spawnEvery=opts.spawnEvery??3.2;
    this.maxZombies=opts.maxZombies??5;
    this.initialDelay=opts.initialDelay??2.8;
    this.elapsed=-Math.max(0,this.initialDelay-this.spawnEvery);
    this.zombies=[];this.dead=[];this.spawned=0;this.flank=0;
  }
  reset(){
    this.elapsed=-Math.max(0,this.initialDelay-this.spawnEvery);
    this.zombies=[];this.dead=[];this.spawned=0;this.flank=0;
  }
  floorAt(g,x) {
    return g.level.solids.find(s=>s.y===480&&s.w>=52&&
      x+22>s.x+12&&x<s.x+s.w-14);
  }
  spawn(g){
    const p=g.player;
    // Alternating interception AHEAD and pursuit behind. This makes
    // surviving active even when the player runs at full speed.
    const inFront=(this.flank++%3)!==2;
    const distance=inFront
      ? (this.speed<200?390:310)+Math.random()*70
      : 150+Math.random()*55;
    const desired=p.x+(inFront?distance:-distance);
    const candidates=g.level.solids.filter(s=>s.y===480&&s.w>=75)
      .map(s=>({floor:s,x:Math.max(s.x+12,Math.min(desired,s.x+s.w-39))}))
      .filter(v=>inFront?v.x>=p.x+215:v.x<=p.x-65)
      .sort((a,b)=>Math.abs(a.x-desired)-Math.abs(b.x-desired));
    if(!candidates.length)return false;
    const x=candidates[0].x;
    const playerNear= Math.abs(x-p.x)<100;
    const trapAtSpawn=g.level.traps.some(t=>t!==this&&
      typeof t.kills==="function"&&
      t.kills().some(h=>aabb(R(x,448,22,32),h)));
    if(playerNear||trapAtSpawn)return false;
    this.zombies.push({x,y:448,vy:0,grounded:true,
      face:x>p.x?-1:1,life:1,anim:0,spawnT:.35});
    this.spawned++;
    return true;
  }
  update(dt,g){
    if(g.state!=="play")return;
    this.elapsed+=dt;
    if(this.elapsed>=this.spawnEvery&&this.zombies.length<this.maxZombies){
      this.elapsed=0;
      this.spawn(g);
    }
    const p=g.player;
    for(let i=this.zombies.length-1;i>=0;i--){
      const z=this.zombies[i];
      z.spawnT=Math.max(0,(z.spawnT||0)-dt);
      const dir=Math.sign((p.x+p.w/2)-(z.x+11))||z.face;
      z.face=dir;
      const oldY=z.y,oldX=z.x;
      const speed=this.speed+Math.min(55,(g.endlessScore||0)*.0075);
      const solids=[...g.level.solids];
      for(const t of g.level.traps)
        if(t!==this&&typeof t.solids==="function")
          solids.push(...t.solids());
      const look=dir*(speed*.38+24);
      const forecastX=z.x+11+look;
      const groundAhead=solids.some(s=>s.y>=420&&s.y<=480&&
        forecastX>s.x+6&&forecastX<s.x+s.w-6);
      const wallAhead=solids.some(s=>s.y+s.h>z.y+10&&
        s.y<z.y+32&&
        (dir>0 ? s.x>z.x+15&&s.x<z.x+look+20 :
          s.x+s.w<z.x+8&&s.x+s.w>z.x+look-6));
      const hazardAhead=g.level.traps.some(t=>t!==this&&
        typeof t.kills==="function"&&
        t.kills().some(h=>dir>0?
          h.x>z.x+14&&h.x<z.x+look+35&&h.y<z.y+32:
          h.x+h.w<z.x+15&&h.x+h.w>z.x+look-12&&h.y<z.y+32));
      // Some zombies jump pits; others fail and visibly fall/die. They can
      // still be killed by spikes/saws, unlike teleporting enemies.
      const willJump=z.grounded&&(!groundAhead||wallAhead||hazardAhead)&&
        Math.sin(this.spawned+i*2.3+z.x*.09)>.12;
      if(willJump){z.vy=-670;z.grounded=false;}
      z.x+=dir*speed*dt;
      z.vy=Math.min(950,z.vy+2150*dt);
      z.y+=z.vy*dt;z.grounded=false;
      if(z.vy>=0)for(const floor of solids){
        if(z.x+22>floor.x&&z.x<floor.x+floor.w&&
          oldY+32<=floor.y+7&&z.y+32>=floor.y){
          z.y=floor.y-32;z.vy=0;z.grounded=true;break;
        }
      }
      for(const wall of solids){
        if(wall.y>=480||wall.y+wall.h<=z.y+5||wall.y>=z.y+30||
           z.x+22<=wall.x||z.x>=wall.x+wall.w)continue;
        if(dir>0&&oldX+22<=wall.x+4){z.x=wall.x-22;z.vy=Math.min(z.vy,-440);}
        else if(dir<0&&oldX>=wall.x+wall.w-4){
          z.x=wall.x+wall.w;z.vy=Math.min(z.vy,-440);
        }
      }
      const hit=R(z.x+3,z.y+2,17,29);
      const hazard=g.level.traps.some(t=>t!==this&&
        typeof t.kills==="function"&&t.kills().some(h=>aabb(hit,h)));
      if(hazard||z.y>H+50){
        this.dead.push({x:z.x,y:Math.min(z.y,480),t:0,fall:hazard?"trap":"pit"});
        this.zombies.splice(i,1);continue;
      }
      if(z.spawnT===0&&aabb(hit,R(p.x+3,p.y+3,p.w-6,p.h-6))){
        if(typeof g.die==="function")g.die(p.x+p.w/2,p.y+p.h/2);
        return;
      }
    }
    for(const d of this.dead)d.t+=dt;
    this.dead=this.dead.filter(d=>d.t<1.1);
  }
  solids(){return []}
  kills(){return []}
  draw(){
    ctx.save();
    for(const z of this.zombies){
      ctx.globalAlpha=z.spawnT>0?.5:1;
      ctx.fillStyle="#4da96b";roundRect(z.x,z.y,22,32,5);ctx.fill();
      ctx.fillStyle="#f2fff2";ctx.fillRect(z.x+4,z.y+8,5,6);
      ctx.fillRect(z.x+13,z.y+8,5,6);
      ctx.fillStyle="#183d2c";ctx.fillRect(z.x+5,z.y+10,2,3);
      ctx.fillRect(z.x+14,z.y+10,2,3);
      if(!z.grounded){
        ctx.fillStyle="#c4ffd4";ctx.fillRect(z.x+4,z.y+29,5,4);
      }
    }
    for(const d of this.dead){
      ctx.globalAlpha=Math.max(0,1-d.t/1.1);
      ctx.fillStyle=d.fall==="pit"?"#3e8e63":"#77ca8b";
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        ctx.fillRect(d.x+11+Math.cos(a)*d.t*45,
          d.y+10+Math.sin(a)*d.t*32+58*d.t*d.t,4,4);
      }
    }
    ctx.restore();
  }
}

/* A crate-controlled wall. No generic lock/switch object depends on it, so
   it is safe to reuse in both authored rooms and future procedural levels. */
class CrateLockGate {
  constructor(x,plateX,opts={}) {
    this.x=x;this.y=opts.y??293;this.w=opts.w??32;
    this.h=480-this.y;this.plateX=plateX;this.plateW=opts.plateW??56;
    this.open=0;this.unlocked=false;
    this.rect=R(x,this.y,this.w,this.h);
  }
  reset(){this.open=0;this.unlocked=false}
  update(dt,g) {
    if(!this.unlocked) {
      this.unlocked=g.level.traps.some(t=>t instanceof PushCrate &&
        t.x+t.w>this.plateX && t.x<this.plateX+this.plateW &&
        t.y+t.h>=476 && t.y+t.h<=484);
    }
    this.open=Math.min(1,this.open+(this.unlocked?dt*2.4:0));
    this.rect.y=this.y-this.h*this.open;
  }
  solids(){return this.open>.94?[]:[this.rect]}
  kills(){return []}
  draw() {
    ctx.save();
    ctx.fillStyle=this.unlocked?"#85d5a3":"#e1a96d";
    roundRect(this.plateX,473,this.plateW,7,3);ctx.fill();
    if(this.open<.95) {
      ctx.fillStyle=theme.ink;ctx.fillRect(this.rect.x,this.rect.y,this.w,this.h);
      ctx.strokeStyle=this.unlocked?"#80d69b":"#dda060";ctx.lineWidth=3;
      ctx.strokeRect(this.rect.x+3,this.rect.y+3,this.w-6,this.h-6);
    }
    ctx.restore();
  }
}

/* Learnable proximity trap: first approach gives an 0.35s ground
   warning, then a low spike appears permanently until retry. */
class SurpriseSpike {
  constructor(x,triggerX,opts={}) {
    this.x=x;this.triggerX=triggerX;
    this.w=opts.width??56;this.maxH=opts.height??34;
    this.warn=opts.warn??.34;this.triggered=false;this.age=0;
  }
  reset(){this.triggered=false;this.age=0}
  update(dt,g) {
    if(!this.triggered&&g.player.x+g.player.w/2>this.triggerX){
      this.triggered=true;
      this.age=0;
    }
    if(this.triggered)this.age+=dt;
  }
  solids(){return []}
  kills(){
    if(!this.triggered||this.age<this.warn)return [];
    return [R(this.x,480-this.maxH,this.w,this.maxH)];
  }
  draw(){
    if(!this.triggered)return;
    ctx.save();
    if(this.age<this.warn){
      ctx.strokeStyle=theme.danger;
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(this.x,479);ctx.lineTo(this.x+this.w/2,474);
      ctx.lineTo(this.x+this.w,479);ctx.stroke();
      ctx.restore();return;
    }
    ctx.fillStyle=theme.danger;
    for(let xx=this.x;xx<this.x+this.w;xx+=14){
      ctx.beginPath();ctx.moveTo(xx,480);
      ctx.lineTo(Math.min(xx+7,this.x+this.w),480-this.maxH);
      ctx.lineTo(Math.min(xx+14,this.x+this.w),480);
      ctx.fill();
    }
    ctx.restore();
  }
}
/* Pursuit trap that activates only when a player crosses the trigger.
   The saw is deliberately slower than the player's 265px/s sprint speed
   and can be learned or avoided by jumping back over it. */
class TriggeredChaseSaw {
  constructor(startX,triggerX,opts={}) {
    this.startX=startX;this.x=startX;
    this.triggerX=triggerX;this.y=opts.y??459;
    this.r=opts.r??17;this.speed=opts.speed??195;
    this.active=false;this.t=0;
  }
  reset(){this.x=this.startX;this.active=false;this.t=0}
  update(dt,g){
    if(!this.active&&g.player.x>this.triggerX)this.active=true;
    if(this.active){this.x+=this.speed*dt;this.t+=dt;}
  }
  solids(){return []}
  kills(){return this.active?[R(this.x-this.r,this.y-this.r,this.r*2,this.r*2)]:[]}
  draw(){
    ctx.save();ctx.translate(this.x,this.y);
    ctx.rotate(this.t*11);ctx.fillStyle=this.active?"#e1a656":"#8e9295";
    ctx.strokeStyle=theme.danger;ctx.lineWidth=2;
    ctx.beginPath();
    for(let i=0;i<=20;i++){
      const a=i*Math.PI/10;
      const rr=i%2===0?this.r:this.r*.7;
      const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.fill();ctx.stroke();
    ctx.fillStyle=theme.ink;ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
}
