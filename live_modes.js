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
  const LIVE_LIMITS=Object.freeze({minBots:5,maxBots:20,nameLength:20,idleMs:15000,
    maxRuntimeObjects:48});
  const LIVE_GIFT_CONFIG=Object.freeze({
    names:Object.freeze({"ROSA":"life"}),
    ids:Object.freeze({"fd-life":"life","fd-portal":"portal","fd-obstacle":"obstacle",
      "fd-horde":"horde","fd-weapon":"weapon","fd-power":"power"}),
  });
  const WEAPONS=Object.freeze({
    pistol:{ammo:8,cooldown:.36,pellets:1,speed:720,spread:0},
    smg:{ammo:16,cooldown:.16,pellets:1,speed:760,spread:.025},
    shotgun:{ammo:5,cooldown:.72,pellets:3,speed:650,spread:.14},
    laser:{ammo:6,cooldown:.48,pellets:1,speed:940,spread:0},
    burst:{ammo:9,cooldown:.28,pellets:2,speed:790,spread:.045},
    glue:{ammo:4,cooldown:1.1,pellets:1,speed:560,spread:0},
  });
  function sanitizeName(value) {
    return String(value??"").normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g,"")
      .replace(/<[^>]*>/g,"")
      .replace(/[^\p{L}\p{N} _.-]/gu,"")
      .replace(/\s+/g," ").trim().slice(0,LIVE_LIMITS.nameLength);
  }
  function parseParticipation(comment,viewer=""){
    const text=String(comment??"").normalize("NFKC").trim();
    const safeViewer=sanitizeName(viewer);
    if(text.startsWith("#")){
      const name=sanitizeName(text.slice(1));
      return name?{name,viewer:safeViewer,legacy:false}:null;
    }
    if(["entrar","!entrar"].includes(text.toLocaleLowerCase("pt-BR"))&&safeViewer)
      return {name:safeViewer,viewer:safeViewer,legacy:true};
    return null;
  }
  function resolveGiftEffect(payload,config=LIVE_GIFT_CONFIG){
    if(!payload||typeof payload!=="object")return null;
    const giftName=String(payload.giftName??"").normalize("NFKC").trim().toLocaleUpperCase("pt-BR");
    const giftId=String(payload.giftId??"").trim();
    return config.names?.[giftName]??config.ids?.[giftId]??null;
  }
  class LiveEventGate{
    constructor(opts={}){
      this.globalMax=opts.globalMax??6;this.globalWindow=opts.globalWindow??2;
      this.cooldowns={life:4,portal:6,obstacle:3,horde:10,weapon:5,power:5,
        ...(opts.cooldowns||{})};
      this.last=new Map();this.recent=[];
    }
    allow(effect,now){
      if(!Number.isFinite(now)||!effect)return false;
      this.recent=this.recent.filter(time=>now-time<this.globalWindow);
      if(this.recent.length>=this.globalMax)return false;
      const cooldown=this.cooldowns[effect]??1;
      if(now-(this.last.get(effect)??-Infinity)<cooldown)return false;
      this.last.set(effect,now);this.recent.push(now);return true;
    }
  }
  class LiveLobby {
    constructor(opts={}) {
      this.minBots=opts.minBots??LIVE_LIMITS.minBots;
      this.maxBots=opts.maxBots??LIVE_LIMITS.maxBots;
      this.idleMs=opts.idleMs??LIVE_LIMITS.idleMs;
      this.participants=[];this.lastViewerAt=0;this.systemSequence=0;
    }
    add(rawName,origin="viewer",now=0,viewer="") {
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
      const participant={id:"live-"+(this.systemSequence+1)+"-"+now+"-"+key,
        name,key,origin,viewer:origin==="viewer"?sanitizeName(viewer)||name:""};
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
  function chooseRiskPortalLanding(origin, floors, hazards=[], portalEntries=[], random=Math.random){
    // An undisclosed outcome: helpful forward warp or a costly safe setback.
    // Landing floors must exist NOW, so the result cannot drop the player
    // into an ungenerated chunk, a pit, or a lethal trigger.
    const forward=random()<.5;
    const direction=forward?1:-1;
    const minDistance=forward?570:490;
    const maxDistance=forward?1420:1090;
    const goal=origin+direction*(minDistance+random()*(maxDistance-minDistance));
    const candidates=floors.filter(f=>f.y===480&&f.w>=95).map(f=>({
      floor:f,x:Math.max(f.x+27,Math.min(goal,f.x+f.w-55)),
    })).filter(({x})=>{
      const distance=(x-origin)*direction;
      if(distance<minDistance||distance>maxDistance)return false;
      const body={x:x-7,y:443,w:44,h:37};
      if(hazards.some(h=>h.w>0&&h.h>0&&
        body.x<h.x+h.w&&body.x+body.w>h.x&&
        body.y<h.y+h.h&&body.y+body.h>h.y))return false;
      if(portalEntries.some(entry=>Math.abs(entry-x)<94))return false;
      return true;
    });
    if(!candidates.length)return null;
    candidates.sort((a,b)=>Math.abs(a.x-goal)-Math.abs(b.x-goal));
    return {x:candidates[0].x,y:480,beneficial:forward,
      distance:Math.abs(candidates[0].x-origin)};
  }
  class WeaponState {
    constructor(){this.type=null;this.ammo=0;this.lastShot=-Infinity;this.lastGift=-Infinity;
      this.expiresAt=-Infinity;this.temporary=false;}
    equip(type){
      const spec=WEAPONS[type];if(!spec)return false;
      this.type=type;this.ammo=spec.ammo;this.lastShot=-Infinity;
      this.expiresAt=Infinity;this.temporary=false;return true;
    }
    grantTemporary(type,now,duration=15){
      const spec=WEAPONS[type];if(!spec||!Number.isFinite(now))return false;
      this.type=type;this.ammo=spec.ammo;this.lastShot=-Infinity;
      this.expiresAt=now+Math.min(15,Math.max(0,duration));this.temporary=true;return true;
    }
    remaining(now){
      if(!this.type)return 0;
      return this.temporary?Math.min(15,Math.max(0,this.expiresAt-now)):Infinity;
    }
    clear(){this.type=null;this.ammo=0;this.expiresAt=-Infinity;this.temporary=false;}
    tick(now){
      if(this.temporary&&now>=this.expiresAt)this.clear();
      return !!this.type;
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
  return {LIVE_LIMITS,LIVE_GIFT_CONFIG,WEAPONS,sanitizeName,parseParticipation,
    resolveGiftEffect,LiveEventGate,LiveLobby,chooseBehindSpawn,
    chooseRiskPortalLanding,WeaponState};
});

/* Browser adapter. It is intentionally additive and only wraps endless mode. */
(function () {
  if(typeof document==="undefined"||typeof Game==="undefined")return;
  const {LIVE_LIMITS,LiveLobby,chooseBehindSpawn,chooseRiskPortalLanding,
    sanitizeName,parseParticipation,resolveGiftEffect,LiveEventGate,
    WeaponState,WEAPONS}=MotocaLiveCore;
  const {ProfileStore,RuleEngine,EFFECTS,normalizeProfile,exportProfiles,importProfiles,
    cleanText}=MotocaLiveRules;
  const lobby=new LiveLobby();
  const byId=id=>document.getElementById(id);
  const rosterEl=byId("live-roster"),countEl=byId("live-roster-count");
  const countdownEl=byId("live-countdown"),feedbackEl=byId("live-feedback");
  const goButton=byId("competition-go"),statusEl=byId("live-status");
  const livePanel=byId("live-panel"),liveToggle=byId("live-panel-toggle");
  const palette=["#79c6ed","#d4a3e8","#e6d178","#89d29a","#ed9d81",
    "#9eb3ee","#e998c4","#9ed6cc","#e8b36c","#b3d77d","#d1a9ef","#8ed0e8"];
  let simulatedSequence=0,bridge=null,effectSequence=0;
  const eventGate=new LiveEventGate(),pendingEffects=[];
  const lastJoinByViewer=new Map();
  const profileStore=new ProfileStore(localStorage);
  let ttsSessionEnabled=false,lastSpokenAt=-Infinity;
  const eventHistory=[];
  const clockMs=()=>Math.floor((typeof performance!=="undefined"?performance.now():Date.now()));
  const colorFor=index=>index<palette.length?palette[index]:
    `hsl(${Math.round((index*137.508)%360)} 62% ${58+(index%3)*6}%)`;

  function createLiveBot(participant,index){
    return {participantId:participant.id,name:participant.name,origin:participant.origin,
      viewer:participant.viewer,color:colorFor(index),speed:265,
      x:55,y:448,w:26,h:32,vy:0,vx:0,grounded:true,face:1,
      squash:0,jumping:false,coyote:0,jumpHold:0,
      lives:Game.maxHearts||10,alive:true,respawnTimer:0,protectedUntil:0,
      jumps:0,deadCount:0,safeX:55,lastY:448,phase:index*1.31,stuckFor:0};
  }
  function syncLiveBots(){
    if(Game.arcadeMode!=="endless"||!Game.level)return null;
    let runtime=Game.level.traps.find(t=>t.constructor?.name==="CompetitionTraining");
    if(!runtime){runtime=new Game.CompetitionTraining("live");Game.level.traps.push(runtime);}
    const current=new Map(runtime.rivals.map(bot=>[bot.participantId,bot]));
    runtime.rivals=lobby.participants.slice(0,LIVE_LIMITS.maxBots).map((participant,index)=>{
      const bot=current.get(participant.id)||createLiveBot(participant,index);
      bot.name=participant.name;bot.origin=participant.origin;bot.viewer=participant.viewer;
      bot.color=colorFor(index);return bot;
    });
    return runtime;
  }

  function feedback(message){if(feedbackEl)feedbackEl.textContent=message;}
  function setStatus(kind,label){
    if(!statusEl)return;
    statusEl.className="live-status "+kind;
    statusEl.textContent="● "+label;
  }
  function setPanel(open){
    livePanel?.classList.toggle("hidden",!open);
    liveToggle?.setAttribute("aria-expanded",String(open));
  }
  liveToggle?.addEventListener("click",()=>
    setPanel(livePanel?.classList.contains("hidden")));
  byId("live-panel-close")?.addEventListener("click",()=>setPanel(false));

  const effectLabels={bot:"Criar bot",life:"+1 vida",portal:"Portal surpresa",
    obstacle:"Obstáculo",horde:"Horda",weapon:"Arma temporária",
    power:"Lentidão não letal",voice:"Mensagem de voz"};
  function eventDescription(event){
    if(event.type==="gift")return "presente "+(event.giftName||event.giftId)+" de "+event.user;
    if(event.type==="like")return event.count+" curtidas de "+event.user;
    if(event.type==="chat")return "comentário de "+event.user+": "+event.comment;
    return ({follow:"novo seguidor",share:"compartilhamento",subscribe:"nova inscrição"}[event.type]||event.type)+
      " de "+event.user;
  }
  function speakEvent(event){
    const profile=profileStore.active();
    if(!profile.tts.enabled||!ttsSessionEnabled||
       typeof speechSynthesis==="undefined"||typeof SpeechSynthesisUtterance==="undefined")return false;
    const now=clockMs()/1000;
    if(now-lastSpokenAt<2)return false;
    const text=cleanText(eventDescription(event),120);if(!text)return false;
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.rate=profile.tts.rate||1;
    const preferred=profile.tts.voice;
    if(preferred){
      const voice=speechSynthesis.getVoices?.().find(item=>item.name===preferred||item.lang===preferred);
      if(voice)utterance.voice=voice;
    }
    speechSynthesis.speak(utterance);lastSpokenAt=now;return true;
  }
  function applyRuleEffect(effect,event){
    if(effect==="bot"){
      const parsed=event.type==="chat"?parseParticipation(event.comment,event.user):null;
      return !!addViewer(parsed?.name||event.user,clockMs(),parsed?.viewer||event.user);
    }
    if(effect==="voice")return speakEvent(event);
    return triggerEffect(effect,clockMs()/1000,event.source,event);
  }
  const ruleEngine=new RuleEngine({profile:profileStore.active(),apply:applyRuleEffect});
  function renderHistory(){
    const list=byId("live-event-history");if(!list)return;
    list.replaceChildren();
    for(const entry of eventHistory){
      const item=document.createElement("li"),source=document.createElement("span"),
        status=document.createElement("span"),message=document.createElement("span");
      source.className="history-source";source.textContent=String(entry.source||"unknown").toUpperCase();
      status.className=entry.status==="applied"?"history-applied":"history-status";
      status.textContent=entry.status.toUpperCase();message.textContent=entry.message;
      item.append(source,status,message);list.appendChild(item);
    }
  }
  function recordResult(result){
    const event=result.event||{};
    const applied=result.effects?.filter(item=>item.applied).map(item=>effectLabels[item.effect]).join(", ");
    const message=(applied?applied+". ":"")+(result.reason||eventDescription(event));
    eventHistory.unshift({source:event.source||"internal",status:result.status,message:cleanText(message,160)});
    eventHistory.splice(30);renderHistory();
    feedback(result.status==="applied"?"Aplicado: "+(applied||"regra concluída"):
      (result.status==="partial"?"Aplicação parcial: "+message:message));
    return result;
  }
  function processEvent(event){return recordResult(ruleEngine.process(event,clockMs()/1000));}
  function simulatedEvent(rule){
    const base={user:"simulador",source:"simulation"};
    if(rule.event==="chat-hash")return {...base,type:"chat",comment:"#Bot teste"};
    if(rule.event==="chat-common")return {...base,type:"chat",comment:"Olá, LIVE!"};
    if(rule.event==="like")return {...base,type:"like",count:rule.likeGoal||1};
    if(rule.event==="gift")return {...base,type:"gift",giftName:rule.giftName,giftId:rule.giftId};
    if(rule.event==="gift-generic")return {...base,type:"gift",giftName:"Presente sem regra",giftId:"unknown"};
    return {...base,type:rule.event};
  }
  function saveRule(ruleId,change){
    const profile=profileStore.active(),rules=profile.rules.map(rule=>
      rule.id===ruleId?{...rule,...change}:rule);
    const saved=profileStore.update(profile.id,{rules});
    ruleEngine.setProfile(saved);renderActiveProfile();return saved;
  }
  function renderActiveProfile(){
    const profile=profileStore.active(),label=byId("live-active-profile");
    if(label)label.textContent="Perfil: "+profile.name;
  }
  function renderRuleEditor(){
    const profile=profileStore.active(),list=byId("live-rule-list");if(!list)return;
    list.replaceChildren();
    for(const rule of profile.rules){
      const row=document.createElement("div");row.className="live-rule";
      const title=document.createElement("div");title.className="live-rule-title";
      const enabledLabel=document.createElement("label");enabledLabel.className="live-rule-enabled";
      const enabled=document.createElement("input");enabled.type="checkbox";enabled.checked=rule.enabled;
      const strong=document.createElement("strong");strong.textContent=rule.label;
      enabledLabel.append(enabled,strong);title.appendChild(enabledLabel);
      const detail=document.createElement("small");
      detail.textContent=rule.event==="gift"?
        "Nome: "+(rule.giftName||"—")+(rule.giftId?" · ID: "+rule.giftId:""):
        (rule.event==="gift-generic"?"Usado quando nenhum presente exato combina":"Evento configurável");
      title.appendChild(detail);
      const effects=document.createElement("div");effects.className="live-rule-effects";
      for(const effect of EFFECTS){
        const label=document.createElement("label"),input=document.createElement("input");
        input.type="checkbox";input.checked=rule.effects.includes(effect);
        input.addEventListener("change",()=>{
          const next=input.checked?[...rule.effects,effect]:rule.effects.filter(item=>item!==effect);
          rule.effects=[...new Set(next)];saveRule(rule.id,{effects:rule.effects});
        });
        const text=document.createElement("span");text.textContent=effectLabels[effect];
        label.append(input,text);effects.appendChild(label);
      }
      const number=document.createElement("div");number.className="live-rule-number";
      const addNumber=(labelText,key,min,max)=>{
        const label=document.createElement("label"),text=document.createElement("span"),
          input=document.createElement("input");
        text.textContent=labelText;input.type="number";input.min=String(min);input.max=String(max);
        input.value=String(rule[key]);input.addEventListener("change",()=>
          saveRule(rule.id,{[key]:Number(input.value)}));
        label.append(text,input);number.appendChild(label);
      };
      if(rule.event==="like")addNumber("Meta","likeGoal",1,1000000);
      addNumber("Cooldown (s)","cooldown",0,3600);
      const actions=document.createElement("div");actions.className="live-rule-actions";
      const test=document.createElement("button");test.type="button";test.className="live-rule-test";
      test.textContent="TESTAR";test.addEventListener("click",()=>processEvent(simulatedEvent(rule)));
      actions.appendChild(test);
      const none=document.createElement("button");none.type="button";none.className="live-rule-none";
      none.textContent="NENHUM EFEITO";none.addEventListener("click",()=>{
        rule.effects=[];saveRule(rule.id,{effects:[]});renderRuleEditor();
      });actions.appendChild(none);
      if(rule.id.startsWith("gift-custom-")){
        const remove=document.createElement("button");remove.type="button";remove.className="live-rule-remove";
        remove.textContent="REMOVER";remove.addEventListener("click",()=>{
          saveRule(rule.id,{});const current=profileStore.active();
          profileStore.update(current.id,{rules:current.rules.filter(item=>item.id!==rule.id)});
          ruleEngine.setProfile(profileStore.active());renderProfileEditor();
        });actions.appendChild(remove);
      }
      enabled.addEventListener("change",()=>saveRule(rule.id,{enabled:enabled.checked}));
      row.append(title,effects,number,actions);list.appendChild(row);
    }
  }
  function populateVoices(){
    const select=byId("live-tts-voice");if(!select||typeof speechSynthesis==="undefined")return;
    const selected=profileStore.active().tts.voice;select.replaceChildren();
    const fallback=document.createElement("option");fallback.value="";fallback.textContent="Voz padrão do navegador";
    select.appendChild(fallback);
    for(const voice of speechSynthesis.getVoices?.()||[]){
      const option=document.createElement("option");option.value=voice.name;
      option.textContent=voice.name+" ("+voice.lang+")";option.selected=voice.name===selected;
      select.appendChild(option);
    }
  }
  function renderProfileEditor(){
    const profile=profileStore.active(),select=byId("live-profile-select");
    if(select){select.replaceChildren();for(const item of profileStore.list()){
      const option=document.createElement("option");option.value=item.id;option.textContent=item.name;
      option.selected=item.id===profile.id;select.appendChild(option);
    }}
    const name=byId("live-profile-name");if(name)name.value=profile.name;
    const tts=byId("live-tts-enabled");if(tts)tts.checked=profile.tts.enabled;
    renderActiveProfile();renderRuleEditor();populateVoices();
  }
  byId("live-profile-select")?.addEventListener("change",event=>{
    const profile=profileStore.select(event.currentTarget.value);if(profile){ruleEngine.setProfile(profile);renderProfileEditor();}
  });
  byId("live-profile-name")?.addEventListener("change",event=>{
    const profile=profileStore.active();profileStore.update(profile.id,{name:event.currentTarget.value});renderProfileEditor();
  });
  byId("live-profile-new")?.addEventListener("click",()=>{
    const profile=profileStore.create("Nova LIVE");ruleEngine.setProfile(profile);renderProfileEditor();
  });
  byId("live-profile-duplicate")?.addEventListener("click",()=>{
    const active=profileStore.active(),profile=profileStore.duplicate(active.id,active.name+" — cópia");
    if(profile){ruleEngine.setProfile(profile);renderProfileEditor();}
  });
  byId("live-profile-delete")?.addEventListener("click",()=>{
    const active=profileStore.active();
    if(typeof confirm==="function"&&!confirm("Excluir o perfil “"+active.name+"”?"))return;
    if(!profileStore.remove(active.id)){feedback("Mantenha pelo menos um perfil.");return;}
    ruleEngine.setProfile(profileStore.active());renderProfileEditor();
  });
  byId("live-gift-form")?.addEventListener("submit",event=>{
    event.preventDefault();const name=cleanText(byId("live-gift-name")?.value,40),
      giftId=cleanText(byId("live-gift-id")?.value,40);
    if(!name&&!giftId){feedback("Informe o nome ou ID exato do presente.");return;}
    const profile=profileStore.active();
    const rule={id:"gift-custom-"+Date.now().toString(36),event:"gift",
      label:"Presente: "+(name||giftId),giftName:name,giftId,enabled:true,cooldown:0,effects:[]};
    profileStore.update(profile.id,{rules:[...profile.rules,rule]});
    ruleEngine.setProfile(profileStore.active());if(byId("live-gift-name"))byId("live-gift-name").value="";
    if(byId("live-gift-id"))byId("live-gift-id").value="";renderProfileEditor();
  });
  byId("live-tts-enabled")?.addEventListener("change",event=>{
    ttsSessionEnabled=event.currentTarget.checked;const profile=profileStore.active();
    profileStore.update(profile.id,{tts:{...profile.tts,enabled:event.currentTarget.checked}});
    feedback(ttsSessionEnabled?"TTS do navegador habilitado neste dispositivo.":"TTS do navegador desligado.");
  });
  byId("live-tts-voice")?.addEventListener("change",event=>{
    const profile=profileStore.active();profileStore.update(profile.id,
      {tts:{...profile.tts,voice:event.currentTarget.value}});
  });
  if(typeof speechSynthesis!=="undefined")speechSynthesis.addEventListener?.("voiceschanged",populateVoices);
  byId("live-export")?.addEventListener("click",()=>{
    const blob=new Blob([exportProfiles(profileStore.snapshot())],{type:"application/json"});
    const link=document.createElement("a");link.href=URL.createObjectURL(blob);
    link.download="fabledevil-live-perfis.json";link.click();setTimeout(()=>URL.revokeObjectURL(link.href),0);
  });
  byId("live-import-file")?.addEventListener("change",event=>{
    const file=event.currentTarget.files?.[0];if(!file)return;
    const reader=new FileReader();reader.onload=()=>{try{
      profileStore.replace(importProfiles(String(reader.result||"")));ruleEngine.setProfile(profileStore.active());
      renderProfileEditor();feedback("Perfis importados e validados.");
    }catch(error){feedback(error.message||"Arquivo de perfis inválido.");}};reader.readAsText(file);
  });
  renderProfileEditor();renderHistory();
  function renderLobby(now=clockMs()) {
    const result=lobby.tick(now);
    if(result.added.length)feedback("Vagas completadas com bots do sistema.");
    if(rosterEl){
      rosterEl.replaceChildren();
      for(const participant of lobby.participants){
        const item=document.createElement("li");
        const origin=document.createElement("small");
        item.textContent=participant.name;
        origin.textContent=participant.origin==="viewer"&&participant.viewer&&
          participant.viewer!==participant.name?"via "+participant.viewer:participant.origin;
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
    syncLiveBots();
  }
  function addViewer(rawName,now=clockMs(),viewer="") {
    const participant=lobby.add(rawName,"viewer",now,viewer);
    if(participant)feedback(participant.name+" entrou na corrida.");
    else feedback("Nome vazio, repetido ou limite de participantes atingido.");
    renderLobby(now);return participant;
  }
  const nameForm=byId("live-name-form"),nameInput=byId("live-name");
  if(nameForm)nameForm.addEventListener("submit",event=>{
    event.preventDefault();
    const name=sanitizeName(nameInput.value);
    if(name){processEvent({type:"chat",user:"simulador",comment:"#"+name,source:"simulation"});
      nameInput.value="";nameInput.focus();}
  });
  byId("simulate-comment")?.addEventListener("click",()=>{
    simulatedSequence++;
    const name=nameInput?.value||("Espectador "+simulatedSequence);
    processEvent({type:"chat",user:"simulador-"+simulatedSequence,
      comment:"#"+name,source:"simulation"});
    if(nameInput)nameInput.value="";
  });
  byId("simulate-like")?.addEventListener("click",()=>{
    const rule=profileStore.active().rules.find(item=>item.event==="like");
    processEvent({type:"like",user:"simulador",count:rule?.likeGoal||1,source:"simulation"});
  });
  for(const [id,giftName] of Object.entries({"simulate-rose":"Rosa",
    "simulate-portal":"Portal","simulate-obstacle":"Obstáculo",
    "simulate-horde":"Horda","simulate-weapon":"Arma","simulate-power":"Poder"}))
    byId(id)?.addEventListener("click",()=>processEvent({type:"gift",user:"simulador",
      giftName,giftId:"legacy-"+giftName.toLocaleLowerCase("pt-BR"),source:"simulation"}));
  byId("competition-btn")?.addEventListener("click",()=>{
    if(!lobby.participants.length)lobby.lastViewerAt=clockMs();
    setPanel(true);
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
      else if(payload.state==="tikfinity-connected")setStatus("connected","TIKFINITY CONECTADO");
      else if(payload.state==="local")setStatus("local","PONTE LOCAL");
      else setStatus("simulated","SIMULADO");
      feedback(sanitizeName(payload.message)||"Status da ponte atualizado.");
    }else processEvent({...payload,source:payload.source||"unknown"});
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

  const endlessSettings=byId("endless-settings");
  byId("endless-btn")?.addEventListener("click",event=>{
    event.preventDefault();event.stopImmediatePropagation();
    menuEl.classList.add("hidden");endlessSettings?.classList.remove("hidden");
    Game.state="endlessSetup";
  },true);
  byId("endless-back")?.addEventListener("click",()=>{
    endlessSettings?.classList.add("hidden");showMenu();
  });
  byId("challenge-btn")?.addEventListener("click",()=>endlessSettings?.classList.add("hidden"),true);
  byId("endless-start")?.addEventListener("click",()=>{
    const zombie=byId("endless-zombies-hard")?.checked?"hard":
      (byId("endless-zombies-easy")?.checked?"easy":"off");
    const variant=byId("endless-variant")?.value||"standard";
    Game.zombieDifficulty=zombie==="hard"?"hard":"easy";
    Game.liveWeaponsEnabled=!!byId("endless-weapons")?.checked;
    Game.liveAutoFire=!!byId("endless-autofire")?.checked;
    if(variant==="standard")Game.requestedEndlessKind=zombie==="off"?"peace":"zombies";
    else{
      Game.requestedEndlessKind="competition";Game.competitionType=variant;
      Game.competitionWithZombies=zombie!=="off";
    }
    endlessSettings?.classList.add("hidden");Game.startEndless();
    window.MotocaMainPlayer?.setBot(!!byId("endless-main-bot")?.checked);
  });

  const baseZombieSpawn=ZombieHorde.prototype.spawn;
  const baseZombieUpdate=ZombieHorde.prototype.update;
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
    this.zombies.push({x,y:448,vy:0,grounded:true,face:1,life:1,anim:0,
      bornAt:g.time,autoShootReadyAt:g.time+2.3,spawnT:1.15});
    this.spawned++;return true;
  };
  ZombieHorde.prototype.update=function(dt,g){
    for(const zombie of this.zombies)
      if(Number.isFinite(zombie.ttl))zombie.ttl-=dt;
    const result=baseZombieUpdate.call(this,dt,g);
    this.zombies=this.zombies.filter(zombie=>!Number.isFinite(zombie.ttl)||zombie.ttl>0);
    return result;
  };

  class RiskPortal {
    constructor(x,y,sectionEnd){
      this.x=x;this.y=y;this.w=30;this.h=48;
      this.arcadeSectionEnd=sectionEnd;this.cool=0;this.t=0;
      this.outcome=null;this.isRiskPortal=true;this.entityCooldown=new WeakMap();
    }
    reset(){this.cool=0;this.t=0;this.outcome=null;this.entityCooldown=new WeakMap();}
    transport(p,g,random=Math.random){
      if(!p||g.state!=="play"||!aabb(p,R(this.x,this.y,this.w,this.h)))return false;
      const last=this.entityCooldown.get(p)??-Infinity;
      if(g.time-last<1.4)return false;
      const lethal=[];
      const otherPortals=[];
      for(const trap of g.level.traps){
        if(trap!==this&&typeof trap.kills==="function")lethal.push(...trap.kills());
        if(trap.isRiskPortal)otherPortals.push(trap.x);
        if(Array.isArray(trap.zombies)){
          for(const zombie of trap.zombies)
            lethal.push(R(zombie.x-34,zombie.y-14,90,65));
        }
      }
      // Protect even from temporarily inactive spikes and solid obstacles.
      for(const trap of g.level.traps){
        if(trap.constructor?.name==="PopSpikes")
          lethal.push(R(trap.x,trap.y-36,trap.w||44,36));
      }
      for(const solid of g.collectSolids()){
        if(solid.y<480&&solid.y+solid.h>443)lethal.push(solid);
      }
      const target=chooseRiskPortalLanding(p.x,g.level.solids,lethal,
        otherPortals,random);
      if(!target)return false;
      p.x=target.x;p.y=target.y-p.h;p.vx=0;p.vy=0;
      p.grounded=true;p.jumping=false;p.coyote=0;
      this.entityCooldown.set(p,g.time);
      this.outcome=target.beneficial?"help":"setback";
      if(typeof AudioFX!=="undefined")AudioFX.poof();
      return true;
    }
    update(dt,g){
      this.t+=dt;this.cool=Math.max(0,this.cool-dt);
      if(g.state!=="play")return;
      this.transport(g.player,g);
    }
    solids(){return []}
    kills(){return []}
    draw(){
      ctx.save();ctx.translate(this.x+this.w/2,this.y+this.h/2);
      const glow=.12+.09*Math.sin(this.t*3);
      ctx.strokeStyle="#f8ba54";ctx.fillStyle="rgba(252,181,61,"+glow+")";
      ctx.lineWidth=3.5;ctx.beginPath();
      ctx.ellipse(0,0,14,22,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle="#fff0b9";ctx.font="bold 20px "+FONT;
      ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("?",0,0);
      ctx.restore();
    }
  }
  class LiveSurprisePortal extends RiskPortal{
    constructor(x,y,sectionEnd){
      super(x,y,sectionEnd);this.warning=.75;this.ttl=10;this.isLiveObject=true;
      this.originalX=x;this.diverted=false;
    }
    transport(entity,g,random=Math.random){
      if(this.warning>0||this.ttl<=0)return false;
      return super.transport(entity,g,random);
    }
    update(dt,g){
      this.warning=Math.max(0,this.warning-dt);this.ttl=Math.max(0,this.ttl-dt);
      if(this.warning===0&&!this.diverted){
        this.diverted=true;
        if(Math.sin(this.originalX*.019)>.35)this.x+=64;
      }
      if(this.ttl>0)super.update(dt,g);
    }
    draw(){
      if(this.ttl<=0)return;
      if(this.warning>0){
        ctx.save();ctx.fillStyle="#ffd37a";ctx.font="bold 11px "+FONT;
        ctx.textAlign="center";ctx.fillText("PORTAL SURPRESA!",this.x+15,this.y-13);
        ctx.restore();return;
      }
      super.draw();
    }
  }
  class LiveObstacle{
    constructor(x,type="spike",sectionEnd=Infinity){
      this.x=x;this.type=type;this.warning=.7;this.ttl=12;
      this.arcadeSectionEnd=sectionEnd;this.isLiveObject=true;this.t=0;
    }
    reset(){this.warning=.7;this.ttl=12;this.t=0;}
    update(dt){this.t+=dt;this.warning=Math.max(0,this.warning-dt);
      this.ttl=Math.max(0,this.ttl-dt);}
    solids(){
      return this.warning===0&&this.ttl>0&&this.type==="wall"
        ?[R(this.x,428,34,52)]:[];
    }
    kills(){
      if(this.warning>0||this.ttl<=0||this.type==="wall")return [];
      if(this.type==="hole")return [R(this.x,465,48,24)];
      if(this.type==="saw")return [R(this.x,448,38,32)];
      return [R(this.x,452,42,28)];
    }
    draw(){
      if(this.ttl<=0)return;
      ctx.save();
      if(this.warning>0){
        ctx.globalAlpha=.45+.35*Math.sin(this.t*18);ctx.fillStyle="#ffcb69";
        ctx.fillRect(this.x,472,44,6);ctx.fillStyle=theme.ink;
        ctx.font="bold 10px "+FONT;ctx.textAlign="center";
        ctx.fillText("!",this.x+22,466);ctx.restore();return;
      }
      if(this.type==="wall"){
        ctx.fillStyle="#a8744f";roundRect(this.x,428,34,52,4);ctx.fill();
      }else if(this.type==="hole"){
        ctx.fillStyle="#080b0c";ctx.fillRect(this.x,465,48,15);
      }else if(this.type==="saw"){
        ctx.fillStyle="#d7dde0";ctx.beginPath();ctx.arc(this.x+19,463,15,0,Math.PI*2);ctx.fill();
      }else{
        ctx.fillStyle="#df6f64";ctx.beginPath();ctx.moveTo(this.x,480);
        ctx.lineTo(this.x+10,452);ctx.lineTo(this.x+21,480);ctx.lineTo(this.x+31,452);
        ctx.lineTo(this.x+42,480);ctx.fill();
      }
      ctx.restore();
    }
  }
  const baseExtend=Game.extendEndlessTerrain;
  Game.extendEndlessTerrain=function(){
    const result=baseExtend.call(this);
    if(this.arcadeMode==="endless"){
      // Endless play has no fake exits or trap teleports. Safe traversal
      // portals remain available in the peaceful/zombie obstacle pool.
      this.level.traps=this.level.traps
        .filter(t=>t.constructor.name!=="DecoyDoor"&&
          !(t.isLiveObject&&t.ttl<=0))
        .flatMap(t=>{
          // The old blue DropPortal had a fixed 137 px destination, which was
          // visible and trivial. In endless it is also an unknown-risk portal.
          if(t.constructor.name==="DropPortal")
            return [new RiskPortal(t.x,t.y,t.arcadeSectionEnd)];
          if(t.constructor.name!=="Teleporter")return [t];
          const count=3+(Math.abs(Math.floor(t.a.x/360)+(this.endlessSeed||0))%3);
          return Array.from({length:count},(_,index)=>
            new RiskPortal(t.a.x+index*52,t.a.y,t.arcadeSectionEnd));
        });
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
      this.drops=[];this.projectiles=[];this.nextDropX=760;this.dropSequence=0;
      this.giftGate=new WeaponState();this.lastHud="";
      this.regularEnabled=!!Game.liveWeaponsEnabled;
      const starter=Game.endlessKind==="peace"?"glue":"pistol";
      if(this.regularEnabled){
        this.playerWeapon.grantTemporary(starter,Game.time,15);
        this.addDrop(240,starter);this.addDrop(480);
      }
    }
    addDrop(x,type){
      if(this.drops.length>=7)return false;
      const kinds=Game.endlessKind==="peace"?["glue"]:
        ["pistol","smg","shotgun","laser","burst","glue"];
      const selected=WEAPONS[type]?type:kinds[this.dropSequence%kinds.length];
      this.dropSequence++;
      // Place pickups on real generated floor, never in a procedural pit.
      const floors=(Game.level?.solids||[]).filter(f=>f.y===480&&f.w>=85);
      const candidates=floors.map(f=>({
        x:Math.max(f.x+30,Math.min(x,f.x+f.w-40)),
      })).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x));
      const landing=candidates.find(f=>Math.abs(f.x-x)<=350);
      if(!landing)return false;
      this.drops.push({x:Math.max(85,landing.x),y:452,type:selected});return true;
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
      if(!this.botWeapons.has(holder)){
        const equipped=new WeaponState();
        if(this.regularEnabled)equipped.grantTemporary(
          Game.endlessKind==="peace"?"glue":"pistol",Game.time,15);
        this.botWeapons.set(holder,equipped);
      }
      return this.botWeapons.get(holder);
    }
    grantTemporary(holder,type,now,duration=15){
      if(!holder||!WEAPONS[type])return false;
      return this.stateFor(holder).grantTemporary(type,now,duration);
    }
    grantTemporaryForEvent(event,type,now){
      const race=Game.level?.traps.find(t=>t.constructor.name==="CompetitionTraining");
      const key=sanitizeName(event?.user).toLocaleLowerCase("pt-BR");
      const bot=(race?.rivals||[]).find(item=>
        item.name.toLocaleLowerCase("pt-BR")===key||item.viewer?.toLocaleLowerCase("pt-BR")===key);
      return this.grantTemporary(bot||Game.player,type,now,15);
    }
    nearestZombie(holder,g,automatic=false){
      let best=null,bestDistance=Infinity;
      const limit=automatic?175:430;
      const shootY=holder.y+14;
      for(const horde of g.level.traps.filter(t=>t instanceof ZombieHorde)){
        for(const zombie of horde.zombies){
          const distance=Math.abs(zombie.x-holder.x);
          if(distance>=bestDistance||distance>limit)continue;
          if(automatic){
            // Do not snipe enemies still materializing. React only to an
            // active enemy in nearby range with a clear horizontal shot.
            if(zombie.spawnT>0||(zombie.autoShootReadyAt??-Infinity)>g.time)continue;
            if(shootY<zombie.y-9||shootY>zombie.y+33)continue;
            const x1=Math.min(holder.x+12,zombie.x+11),
              x2=Math.max(holder.x+12,zombie.x+11);
            if(g.level.solids.some(s=>s.y<=shootY&&s.y+s.h>=shootY&&
              s.x<x2-8&&s.x+s.w>x1+8))continue;
          }
          best={horde,zombie};bestDistance=distance;
        }
      }
      return best;
    }
    fire(holder,g,automatic=false){
      const state=this.stateFor(holder),target=this.nearestZombie(holder,g,automatic);
      if(!state.type||state.ammo<=0||(!target&&automatic))return false;
      const direction=target?Math.sign(target.zombie.x-holder.x)||1:(holder.face||1);
      // Bound the global bullet count with 20 participants on mobile.
      if(this.projectiles.length>=140)return false;
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
      for(const holder of holders){
        const state=this.stateFor(holder),wasTemporary=state.temporary,wasType=state.type;
        state.tick(g.time);
        if(holder===g.player&&wasTemporary&&wasType&&!state.type)
          announceEvent("Arma temporária expirada; disparo interrompido.");
      }
      if(this.regularEnabled){
        this.drops=this.drops.filter(drop=>drop.x>=lead-1100);
        while(lead+420>=this.nextDropX){
          this.addDrop(this.nextDropX);
          this.nextDropX+=440;
        }
      }
      for(let i=this.drops.length-1;i>=0;i--){
        const drop=this.drops[i];
        const holder=holders.find(h=>Math.abs((h.x+(h.w||24)/2)-drop.x)<28&&
          Math.abs((h.y+(h.h||32)/2)-drop.y)<45);
        if(holder){this.stateFor(holder).grantTemporary(drop.type,g.time,15);
          this.drops.splice(i,1);}
      }
      if(fireRequested){this.fire(g.player,g,false);fireRequested=false;}
      if(g.liveAutoFire&&g.autoFireMain)this.fire(g.player,g,true);
      if(g.liveAutoFire)for(const bot of holders.slice(1))this.fire(bot,g,true);
      for(let i=this.projectiles.length-1;i>=0;i--){
        const bullet=this.projectiles[i];bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.life-=dt;
        let hit=false;
        if(bullet.type==="glue"&&race){
          const bot=race.rivals.find(r=>r.alive&&
            aabb(R(bullet.x-4,bullet.y-3,9,6),R(r.x,r.y,24,32)));
          if(bot){bot.slowedUntil=Math.max(bot.slowedUntil||0,race.clock+2);hit=true;}
        }
        for(const horde of hit?[]:g.level.traps.filter(t=>t instanceof ZombieHorde)){
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
      const remaining=state.temporary?" · "+Math.ceil(state.remaining(Game.time))+" s":"";
      const text=state.type?state.type.toUpperCase()+" · "+state.ammo+remaining:
        (this.regularEnabled?"SEM ARMA · PEGUE UM DROP":"SEM ARMA");
      hud.classList.toggle("hidden",!this.regularEnabled&&!state.type);
      byId("tc-fire")?.classList.toggle("hidden",!this.regularEnabled&&!state.type);
      if(text!==this.lastHud){hud.textContent=text;this.lastHud=text;}
    }
    solids(){return []}kills(){return []}
    draw(){
      ctx.save();
      const colors={pistol:"#b9e8ff",smg:"#ffd478",shotgun:"#efa78f",
        laser:"#ff8fda",burst:"#d5b2ff",glue:"#83e2d1"};
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
        // Keep the equipped gun visible even at zero ammo; HUD shows reload need.
        const state=this.stateFor(holder);if(!state.type)continue;
        const target=this.nearestZombie(holder,Game);
        const direction=target?Math.sign(target.zombie.x-holder.x)||1:(holder.face||1);
        ctx.fillStyle=colors[state.type];ctx.fillRect(
          holder.x+(direction>0?(holder.w||24)-1:-10),holder.y+14,11,4);
      }
      ctx.restore();
    }
  }

  class LivePowerRuntime{
    constructor(){this.expiresAt=-Infinity;this.duration=0;this.lastHud="";}
    grant(now,duration=5){
      if(!Number.isFinite(now))return false;
      this.duration=Math.min(15,Math.max(0,duration));this.expiresAt=now+this.duration;
      return this.duration>0;
    }
    remaining(now){return Math.min(15,Math.max(0,this.expiresAt-now));}
    update(_dt,g){
      const hud=byId("live-power-hud");if(!hud)return;
      const remaining=this.remaining(g.time),active=remaining>0;
      hud.classList.toggle("hidden",!active);
      const text=active?"LENTIDÃO · "+Math.ceil(remaining)+" s":"LENTIDÃO";
      if(text!==this.lastHud){hud.textContent=text;this.lastHud=text;}
    }
    solids(){return []}kills(){return []}draw(){}
  }

  function announceEvent(message){
    feedback(message);
    const toast=byId("live-event-toast");
    if(toast){toast.textContent=message;toast.classList.remove("hidden");
      if(typeof setTimeout==="function")setTimeout(()=>toast.classList.add("hidden"),1800);}
  }
  function liveRace(){
    return Game.level?.traps.find(t=>t.constructor?.name==="CompetitionTraining");
  }
  function liveLeader(){
    const race=liveRace();
    return Math.max(Game.player?.x||55,...(race?.rivals||[]).filter(b=>b.alive).map(b=>b.x));
  }
  function floorPointAhead(distance=210){
    const leader=liveLeader(),target=leader+distance;
    const floors=(Game.level?.solids||[]).filter(s=>s.y===480&&s.w>=80&&
      s.x+s.w>=leader+90);
    floors.sort((a,b)=>Math.abs((a.x+a.w/2)-target)-Math.abs((b.x+b.w/2)-target));
    const floor=floors[0];
    return floor?Math.max(floor.x+18,Math.min(target,floor.x+floor.w-70)):null;
  }
  function addTemporaryHorde(){
    let horde=Game.level.traps.find(t=>t instanceof ZombieHorde);
    if(!horde){
      horde=new ZombieHorde({speed:168,spawnEvery:99,maxZombies:28,initialDelay:99});
      Game.level.traps.push(horde);
    }
    horde.maxZombies=28;
    const race=liveRace();
    const positions=[Game.player?.x,...(race?.rivals||[]).filter(b=>b.alive).map(b=>b.x)];
    const count=Math.min(14,28-horde.zombies.length);
    let added=0;
    for(let index=0;index<count;index++){
      const base=chooseBehindSpawn(positions,Game.level.solids,horde.spawned+index);
      if(base===null)break;
      const x=base-Math.floor(index/4)*8;
      const body=R(x,448,22,32);
      const blocked=Game.level.traps.some(t=>t!==horde&&typeof t.kills==="function"&&
        t.kills().some(hit=>aabb(body,hit)));
      if(blocked)continue;
      horde.zombies.push({x,y:448,vy:0,grounded:true,face:1,life:1,anim:0,
        bornAt:Game.time,autoShootReadyAt:Game.time+2.3,spawnT:1.15,
        ttl:12+(index%4)});
      horde.spawned++;added++;
    }
    return added;
  }
  function applyLiveEffect(effect,event={}){
    if(Game.arcadeMode!=="endless"||Game.state!=="play")return false;
    const objects=Game.level.traps.filter(t=>t.isLiveObject&&t.ttl>0);
    if(["portal","obstacle"].includes(effect)&&
       objects.length>=LIVE_LIMITS.maxRuntimeObjects)return false;
    if(effect==="life"){
      if(Game.hearts>=(Game.maxHearts||10)){
        announceEvent("Vida já está no máximo de 10.");return false;
      }
      Game.hearts=Math.min(Game.maxHearts||10,Game.hearts+1);
      const heart=byId("arcade-hearts");
      if(heart)heart.textContent="♥ "+Game.hearts+"/"+(Game.maxHearts||10);
      announceEvent("ROSA: +1 vida (máximo 10).");return true;
    }
    if(effect==="portal"){
      const x=floorPointAhead(190);if(x===null)return false;
      Game.level.traps.push(new LiveSurprisePortal(x,416,x+700));
      announceEvent("Portal surpresa avisado à frente do líder.");return true;
    }
    if(effect==="obstacle"){
      const x=floorPointAhead(245);if(x===null)return false;
      const kinds=["wall","saw","hole","spike","other"];
      const type=kinds[Math.floor(Math.random()*kinds.length)];
      Game.level.traps.push(new LiveObstacle(x,type,x+700));
      announceEvent("Obstáculo "+type+" telegrafado à frente.");return true;
    }
    if(effect==="horde"){
      if(Game.endlessKind==="peace"){
        // Peaceful infinite must never become a lethal zombie mode because
        // of a live gift: use a temporary non-lethal slowdown wave instead.
        const race=liveRace();if(!race?.rivals.length)return false;
        for(const bot of race.rivals)
          bot.slowedUntil=Math.max(bot.slowedUntil||0,race.clock+3);
        announceEvent("Onda de lentidão: rivais atrasados por 3 s, sem mortes.");
        return true;
      }
      const added=addTemporaryHorde();
      if(!added)return false;
      announceEvent("Horda gigante temporária: "+added+" zumbis atrás.");return true;
    }
    if(effect==="weapon"){
      const type=Game.endlessKind==="peace"?"glue":
        (effectSequence++%2?"burst":"laser");
      const added=Game.liveWeapons?.grantTemporaryForEvent(event,type,Game.time)||false;
      if(added)announceEvent("Arma temporária "+type.toUpperCase()+" liberada por 15 s.");
      return added;
    }
    if(effect==="power"){
      const race=liveRace();if(!race?.rivals.length)return false;
      const duration=5;
      for(const bot of race.rivals)
        bot.slowedUntil=race.clock+duration;
      Game.livePower?.grant(Game.time,duration);
      announceEvent("Poder de lentidão: rivais atrasados por 5 s, sem dano.");return true;
    }
    return false;
  }
  function triggerEffect(effect,now=clockMs()/1000,source="simulation",event={}){
    if(!["life","portal","obstacle","horde","weapon","power"].includes(effect))return false;
    if(!eventGate.allow(effect,now)){
      announceEvent("Evento "+effect+" bloqueado por cooldown.");return false;
    }
    if(Game.arcadeMode!=="endless"||Game.state!=="play"){
      if(pendingEffects.length>=8){
        announceEvent("Fila de eventos cheia; aguarde a próxima partida.");return false;
      }
      pendingEffects.push({effect,event});
      announceEvent((source==="simulation"?"Evento simulado":"Evento da LIVE")+
        " agendado para a próxima partida infinita.");return true;
    }
    const applied=applyLiveEffect(effect,event);
    if(!applied&&effect!=="life")
      announceEvent("Evento "+effect+" não pôde ser aplicado com segurança agora.");
    return applied;
  }

  Game.startEndless=function(){
    if((this.requestedEndlessKind||"peace")==="competition")lobby.ensureMinimum(clockMs());
    this.liveWeaponsEnabled=!!this.liveWeaponsEnabled;
    this.liveAutoFire=!!this.liveAutoFire;
    const result=baseStartEndless.call(this);
    const race=syncLiveBots();
    const weaponHud=byId("live-weapon-hud"),fireButton=byId("tc-fire");
    weaponHud?.classList.toggle("hidden",!this.liveWeaponsEnabled);
    fireButton?.classList.toggle("hidden",!this.liveWeaponsEnabled);
    this.liveWeapons=new LiveWeaponRuntime();
    this.livePower=new LivePowerRuntime();
    this.level.traps.push(this.liveWeapons);
    this.level.traps.push(this.livePower);
    this.liveWeapons.updateHud();
    while(pendingEffects.length){const pending=pendingEffects.shift();
      applyLiveEffect(pending.effect,pending.event);}
    return result;
  };
  if(typeof setInterval==="function")setInterval(()=>renderLobby(),250);
  renderLobby(0);
  window.MotocaLive={lobby,addViewer,renderLobby,handleBridgeEvent,processEvent,
    triggerEffect,profileStore,ruleEngine,simulated:true,realTikTokTested:false};
})();
