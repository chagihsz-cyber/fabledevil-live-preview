/*
 Motoquinha Arcade: lives, earnable coins, zombie survival and competition training.
 Competitions and LIVE participants are local 2D bots, not network multiplayer.
 Both game and content remain under the project's MIT terms.
*/
"use strict";
(function () {
 const KEY_COINS="motoca_arcade_coins_v1",KEY_LIVES="motoca_arcade_lives_v1";
 const MAX_LIVES=10;
 const walletEl=document.getElementById("arcade-wallet");
 const heartEl=document.getElementById("arcade-hearts");
 const shop=document.getElementById("arcade-shop");
 const noLives=document.getElementById("arcade-out-of-lives");
 const settings=document.getElementById("competition-settings");
 const compResult=document.getElementById("competition-results");
 const getStore=(key, fallback)=>{
   try{const v=localStorage.getItem(key);return v===null?fallback:Number(v)||0;}
   catch{return fallback;}
 };
 Game.coins=Math.max(0,getStore(KEY_COINS,0));
 Game.maxHearts=MAX_LIVES;
 Game.hearts=Math.max(0,Math.min(MAX_LIVES,getStore(KEY_LIVES,MAX_LIVES)));
 Game.awardCoins=function(value) {
   if(!Number.isFinite(value)||value<0)return;
   this.coins+=Math.floor(value);
   try{localStorage.setItem(KEY_COINS,String(this.coins));}catch{}
   updateHud();
 };
 function saveHearts() {
   try{localStorage.setItem(KEY_LIVES,String(Game.hearts));}catch{}
 }
 function updateHud() {
   heartEl.textContent="♥ "+Math.max(0,Game.hearts)+"/"+MAX_LIVES;
   heartEl.classList.toggle("hidden",Game.arcadeMode!=="endless");
   walletEl.textContent="🪙 "+Game.coins;
   const msg="Você tem "+Game.coins+
     " moedas. Nas fases não há limite de vidas. Nos modos infinitos,"+
     " após perder os 10 corações, continuar custa 20 moedas.";
   document.getElementById("shop-status").textContent=msg;
   document.getElementById("buy-heart").classList.add("hidden");
   document.getElementById("lives-buy").disabled=Game.coins<20;
 }
 function buyLife() {
   // "Continuar" applies only to endless runs; keep the same map and distance.
   if(Game.arcadeMode!=="endless" || Game.state!=="livesOut" ||
      Game.coins<20)return false;
   Game.coins-=20;
   Game.hearts=1;
   try{localStorage.setItem(KEY_COINS,String(Game.coins));}catch{}
   updateHud();
   noLives.classList.add("hidden");
   Game.reviveInSurvival();
   return true;
 }
 document.getElementById("buy-heart").addEventListener("click",buyLife);
 document.getElementById("lives-buy").addEventListener("click",buyLife);
 document.getElementById("shop-btn").addEventListener("click",()=>{
   updateHud();shop.classList.remove("hidden");
 });
 document.getElementById("shop-close").addEventListener("click",()=>{
   shop.classList.add("hidden");
 });
 document.getElementById("lives-menu").addEventListener("click",showMenu);
 document.getElementById("lives-restart").addEventListener("click",()=>{
   noLives.classList.add("hidden");
   Game.hearts=MAX_LIVES;
   Game.startEndless();
 });

 const winOriginal=Game.winLevel;
 Game.winLevel=function() {
   const wasCampaign=this.arcadeMode==="campaign"&&this.state==="play";
   const result=winOriginal.call(this);
   if(wasCampaign)this.awardCoins(8);
   return result;
 };

 const oldStart=startGame;
 startGame=function(i) {
   // Campaign is unlimited retries. Lives belong to endless modes only.
   noLives.classList.add("hidden");
   const result=oldStart(i);
   updateHud();
   return result;
 };

 const coreStartEndless=Game.startEndless;
 Game.startEndless=function() {
   // Set mode BEFORE the base generates the first map sections.
   this.endlessKind=this.requestedEndlessKind||"peace";
   coreStartEndless.call(this);
   this.endlessKind=this.requestedEndlessKind||"peace";
   document.getElementById("race-standings").classList.toggle("hidden",
     this.endlessKind!=="competition");
   this.hearts=MAX_LIVES;
   this.lastSafeX=55;
   this.invulnerableUntil=0;
   this.respawnTimer=0;
   if(this.endlessKind==="zombies"){
     const hard=this.zombieDifficulty==="hard";
     this.level.traps.push(new ZombieHorde({
       speed:hard?224:154,spawnEvery:hard?.72:2.2,
       maxZombies:hard?16:7,initialDelay:hard?1.2:2.2}));
     document.getElementById("hud-levelname").textContent=
       hard?"ZUMBIS · DIFÍCIL":"ZUMBIS · FÁCIL";
   } else if(this.endlessKind==="competition") {
     const type=this.competitionType||"race";
     this.level.traps.push(new CompetitionTraining(type));
     if(this.competitionWithZombies)
       this.level.traps.push(new ZombieHorde({
         speed:152,spawnEvery:5.0,maxZombies:3}));
     document.getElementById("hud-levelname").textContent="COMPETIÇÃO · BOTS";
   }
   updateHud();
 };
 Game.startZombieMode=function(difficulty="easy") {
   this.requestedEndlessKind="zombies";
   this.zombieDifficulty=difficulty==="hard"?"hard":"easy";
   return this.startEndless();
 };
 const zombieSettings=document.getElementById("zombie-settings");
 document.getElementById("zombie-btn").addEventListener("click",()=>{
   menuEl.classList.add("hidden");
   zombieSettings.classList.remove("hidden");
   Game.state="zombieSetup";
 });
 document.getElementById("zombie-back").addEventListener("click",()=>{
   zombieSettings.classList.add("hidden");showMenu();
 });
 document.getElementById("zombie-start").addEventListener("click",()=>{
   const choice=document.querySelector('input[name="zombie-difficulty"]:checked');
   zombieSettings.classList.add("hidden");
   Game.startZombieMode(choice?.value||"easy");
 });
 // Existing peaceful button uses the original call and defaults to "peace".
 document.getElementById("endless-btn").addEventListener("click",()=>{
   Game.requestedEndlessKind="peace";
 },true);

 Game.reviveInSurvival=function() {
   this.state="play";
   this.deathT=0;
   this.respawnTimer=0;
   // Choose a real nearby floor for the respawn, never an endless-mode gap.
   const floors=this.level.solids.filter(s=>s.y===480&&s.w>=80);
   const desired=Math.max(55,this.lastSafeX??this.player.x-170);
   const standing=floors.find(s=>desired>=s.x+12&&desired<=s.x+s.w-38);
   const landing=standing||floors.reduce((best,s)=>
     Math.abs(s.x-desired)<Math.abs(best.x-desired)?s:best,
     floors[0]||{x:55,w:260});
   this.player.x=Math.max(landing.x+14,Math.min(desired,landing.x+landing.w-38));
   this.player.y=440;this.player.vx=0;this.player.vy=0;
   this.invulnerableUntil=this.time+1.5;
   this.player.w=26;this.player.h=32;
   this.morph=null;this.reverseUntil=0;
   const zombie=this.level.traps.find(t=>t instanceof ZombieHorde);
   if(zombie)zombie.zombies=[];
   hudEl.classList.remove("hidden");
   setTouchControlsVisible(true);
 };
 const dieOriginal=Game.die;
 Game.die=function(x,y) {
   if(this.arcadeMode==="endless"&&
      this.time<(this.invulnerableUntil||0))return;
   return dieOriginal.call(this,x,y);
 };
 const updatePlayOriginal=Game.updatePlay;
 Game.updatePlay=function(dt) {
   const ret=updatePlayOriginal.call(this,dt);
   if(this.arcadeMode==="endless"&&
      this.player?.grounded&&this.state==="play"){
     const p=this.player;
     const ground=this.level.solids.some(s=>s.y===480&&s.w>=75&&
       p.x+p.w>s.x+5&&p.x<s.x+s.w-5);
     if(ground)this.lastSafeX=p.x;
   }
   return ret;
 };
 const updateOriginal=Game.update;
 Game.update=function(dt) {
   if(this.arcadeMode==="endless"&&this.state==="respawnDelay"){
     this.time+=dt;
     // Rival racers and chasing zombies keep moving during the player's
     // half-second penalty; a dead player does not freeze the whole race.
     const waitingState=this.state;
     this.state="play";
     for(const t of this.level.traps) {
       if(t instanceof CompetitionTraining||t instanceof ZombieHorde)
         t.update(dt,this);
       if(this.state!=="play")break;
     }
     if(this.state!=="play")return;
     this.state=waitingState;
     this.respawnTimer-=dt;
     if(this.respawnTimer<=0) {
       if(this.hearts<=0&&this.endlessKind==="competition")
         this.showCompetitionResult("Você perdeu suas dez vidas");
       else if(this.hearts<=0) {
         this.state="livesOut";
         hudEl.classList.add("hidden");
         setTouchControlsVisible(false);
         document.getElementById("out-lives-caption").textContent=
           "Continuar na mesma corrida custa 20 moedas. Saldo: "+
           this.coins+" moedas.";
         noLives.classList.remove("hidden");
         updateHud();
       } else this.reviveInSurvival();
     }
     return;
   }
   const prior=this.state;
   const result=updateOriginal.call(this,dt);
   if(prior==="play"&&this.state==="dead"&&this.arcadeMode==="endless") {
     this.hearts=Math.max(0,this.hearts-1);
     updateHud();
     this.state="respawnDelay";
     this.respawnTimer=.5;
     this.invulnerableUntil=this.time+1.6;
     this.reverseUntil=0;
     this.reverseType=null;
     this.gravityDir=1;
     this.invertControls=false;
     this.remoteLock=false;
     this.morph=null;
   }
   return result;
 };

 class CompetitionTraining {
   // One shared map and hazard set for the human and all simulated rivals.
   constructor(type) {
     this.type=type;this.clock=0;
     this.rivals=[
       {name:"Motoca Azul",color:"#79c6ed",speed:265},
       {name:"Motoca Roxo",color:"#d4a3e8",speed:265},
       {name:"Motoca Amarelo",color:"#e6d178",speed:265},
     ].map((b,i)=>({...b,x:55,y:448,w:26,h:32,vy:0,vx:0,
       grounded:true,face:1,squash:0,jumping:false,coyote:0,jumpHold:0,
       lives:MAX_LIVES,alive:true,respawnTimer:0,protectedUntil:0,jumps:0,deadCount:0,
       safeX:55,lastY:448,phase:i*1.31}));
   }
   reset(){}
   botHit(bot,g) {
     const b=R(bot.x+3,bot.y+3,bot.w-6,bot.h-4);
     if(bot.y>H+36 || bot.y< -90)return true;
     for(const trap of g.level.traps) {
       if(trap===this||typeof trap.kills!=="function")continue;
       if(trap.kills().some(hit=>aabb(b,hit)))return true;
       if(trap instanceof ZombieHorde &&
          trap.zombies.some(z=>aabb(b,R(z.x,z.y,22,32))))return true;
     }
     return false;
   }
   loseLife(bot,g) {
     if(this.clock<bot.protectedUntil)return;
     bot.lives=Math.max(0,bot.lives-1);
     bot.deadCount++;
     bot.respawnTimer=.5;
     bot.vx=0;bot.vy=0;
     if(bot.lives===0)bot.alive=false;
   }
   update(dt,g) {
     if(g.state!=="play")return;
     this.clock+=dt;
     for(const bot of this.rivals) {
       if(!bot.alive)continue;
       if(bot.respawnTimer>0) {
         bot.respawnTimer=Math.max(0,bot.respawnTimer-dt);
         if(bot.respawnTimer===0) {
           const floors=g.level.solids.filter(s=>s.y===480&&s.w>=60);
           const desired=Math.max(35,bot.safeX-90);
           const floor=floors.find(s=>desired>=s.x+8&&desired<=s.x+s.w-28)||
             floors.reduce((a,b)=>Math.abs(a.x-desired)<Math.abs(b.x-desired)?a:b,
               {x:35,w:140});
           bot.x=Math.max(floor.x+8,Math.min(desired,floor.x+floor.w-35));
           bot.y=448;bot.vx=0;bot.vy=0;bot.grounded=true;
           bot.jumping=false;bot.jumpHold=0;bot.squash=0;
           bot.protectedUntil=this.clock+.8;
         }
         continue;
       }
       // Live collisions: same platforms, spikes, saws and gaps as the human.
       const solids=[...g.level.solids];
       for(const trap of g.level.traps) {
         if(trap!==this&&typeof trap.solids==="function")
           solids.push(...trap.solids());
       }
       const floors=solids.filter(s=>s.y===480&&s.w>35);
       const playerFloor=floors.find(s=>bot.x+12>=s.x&&bot.x+12<s.x+s.w);
       const edge=playerFloor?playerFloor.x+playerFloor.w:bot.x+bot.w;
       const edgeDistance=edge-(bot.x+bot.w);
       const upcoming=floors.filter(s=>s.x>=edge-2).sort((a,b)=>a.x-b.x)[0];
       const gap=upcoming?upcoming.x-edge:Infinity;
       const danger=g.level.traps.some(t=>t!==this&&
         typeof t.kills==="function"&&t.kills().some(h=>
           h.x>bot.x+22&&h.x<bot.x+123&&
           h.y<bot.y+43&&h.y+h.h>bot.y-17));
       const wallAhead=solids.some(s=>!s.pushable&&s.y+s.h>bot.y+17&&s.y<bot.y+32&&
         s.x>bot.x+bot.w-5&&s.x<bot.x+87);
       const riskPortal=g.level.traps.find(t=>t.isRiskPortal&&
         t.x>bot.x-8&&t.x<bot.x+105);
       let takesPortal=false;
       if(riskPortal){
         const chance=(Math.sin(riskPortal.x*.071+bot.phase*3.1)+1)/2;
         takesPortal=chance<.46&&bot.lives>1;
         bot.portalChoice=takesPortal?"risk":"avoid";
       }
       const needsGapJump=playerFloor&&edgeDistance<78&&
         edgeDistance>-18&&gap>15;
       const shouldJump=bot.grounded&&(needsGapJump||wallAhead||danger||
         (riskPortal&&!takesPortal));
       // Match the original protagonist's 265 px/s speed, 2600/1800
       // ground/air acceleration, -645 jump, 2150 gravity and 980 fall cap.
       // The AI decides WHEN to jump, never receives extra movement power.
       const oldX=bot.x,oldY=bot.y;
       const slowFactor=this.clock<(bot.slowedUntil||0)?.46:1;
       const target=265*slowFactor;
       const acceleration=bot.grounded?2600:1800;
       if(target>bot.vx)bot.vx=Math.min(target,bot.vx+acceleration*dt);
       else if(target<bot.vx)bot.vx=Math.max(target,bot.vx-acceleration*dt);
       bot.speed=265;
       bot.face=bot.vx<0?-1:1;
       if(shouldJump&&bot.grounded){
         bot.vy=-645;bot.grounded=false;bot.jumping=true;
         bot.jumpHold=.24;bot.jumps++;
       }
       bot.jumpHold=Math.max(0,(bot.jumpHold||0)-dt);
       if(bot.vy>=0)bot.jumping=false;
       if(bot.jumpHold<=0&&bot.jumping&&bot.vy<-220){
         bot.vy=-220;bot.jumping=false;
       }
       bot.vy=Math.min(bot.vy+2150*dt,980);
       bot.x+=bot.vx*dt;
       for(const solid of solids){
         if(!aabb(bot,solid))continue;
         // Same pushable-crate behavior as the original player.
         if(solid.pushable&&typeof solid.tryPush==='function'&&
           solid.tryPush(bot.vx*dt,solids)){
           bot.x=bot.vx>0?solid.x-bot.w:solid.x+solid.w;
           continue;
         }
         if(bot.vx>0)bot.x=solid.x-bot.w;
         else if(bot.vx<0)bot.x=solid.x+solid.w;
         bot.vx=0;
       }
       bot.y+=bot.vy*dt;
       const wasGrounded=bot.grounded;
       bot.grounded=false;
       for(const solid of solids){
         if(!aabb(bot,solid))continue;
         if(bot.vy>0){
           bot.y=solid.y-bot.h;
           if(!wasGrounded&&bot.vy>350)bot.squash=.12;
           bot.vy=0;bot.grounded=true;
         }else if(bot.vy<0){
           bot.y=solid.y+solid.h;bot.vy=0;
         }
       }
       bot.squash=Math.max(0,(bot.squash||0)-dt);
       if(bot.grounded)bot.safeX=bot.x;
       bot.stuckFor=bot.x<=oldX+.2?(bot.stuckFor||0)+dt:0;
       if(bot.stuckFor>1.1&&bot.grounded){
         bot.vy=-645;bot.grounded=false;bot.jumping=true;
         bot.jumpHold=.24;bot.stuckFor=0;bot.jumps++;
       }
       if(riskPortal&&takesPortal&&typeof riskPortal.transport==="function")
         riskPortal.transport(bot,g);
       if(this.botHit(bot,g))this.loseLife(bot,g);
     }
     const stand=document.getElementById("race-standings");
     if(stand && g.endlessKind==="competition"&&
       this.clock-(this.lastHudUpdate||0)>.15) {
       this.lastHudUpdate=this.clock;
       stand.classList.remove("hidden");
       const positions=[
         {name:"Você",x:g.player.x,live:g.hearts,alive:g.hearts>0},
         ...this.rivals.map(b=>({name:b.name,x:b.x,live:b.lives,alive:b.alive}))
       ].sort((a,b)=>b.x-a.x);
       stand.replaceChildren();
       for(let i=0;i<positions.length;i++){
         const line=document.createElement("div");
         const b=positions[i];
         line.textContent=(i+1)+"º "+b.name+" · "+Math.max(0,Math.floor((b.x-55)/10))+
           " m · ♥"+b.live+(b.alive?"":" ☠");
         if(b.name==="Você")line.classList.add("racer-you");
         stand.appendChild(line);
       }
     }
     if(this.type==="race"){
       if(g.endlessScore>=350){g.showCompetitionResult("Você chegou à meta!");return;}
       const winner=this.rivals.find(b=>b.alive&&b.x>=3555);
       if(winner){g.showCompetitionResult(winner.name+" chegou primeiro.");return;}
     }else if(this.type==="distance"&&this.clock>=60){
       const rank=1+this.rivals.filter(b=>b.x>g.player.x).length;
       g.showCompetitionResult("Tempo esgotado. Sua posição: "+rank+"º");
     }else if(this.type==="last"){
       if(this.rivals.every(b=>!b.alive)){
         g.showCompetitionResult("Você foi o último sobrevivente!");
       }else if(this.clock>=100){
         g.showCompetitionResult("Fim por tempo: compare os sobreviventes.");
       }
     }
   }
   solids(){return []}
   kills(){return []}
   draw(){
     ctx.save();
     for(const b of this.rivals){
       if(!b.alive||b.respawnTimer>0)continue;
       const camera=Game.cameraX||0;
       if(b.x<camera-90||b.x>camera+1050)continue;
       ctx.globalAlpha=b.protectedUntil>this.clock?.48:.75;
       Game.drawPlayer(b,b.color);
       if(this.clock<(b.slowedUntil||0)){
         ctx.strokeStyle="#9be6d8";ctx.lineWidth=2;ctx.strokeRect(b.x-3,b.y-3,30,38);
       }
       ctx.globalAlpha=.85;ctx.fillStyle=theme.paper;
       ctx.font="10px "+FONT;ctx.fillText(
         b.name+" ♥"+b.lives,b.x-14,b.y-9);
     }
     ctx.restore();
   }
 }
 Game.CompetitionTraining=CompetitionTraining;

 Game.showCompetitionResult=function(reason) {
   if(this.state==="competitionResult")return;
   this.state="competitionResult";
   hudEl.classList.add("hidden");
   setTouchControlsVisible(false);
   document.getElementById("endless-result").classList.add("hidden");
   let lines=reason+"\nSua distância: "+(this.endlessScore||0)+" m";
   const race=this.level.traps.find(t=>t instanceof CompetitionTraining);
   if(race)lines+="\n"+race.rivals.map(b=>b.name+": "+
     Math.floor((b.x-55)/10)+" m"+(" ♥"+b.lives+(b.alive?"":" (eliminado)"))).join("\n");
   document.getElementById("competition-score").textContent=lines;
   compResult.classList.remove("hidden");
 };
 const originalEndlessResult=Game.endEndlessRun;
 Game.endEndlessRun=function() {
   if(this.endlessKind==="competition") {
     this.showCompetitionResult("Partida encerrada");
     return;
   }
   return originalEndlessResult.call(this);
 };

 function beginCompetition() {
   settings.classList.add("hidden");
   Game.competitionType=document.getElementById("competition-type").value;
   Game.competitionWithZombies=!!document.getElementById("competition-zombies").checked;
   Game.requestedEndlessKind="competition";
   Game.startEndless();
 }
 document.getElementById("competition-btn").addEventListener("click",()=>{
   menuEl.classList.add("hidden");settings.classList.remove("hidden");
   Game.state="competitionSetup";
 });
 document.getElementById("competition-go").addEventListener("click",beginCompetition);
 document.getElementById("competition-back").addEventListener("click",showMenu);
 document.getElementById("competition-again").addEventListener("click",()=>{
   compResult.classList.add("hidden");beginCompetition();
 });
 document.getElementById("competition-menu").addEventListener("click",showMenu);
 const menuOriginal=showMenu;
 showMenu=function() {
   shop.classList.add("hidden");noLives.classList.add("hidden");
   settings.classList.add("hidden");compResult.classList.add("hidden");
   zombieSettings.classList.add("hidden");
   document.getElementById("race-standings").classList.add("hidden");
   if(Game.hideLabOverlays)Game.hideLabOverlays();
   Game.hearts=MAX_LIVES;
   const result=menuOriginal();
   updateHud();
   return result;
 };
 const labMenuListenerFix=()=>{}; // legacy listeners resolve showMenu lexically.
 updateHud();
 window.MotocaAdventure={getWallet:()=>Game.coins,getLives:()=>Game.hearts,
   buyLife,competitiveBots:true,realMultiplayer:false};
})();
