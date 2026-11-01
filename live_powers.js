/* FableDevil LIVE powers — isolated actor-scoped 15-second abilities. */
'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FablePowers=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TYPES=Object.freeze({
    float:{label:'FLUTUAR',color:'#9bd4ff',duration:10},
    haste:{label:'VELOCIDADE',color:'#ffdd84',duration:8},
    phase:{label:'ATRAVESSAR PAREDES',color:'#bc9bff',duration:8},
    shield:{label:'INVULNERÁVEL',color:'#ffe47c',duration:7},
    superjump:{label:'SUPERSALTO',color:'#ff9eb8',duration:10},
    freeze:{label:'AURA CONGELANTE',color:'#9dfafa',duration:7},
    magnet:{label:'ÍMÃ DE LOOT',color:'#c6ffa3',duration:12},
  });
  const keys=Object.keys(TYPES);
  const defaultMods=Object.freeze({speed:1,gravity:1,jump:1,phase:false,
    shield:false,float:false,freeze:false,magnet:false});
  class PowerManager{
    constructor(){this.states=new WeakMap();}
    grant(actor,type,now,duration){
      if(!actor||!TYPES[type]||!Number.isFinite(now))return false;
      const until=now+Math.min(15,Math.max(.1,Number.isFinite(duration)?duration:TYPES[type].duration));
      let state=this.states.get(actor);
      if(!state){state=new Map();this.states.set(actor,state);}
      state.set(type,until);return true;
    }
    remaining(actor,type,now){
      const expiry=actor&&this.states.get(actor)?.get(type);
      if(!Number.isFinite(expiry))return 0;
      return Math.max(0,Math.min(15,expiry-now));
    }
    active(actor,type,now){return this.remaining(actor,type,now)>0;}
    list(actor,now){return keys.filter(type=>this.active(actor,type,now)).map(type=>({
      type,remaining:this.remaining(actor,type,now),label:TYPES[type].label}));}
    mods(actor,now){
      if(!actor)return defaultMods;
      const on=t=>this.active(actor,t,now);
      return {speed:on('haste')?1.35:1,gravity:on('float')?.32:1,
        jump:on('superjump')?1.42:1,phase:on('phase'),
        shield:on('shield'),float:on('float'),freeze:on('freeze'),magnet:on('magnet')};
    }
    reset(actor){if(actor)this.states.delete(actor);}
  }
  function isPassableWall(solid,actor){
    // Skip vertical blocking walls only. Never bypass horizontal floors, roofs,
    // or large terrain segments when the actor is intangible.
    if(!solid||!actor)return false;
    const height=solid.h||0,width=solid.w||0;
    return height>=Math.max(44,(actor.h||32)*1.35)&&
      width<115&&solid.y<450&&solid.y+height>=actor.y+10;
  }
  function install(game){
    const manager=new PowerManager();
    game.powerManager=manager;
    game.grantActorPower=(actor,type,duration)=>manager.grant(actor,type,game.time,duration);
    game.actorPower=(actor,type)=>manager.active(actor,type,game.time);
    game.actorPowerMods=actor=>{
      const mods=manager.mods(actor,game.time);
      // If phasing expires while an actor overlaps a vertical wall, move the
      // actor to the nearest safe wall edge before collision/damage checks.
      if(actor._phaseWasActive&&!mods.phase){
        const solids=typeof game.collectSolids==='function'?
          game.collectSolids():(game.level?.solids||[]);
        for(const solid of solids){
          if(!isPassableWall(solid,actor)||
            actor.x+actor.w<=solid.x||actor.x>=solid.x+solid.w||
            actor.y+actor.h<=solid.y||actor.y>=solid.y+solid.h)continue;
          const left=solid.x-actor.w-1,right=solid.x+solid.w+1;
          actor.x=Math.abs(actor.x-left)<Math.abs(right-actor.x)?left:right;
          actor.vx=0;
        }
      }
      actor._phaseWasActive=mods.phase;
      return mods;
    };
    game.actorCanPhase=(actor,solid)=>manager.active(actor,'phase',game.time)&&isPassableWall(solid,actor);
    game.actorPowers=actor=>manager.list(actor,game.time);
    game.clearActorPowers=actor=>manager.reset(actor);
    // Draw the same player's sprite, with a light visual status outline.
    if(!game.__powerDrawWrapped&&typeof game.drawPlayer==='function'){
      const original=game.drawPlayer;
      game.drawPlayer=function(actor,color){
        const output=original.call(this,actor,color);
        const entries=this.actorPowers(actor||this.player);
        if(entries.length&&typeof ctx!=='undefined'&&!this.tournament?.active){
          const a=actor||this.player;
          ctx.save();ctx.strokeStyle=TYPES[entries[0].type].color;
          ctx.lineWidth=2;ctx.globalAlpha=.75;
          ctx.strokeRect(a.x-3,a.y-3,a.w+6,a.h+6);
          ctx.restore();
        }
        return output;
      };
      game.__powerDrawWrapped=true;
    }
    return manager;
  }
  return {TYPES,keys,PowerManager,isPassableWall,install};
});
if(typeof Game!=='undefined'&&typeof document!=='undefined'){
  FablePowers.install(Game);
}
