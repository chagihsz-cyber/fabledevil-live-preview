/*
 * FableDevil LIVE: deterministic lobby, safe event handling and endless-only
 * runtime integration. The pure exports at the top are also exercised by Node.
 */
"use strict";
(function (root, factory) {
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.MotocaLiveCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function () {
  const LIVE_LIMITS=Object.freeze({minBots:5,maxBots:12,nameLength:20,idleMs:15000});
  const WEAPONS=Object.freeze({
    pistol:{ammo:8,cooldown:.36,pellets:1,speed:720,spread:0},
    smg:{ammo:16,cooldown:.16,pellets:1,speed:760,spread:.025},
    shotgun:{ammo:5,cooldown:.72,pellets:3,speed:650,spread:.14},
  });
  function sanitizeName(value) {
    return String(value??"").normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g,"")
      .replace(/<[^>]*>/g,"")
      .replace(/[^\p{L}\p{N} _.-]/gu,"")
      .replace(/\s+/g," ").trim().slice(0,LIVE_LIMITS.nameLength);
  }
  class LiveLobby {
    constructor(opts={}) {
      this.minBots=opts.minBots??LIVE_LIMITS.minBots;
      this.maxBots=opts.maxBots??LIVE_LIMITS.maxBots;
      this.idleMs=opts.idleMs??LIVE_LIMITS.idleMs;
      this.participants=[];this.lastViewerAt=0;this.systemSequence=0;
    }
    add(rawName,origin="viewer",now=0) {
      if(origin!=="viewer"&&origin!=="system")return null;
      const name=sanitizeName(rawName);
      if(!name)return null;
      const key=name.toLocaleLowerCase("pt-BR");
      if(this.participants.some(p=>p.key===key))return null;
      if(this.participants.length>=this.maxBots){
        if(origin!=="viewer")return null;
        const replace=this.participants.findLastIndex(p=>p.origin==="system");
        if(replace<0)return null;
        this.participants.splice(replace,1);
      }
      const participant={id:"live-"+(this.participants.length+1)+"-"+now,
        name,key,origin};
      this.participants.push(participant);
      if(origin==="viewer")this.lastViewerAt=now;
      return participant;
    }
    remainingMs(now) {
      if(this.participants.length>=this.minBots)return 0;
      return Math.max(0,this.idleMs-(now-this.lastViewerAt));
    }
    tick(now) {
      const added=[];
      if(this.remainingMs(now)>0)return {added,remainingMs:this.remainingMs(now)};
      while(this.participants.length<this.minBots){
        this.systemSequence++;
        const bot=this.add("Bot do sistema "+this.systemSequence,"system",now);
        if(!bot)break;
        added.push(bot);
      }
      return {added,remainingMs:this.remainingMs(now)};
    }
    ensureMinimum(now=Date.now()) {
      const previous=this.lastViewerAt;this.lastViewerAt=now-this.idleMs;
      const result=this.tick(now);this.lastViewerAt=previous;return result;
    }
    clear(){this.participants=[];this.lastViewerAt=0;this.systemSequence=0;}
  }
  function chooseBehindSpawn(positions,floors,sequence=0) {
    const valid=positions.filter(Number.isFinite);
    if(!valid.length)return null;
    const trailing=Math.min(...valid);
    const distance=36+(Math.abs(sequence)%4)*16;
    const desired=trailing-distance;
    const candidates=floors.filter(s=>s.y===480&&s.w>=52)
      .map(s=>Math.max(12,Math.max(s.x+12,Math.min(desired,s.x+s.w-39))))
      .filter(x=>x<=trailing-25)
      .sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));
    return candidates.length?candidates[0]:null;
  }
  class WeaponState {
    constructor(){this.type=null;this.ammo=0;this.lastShot=-Infinity;this.lastGift=-Infinity;}
    equip(type){
      const spec=WEAPONS[type];if(!spec)return false;
      this.type=type;this.ammo=spec.ammo;this.lastShot=-Infinity;return true;
    }
    shoot(now){
      const spec=WEAPONS[this.type];
      if(!spec||this.ammo<=0||now-this.lastShot<spec.cooldown)return [];
      this.lastShot=now;this.ammo--;
      const middle=(spec.pellets-1)/2;
      return Array.from({length:spec.pellets},(_,i)=>({
        speed:spec.speed,angle:(i-middle)*spec.spread,type:this.type,
      }));
    }
    allowGiftDrop(now){
      if(now-this.lastGift<10)return false;
      this.lastGift=now;return true;
    }
  }
  return {LIVE_LIMITS,WEAPONS,sanitizeName,LiveLobby,chooseBehindSpawn,WeaponState};
});

/* Browser adapter. It is intentionally additive and only wraps endless mode. */
(function () {
  if(typeof document==="undefined"||typeof Game==="undefined")return;
  const {LIVE_LIMITS,LiveLobby,chooseBehindSpawn,sanitizeName,WeaponState,WEAPONS}=MotocaLiveCore;
  const lobby=new LiveLobby();
  const byId=id=>document.getElementById(id);
  const rosterEl=byId("live-roster"),countEl=byId("live-roster-count");
  const countdownEl=byId("live-countdown"),feedbackEl=byId("live-feedback");
  const goButton=byId("competition-go"),statusEl=byId("live-status");
  const palette=["#79c6ed","#d4a3e8","#e6d178","#89d29a","#ed9d81",
    "#9eb3ee","#e998c4","#9ed6cc","#e8b36c","#b3d77d","#d1a9ef","#8ed0e8"];
  let simulatedSequence=0,bridge=null;
  const clockMs=()=>Math.floor((typeof performance!=="undefined"?performance.now():Date.now()));

  function feedback(message){if(feedbackEl)feedbackEl.textContent=message;}
  function setStatus(kind,label){
    if(!statusEl)return;
    statusEl.className="live-status "+kind;
    statusEl.textContent="● "+label;
  }
  function renderLobby(now=clockMs()) {
    const result=lobby.tick(now);
    if(result.added.length)feedback("Vagas completadas com bots do sistema.");
    if(rosterEl){
      rosterEl.replaceChildren();
      for(const participant of lobby.participants){
        const item=document.createElement("li");
        const origin=document.createElement("small");
        item.textContent=participant.name;origin.textContent=participant.origin;
        item.appendChild(origin);rosterEl.appendChild(item);
      }
    }
    if(countEl)countEl.textContent=lobby.participants.length+"/"+
      LIVE_LIMITS.maxBots+" participantes";
    const remaining=Math.ceil(lobby.remainingMs(now)/1000);
    if(countdownEl)countdownEl.textContent=lobby.participants.length>=lobby.minBots
      ?"mínimo pronto":"completa em "+remaining+" s";
    if(goButton){
      const ready=lobby.participants.length>=lobby.minBots;
      goButton.disabled=!ready;
      goButton.textContent=ready?"INICIAR COM "+lobby.participants.length+" BOTS":"AGUARDANDO 5 BOTS";
    }
  }
  function addViewer(rawName,now=clockMs()) {
    const participant=lobby.add(rawName,"viewer",now);
    if(participant)feedback(participant.name+" entrou como espectador.");
    else feedback("Nome vazio, repetido ou limite de participantes atingido.");
    renderLobby(now);return participant;
  }
  const nameForm=byId("live-name-form"),nameInput=byId("live-name");
  if(nameForm)nameForm.addEventListener("submit",event=>{
    event.preventDefault();
    if(addViewer(nameInput.value)){nameInput.value="";nameInput.focus();}
  });
  byId("simulate-comment")?.addEventListener("click",()=>{
    simulatedSequence++;
    addViewer(nameInput?.value||("Espectador "+simulatedSequence));
    if(nameInput)nameInput.value="";
  });
  byId("simulate-like")?.addEventListener("click",()=>
    feedback("Curtida simulada recebida; curtidas não criam bots nem drops."));
  byId("simulate-gift")?.addEventListener("click",()=>{
    if(Game.liveWeapons?.requestGiftDrop(clockMs()/1000))
      feedback("Presente simulado: um drop limitado foi criado.");
    else feedback("Presente recebido; drop bloqueado pelo cooldown ou modo atual.");
  });
  byId("competition-btn")?.addEventListener("click",()=>{
    if(!lobby.participants.length)lobby.lastViewerAt=clockMs();
    renderLobby();
  });
  goButton?.addEventListener("click",event=>{
    if(lobby.participants.length<lobby.minBots){
      event.preventDefault();event.stopImmediatePropagation();renderLobby();
    }
  },true);

  function handleBridgeEvent(payload) {
    if(!payload||typeof payload!=="object")return;
    if(payload.type==="status"){
      if(payload.state==="tiktok-connected")setStatus("connected","TIKTOK CONECTADO");
      else if(payload.state==="local")setStatus("local","PONTE LOCAL");
      else setStatus("simulated","SIMULADO");
      feedback(sanitizeName(payload.message)||"Status da ponte atualizado.");
    }else if(payload.type==="chat"){
      const command=String(payload.comment||"").trim().toLocaleLowerCase("pt-BR");
      if(command==="entrar"||command==="!entrar")addViewer(payload.user);
    }else if(payload.type==="gift"){
      Game.liveWeapons?.requestGiftDrop(clockMs()/1000);
    }
  }
  byId("live-connect")?.addEventListener("click",()=>{
    if(typeof EventSource==="undefined"){
      feedback("Este navegador não oferece SSE; o simulador continua ativo.");return;
    }
    bridge?.close();
    bridge=new EventSource("/events");
    setStatus("local","CONECTANDO À PONTE");
    bridge.onopen=()=>{setStatus("local","PONTE LOCAL");feedback("Ponte local conectada; TikTok ainda não confirmado.");};
    bridge.onmessage=event=>{try{handleBridgeEvent(JSON.parse(event.data));}catch{feedback("Evento inválido ignorado.");}};
    bridge.onerror=()=>{setStatus("simulated","SIMULADO · PONTE OFFLINE");feedback("Ponte local indisponível; usando simulador.");};
  });

  const baseZombieSpawn=ZombieHorde.prototype.spawn;
  ZombieHorde.prototype.spawn=function(g){
    if(g.arcadeMode!=="endless")return baseZombieSpawn.call(this,g);
    const race=g.level.traps.find(t=>t.constructor.name==="CompetitionTraining");
    const positions=[g.player?.x,...(race?.rivals||[]).filter(b=>b.alive).map(b=>b.x)];
    const x=chooseBehindSpawn(positions,g.level.solids,this.spawned);
    if(x===null)return false;
    const hitbox=R(x,448,22,32);
    const blocked=g.level.traps.some(t=>t!==this&&typeof t.kills==="function"&&
      t.kills().some(hit=>aabb(hitbox,hit)));
    if(blocked)return false;
    this.zombies.push({x,y:448,vy:0,grounded:true,face:1,life:1,anim:0,spawnT:.55});
    this.spawned++;return true;
  };

  const baseExtend=Game.extendEndlessTerrain;
  Game.extendEndlessTerrain=function(){
    const result=baseExtend.call(this);
    if(this.arcadeMode==="endless"){
      // Endless play has no fake exits or trap teleports. Safe traversal
      // portals remain available in the peaceful/zombie obstacle pool.
      this.level.traps=this.level.traps.filter(t=>t.constructor.name!=="DecoyDoor");
    }
    return result;
  };
  const baseStartEndless=Game.startEndless;
  let fireRequested=false;
  addEventListener("keydown",event=>{
    if(event.code==="KeyF"&&!event.repeat)fireRequested=true;
  });
  byId("tc-fire")?.addEventListener("pointerdown",event=>{
    event.preventDefault();fireRequested=true;
  });

  class LiveWeaponRuntime {
    constructor(){
      this.playerWeapon=new WeaponState();this.botWeapons=new Map();
      this.drops=[];this.projectiles=[];this.nextDropX=1100;this.dropSequence=0;
      this.giftGate=new WeaponState();this.lastHud="";
      this.addDrop(225,"pistol");
    }
    addDrop(x,type){
      if(this.drops.length>=4)return false;
      const kinds=["pistol","smg","shotgun"];
      const selected=WEAPONS[type]?type:kinds[this.dropSequence%kinds.length];
      this.dropSequence++;
      this.drops.push({x:Math.max(85,x),y:452,type:selected});return true;
    }
    requestGiftDrop(now){
      if(Game.arcadeMode!=="endless"||!Game.liveWeaponsEnabled||
         !this.giftGate.allowGiftDrop(now))return false;
      const race=Game.level?.traps.find(t=>t.constructor.name==="CompetitionTraining");
      const lead=Math.max(Game.player?.x||55,...(race?.rivals||[]).map(b=>b.x));
      return this.addDrop(lead+180);
    }
    stateFor(holder){
      if(holder===Game.player)return this.playerWeapon;
      if(!this.botWeapons.has(holder))this.botWeapons.set(holder,new WeaponState());
      return this.botWeapons.get(holder);
    }
    nearestZombie(holder,g){
      let best=null,bestDistance=Infinity;
      for(const horde of g.level.traps.filter(t=>t instanceof ZombieHorde)){
        for(const zombie of horde.zombies){
          const distance=Math.abs(zombie.x-holder.x);
          if(distance<bestDistance&&distance<430){best={horde,zombie};bestDistance=distance;}
        }
      }
      return best;
    }
    fire(holder,g,automatic=false){
      const state=this.stateFor(holder),target=this.nearestZombie(holder,g);
      if(!state.type||state.ammo<=0||(!target&&automatic))return false;
      const direction=target?Math.sign(target.zombie.x-holder.x)||1:(holder.face||1);
      const shots=state.shoot(g.time);
      for(const shot of shots){
        this.projectiles.push({x:holder.x+(direction>0?(holder.w||24):0),
          y:holder.y+14,vx:direction*shot.speed*Math.cos(shot.angle),
          vy:shot.speed*Math.sin(shot.angle),life:1.15,type:shot.type});
      }
      return shots.length>0;
    }
    update(dt,g){
      if(g.state!=="play")return;
      const race=g.level.traps.find(t=>t.constructor.name==="CompetitionTraining");
      const holders=[g.player,...(race?.rivals||[]).filter(b=>b.alive&&b.respawnTimer<=0)];
      const lead=Math.max(...holders.map(h=>h.x));
      if(lead+420>=this.nextDropX){
        this.addDrop(this.nextDropX);this.nextDropX+=900;
      }
      for(let i=this.drops.length-1;i>=0;i--){
        const drop=this.drops[i];
        const holder=holders.find(h=>Math.abs((h.x+(h.w||24)/2)-drop.x)<28&&
          Math.abs((h.y+(h.h||32)/2)-drop.y)<45);
        if(holder){this.stateFor(holder).equip(drop.type);this.drops.splice(i,1);}
      }
      if(fireRequested){this.fire(g.player,g,false);fireRequested=false;}
      if(g.autoFireMain)this.fire(g.player,g,true);
      for(const bot of holders.slice(1))this.fire(bot,g,true);
      for(let i=this.projectiles.length-1;i>=0;i--){
        const bullet=this.projectiles[i];bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.life-=dt;
        let hit=false;
        for(const horde of g.level.traps.filter(t=>t instanceof ZombieHorde)){
          const index=horde.zombies.findIndex(z=>aabb(R(bullet.x-3,bullet.y-2,7,4),R(z.x,z.y,22,32)));
          if(index>=0){
            const zombie=horde.zombies[index];zombie.life=(zombie.life||1)-1;
            if(zombie.life<=0){
              horde.dead.push({x:zombie.x,y:zombie.y,t:0,fall:"shot"});
              horde.zombies.splice(index,1);
            }
            hit=true;break;
          }
        }
        if(hit||bullet.life<=0)this.projectiles.splice(i,1);
      }
      this.updateHud();
    }
    updateHud(){
      const hud=byId("live-weapon-hud"),state=this.playerWeapon;
      if(!hud)return;
      const text=state.type?state.type.toUpperCase()+" · "+state.ammo:"SEM ARMA · PEGUE UM DROP";
      if(text!==this.lastHud){hud.textContent=text;this.lastHud=text;}
    }
    solids(){return []}kills(){return []}
    draw(){
      ctx.save();
      const colors={pistol:"#b9e8ff",smg:"#ffd478",shotgun:"#efa78f"};
      for(const drop of this.drops){
        ctx.fillStyle=colors[drop.type];ctx.fillRect(drop.x-11,drop.y-7,22,7);
        ctx.fillRect(drop.x+2,drop.y,5,8);
        ctx.fillStyle=theme.ink;ctx.font="bold 9px "+FONT;ctx.textAlign="center";
        ctx.fillText(drop.type.toUpperCase(),drop.x,drop.y-12);
      }
      ctx.fillStyle="#fff3ad";
      for(const bullet of this.projectiles)ctx.fillRect(bullet.x-3,bullet.y-2,7,4);
      const race=Game.level?.traps.find(t=>t.constructor.name==="CompetitionTraining");
      const holders=[Game.player,...(race?.rivals||[]).filter(b=>b.alive)];
      for(const holder of holders){
        const state=this.stateFor(holder);if(!state.type||state.ammo<=0)continue;
        const target=this.nearestZombie(holder,Game);
        const direction=target?Math.sign(target.zombie.x-holder.x)||1:(holder.face||1);
        ctx.fillStyle=colors[state.type];ctx.fillRect(
          holder.x+(direction>0?(holder.w||24)-1:-10),holder.y+14,11,4);
      }
      ctx.restore();
    }
  }

  Game.startEndless=function(){
    if((this.requestedEndlessKind||"peace")==="competition")lobby.ensureMinimum(clockMs());
    this.liveWeaponsEnabled=(this.requestedEndlessKind==="zombies")
      ?!!byId("zombie-weapons")?.checked
      :((this.requestedEndlessKind==="competition")&&this.competitionWithZombies&&
        !!byId("competition-weapons")?.checked);
    const result=baseStartEndless.call(this);
    const race=this.level.traps.find(t=>t.constructor.name==="CompetitionTraining");
    if(race){
      race.rivals=lobby.participants.slice(0,LIVE_LIMITS.maxBots).map((p,i)=>({
        name:p.name,origin:p.origin,color:palette[i%palette.length],speed:190+(i*23)%54,
        x:55,y:448,vy:0,vx:0,grounded:true,lives:4,alive:true,
        respawnTimer:0,protectedUntil:0,jumps:0,deadCount:0,safeX:55,
        lastY:448,phase:i*1.31,stuckFor:0,
      }));
    }
    const weaponHud=byId("live-weapon-hud"),fireButton=byId("tc-fire");
    weaponHud?.classList.toggle("hidden",!this.liveWeaponsEnabled);
    fireButton?.classList.toggle("hidden",!this.liveWeaponsEnabled);
    if(this.liveWeaponsEnabled){
      this.liveWeapons=new LiveWeaponRuntime();
      this.level.traps.push(this.liveWeapons);
      this.liveWeapons.updateHud();
    }else this.liveWeapons=null;
    return result;
  };
  if(typeof setInterval==="function")setInterval(()=>renderLobby(),250);
  renderLobby(0);
  window.MotocaLive={lobby,addViewer,renderLobby,handleBridgeEvent,
    simulated:true,realTikTokTested:false};
})();
