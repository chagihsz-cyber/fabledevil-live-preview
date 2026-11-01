/* Pure LIVE profile/rule engine shared by the browser and Node tests. */
"use strict";
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  root.MotocaLiveRules=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const STORAGE_KEY="fabledevil_live_profiles_v4";
  const EFFECTS=Object.freeze(["bot","life","portal","obstacle","horde",
    "weapon","power","voice"]);
  const SOURCES=new Set(["simulation","tikfinity","tiktok","internal","unknown"]);
  const EFFECT_SET=new Set(EFFECTS);
  const EVENT_SET=new Set(["chat","like","gift","follow","share","subscribe"]);

  function cleanText(value,max=60){
    return String(value??"").normalize("NFKC")
      .replace(/[\u0000-\u001f\u007f]/g,"")
      .replace(/<[^>]*>/g,"").replace(/[<>]/g,"")
      .replace(/\s+/g," ").trim().slice(0,max);
  }
  function cleanId(value,fallback="profile"){
    return cleanText(value,48).toLocaleLowerCase("pt-BR")
      .replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||fallback;
  }
  function boundedNumber(value,min,max,fallback){
    const number=Number(value);
    return Number.isFinite(number)?Math.min(max,Math.max(min,number)):fallback;
  }
  function defaultRules(){
    return [
      {id:"chat-hash",event:"chat-hash",label:"Comentário #Nome",enabled:true,
        cooldown:0,effects:["bot"]},
      {id:"chat-common",event:"chat-common",label:"Comentário comum",enabled:true,
        cooldown:0,effects:[]},
      {id:"like",event:"like",label:"Meta de curtidas",enabled:true,
        cooldown:0,likeGoal:100,effects:[]},
      {id:"follow",event:"follow",label:"Seguir",enabled:true,cooldown:0,effects:[]},
      {id:"share",event:"share",label:"Compartilhar",enabled:true,cooldown:0,effects:[]},
      {id:"subscribe",event:"subscribe",label:"Inscrição",enabled:true,cooldown:0,effects:[]},
      {id:"gift-rose",event:"gift",label:"Presente: Rosa",giftName:"Rosa",
        giftId:"",enabled:true,cooldown:4,effects:[]},
      {id:"gift-generic",event:"gift-generic",label:"Presente desconhecido",
        enabled:true,cooldown:0,effects:[]},
    ];
  }
  function normalizeRule(input,index=0){
    if(!input||typeof input!=="object")return null;
    const rawEvent=cleanText(input.event,24);
    const allowedEvents=new Set(["chat-hash","chat-common","like","follow","share",
      "subscribe","gift","gift-generic"]);
    if(!allowedEvents.has(rawEvent))return null;
    const fallbackId=rawEvent==="gift"?"gift-custom-"+(index+1):rawEvent;
    const id=cleanId(input.id,fallbackId);
    const effects=Array.isArray(input.effects)?[...new Set(input.effects
      .map(value=>cleanText(value,20)).filter(value=>EFFECT_SET.has(value)))]:[];
    const rule={id,event:rawEvent,
      label:cleanText(input.label,64)||({
        "chat-hash":"Comentário #Nome","chat-common":"Comentário comum",
        like:"Meta de curtidas",follow:"Seguir",share:"Compartilhar",
        subscribe:"Inscrição",gift:"Presente específico",
        "gift-generic":"Presente desconhecido",
      }[rawEvent]),
      enabled:input.enabled!==false,
      cooldown:boundedNumber(input.cooldown,0,3600,0),effects};
    if(rawEvent==="like")rule.likeGoal=Math.floor(boundedNumber(input.likeGoal,1,1000000,100));
    if(rawEvent==="gift"){
      rule.giftName=cleanText(input.giftName,40);
      rule.giftId=cleanText(input.giftId,40);
      if(!rule.giftName&&!rule.giftId)return null;
    }
    return rule;
  }
  function normalizeProfile(input={}){
    const hasRules=Array.isArray(input.rules);
    const rawRules=hasRules?input.rules:defaultRules();
    const rules=[];
    const seen=new Set();
    for(let index=0;index<rawRules.length&&rules.length<48;index++){
      const rule=normalizeRule(rawRules[index],index);
      if(!rule||seen.has(rule.id))continue;
      seen.add(rule.id);rules.push(rule);
    }
    return {
      id:cleanId(input.id,"live-"+Date.now().toString(36)),
      name:cleanText(input.name,40)||"Live sem nome",
      tts:{enabled:input.tts?.enabled===true,
        voice:cleanText(input.tts?.voice,80),rate:boundedNumber(input.tts?.rate,.7,1.4,1)},
      rules,
    };
  }
  const DEFAULT_PROFILE=Object.freeze(normalizeProfile({
    id:"live-padrao",name:"Live padrão",rules:defaultRules(),
  }));
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function normalizedSnapshot(input){
    if(!input||typeof input!=="object"||!Array.isArray(input.profiles))
      throw new Error("Arquivo de perfis inválido.");
    if(input.profiles.length<1)throw new Error("Importe pelo menos um perfil.");
    if(input.profiles.length>32)throw new Error("Limite de 32 perfis excedido.");
    const profiles=input.profiles.map(normalizeProfile);
    const unique=[];const ids=new Set();
    for(const profile of profiles){
      let id=profile.id,suffix=2;
      while(ids.has(id))id=profile.id+"-"+suffix++;
      profile.id=id;ids.add(id);unique.push(profile);
    }
    const active=cleanId(input.activeProfileId,"");
    return {version:1,profiles:unique,
      activeProfileId:ids.has(active)?active:unique[0].id};
  }
  function exportProfiles(snapshot){
    return JSON.stringify(normalizedSnapshot(snapshot),null,2);
  }
  function importProfiles(text){
    if(typeof text!=="string"||text.length>262144)
      throw new Error("Arquivo de perfis inválido ou muito grande.");
    let parsed;
    try{parsed=JSON.parse(text);}catch{throw new Error("JSON de perfis inválido.");}
    return normalizedSnapshot(parsed);
  }

  class ProfileStore{
    constructor(storage,key=STORAGE_KEY){
      this.storage=storage;this.key=key;this.sequence=0;
      this.state={version:1,profiles:[clone(DEFAULT_PROFILE)],activeProfileId:DEFAULT_PROFILE.id};
      try{
        const saved=storage?.getItem?.(key);
        if(saved)this.state=importProfiles(saved);
      }catch{}
    }
    snapshot(){return clone(this.state);}
    list(){return clone(this.state.profiles);}
    active(){return clone(this.state.profiles.find(p=>p.id===this.state.activeProfileId)||
      this.state.profiles[0]);}
    persist(){try{this.storage?.setItem?.(this.key,exportProfiles(this.state));}catch{}
      return this.snapshot();}
    nextId(name){
      const base=cleanId(name,"live");let id=base;
      const ids=new Set(this.state.profiles.map(profile=>profile.id));
      while(ids.has(id))id=base+"-"+(++this.sequence+1);
      return id;
    }
    create(name="Nova LIVE"){
      if(this.state.profiles.length>=32)throw new Error("Limite de 32 perfis atingido.");
      const profile=normalizeProfile({id:this.nextId(name),name,rules:defaultRules()});
      this.state.profiles.push(profile);this.state.activeProfileId=profile.id;this.persist();
      return clone(profile);
    }
    select(id){
      const found=this.state.profiles.find(profile=>profile.id===id);
      if(!found)return null;
      this.state.activeProfileId=found.id;this.persist();return clone(found);
    }
    update(id,patch={}){
      const index=this.state.profiles.findIndex(profile=>profile.id===id);
      if(index<0)return null;
      this.state.profiles[index]=normalizeProfile({...this.state.profiles[index],...patch,id});
      this.persist();return clone(this.state.profiles[index]);
    }
    duplicate(id,name){
      const source=this.state.profiles.find(profile=>profile.id===id);
      if(!source)return null;
      const label=cleanText(name,40)||source.name+" — cópia";
      const copy=normalizeProfile({...clone(source),id:this.nextId(label),name:label});
      this.state.profiles.push(copy);this.state.activeProfileId=copy.id;this.persist();
      return clone(copy);
    }
    remove(id){
      if(this.state.profiles.length<=1)return false;
      const index=this.state.profiles.findIndex(profile=>profile.id===id);
      if(index<0)return false;
      this.state.profiles.splice(index,1);
      if(this.state.activeProfileId===id)this.state.activeProfileId=this.state.profiles[0].id;
      this.persist();return true;
    }
    replace(snapshot){this.state=normalizedSnapshot(snapshot);this.persist();return this.snapshot();}
  }

  function normalizedEvent(input){
    if(!input||typeof input!=="object"||!EVENT_SET.has(input.type))return null;
    const source=SOURCES.has(input.source)?input.source:"unknown";
    const user=cleanText(input.user,20);
    if(!user)return null;
    if(input.type==="chat"){
      const comment=cleanText(input.comment,100);if(!comment)return null;
      return {type:"chat",user,comment,source};
    }
    if(input.type==="like")return {type:"like",user,
      count:Math.floor(boundedNumber(input.count,1,1000000,1)),source};
    if(input.type==="gift"){
      const giftName=cleanText(input.giftName,40),giftId=cleanText(input.giftId,40);
      return giftName||giftId?{type:"gift",user,giftName,giftId,source}:null;
    }
    return {type:input.type,user,source};
  }
  class RuleEngine{
    constructor({profile=DEFAULT_PROFILE,apply=()=>false}={}){
      this.apply=apply;this.lastRun=new Map();this.likeProgress=0;this.setProfile(profile);
    }
    setProfile(profile){this.profile=normalizeProfile(profile);this.lastRun.clear();
      this.likeProgress=0;return clone(this.profile);}
    matchingRule(event){
      let eventName=event.type;
      if(event.type==="chat")eventName=event.comment.startsWith("#")?"chat-hash":"chat-common";
      if(event.type!=="gift")return this.profile.rules.find(rule=>rule.event===eventName);
      const name=event.giftName.toLocaleLowerCase("pt-BR");
      const exact=this.profile.rules.find(rule=>rule.event==="gift"&&
        ((rule.giftName&&rule.giftName.toLocaleLowerCase("pt-BR")===name)||
          (rule.giftId&&rule.giftId===event.giftId)));
      return exact||this.profile.rules.find(rule=>rule.event==="gift-generic");
    }
    process(input,now=Date.now()/1000){
      const event=normalizedEvent(input);
      if(!event||!Number.isFinite(now))return {status:"invalid",reason:"Evento inválido."};
      const rule=this.matchingRule(event);
      if(!rule||!rule.enabled)return {status:"ignored",event,reason:"Regra inativa ou ausente."};
      const last=this.lastRun.get(rule.id)??-Infinity;
      if(now-last<rule.cooldown)return {status:"blocked",event,ruleId:rule.id,
        reason:"Cooldown ativo por "+Math.max(0,rule.cooldown-(now-last)).toFixed(1)+" s."};
      if(rule.event==="like"){
        this.likeProgress+=event.count;
        if(this.likeProgress<rule.likeGoal)return {status:"waiting",event,ruleId:rule.id,
          progress:this.likeProgress,goal:rule.likeGoal,reason:"Meta de curtidas ainda não atingida."};
        this.likeProgress%=rule.likeGoal;
      }
      if(!rule.effects.length)return {status:"ignored",event,ruleId:rule.id,
        progress:this.likeProgress,reason:"Nenhum efeito configurado."};
      this.lastRun.set(rule.id,now);
      const effects=rule.effects.map(effect=>{
        let applied=false;
        try{const value=this.apply(effect,event,rule);applied=value===true||value?.applied===true;}
        catch{}
        return {effect,applied};
      });
      const succeeded=effects.filter(effect=>effect.applied).length;
      return {status:succeeded===effects.length?"applied":succeeded?"partial":"blocked",
        event,ruleId:rule.id,effects,progress:this.likeProgress,
        reason:succeeded?"Efeito aplicado.":"Nenhum efeito pôde ser aplicado."};
    }
  }
  return {STORAGE_KEY,EFFECTS,DEFAULT_PROFILE,cleanText,normalizeRule,normalizeProfile,
    exportProfiles,importProfiles,ProfileStore,RuleEngine,normalizedEvent};
});
