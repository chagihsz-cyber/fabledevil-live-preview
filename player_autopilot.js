/* Auto-pilot for the SAME main player, exclusive to endless modes. */
"use strict";
(function(root, make){
  const api=make();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.MotocaPlayerAutopilot=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  function decideMove(player, solids, hazards=[], zombies=[]){
    if(!player)return {right:false,jump:false};
    const right=player.x+player.w, feet=player.y+player.h;
    const floors=solids.filter(s=>s.w>30&&s.y>=feet-25&&s.y<=feet+30);
    const floor=floors.filter(s=>right>s.x+2&&player.x<s.x+s.w-2)
      .sort((a,b)=>Math.abs((a.y-feet))-Math.abs(b.y-feet))[0];
    const edge=floor?floor.x+floor.w:Infinity;
    const edgeDistance=edge-right;
    const ahead=floors.filter(s=>floor!==s&&s.x>=edge-5).sort((a,b)=>a.x-b.x)[0];
    const gap=ahead?ahead.x-edge:Infinity;
    const jumpGap=!!floor&&edgeDistance<78&&edgeDistance>-24&&gap>14;
    const wall=solids.some(s=>s.y+s.h>player.y+9&&s.y<feet-12&&
      s.x>=right-3&&s.x<right+88);
    const hazard=hazards.some(h=>h.x+h.w>right+2&&h.x<right+106&&
      h.y<feet+6&&h.y+h.h>player.y-12);
    const enemy=zombies.some(z=>z.x>=right+1&&z.x<right+78&&
      z.y<feet&&z.y+32>player.y);
    return {right:true,jump:!!player.grounded&&(jumpGap||wall||hazard||enemy),
      jumpGap,wall,hazard,enemy};
  }
  function reversedAt(game,player){
    // The core resets invertControls on every tick, then each ChaosRoom sets
    // it again. A stale g.invertControls or reverseUntil alone is insufficient.
    const temporary=game.reverseUntil>game.time&&game.reverseType!=="gravity";
    const room=game.level.traps.some(t=>t.constructor?.name==="ChaosRoom"&&
      (t.type==="mirror"||t.type==="chaos")&&
      player.x+player.w/2>t.x&&player.x+player.w/2<t.x+t.width&&
      player.y+player.h>t.y&&player.y<t.y+t.h);
    return !!(temporary||room);
  }
  function pendingCratePuzzle(game,player){
    for(const gate of game.level.traps){
      if(gate.constructor?.name!=="CrateLockGate"||gate.unlocked||
        gate.x<player.x-75||gate.x>player.x+465)continue;
      const crate=game.level.traps.find(t=>t.constructor?.name==="PushCrate"&&
        t.x<gate.x&&gate.x-t.x<290);
      if(!crate)continue;
      // Avoid turning around when the crate already operates its pressure pad.
      if(crate.x+crate.w>gate.plateX&&crate.x<gate.plateX+gate.plateW)continue;
      return {crate,gate};
    }
    return null;
  }
  class MainPlayerBrain{
    constructor(){this.stalled=0;this.lastX=null;this.jumpHold=0;this.jumpCooldown=0;this.crateRecovery=null;this.portalChoices=new WeakMap();}
    reset(){this.stalled=0;this.lastX=null;this.jumpHold=0;this.jumpCooldown=0;this.crateRecovery=null;this.portalChoices=new WeakMap();}
    next(dt,game){
      const p=game.player;
      const solids=typeof game.collectSolids==="function"?game.collectSolids():game.level.solids;
      const hazards=[],zombies=[];
      for(const trap of game.level.traps){
        if(typeof trap.kills==="function")hazards.push(...trap.kills());
        if(Array.isArray(trap.zombies))zombies.push(...trap.zombies);
        // Periodic spikes may be hidden at the instant of the decision.
        if(trap.constructor?.name==="PopSpikes"&&Number.isFinite(trap.x))
          hazards.push({x:trap.x,y:trap.y-28,w:trap.w||40,h:28});
      }
      const decision=decideMove(p,solids,hazards,zombies);
      const puzzle=pendingCratePuzzle(game,p);
      let direction=1;
      if(puzzle){
        const crate=puzzle.crate;
        // If we jumped past the crate, go around it and approach from the
        // left; otherwise push it onto the pressure pad instead of jumping.
        if(p.x>crate.x-p.w+6)this.crateRecovery=crate;
        if(this.crateRecovery===crate){
          if(p.x+p.w<crate.x-60&&p.grounded)this.crateRecovery=null;
          else {
            direction=-1;
            const backDistance=p.x-(crate.x+crate.w);
            decision.jump=!!p.grounded&&backDistance<108&&backDistance>-38;
          }
        }
        if(direction===1){
          decision.jump=false;
          decision.pushCrate=true;
        }
      }else this.crateRecovery=null;
      // Yellow portals conceal their outcome. The bot decides to gamble or
      // jump past each portal without consulting its eventual destination.
      if(direction===1&&!puzzle){
        const portal=game.level.traps.find(t=>t.constructor?.name==="RiskPortal"&&
          t.x>p.x+p.w-3&&t.x<p.x+p.w+96);
        if(portal){
          if(!this.portalChoices.has(portal)){
            const seed=Math.sin(portal.x*12.9898+(game.endlessSeed||0)*.013)*43758.5453;
            const risk=(seed-Math.floor(seed))<.43&&(game.hearts??4)>1;
            this.portalChoices.set(portal,risk);
          }
          if(this.portalChoices.get(portal))decision.jump=false;
          else if(portal.x-(p.x+p.w)<85&&p.grounded)decision.jump=true;
          decision.portalChoice=this.portalChoices.get(portal)?"risk":"avoid";
        }
      }
      decision.direction=direction;
      decision.reverseControls=reversedAt(game,p);
      const step=Math.max(0,Math.min(0.05,dt));
      this.jumpCooldown=Math.max(0,this.jumpCooldown-step);
      this.jumpHold=Math.max(0,this.jumpHold-step);
      if(this.lastX!==null&&p.grounded&&
        (direction>0?p.x-this.lastX:this.lastX-p.x)<0.15)
        this.stalled=Math.min(2,this.stalled+step);
      else this.stalled=0;
      this.lastX=p.x;
      if(p.grounded&&(decision.jump||this.stalled>.6)&&this.jumpCooldown===0){
        this.jumpHold=.26;this.jumpCooldown=.43;this.stalled=0;
        decision.jumpNow=true;
      }
      return {...decision,jump:this.jumpHold>0};
    }
  }
  return {decideMove,reversedAt,pendingCratePuzzle,MainPlayerBrain};
});

(function(){
  if(typeof document==="undefined"||typeof Game==="undefined")return;
  const {MainPlayerBrain}=MotocaPlayerAutopilot;
  const brain=new MainPlayerBrain();
  const menuCheck=document.getElementById("main-player-bot");
  const zombieCheck=document.getElementById("zombie-main-bot");
  const competitionCheck=document.getElementById("competition-main-bot");
  const button=document.getElementById("player-bot-switch");
  const panel=document.getElementById("player-auto-controls");
  let enabled=false,botOwnedInput=false;
  function releaseBotInput(){
    if(botOwnedInput){touch.left=false;touch.right=false;touch.jump=false;botOwnedInput=false;}
    Game.autoFireMain=false;brain.reset();
  }
  function refreshUI(){
    for(const input of [menuCheck,zombieCheck,competitionCheck]){
      if(input)input.checked=enabled;
    }
    if(button){button.textContent=enabled?"🤖 BOT: LIGADO":"🎮 JOGAR MANUAL";
      button.setAttribute("aria-pressed",String(enabled));}
    const isEndless=Game.arcadeMode==="endless";
    if(panel)panel.classList.toggle("hidden",!isEndless||!
      ["play","respawnDelay"].includes(Game.state));
    if(isEndless&&Game.state==="play")setTouchControlsVisible(!enabled);
  }
  function setEnabled(value){
    enabled=!!value;
    if(!enabled)releaseBotInput();
    else brain.reset();
    refreshUI();
    return enabled;
  }
  for(const input of [menuCheck,zombieCheck,competitionCheck])
    input?.addEventListener("change",()=>setEnabled(input.checked));
  button?.addEventListener("click",()=>setEnabled(!enabled));
  const oldStart=Game.startEndless;
  Game.startEndless=function(...args){
    releaseBotInput();
    const result=oldStart.apply(this,args);
    refreshUI();
    return result;
  };
  const oldRevive=Game.reviveInSurvival;
  if(typeof oldRevive==="function")Game.reviveInSurvival=function(...args){
    const result=oldRevive.apply(this,args);
    if(enabled&&this.arcadeMode==="endless")setTouchControlsVisible(false);
    return result;
  };
  const oldPlay=Game.updatePlay;
  Game.updatePlay=function(dt){
    const active=enabled&&this.arcadeMode==="endless"&&this.state==="play";
    if(active&&this.player){
      const d=brain.next(dt,this);
      const inputDirection=d.reverseControls?-d.direction:d.direction;
      touch.left=inputDirection<0;
      touch.right=inputDirection>0;
      touch.jump=!!d.jump;
      if(d.jumpNow)jumpBuffered=Math.max(jumpBuffered,.12);
      botOwnedInput=true;
      this.autoFireMain=!!this.liveWeaponsEnabled;
    }else if(botOwnedInput)releaseBotInput();
    return oldPlay.call(this,dt);
  };
  const oldUpdate=Game.update;
  let oldVisible=null;
  Game.update=function(dt){
    const result=oldUpdate.call(this,dt);
    const visible=this.arcadeMode==="endless"&&
      ["play","respawnDelay"].includes(this.state);
    if(visible!==oldVisible){refreshUI();oldVisible=visible;}
    return result;
  };
  // The campaign and all other modes keep their original player controls.
  window.MotocaMainPlayer={setBot:setEnabled,isBot:()=>enabled,brain};
  refreshUI();
})();
