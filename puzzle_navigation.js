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
  function platformPlan(actor,level,solids,physics={}){
    if(!actor?.grounded||actor.gravityDir===-1||!Array.isArray(solids))return null;
    const foot=actor.y+actor.h;
    const blink=(level?.traps||[]).filter(t=>kind(t)==='BlinkPlatform');
    const surfaces=[...solids,...blink.filter(t=>!solids.includes(t.rect)).map(t=>t.rect)]
      .filter(s=>s&&!s.pushable&&s.w>=34&&s.h>0&&s.h<=70&&s.y>=85&&s.y<=480);
    const center=actor.x+actor.w/2;
    const support=surfaces.filter(s=>Math.abs(s.y-foot)<6&&
      center>=s.x-3&&center<=s.x+s.w+3).sort((a,b)=>a.w-b.w)[0];
    if(!support)return null;
    const right=support.x+support.w;
    const forward=surfaces.filter(s=>s!==support&&
      s.x>=right-6&&s.x>=actor.x+actor.w-10&&
      s.y>foot-92&&s.y<foot+85).sort((a,b)=>a.x-b.x)[0];
    if(!forward)return null;
    const gap=forward.x-right;
    if(gap<5&&Math.abs(forward.y-support.y)<9)return null;
    const velocity=Math.max(160,physics.maxSpeed||265);
    const jump=Math.abs(physics.jumpVelocity||-645),gravity=Math.max(1500,physics.gravity||2150);
    const delta=forward.y-support.y;
    const discr=jump*jump+2*gravity*delta;
    if(discr<0)return null;
    const descending=(jump+Math.sqrt(discr))/gravity;
    const travel=velocity*descending;
    const maxTakeoff=right-actor.w+3;
    const futureBlink=blink.find(t=>t.rect===forward);
    // A short-lived platform may vanish a moment after landing; land
    // toward its near edge so the bot has enough time to jump to the next.
    const desired=Math.min(maxTakeoff,forward.x-travel*.88-
      (futureBlink?18:0));
    const mustJump=gap>=9||delta< -14;
    if(!mustJump)return null;
    if(gap>travel+actor.w+8)return {
      kind:'platform-wait',direction:actor.x<maxTakeoff-21?1:0,
      jump:false,velocity:0,suppressJump:true};
    // Blink pads in a chain are intentionally phased: the next one may be
    // invisible at takeoff but turns solid at touchdown. Predict the whole
    // landing window and wait on the current platform until it is safe.
    const blinkLanding=futureBlink?
      (futureBlink.t+descending)%futureBlink.period:0;
    const predictedOn=!futureBlink||
      (blinkLanding>.055&&
        blinkLanding<futureBlink.period*futureBlink.onFrac-.035);
    const landingSpike=(level?.traps||[]).filter(t=>kind(t)==='PopSpikes'&&
      t.dir==='up'&&Math.abs(t.y-forward.y)<9&&
      t.x>=forward.x-5&&t.x<forward.x+98).sort((a,b)=>a.x-b.x)[0];
    // There are two distinct landings with a spike at the floor's start:
    // (1) enough safe ground BEFORE it: land there slowly, then jump over it;
    // (2) no safe ground: launch near the edge and overfly the full spike.
    let safeLaunch=desired,flightSpeed=null;
    if(landingSpike){
      const safeLandingWidth=landingSpike.x-forward.x;
      if(safeLandingWidth>=actor.w+22){
        flightSpeed=190;
        const safeLanding=landingSpike.x-actor.w-18;
        safeLaunch=Math.max(desired,safeLanding-flightSpeed*descending);
      }else{
        safeLaunch=Math.max(desired,landingSpike.x+landingSpike.w+4-travel);
      }
    }
    if(safeLaunch>maxTakeoff+4)return {
      kind:'platform-wait',direction:actor.x<maxTakeoff-18?1:0,
      jump:false,suppressJump:true};
    if(!predictedOn)return {
      kind:'platform-timing',direction:actor.x<safeLaunch-14?1:0,
      jump:false,velocity:0,suppressJump:true};
    const ready=actor.x>=safeLaunch-2;
    return {kind:'platform-transfer',direction:1,jump:ready,
      velocity,flightSpeed,launchAt:safeLaunch,
      nextX:forward.x,nextY:forward.y,suppressJump:!ready};
  }
  function hazardPlan(actor,level,physics={}){
    if(!actor?.grounded||actor.gravityDir===-1)return null;
    const foot=actor.y+actor.h;
    const danger=(level?.traps||[]).filter(t=>kind(t)==='PopSpikes'&&
      t.dir==='up'&&Math.abs(t.y-foot)<10&&t.w>15&&
      t.x+ t.w>actor.x+actor.w-5&&
      t.x<actor.x+actor.w+100).sort((a,b)=>a.x-b.x)[0];
    if(!danger)return null;
    const gap=danger.x-(actor.x+actor.w);
    const buffer=16+(actor.retryStrategy||0)*2;
    const launch=gap<=buffer&&gap>-actor.w+1;
    const jump=Math.abs(physics.jumpVelocity||-645),gravity=Math.max(1500,physics.gravity||2150);
    const flightTime=2*jump/gravity;
    const landing=danger.x+danger.w+8;
    const optimal=(landing-actor.x)/flightTime;
    const flightSpeed=Math.max(160,Math.min(265,optimal));
    return {kind:'spike-clearance',direction:1,jump:launch,
      flightSpeed,suppressJump:!launch};
  }
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
  return {plan,platformPlan,hazardPlan};
});
