/* Shared, deterministic puzzle steering for the main autopilot and live rivals.
 * Decisions are based only on visible mechanisms and the actor's position.
 * Movement and collision remain under the original game's physics. */
'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FablePuzzleNavigation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const kind=(obj)=>obj?.constructor?.name||'';
  function plan(actor,level){
    if(!actor||!level)return null;
    const traps=level.traps||[],solids=level.solids||[];
    const center=actor.x+actor.w/2;
    // A low beam has only 15–37px clearance under its bottom edge.
    // Without the slim morph, no standard 32px-tall character can pass.
    const tunnel=solids.find(s=>s.w>=40&&s.h>=20&&
      s.y+s.h>=443&&s.y+s.h<=466&&
      s.x+s.w>actor.x-12&&s.x<center+290);
    if(tunnel){
      const pad=traps.find(t=>kind(t)==='MorphPad'&&t.kind==='slim'&&
        t.x<tunnel.x&&t.x>tunnel.x-275);
      if(pad){
        const slim=actor.morph?.kind==='slim'&&actor.h<=20;
        if(!slim){
          const target=pad.x+pad.w/2;
          const dx=target-center;
          return {kind:'morph-activate',direction:dx>8?1:dx< -8?-1:0,
            jump:false,suppressJump:true};
        }
        if(center<tunnel.x+tunnel.w+20)
          return {kind:'morph-cross',direction:1,jump:false,
            suppressJump:true};
      }
    }
    // A locked gate requires a crate to occupy a floor plate. The crate
    // may lie on EITHER side of that plate after other actors pushed it.
    const mechanisms=traps.filter(t=>['CrateLockGate','PressureBridge'].includes(kind(t))&&
      !(t.unlocked||t.extended)&&t.x>center-150&&t.x<center+630);
    for(const gate of mechanisms){
      const plateLeft=gate.plateX,plateRight=plateLeft+gate.plateW;
      const crates=traps.filter(t=>kind(t)==='PushCrate'&&
        t.x+t.w>plateLeft-300&&t.x<plateRight+300);
      if(!crates.length)continue;
      const crate=crates.reduce((a,b)=>
        Math.abs(a.x-plateLeft)<Math.abs(b.x-plateLeft)?a:b);
      if(crate.x+crate.w>plateLeft+6&&crate.x<plateRight-6)continue;
      const pushingRight=crate.x+crate.w<=plateLeft+6;
      const pushDirection=pushingRight?1:-1;
      const behind=pushingRight?actor.x+actor.w<=crate.x+3:
        actor.x>=crate.x+crate.w-3;
      if(behind)return {kind:'crate',direction:pushDirection,
        jump:false,suppressJump:true,pushing:true};
      const sideX=pushingRight?crate.x-actor.w-14:crate.x+crate.w+14;
      const direction=sideX-actor.x>7?1:sideX-actor.x< -7?-1:0;
      const obstacleDistance=pushingRight?actor.x-(crate.x+crate.w):
        crate.x-(actor.x+actor.w);
      // Jump OVER the crate to get behind it. Never repeatedly jump while
      // already at the pushing side: that would skip the pressure plate.
      const jump=!!actor.grounded&&direction===-pushDirection&&
        obstacleDistance<90&&obstacleDistance>-34;
      return {kind:'crate',direction,jump,suppressJump:!jump,positioning:true};
    }
    // The stretch bridge is opened by a floor switch, not a crate. Avoid
    // hopping over that switch when preparing to cross its gap.
    for(const bridge of traps){
      if(kind(bridge)!=='StretchBridge'||bridge.latched||
        bridge.x<center-90||bridge.x>center+450)continue;
      const dx=bridge.padX+24-center;
      return {kind:'bridge-switch',direction:dx>8?1:dx< -8?-1:0,
        jump:false,suppressJump:true};
    }
    // Buttons tied to conventional keyed gates must be stepped on first.
    for(const gate of traps){
      if(kind(gate)!=='Gate'||gate.invert||!gate.key||
        gate.rect?.x<center-80||gate.rect?.x>center+460||gate.open>.95)continue;
      const button=traps.find(t=>kind(t)==='Button'&&t.key===gate.key&&!t.pressed);
      if(!button)continue;
      const dx=button.x+button.w/2-center;
      return {kind:'button',direction:dx>8?1:dx< -8?-1:0,
        jump:false,suppressJump:true};
    }
    return null;
  }
  return {plan};
});
