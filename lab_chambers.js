/* Independent experiment rooms. MIT engine; no campaign stages reused or unlocked. */
"use strict";
(function () {
  const LAB = [
    { name:"Piso falso e saída real", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:866,y:416}]),
      solids:[floorSeg(0,330),floorSeg(710,960),wallL(),wallR()],
      traps:[
        new PhantomFloor(340,463,99,{trigger:316}),
        new SawPlatform(386,431,110),
        new SawPlatform(515,407,110),
        new SawPlatform(641,436,95),
        new Note(430,326,"O chão some, mas a porta à direita é real"),
      ]
    })},
    { name:"Escuro + serra que corre", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:880,y:416}]),
      solids:[floorSeg(0,960),wallL(),wallR()],
      traps:[new DarknessZone(245,540,{visibility:105}),
        new Saw([{x:415,y:445},{x:680,y:445}],{r:18,speed:136}),
        new Note(410,310,"Escute, observe e desvie"),
      ]
    })},
    { name:"A primeira porta é a certa", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:270,y:416}]),
      solids:[floorSeg(0,960),wallL(),wallR()],
      traps:[new DecoyDoor(535,416,"teleport",85),
        new DecoyDoor(765,416,"kill"),
        new Note(415,315,"Será que a primeira era falsa?"),
      ]
    })},
    { name:"Caixa e ponte acionável", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:875,y:416}]),
      solids:[floorSeg(0,525),floorSeg(695,960),wallL(),wallR()],
      traps:[new PushCrate(290,440,40,40),
        new PressureBridge(525,480,171,450,{plateW:56}),
        new Note(367,365,"Empurre a caixa sobre o botão"),
      ]
    })},
    { name:"Portais e serras móveis", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:872,y:416}]),
      solids:[floorSeg(0,960),wallL(),wallR()],
      traps:[new Teleporter(290,432,680,432,{twoWay:false}),
        new Saw([{x:462,y:440},{x:600,y:440}],{r:18,speed:145}),
        new Note(395,300,"Portal ou desvio?"),
      ]
    })},
    { name:"Sala de encolhimento", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:883,y:416}]),
      solids:[floorSeg(0,960),wallL(),wallR()],
      traps:[new MorphPad(250,"slim",{duration:10}),
        new Conveyor(R(390,480,190,60),{dir:-1,force:110}),
        new Note(365,330,"Encolha e avance com os controles normais"),
      ]
    })},
    { name:"Gravidade invertida", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:881,y:416}]),
      solids:[floorSeg(0,960),R(190,125,530,18),wallL(),wallR()],
      traps:[new ChaosRoom(210,500,"gravity",{y:95,h:385}),
        new Note(460,206,"O teto virou o chão"),
      ]
    })},
    { name:"Encolher para passar", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:880,y:416}]),
      solids:[floorSeg(0,960),R(390,95,172,355),wallL(),wallR()],
      traps:[new MorphPad(230,"slim",{duration:10}),
        new Note(470,355,"Só um personagem pequeno passa"),
      ]
    })},
    { name:"Degraus, escuro e serra", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:877,y:416}]),
      solids:[floorSeg(0,960),R(250,423,80,57),R(374,375,80,105),
        R(500,327,90,153),wallL(),wallR()],
      traps:[new DarknessZone(390,380,{visibility:110}),
        new Saw([{x:690,y:370},{x:690,y:425}],{r:19,speed:130}),
        new Note(430,259,"Suba, observe e caia do outro lado"),
      ]
    })},
    { name:"Gravidade e ilusões", build:()=>({
      spawn:{x:55,y:440},door:new Door([{x:888,y:416}]),
      solids:[floorSeg(0,960),R(190,123,465,18),wallL(),wallR()],
      traps:[new ChaosRoom(205,410,"gravity",{y:95,h:385,label:"↑ GRAVIDADE INVERTIDA"}),
        new DarknessZone(385,400,{visibility:108}),
        new SawPlatform(385,422,90),
        new Saw([{x:580,y:365},{x:730,y:390}],{r:17,speed:120}),
        new DecoyDoor(736,416,"teleport",350),
        new Note(360,300,"Gravidade reversa, ilusões e saída real"),
      ]
    })}
  ];

  const sel=document.getElementById("lab-select");
  const done=document.getElementById("lab-result");
  const milestone=document.getElementById("campaign-milestone");
  const list=document.getElementById("lab-rooms");
  const hideOverlays=()=> {
    sel.classList.add("hidden");
    done.classList.add("hidden");
    milestone.classList.add("hidden");
  };
  Game.hideLabOverlays=hideOverlays;
  for(const id of ["lab-select-menu","lab-result-menu","campaign-milestone-menu",
      "btn-back-menu"]) {
    document.getElementById(id).addEventListener("click",hideOverlays,true);
  }
  document.addEventListener("keydown",e=>{
    if(e.code==="Escape")hideOverlays();
  });
  for(const popup of [sel,done,milestone]) {
    const close=document.createElement("button");
    close.className="dialog-close";
    close.textContent="✕";
    close.title="Fechar e voltar ao menu";
    close.setAttribute("aria-label","Fechar e voltar ao menu");
    close.addEventListener("click",()=>{hideOverlays();showMenu();});
    popup.appendChild(close);
  }

  Game.showLabSelect=function() {
    hideOverlays();
    menuEl.classList.add("hidden");
    endEl.classList.add("hidden");
    hudEl.classList.add("hidden");
    setTouchControlsVisible(false);
    this.state="labSelect";
    this.arcadeMode="lab";
    sel.classList.remove("hidden");
  };
  Game.startLab=function(index) {
    const idx=Math.max(0,Math.min(LAB.length-1,index));
    AudioFX.init();
    hideOverlays();
    menuEl.classList.add("hidden");
    endEl.classList.add("hidden");
    hudEl.classList.remove("hidden");
    setTouchControlsVisible(true);
    document.getElementById("btn-back-menu").classList.remove("hidden");
    document.getElementById("arcade-distance").classList.add("hidden");
    this.arcadeMode="lab";
    this.labIndex=idx;
    // Lab never references LEVELS[] or fd_done, by design.
    this.levelIndex=-100-idx;
    const room=LAB[idx];
    this.level=room.build();
    this.level.name=room.name;
    this.flags={};this.darknessActive=false;
    this.morph=null;this.gravityDir=1;this.invertControls=false;
    this.reverseUntil=0;this.reverseType=null;this.remoteLock=false;
    this.spawnPlayer();
    this.cameraX=0;
    this.wipe=0;this.wipeDir=0;this.wipeNext=null;
    this.state="play";this.deathT=0;
    document.getElementById("hud-levelnum").textContent="L"+(idx+1);
    document.getElementById("hud-levelname").textContent=room.name;
  };

  for(let i=0;i<LAB.length;i++) {
    const button=document.createElement("button");
    button.type="button";
    button.textContent=(i+1)+". "+LAB[i].name;
    button.addEventListener("click",()=>Game.startLab(i));
    list.appendChild(button);
  }
  document.getElementById("lab-select-menu").addEventListener("click",showMenu);
  document.getElementById("lab-result-menu").addEventListener("click",showMenu);
  document.getElementById("campaign-milestone-menu").addEventListener("click",showMenu);
  document.getElementById("lab-next").addEventListener("click",()=>{
    if(Game.labIndex+1<LAB.length)Game.startLab(Game.labIndex+1);
    else Game.showLabSelect();
  });
  document.getElementById("campaign-next").addEventListener("click",()=>{
    hideOverlays();startGame(30);
  });
  // Lab entry is independent: it never invokes startGame/LEVELS.
  document.getElementById("challenge-btn").addEventListener("click",
    ()=>Game.showLabSelect());

  const prevWin=Game.winLevel;
  Game.winLevel=function() {
    if(this.arcadeMode==="lab") {
      this.state="labComplete";
      AudioFX.win();
      document.getElementById("lab-result-label").textContent=
        "Você concluiu "+LAB[this.labIndex].name+
        ". Nenhum progresso da campanha foi alterado.";
      document.getElementById("lab-next").textContent=
        this.labIndex+1<LAB.length?"PRÓXIMA SALA →":"ESCOLHER OUTRA SALA";
      done.classList.remove("hidden");
      return;
    }
    const isFinalChapter=this.arcadeMode==="campaign"&&this.levelIndex===29;
    const result=prevWin.call(this);
    if(isFinalChapter) {
      this.state="chapterComplete";
      this.wipe=0;this.wipeDir=0;this.wipeNext=null;
      milestone.classList.remove("hidden");
    }
    return result;
  };

  const prevRestart=Game.restartLevel;
  Game.restartLevel=function(manual) {
    if(this.arcadeMode==="lab")return this.startLab(this.labIndex);
    return prevRestart.call(this,manual);
  };

  const prevUpdate=Game.update;
  Game.update=function(dt) {
    if(this.arcadeMode==="lab"&&
       (this.state==="dead"||this.state==="respawning")) {
      this.time+=dt;
      this.deathT+=dt;
      if(this.deathT>.85)this.startLab(this.labIndex);
      return;
    }
    return prevUpdate.call(this,dt);
  };

  const prevUpdatePlay=Game.updatePlay;
  Game.updatePlay=function(dt) {
    const deathsBefore=this.deaths;
    const result=prevUpdatePlay.call(this,dt);
    if(this.arcadeMode==="lab"&&this.deaths!==deathsBefore) {
      this.deaths=deathsBefore;
      saveProgress();
      updateDeathHud();
    }
    return result;
  };
  const prevDraw=Game.draw;
  Game.draw=function() {
    prevDraw.call(this);
    if(this.darknessActive&&this.player) {
      const px=this.player.x+this.player.w/2-
        (this.arcadeMode==="endless"?(this.cameraX||0):0);
      const py=this.player.y+this.player.h/2;
      const fog=ctx.createRadialGradient(px,py,12,px,py,116);
      fog.addColorStop(0,"rgba(2,4,8,0.05)");
      fog.addColorStop(.65,"rgba(2,4,8,0.62)");
      fog.addColorStop(1,"rgba(2,4,8,0.92)");
      ctx.save();ctx.fillStyle=fog;ctx.fillRect(0,0,W,H);ctx.restore();
    }
  };

  const prevShowMenu=showMenu;
  showMenu=function() {
    hideOverlays();
    return prevShowMenu();
  };
  window.MotocaLab={rooms:LAB,start:i=>Game.startLab(i)};
})();
