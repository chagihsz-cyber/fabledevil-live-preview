/* Motoquinha Arcade — original new modes atop MIT-licensed FableDevil code. */
"use strict";
(function () {
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const ORIGINAL_LEVELS = LEVELS.length;
  const PAGE_SIZE = 24;
  let page = 0;
  function proceduralLevel(i) {
    const random = rng(Math.imul(i + 73, 2654435761));
    const variant = (i - ORIGINAL_LEVELS) % 18;
    const stage = i + 1;
    const difficulty = Math.min(1, (stage - ORIGINAL_LEVELS) / 120);
    const jitter = (a,b) => Math.round(a + random() * (b-a));
    return {
      name: "DESAFIO " + stage,
      generated: true,
      build() {
        const solids = [wallL(),wallR()];
        const traps = [];
        const offset = jitter(-18,18);
        if (variant === 0) {
          solids.push(floorSeg(0,960));
          for(let j=0;j<2+(difficulty>.7?1:0);j++)
            traps.push(new PopSpikes(270+j*230+offset,480,48,null,{
              period:1.7+random()*.45,phase:j*.35,holdOut:.66+difficulty*.1}));
        } else if (variant === 1) {
          solids.push(floorSeg(0,315+offset),floorSeg(393+offset,630),
            floorSeg(709,960));
          traps.push(new Note(400,430,"pule com cuidado"));
        } else if (variant === 2) {
          solids.push(floorSeg(0,960),roof(30));
          for(let j=0;j<2+(difficulty>.6?1:0);j++) {
            const x=260+j*245+offset;
            traps.push(new FallBlock(R(x,30,58,40),R(x-80,250,70,230),{
              shakeTime:.12-difficulty*.045}));
          }
        } else if (variant === 3) {
          solids.push(floorSeg(0,960));
          traps.push(new Conveyor(R(310+offset,480,260,60),{
            dir:-1,force:125+difficulty*60}));
          traps.push(new PopSpikes(770,480,54,R(715,310,22,170),{delay:.15}));
        } else if (variant === 4) {
          solids.push(floorSeg(0,430),R(470,315,490,16),floorSeg(595,960));
          traps.push(new Spring(335,480,{power:-1050-difficulty*100}));
          traps.push(new PopSpikes(780,315,48,R(725,170,18,140),{delay:.11}));
          return {spawn:{x:55,y:440},door:new Door([{x:875,y:251}]),
            solids,traps};
        } else if (variant === 5) {
          solids.push(floorSeg(0,960),roof(30));
          traps.push(new Laser({x:470+offset,y:30,len:449,vertical:true,
            period:2.1-.3*difficulty,warn:.5,fire:.37+difficulty*.08}));
          traps.push(new PopSpikes(745,480,53,R(700,325,20,155),{delay:.12}));
        } else if (variant === 6) {
          solids.push(floorSeg(0,260),floorSeg(675,960));
          traps.push(new CrumblePlatform(R(288,460,110,17),{delay:.5}));
          traps.push(new CrumblePlatform(R(418,420,110,17),{delay:.5}));
          traps.push(new CrumblePlatform(R(548,460,110,17),{delay:.5}));
        } else if (variant === 7) {
          solids.push(floorSeg(0,960),roof(30));
          traps.push(new FallBlock(R(300+offset,30,68,42),
            R(250+offset,240,45,240),{shakeTime:.13}));
          traps.push(new PopSpikes(660,480,62,null,{period:1.9,phase:.75,holdOut:.7}));
        } else if (variant === 8) {
          // Gravity zone with a real, reachable ceiling; controls stay normal.
          solids.push(floorSeg(0,960),R(210,115,550,19));
          traps.push(new ChaosRoom(235,500,"gravity",{y:95,h:385,
            label:"↑ DESAFIO DE GRAVIDADE"}));
          traps.push(new PopSpikes(570,480,45,
            R(525,335,20,145),{delay:.18}));
          traps.push(new Note(470,240,"o teto virou o chão"));
        } else if (variant === 9) {
          // Reverse gravity with a reachable roof and an unmistakable cue.
          solids.push(floorSeg(0,960),R(175,115,580,19));
          traps.push(new ChaosRoom(190,555,"gravity",{y:95,h:385}));
          traps.push(new Note(470,200,"↑ gravidade invertida ↑"));
        } else if (variant === 10) {
          // The box must press the switch to extend a bridge.
          solids.push(floorSeg(0,525),floorSeg(695,960));
          traps.push(new PushCrate(300,440,40,40));
          traps.push(new PressureBridge(525,480,171,450,{plateW:55}));
          traps.push(new Note(388,385,"empurre a caixa até o botão"));
        } else if (variant === 11) {
          // Only a compressed character fits through the 24px-high corridor.
          solids.push(floorSeg(0,960),R(345,85,265,370));
          traps.push(new MorphPad(225,"slim",{duration:9}));
          traps.push(new Note(430,365,"fique pequeno para passar"));
        } else if (variant === 12) {
          // Switches grow/retract a bridge; the pad changes body proportions.
          solids.push(floorSeg(0,525),floorSeg(690,960));
          traps.push(new MorphPad(205,"tall",{duration:6}));
          traps.push(new MorphPad(334,"wide",{duration:6}));
          traps.push(new StretchBridge(525,480,167,395));
          traps.push(new Note(360,375,"o botão estica a ponte"));
        } else if (variant === 13) {
          // Blade-shaped objects are actually harmless platforms.
          solids.push(floorSeg(0,310),floorSeg(700,960));
          traps.push(new SawPlatform(330,445,105));
          traps.push(new SawPlatform(465,415,105));
          traps.push(new SawPlatform(600,445,100));
          traps.push(new Note(490,345,"nem toda serra machuca!"));
        } else if (variant === 14) {
          // A fake floor loses solidity when a player approaches it.
          // Escadaria alternativa segura: mesmo que a primeira
          // plataforma desapareça, as serras falsas levam à saída.
          solids.push(floorSeg(0,335),floorSeg(705,960));
          traps.push(new PhantomFloor(343,460,96,{trigger:320}));
          traps.push(new SawPlatform(370,430,96));
          traps.push(new SawPlatform(489,401,100));
          traps.push(new SawPlatform(611,432,105));
          traps.push(new Note(400,350,"nem tudo é o que parece"));
        } else if (variant === 15) {
          // In this prank room the FIRST door is real, others are traps.
          solids.push(floorSeg(0,960));
          traps.push(new DecoyDoor(605,416,"kill"));
          traps.push(new DecoyDoor(810,416,"teleport",95));
          traps.push(new Note(465,325,"a primeira porta era real"));
          return {spawn:{x:55,y:440},door:new Door([{x:300,y:416}]),
            solids,traps};
        } else if (variant === 16) {
          solids.push(floorSeg(0,960));
          traps.push(new Teleporter(215,416,737,416,{twoWay:true}));
          traps.push(new PopSpikes(500,480,58,null,{period:2,phase:.4,holdOut:.7}));
          traps.push(new Note(485,320,"um portal muda tudo"));
        } else {
          // High-gravity reversal challenge, without reversed movement keys.
          solids.push(floorSeg(0,960),R(218,110,535,20));
          traps.push(new ChaosRoom(230,510,"gravity",{y:90,h:390,label:"↑ TETO MAGNÉTICO"}));
          traps.push(new Teleporter(360,416,705,416,{twoWay:false}));
          traps.push(new Note(465,208,"nada aqui está na ordem certa"));
        }
        // Dificuldade das fases avançadas: COMBINAR mecanismos na mesma sala,
        // com avisos e espaço de reação em vez de apenas aumentar os espinhos.
        if(stage>=39) {
          if([0,2,3,7,8,13,14,16].includes(variant)) {
            traps.push(new Saw([{x:570,y:300},{x:710,y:345}],
              {r:17+Math.floor(difficulty*3),speed:95+difficulty*55}));
          }
          if([1,2,5,8,12,14,16].includes(variant)) {
            traps.push(new DarknessZone(405,360,{visibility:115}));
          }
          if([0,3,5,7,13].includes(variant)) {
            traps.push(new PhantomFloor(320,375,85,{trigger:290}));
          }
        }
        return {spawn:{x:55,y:440},door:new Door([{x:884,y:416}]),
          solids,traps};
      }
    };
  }
  function ensureLevels(count) {
    while (LEVELS.length < count) {
      const index=LEVELS.length;
      LEVELS.push(index<ORIGINAL_LEVELS+CHAPTER_2_LEVELS.length
        ? CHAPTER_2_LEVELS[index-ORIGINAL_LEVELS]
        : proceduralLevel(index));
    }
  }
  ensureLevels(ORIGINAL_LEVELS+24);
  function highestUnlocked() {
    const done = getDone();
    let i=0;
    while(done[i]) i++;
    return i;
  }
  const winOriginal = Game.winLevel;
  Game.winLevel = function() {
    if (this.arcadeMode==="endless") return;
    ensureLevels(this.levelIndex+2);
    return winOriginal.call(this);
  };
  const loadOriginal = Game.loadLevel;
  Game.loadLevel = function(i) {
    this.arcadeMode="campaign";
    this.morph=null;this.gravityDir=1;
    this.cameraX=0;
    ensureLevels(i+2);
    return loadOriginal.call(this,i);
  };
  buildLevelGrid = function() {
    const grid=document.getElementById("level-grid");
    const nav=document.getElementById("level-pagination");
    const unlocked=highestUnlocked();
    ensureLevels(Math.max(ORIGINAL_LEVELS+24,unlocked+25));
    const maxPage=Math.max(0,Math.ceil((unlocked+1)/PAGE_SIZE)-1);
    page=Math.min(Math.max(page,0),maxPage);
    grid.replaceChildren();
    const done=getDone();
    const first=page*PAGE_SIZE;
    for(let i=first;i<first+PAGE_SIZE;i++) {
      const button=document.createElement("button");
      button.textContent=i+1;
      button.disabled=i>unlocked;
      if(done[i]) button.classList.add("done");
      button.title=i<ORIGINAL_LEVELS?"Fase original":"Fase procedural";
      button.addEventListener("click",()=>startGame(i));
      grid.appendChild(button);
    }
    nav.replaceChildren();
    const prev=document.createElement("button");
    prev.textContent="←"; prev.disabled=page===0;
    prev.addEventListener("click",()=>{page--;buildLevelGrid();});
    const status=document.createElement("span");
    status.textContent="PÁGINA "+(page+1)+" · FASES "+(first+1)+"–"+(first+PAGE_SIZE);
    const next=document.createElement("button");
    next.textContent="→"; next.disabled=page>=maxPage;
    next.addEventListener("click",()=>{page++;buildLevelGrid();});
    nav.append(prev,status,next);
  };
  const startOriginal=startGame;
  startGame=function(i) {
    Game.arcadeMode="campaign";
    document.getElementById("btn-back-menu").classList.remove("hidden");
    document.getElementById("arcade-distance").classList.add("hidden");
    document.getElementById("endless-result").classList.add("hidden");
    return startOriginal(i);
  };
  const menuOriginal=showMenu;
  showMenu=function() {
    Game.arcadeMode="campaign";Game.cameraX=0;
    document.getElementById("btn-back-menu").classList.add("hidden");
    document.getElementById("arcade-distance").classList.add("hidden");
    document.getElementById("endless-result").classList.add("hidden");
    page=Math.floor(highestUnlocked()/PAGE_SIZE);
    return menuOriginal();
  };
  function seededRandom(n) {
    return rng(Math.imul(n+243,0x85ebca6b) ^ (Game.endlessSeed || 0))();
  }
  // Each 360 px segment is a tested "micro-room": a safe approach,
  // one trick, and a landing/reaction zone. A 645 px/s jump against
  // 2150 px/s² gravity rises ~97 px and travels ~159 px at 265 px/s.
  // No procedural wall may exceed 76 px without a special escape route.
  // Puzzles shuffle once per batch; avoid repeating the same pattern.
  const endlessBiomeNames=[
    "respiro","espinhos","serra móvel","pulo","gravidade invertida",
    "chão que mente","empurre a caixa","túnel de encolher",
    "portal de queda","serras-plataforma","porta falsa",
    "escuridão e serra","buraco móvel","muro surpresa","escadaria","portal longo"
  ];
  function biomeFor(n) {
    if(n<3)return 0; // players have a safe opening each run
    if(n>=4&&n%8===4)return 4; // recognizable gravity challenge every ~2880px
    const batch=Math.floor((n-3)/endlessBiomeNames.length);
    const index=(n-3)%endlessBiomeNames.length;
    const order=endlessBiomeNames.map((_,i)=>i);
    // Fisher-Yates using a fixed seed per run and batch
    const shuffle=rng((Game.endlessSeed ^ Math.imul(batch+1,0x9e3779b9))>>>0);
    for(let i=order.length-1;i>0;i--){
      const j=Math.floor(shuffle()*(i+1));
      [order[i],order[j]]=[order[j],order[i]];
    }
    return order[index];
  }
  Game.extendEndlessTerrain=function() {
    if(this.arcadeMode!=="endless")return;
    const race=this.level.traps.find(t=>t.constructor.name==="CompetitionTraining");
    const fastest=race?Math.max(...race.rivals.map(b=>b.x),this.player.x):this.player.x;
    const target=fastest+1550;
    while(this.endlessWorldX<target){
      const n=this.endlessSection++;
      const x=this.endlessWorldX;
      const length=360;
      const end=x+length;
      const difficulty=Math.min(1,x/18000);
      // During competitive races, everyone gets the SAME obstacle course.
      // Until the AI supports portals and morph buttons, choose from the
      // physical obstacle pool that ALL participants can negotiate.
      const raceBiomes=[0,1,2,3,4,5,9,12,13,14];
      const chosen=biomeFor(n);
      const biome=this.endlessKind==="competition"
        ? raceBiomes[chosen%raceBiomes.length] : chosen;
      const sectionSolids=[];
      const sectionTraps=[];
      const floor=(left,right)=>sectionSolids.push(R(x+left,480,right-left,60));
      const add=(trap)=>{trap.arcadeSectionEnd=end+20;sectionTraps.push(trap);};
      const entireFloor=()=>floor(0,length);
      const addSaw=(left,right,y=441)=>{
        add(new Saw([{x:x+left,y},{x:x+right,y}],{
          r:15+Math.round(difficulty*3),speed:104+difficulty*85}));
      };
      if(biome===0){ // breathing room, always safe
        entireFloor();
      }else if(biome===1){
        entireFloor();
        add(new PopSpikes(x+230,480,45,null,{
          period:2.1-difficulty*.25,phase:.25,holdOut:.57+difficulty*.12}));
      }else if(biome===2){
        entireFloor();addSaw(200,265);
      }else if(biome===3){
        floor(0,182);floor(260,length); // 78 px gap; max jump 159
      }else if(biome===4){
        entireFloor();
        sectionSolids.push(R(x+75,120,248,18));
        add(new ChaosRoom(x+80,232,"gravity",{y:95,h:385,
          label:"↑ GRAVIDADE INVERTIDA"}));
        // No inverted controls: climb onto the roof, then return to floor.
      }else if(biome===5){
        floor(0,184);floor(260,length);
        // Reveals a hidden 76 px gap when approached; jumping remains possible.
        add(new PhantomFloor(x+184,480,76,{trigger:x+149}));
      }else if(biome===6){
        entireFloor();
        add(new PushCrate(x+85,440,39,40));
        add(new CrateLockGate(x+265,x+186,{y:355,plateW:58}));
        // The button must be pressed by the crate to open the gate.
      }else if(biome===7){
        entireFloor();
        add(new MorphPad(x+53,"slim",{duration:7}));
        // A legitimate 30px tunnel: shrunk player (17px) fits, 32px doesn't.
        sectionSolids.push(R(x+165,386,90,64));
      }else if(biome===8){
        entireFloor();
        // Destination is on solid ground with 85px to react, NOT a pit.
        add(new DropPortal(x+110,416,x+247,120));
      }else if(biome===9){
        floor(0,135);floor(303,length);
        add(new SawPlatform(x+151,442,92));
        add(new SawPlatform(x+249,427,82));
        // Distances between jumps 65-98px; platforms are safe despite looks.
      }else if(biome===10){
        entireFloor();
        add(new DecoyDoor(x+152,416,"teleport",x+38));
        // First apparent exit is fake; player can bypass and run onward.
      }else if(biome===11){
        entireFloor();
        add(new DarknessZone(x+75,228,{visibility:120}));
        addSaw(204,259,439);
      }else if(biome===12){
        floor(0,118);floor(285,length);
        add(new ShiftingHole(x+118,x+285,{
          start:x+169,w:66,speed:57+difficulty*17}));
        // Can be timed and jumped; hole never exceeds 66px.
      }else if(biome===13){
        entireFloor();
        add(new SurpriseWall(x+120,x+254,{
          height:55+Math.round(difficulty*8),speed:165}));
      }else if(biome===14){
        entireFloor();
        // Maximum rise 73px. Never generate vertical walls over jump height.
        sectionSolids.push(R(x+130,423,65,57));
        sectionSolids.push(R(x+231,407,55,73));
      }else {
        entireFloor();
        add(new Teleporter(x+115,416,x+244,416,{twoWay:false}));
      }
      this.level.solids.push(...sectionSolids);
      this.level.traps.push(...sectionTraps);
      this.endlessLastBiome=biome;
      this.endlessWorldX=end;
    }
    const pruneX=Math.max(-500,Math.min(this.player.x,fastest)-1250);
    this.level.solids=this.level.solids.filter(s=>s.x+s.w>=pruneX);
    this.level.traps=this.level.traps.filter(t=>
      t.arcadeSectionEnd===undefined||t.arcadeSectionEnd>=pruneX);
  };
  Game.endlessBiomeNames=endlessBiomeNames;
  const updateOriginal=Game.update;
  Game.update=function(dt) {
    if(this.arcadeMode!=="endless") return updateOriginal.call(this,dt);
    if(this.state==="dead"||this.state==="respawning") {
      this.deathT+=dt;updateParticles(dt);
      if(this.deathT>=.8)this.endEndlessRun();
      return;
    }
    if(this.state==="play")this.extendEndlessTerrain();
    updateOriginal.call(this,dt);
    if(this.state==="play"||this.state==="dead") {
      this.endlessScore=Math.max(this.endlessScore,
        Math.max(0,Math.floor((this.player.x-55)/10)));
      this.cameraX=Math.max(0,this.player.x-260);
      document.getElementById("arcade-distance").textContent=
        this.endlessScore+" m";
    }
  };
  Game.startEndless=function() {
    AudioFX.init();
    if(IS_TOUCH&&!document.fullscreenElement)toggleFullscreen();
    menuEl.classList.add("hidden");
    endEl.classList.add("hidden");
    hudEl.classList.remove("hidden");
    document.getElementById("endless-result").classList.add("hidden");
    document.getElementById("arcade-distance").classList.remove("hidden");
    setTouchControlsVisible(true);
    this.arcadeMode="endless";
    this.levelIndex=-1;
    this.level={spawn:{x:55,y:440},name:"ATÉ O LIMITE",
      door:{update(){},draw(){},playerWins(){return false;}},
      solids:[R(-30,480,550,60)],traps:[]};
    this.spawnPlayer();
    this.endlessScore=0;this.endlessSection=0;
    this.endlessSeed=Math.floor(Math.random()*0x7fffffff);
    this.endlessWorldX=520;this.cameraX=0;
    document.getElementById("btn-back-menu").classList.remove("hidden");
    this.wipe=0;this.wipeDir=0;this.deathT=0;
    this.flags={};this.morph=null;this.gravityDir=1;
    this.reverseUntil=0;this.reverseType=null;this.invertControls=false;
    this.remoteLock=false;this.state="play";
    stains=[];particles.length=0;jumpBuffered=0;
    document.getElementById("hud-levelnum").textContent="∞";
    document.getElementById("hud-levelname").textContent="ATÉ O LIMITE";
    document.getElementById("arcade-distance").textContent="0 m";
    this.extendEndlessTerrain();
  };
  const restartOriginal=Game.restartLevel;
  Game.restartLevel=function(manual) {
    if(this.arcadeMode==="endless") {
      const best=Math.max(Number(localStorage.getItem("fd_endless_best"))||0,this.endlessScore||0);
      try{localStorage.setItem("fd_endless_best",String(best));}catch{}
      return this.startEndless();
    }
    return restartOriginal.call(this,manual);
  };
  Game.endEndlessRun=function() {
    this.state="endlessResult";
    const oldBest=Number(localStorage.getItem("fd_endless_best"))||0;
    const best=Math.max(oldBest,this.endlessScore);
    try{localStorage.setItem("fd_endless_best",String(best));}catch{}
    hudEl.classList.add("hidden");
    setTouchControlsVisible(false);
    document.getElementById("endless-distance").textContent=this.endlessScore;
    document.getElementById("endless-record").textContent=best;
    document.getElementById("endless-result").classList.remove("hidden");
  };
  document.getElementById("btn-back-menu").addEventListener("click",showMenu);
  document.addEventListener("keydown",e=>{
    if(e.code==="Escape" && Game.state!=="menu")showMenu();
  });
  document.getElementById("endless-btn").addEventListener("click",
    ()=>Game.startEndless());
  document.getElementById("endless-again").addEventListener("click",
    ()=>Game.startEndless());
  document.getElementById("endless-menu").addEventListener("click",showMenu);
  document.getElementById("play-btn").textContent="FASES · CONTINUAR";
  // Capture phase runs before the old "always start at level 1" callback.
  document.getElementById("play-btn").addEventListener("click",e=>{
    e.stopImmediatePropagation();
    if(typeof Game.openPhaseTourneyMenu==='function')Game.openPhaseTourneyMenu();
    else startGame(highestUnlocked());
  },true);
  buildLevelGrid();
  window.MotocaArcade={campaign:{original:ORIGINAL_LEVELS,procedural:true,
    ensureLevels,highestUnlocked,proceduralLevel},
    endless:{start:()=>Game.startEndless(),
      best:()=>Number(localStorage.getItem("fd_endless_best"))||0}};
})();
