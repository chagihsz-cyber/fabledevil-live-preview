/* FableDevil LIVE: opt-in elimination tournament for authored campaign stages. */
'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.FableTournament=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const STORAGE='fabledevil_tournament_v7';
  const DEFAULT_BOTS=Object.freeze([20,18,14,11,9,7,5,4,3,2,1]);
  const DEFAULT_LOOT=Object.freeze([20,16,13,10,8,6,5,4,3,2,1]);
  function parseCounts(value,fallback=DEFAULT_BOTS,max=20){
    const entries=Array.isArray(value)?value:String(value??'').split(/[,;\n]+/);
    const values=entries.slice(0,54).map(Number).filter(Number.isFinite)
      .map(x=>Math.max(0,Math.min(max,Math.floor(x))));
    return values.length?values:[...fallback];
  }
  function countAt(values,index){return values[Math.min(values.length-1,Math.max(0,index))]??0;}
  function selectSurvivors(bots,cap){
    return [...bots].filter(bot=>bot.alive!==false&&bot.lives>0)
      .sort((a,b)=>b.x-a.x||String(a.participantId||a.name)
        .localeCompare(String(b.participantId||b.name)))
      .slice(0,Math.max(0,cap));
  }
  function doorSteering(bot,door){
    if(!door||!door.pos)return null;
    const d=door.pos;
    const center=d.x+(door.w||38)/2;
    const feet=bot.y+bot.h;
    const elevated=d.y+(door.h||64)<feet-8;
    const delta=center-(bot.x+bot.w/2);
    return {direction:delta>4?1:delta< -4?-1:0,
      near:Math.abs(delta)<130||delta< -4,
      jump:elevated&&Math.abs(delta)<100&&Math.abs(delta)>12,
      targetX:center};
  }
  function qualificationStatus(bots,nextCap,playerQualified=false){
    const active=bots.filter(b=>b.alive&&b.lives>0);
    const passed=active.filter(b=>b.qualified);
    const required=Math.max(0,Math.min(20,Math.floor(Number(nextCap)||0)));
    return {required,passed:passed.length,possible:active.length>=required,
      complete:required>0?passed.length>=required:!!playerQualified,
      impossible:active.length<required};
  }
  function planLoot(solids,amount,traps=[]){
    const floors=solids.filter(s=>s.w>=25&&s.y>=80&&s.y<=480&&s.h>3&&
      s.x<950&&s.x+s.w>25);
    const proposed=[];
    for(const floor of floors){
      const begin=Math.max(35,floor.x+11),end=Math.min(928,floor.x+floor.w-11);
      for(let x=begin;x<end;x+=25){
        if(Math.abs(x-55)<25||x>914)continue;
        const y=floor.y-18;
        const nearHazard=traps.some(t=>typeof t.kills==='function'&&
          t.kills().some(h=>x>h.x-12&&x<h.x+h.w+12&&
            y>h.y-20&&y<h.y+h.h+20));
        if(!nearHazard)proposed.push({x,y});
      }
    }
    // Spread visual pickups across the entire level, avoiding same-pixel
    // collisions and overcrowding in a small region.
    const unique=[...new Map(proposed.map(p=>[p.x.toFixed(1)+'|'+p.y.toFixed(1),p])).values()]
      .sort((a,b)=>a.x-b.x||a.y-b.y);
    const n=Math.max(0,Math.min(30,amount));
    if(!unique.length)return [];
    const selected=[];
    for(let i=0;i<n;i++){
      let index=Math.floor((i+.5)*unique.length/n);
      index=Math.min(unique.length-1,index);
      while(index<unique.length&&selected.some(p=>Math.abs(p.x-unique[index].x)<15&&
        Math.abs(p.y-unique[index].y)<40))index++;
      if(index<unique.length)selected.push(unique[index]);
    }
    // Sparse authored stages may not provide enough ground coordinates for
    // a 20-item budget. Use accessible aerial tiers above the same safe
    // platforms rather than silently dropping configured loot.
    if(selected.length<n){
      for(const rise of [27,49,70,91]){
        for(const slot of unique){
          if(selected.length>=n)break;
          const pickup={x:slot.x,y:slot.y-rise};
          if(pickup.y<32||selected.some(v=>
            Math.abs(v.x-pickup.x)<12&&Math.abs(v.y-pickup.y)<17))continue;
          selected.push(pickup);
        }
      }
    }
    return selected.slice(0,n);
  }
  function loadConfig(storage){
    try{
      const stored=JSON.parse(storage.getItem(STORAGE));
      if(!stored||stored.version!==1)throw Error('unavailable');
      const oldPreset=[20,16,13,10,8,6,5,4,3,2,1];
      const storedCaps=parseCounts(stored.botCaps,DEFAULT_BOTS);
      const migratedCaps=JSON.stringify(storedCaps)===JSON.stringify(oldPreset)
        ?[...DEFAULT_BOTS]:storedCaps;
      return {version:1,botCaps:migratedCaps,
        lootCaps:parseCounts(stored.lootCaps,DEFAULT_LOOT,30),
        initialBots:Math.max(0,Math.min(20,Math.round(Number(stored.initialBots)||0))),
        zombies:['off','normal','hard'].includes(stored.zombies)?stored.zombies:'off',
        weapons:stored.weapons===true,powers:stored.powers===true,
        mainBot:stored.mainBot===true};
    }catch{return {version:1,botCaps:[...DEFAULT_BOTS],lootCaps:[...DEFAULT_LOOT],
      initialBots:20,zombies:'off',weapons:false,powers:false,mainBot:false};}
  }
  function saveConfig(storage,config){
    const sanitized={version:1,botCaps:parseCounts(config.botCaps,DEFAULT_BOTS),
      lootCaps:parseCounts(config.lootCaps,DEFAULT_LOOT,30),
      initialBots:Math.min(20,Math.max(0,Math.floor(Number(config.initialBots)||0))),
      zombies:['off','normal','hard'].includes(config.zombies)?config.zombies:'off',
      weapons:config.weapons===true,powers:config.powers===true,
      mainBot:config.mainBot===true};
    try{storage?.setItem?.(STORAGE,JSON.stringify(sanitized));}catch{}
    return sanitized;
  }
  class TournamentLoot{
    constructor(x,y,type,run){this.x=x;this.y=y;this.type=type;
      this.w=14;this.h=14;this.run=run;this.collected=false;this.t=0;}
    update(dt,game){
      if(this.collected||game.state!=='play')return;
      this.t+=dt;
      for(const actor of game.liveActors?.()||[game.player]){
        const radius=game.actorPower?.(actor,'magnet')?76:13;
        if(Math.abs(actor.x+actor.w/2-(this.x+7))>radius||
          Math.abs(actor.y+actor.h/2-(this.y+7))>radius+10)continue;
        this.collected=true;this.run.collected++;
        if(this.type==='coin')game.awardCoins?.(1);
        else if(this.type==='life'){
          if(actor===game.player)game.hearts=Math.min(game.maxHearts||10,(game.hearts||0)+1);
          else actor.lives=Math.min(10,(actor.lives||0)+1);
        }else if(this.type==='weapon'){
          const names=Object.keys(globalThis.MotocaLiveCore?.WEAPONS||{});
          const type=names[(this.run.collected+this.run.phaseIndex)%names.length]||'pistol';
          game.liveWeapons?.grantTemporary(actor,type,game.time,15);
        }else if(this.type==='power'){
          const names=globalThis.FablePowers?.keys||[];
          const type=names[(this.run.collected+this.run.phaseIndex)%names.length];
          if(type)game.grantActorPower?.(actor,type);
        }
        this.run.renderHud();break;
      }
    }
    draw(){
      if(this.collected)return;
      ctx.save();ctx.fillStyle=({coin:'#ffd977',life:'#ff829d',
        weapon:'#a6cfff',power:'#c5a8ff'})[this.type]||'#fff';
      ctx.globalAlpha=.78+.22*Math.sin(this.t*4);
      ctx.beginPath();ctx.arc(this.x+7,this.y+7,6.5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#162422';ctx.font='900 10px Outfit,sans-serif';
      ctx.textAlign='center';ctx.fillText(({coin:'$',life:'+',weapon:'W',power:'P'})[this.type],
        this.x+7,this.y+11);ctx.restore();
    }
    solids(){return []}kills(){return []}
  }
  function install(game){
    const ui=id=>document.getElementById(id);
    const resultPanel=ui('tournament-results'),settings=ui('campaign-settings');
    const scoreboard=ui('race-standings'),counter=ui('tournament-counter');
    let config=loadConfig(localStorage);
    const run={active:false,phaseIndex:0,botCaps:config.botCaps,
      lootCaps:config.lootCaps,initialBots:config.initialBots,
      survivors:[],eliminated:new Set(),race:null,lootTotal:0,collected:0,
      finished:false,lastStageIndex:null,playerQualified:false,
      nextCap(){return countAt(this.botCaps,this.phaseIndex+1);},
      qualification(){return qualificationStatus(this.race?.rivals||[],this.nextCap(),this.playerQualified);},
      botAtDoor(bot){
        if(!this.active||this.finished||bot.qualified||!bot.alive||
          bot.respawnTimer>0||!game.level?.door?.playerWins(bot))return false;
        bot.qualified=true;bot.vx=0;bot.vy=0;
        this.renderHud();this.tryAdvance();return true;
      },
      tryAdvance(){
        if(!this.active||this.finished||game.state!=='play')return false;
        const status=this.qualification();
        if(status.impossible){this.fail(status);return false;}
        if(!status.complete)return false;
        if(this.nextCap()<=1||this.phaseIndex>=10){
          this.finish();return true;
        }
        baseWin.call(game);return true;
      },
      cap(){return countAt(this.botCaps,this.phaseIndex);},
      renderHud(){
        if(counter&&!counter.classList.contains('hidden'))
          counter.textContent='FASE '+(this.phaseIndex+1)+' · CLASSIFICADOS '+
            this.qualification().passed+'/'+this.qualification().required+
            ' · BOTS '+(this.race?.rivals.filter(b=>b.alive).length||0)+
            ' · LOOT '+this.collected+'/'+this.lootTotal;
      },
      syncLobby(participants){
        if(!this.active||!this.race)return;
        const bots=this.race.rivals;
        const allowed=new Set(participants.map(p=>p.id));
        for(let i=bots.length-1;i>=0;i--)
          if(!allowed.has(bots[i].participantId))bots.splice(i,1);
        const ids=new Set(bots.map(b=>b.participantId));
        const limit=this.cap();
        for(const person of participants){
          if(ids.has(person.id)||this.eliminated.has(person.id))continue;
          if(bots.length>=limit){
            // A viewer may replace a system NPC even if the old lobby NPC
            // was not one of the survivors in this particular stage.
            if(person.origin!=='viewer')continue;
            const replace=bots.findIndex(bot=>bot.origin==='system'&&!bot.qualified);
            if(replace<0)continue;
            ids.delete(bots[replace].participantId);
            this.eliminated.add(bots[replace].participantId);
            bots.splice(replace,1);
          }
          const ai=globalThis.MotocaLiveCore?.createBotIdentity(person.id,person.name);
          if(!ai)continue;
          const appearance=globalThis.MotocaLive?.appearanceStore?.get(person.name)||{};
          const base=game.level.spawn;
          const bot={participantId:person.id,name:person.name,origin:person.origin,
            viewer:person.viewer,color:appearance.color||'#8ec2dd',
            personalColor:appearance.color||'',team:appearance.team||'none',
            ai,trait:ai.trait,speed:265,x:base.x-ids.size*.65,y:base.y,
            w:26,h:32,vy:0,vx:0,grounded:false,face:1,squash:0,jumping:false,
            coyote:0,jumpHold:0,lives:1,alive:true,respawnTimer:0,
            protectedUntil:0,jumps:0,deadCount:0,safeX:base.x,lastY:base.y,
            phase:(ai.seed%6283)/1000,stuckFor:0,qualified:false};
          bots.push(bot);ids.add(person.id);
        }
        this.renderHud();
        if(game.state==='play')this.tryAdvance();
      },
      fail(status=this.qualification()){
        if(this.finished)return;
        this.finished=true;this.active=false;
        game.state='tournamentFailed';
        const caption=ui('tournament-winner');
        if(ui('tournament-result-heading'))
          ui('tournament-result-heading').textContent='❌ COTA NÃO ATINGIDA';
        if(caption)caption.textContent='Fase eliminada: '+status.passed+'/'+
          status.required+' classificados. Não há sobreviventes suficientes. '+
          'Inicie um novo torneio.';
        resultPanel?.classList.remove('hidden');
        scoreboard?.classList.remove('hidden');
      },
      finish(){
        this.finished=true;this.active=false;
        game.state='tournamentFinished';
        scoreboard?.classList.remove('hidden');
        const finalists=(this.race?.rivals||[]).filter(b=>b.alive&&b.qualified)
          .sort((a,b)=>b.x-a.x);
        const leading=finalists[0];
        const winner=this.playerQualified&&(!leading||game.player.x>=leading.x)
          ?'Protagonista':(leading?.name||'Protagonista');
        const caption=ui('tournament-winner');
        if(ui('tournament-result-heading'))
          ui('tournament-result-heading').textContent='🏆 TORNEIO ENCERRADO';
        if(caption)caption.textContent='🏆 '+winner+' venceu o torneio!';
        resultPanel?.classList.remove('hidden');
      },
    };
    game.tournament=run;
    const baseLoad=game.loadLevel;
    game.loadLevel=function(index){
      const active=run.active;
      const firstLoad=run.lastStageIndex===null;
      run.firstLoad=firstLoad;
      if(active&&!firstLoad&&run.lastStageIndex===index)
        run.survivors=(run.race?.rivals||run.survivors).filter(b=>b.alive&&b.qualified);
      if(active&&run.lastStageIndex!==null&&run.lastStageIndex!==index){
        // No manual / delayed transition is allowed to bypass the door quota.
        if(!run.qualification().complete||run.qualification().impossible)return;
        const cap=countAt(run.botCaps,run.phaseIndex+1);
        const selected=selectSurvivors((run.race?.rivals||[]).filter(b=>b.qualified),cap);
        for(const bot of run.race?.rivals||[])
          if(!selected.includes(bot))run.eliminated.add(bot.participantId);
        run.survivors=selected;run.phaseIndex++;
        run.playerQualified=false;
      }
      const result=baseLoad.call(this,index);
      if(!active)return result;
      run.lastStageIndex=index;run.firstLoad=false;
      scoreboard?.replaceChildren?.(); // old dead bots must not persist on new stage
      this.arcadeMode='campaign';
      this.endlessKind=config.zombies==='off'?'peace':'zombies';
      this.zombieDifficulty=config.zombies==='hard'?'hard':'normal';
      this.liveWeaponsEnabled=config.weapons;
      this.liveAutoFire=true;
      this.hearts=Math.min(10,Math.max(0,this.hearts||10));
      const race=new this.CompetitionTraining('tournament');
      race.rivals=run.survivors.map((bot,i)=>({...bot,x:this.level.spawn.x-i*.65,
        y:this.level.spawn.y,vx:0,vy:0,grounded:false,
        w:26,h:32,morph:null,respawnTimer:0,protectedUntil:0,jumping:false,
        qualified:false,stuckFor:0}));
      run.race=race;this.level.traps.push(race);
      if(firstLoad)
        run.syncLobby(globalThis.MotocaLive?.lobby?.participants||[]);
      if(config.zombies!=='off'){
        const hard=config.zombies==='hard';
        this.level.traps.push(new ZombieHorde({speed:hard?240:185,
          spawnEvery:hard?.38:1.6,maxZombies:hard?20:7,initialDelay:2}));
      }
      if(this.LiveWeaponRuntime){
        this.liveWeapons=new this.LiveWeaponRuntime();
        this.level.traps.push(this.liveWeapons);
      }
      if(this.LivePowerRuntime){
        this.livePower=new this.LivePowerRuntime();
        this.level.traps.push(this.livePower);
      }
      run.collected=0;
      const count=countAt(run.lootCaps,run.phaseIndex);
      const spots=planLoot(this.level.solids,count,this.level.traps);
      const types=['coin','coin','coin','coin','life',
        ...(config.weapons?['weapon']:[]),...(config.powers?['power']:[])];
      this.level.traps.push(...spots.map((p,i)=>new TournamentLoot(p.x,p.y,
        types[(i+run.phaseIndex)%types.length],run)));
      run.lootTotal=spots.length;
      counter?.classList.remove('hidden');scoreboard?.classList.remove('hidden');
      run.renderHud();return result;
    };
    const baseWin=game.winLevel;
    game.winLevel=function(){
      if(run.finished)return;
      if(!run.active)return baseWin.call(this);
      run.playerQualified=true;
      return run.tryAdvance();
    };
    const originalDie=game.die;
    game.die=function(x,y){
      if(run.active&&this.time<(this.invulnerableUntil||0))return;
      return originalDie.call(this,x,y);
    };
    // A campaign death restarts the protagonist only. Bots, their progress,
    // trap state and already collected loot remain in this running stage.
    const originalUpdate=game.update;
    game.update=function(dt){
      if(run.active&&this.state==='tournamentRespawn'){
        this.time+=dt;
        const delay=this.tournamentRespawnTimer-dt;
        this.state='play';
        for(const trap of this.level.traps){
          if(trap===run.race||['ZombieHorde','PhantomFloor','CrumblePlatform'].includes(trap.constructor?.name))
            trap.update(dt,this);
          if(this.state!=='play')return;
        }
        this.state='tournamentRespawn';
        this.tournamentRespawnTimer=delay;
        if(delay<=0){
          const oldPlayer=this.player;
          this.clearActorPowers?.(oldPlayer);
          this.spawnPlayer();
          for(const key of ['liveColor','liveTeam','liveTeamLabel'])
            if(oldPlayer?.[key]!==undefined)this.player[key]=oldPlayer[key];
          this.morph=null;this.reverseUntil=0;this.reverseType=null;
          this.gravityDir=1;this.invertControls=false;this.remoteLock=false;
          this.deathT=0;this.invulnerableUntil=this.time+1.2;
          this.state='play';
        }
        return;
      }
      const result=originalUpdate.call(this,dt);
      if(run.active&&this.state==='dead'){
        run.playerQualified=false;
        this.player._tournamentRespawning=true;
        this.state='tournamentRespawn';
        this.tournamentRespawnTimer=.65;
      }
      return result;
    };
    const baseMenu=showMenu;
    showMenu=function(){
      run.active=false;run.finished=false;
      settings?.classList.add('hidden');resultPanel?.classList.add('hidden');
      counter?.classList.add('hidden');scoreboard?.classList.add('hidden');
      return baseMenu();
    };
    game.openPhaseTourneyMenu=function(){
      config=loadConfig(localStorage);
      ui('phase-initial-bots').value=String(config.initialBots);
      ui('phase-bot-caps').value=config.botCaps.join(', ');
      ui('phase-loot-caps').value=config.lootCaps.join(', ');
      ui('phase-zombies').value=config.zombies;
      ui('phase-weapons').checked=config.weapons;
      ui('phase-powers').checked=config.powers;
      ui('phase-main-bot').checked=config.mainBot;
      menuEl.classList.add('hidden');settings?.classList.remove('hidden');
      game.state='tournamentSetup';
    };
    ui('btn-back-menu')?.addEventListener('click',()=>{
      run.active=false;counter?.classList.add('hidden');
      resultPanel?.classList.add('hidden');settings?.classList.add('hidden');
    },true);
    ui('phase-back')?.addEventListener('click',()=>showMenu());
    ui('phase-classic')?.addEventListener('click',()=>{
      settings?.classList.add('hidden');run.active=false;
      startGame(window.MotocaArcade?.campaign?.highestUnlocked?.()||0);
    });
    ui('phase-start')?.addEventListener('click',()=>{
      const requestedCaps=parseCounts(ui('phase-bot-caps').value,DEFAULT_BOTS);
      const requestedInitial=Math.max(0,Math.min(20,Math.floor(Number(ui('phase-initial-bots').value)||0)));
      const minimum=countAt(requestedCaps,1);
      const invalidGrowth=requestedCaps.some((cap,i)=>i>0&&cap>requestedCaps[i-1]);
      if(requestedInitial<minimum||invalidGrowth){
        const feedback=ui('phase-feedback');
        if(feedback)feedback.textContent='Para avançar, a cota mínima da fase 1 ('+
          minimum+') deve caber na largada ('+requestedInitial+'). '+
          'A sequência de cotas não pode aumentar. Ajuste os valores.';
        return;
      }
      if(ui('phase-feedback'))ui('phase-feedback').textContent='';
      config=saveConfig(localStorage,{
        botCaps:requestedCaps,
        lootCaps:parseCounts(ui('phase-loot-caps').value,DEFAULT_LOOT,30),
        initialBots:ui('phase-initial-bots').value,zombies:ui('phase-zombies').value,
        weapons:ui('phase-weapons').checked,powers:ui('phase-powers').checked,
        mainBot:ui('phase-main-bot').checked
      });
      run.active=true;run.finished=false;run.phaseIndex=0;
      run.botCaps=config.botCaps;run.lootCaps=config.lootCaps;
      run.initialBots=config.initialBots;run.lastStageIndex=null;
      run.survivors=[];run.eliminated.clear();run.race=null;
      run.playerQualified=false;
      const lobby=window.MotocaLive?.lobby;
      if(lobby){lobby.setSystemTarget(config.initialBots);lobby.ensureSystemBots();}
      settings?.classList.add('hidden');resultPanel?.classList.add('hidden');
      game.hearts=10;
      startGame(0);
      if(config.mainBot)window.MotocaMainPlayer?.setBot(true);
    });
    ui('phase-result-restart')?.addEventListener('click',()=>{
      resultPanel?.classList.add('hidden');game.openPhaseTourneyMenu();
    });
    ui('phase-result-menu')?.addEventListener('click',()=>showMenu());
    return run;
  }
  return {DEFAULT_BOTS,DEFAULT_LOOT,parseCounts,countAt,selectSurvivors,
    doorSteering,qualificationStatus,planLoot,loadConfig,saveConfig,TournamentLoot,install};
});
if(typeof Game!=='undefined'&&typeof document!=='undefined'){
  FableTournament.install(Game);
}
