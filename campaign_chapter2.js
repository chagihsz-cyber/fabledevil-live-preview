/*
  24 deliberately authored stages, numbers 31-54. Each level has unique
  mechanics, set pieces and an explicit reachable exit. Independent of lab.
  MIT original work for Motoquinha Arcade. No copied commercial level maps.
*/
"use strict";
const CHAPTER_2_LEVELS = (() => {
 const B=(name,build)=>({name,authored:true,build});
 const shell=(spawnX=55,exitX=882,extras=[])=>({
   spawn:{x:spawnX,y:440},
   door:new Door([{x:exitX,y:416}]),
   solids:[floorSeg(0,960),wallL(),wallR(),...extras],traps:[]
 });
 const coin=(x,y=440)=>new CoinPickup(x,y,5);
 const say=(x,txt,y=330)=>new Note(x,y,txt,{size:14});
 return [
 B("31 · O TETO VIROU CHÃO",()=>{
   const q=shell();q.solids.push(R(240,128,430,16));
   q.traps.push(new ChaosRoom(235,450,"gravity",{y:98,h:382}),
      say(470,"Pule no teto. Depois volte ao chão.",208),coin(750));
   return q;
 }),
 B("32 · PORTAL DA QUEDA",()=>{
   const q=shell();
   q.traps.push(new DropPortal(280,416,615,62),
      new SurpriseSpike(785,713,{width:47,warn:.37}),
      say(435,"Entre no portal. O perigo espera no final."),coin(720));
   return q;
 }),
 B("33 · CRESÇA, MAS NÃO DEMAIS",()=>{
   const q=shell();
   q.traps.push(new GrowthTimer(180,502,{switchY:367,rate:58}),
      new StaticSpikes(650,398,116,{dir:"down",size:30}),
      say(480,"Cresça para apertar lá em cima!"),coin(822));
   return q;
 }),
 B("34 · O PESO DA ESCOLHA",()=>{
   const q=shell();q.solids=[floorSeg(0,530),floorSeg(700,960),wallL(),wallR()];
   q.traps.push(new PushCrate(268,440),new PressureBridge(530,480,172,450),
      say(380,"Empurre a caixa. A ponte não vem sozinha."),coin(760));
   return q;
 }),
 B("35 · O BURACO QUE FOGE",()=>{
   const q=shell();q.solids=[floorSeg(0,225),floorSeg(790,960),wallL(),wallR()];
   q.traps.push(new ShiftingHole(225,790,{start:440,w:83,speed:120}),
      new Saw([{x:675,y:346},{x:730,y:346}],{r:17,speed:100}),
      say(460,"O buraco não fica no mesmo lugar."),coin(840));
   return q;
 }),
 B("36 · VOCÊ AGORA É O PORTAL",()=>{
   const q=shell();
   q.traps.push(new RemotePortal(310,688),
      say(495,"Controle o portal com as setas!"),coin(790));
   return q;
 }),
 B("37 · A PRIMEIRA PORTA ERA A CERTA",()=>{
   const q=shell(55,282);
   q.traps.push(new DecoyDoor(535,416,"teleport",75),
      new DecoyDoor(765,416,"kill"),
      say(458,"A mais óbvia é a mais suspeita."),coin(188));
   return q;
 }),
 B("38 · NÃO CONFIE NO ESCURO",()=>{
   const q=shell();q.traps.push(new DarknessZone(280,535,{visibility:100}),
      new Saw([{x:465,y:440},{x:660,y:440}],{r:19,speed:155}),
      new MorphPad(240,"slim",{duration:6}),
      say(530,"No escuro, até o caminho te engana."),coin(830));
   return q;
 }),
 B("39 · O MURO CRESCE ATRÁS",()=>{
   const q=shell();q.traps.push(new SurpriseWall(290,220,{height:80,speed:200,drag:135}),
      new TriggeredChaseSaw(180,322,{speed:195}),
      new SurpriseSpike(683,627,{width:55,warn:.37}),
      say(460,"O muro aparece e a serra vem atrás."),coin(800));
   return q;
 }),
 B("40 · A SERRA QUE É ESCADA",()=>{
   const q=shell();q.solids=[floorSeg(0,315),floorSeg(680,960),wallL(),wallR()];
   q.traps.push(new SawPlatform(329,445,105),new SawPlatform(456,410,105),
      new SawPlatform(580,445,102),
      new Saw([{x:650,y:280},{x:650,y:360}],{r:16,speed:125}),
      say(465,"Nem toda serra quer te cortar."),coin(770));
   return q;
 }),
 B("41 · MOEDAS OU SAÍDA?",()=>{
   const q=shell();q.traps.push(coin(235),coin(360),coin(480,365),
      new FallBlock(R(530,40,76,42),R(460,265,38,210),{shakeTime:.16}),
      new SurpriseSpike(582,520,{width:49,warn:.42}),
      new DecoyDoor(705,416,"teleport",175),
      say(440,"Moeda fácil pode esconder espinhos."));
   return q;
 }),
 B("42 · O PRIMEIRO VERDE",()=>{
   const q=shell();
   q.traps.push(new ZombieHorde({speed:146,spawnEvery:3.4,maxZombies:3}),
      new PopSpikes(560,480,62,null,{period:1.8,holdOut:.65}),
      say(425,"Verde não significa amizade."),coin(800));
   return q;
 }),
 B("43 · MAIS ALTO QUE O TETO",()=>{
   const q=shell();
   q.traps.push(new GrowthTimer(210,540,{switchY:362,rate:65,maxHeight:135}),
      new StaticSpikes(690,402,110,{dir:"down",size:28}),
      new DarknessZone(500,285,{visibility:130}),
      say(430,"O teto é o seu cronômetro."),coin(850));
   return q;
 }),
 B("44 · EMPURRE, DEPOIS TELEPORTE",()=>{
   const q=shell();
   q.traps.push(new PushCrate(275,440),
      new CrateLockGate(468,375,{y:282}),
      new DropPortal(520,416,720,75),
      new SurpriseWall(600,630,{height:75,speed:115}),
      say(409,"Empurre a caixa para liberar o portal."),coin(795));
   return q;
 }),
 B("45 · VOLTAR É AVANÇAR",()=>{
   const q=shell();q.traps.push(new MorphPad(215,"tall",{duration:6}),
      new Teleporter(440,416,700,416,{twoWay:false}),
      new PopSpikes(805,480,50,null,{period:2.2,holdOut:.5}),
      say(450,"O corpo muda, o portal permanece."),coin(855));
   return q;
 }),
 B("46 · QUATRO CAMINHOS, UMA SAÍDA",()=>{
   const q=shell();
   q.traps.push(new DropPortal(215,416,430,110),
      new DropPortal(510,416,780,70),
      new DropPortal(650,416,300,90,{kind:"reverse"}),
      say(430,"Nem todo portal aponta para frente."),coin(837));
   return q;
 }),
 B("47 · CHÃO MÓVEL, TETO PERIGOSO",()=>{
   const q=shell();q.solids=[floorSeg(0,225),floorSeg(790,960),wallL(),wallR()];
   q.traps.push(new ShiftingHole(225,790,{start:525,w:76,speed:105}),
      new SurpriseSpike(840,788,{width:45,warn:.44}),
      say(460,"Primeiro o chão se move. Depois a saída mente."),coin(814));
   return q;
 }),
 B("48 · O BOTÃO DE GRAVIDADE",()=>{
   const q=shell();q.solids.push(R(430,112,280,18));q.traps.push(new ReverseButton(235,"gravity",3.0),
      new ChaosRoom(460,220,"gravity",{y:95,h:385,label:"↑ GRAVIDADE INVERTIDA"}),
      new Saw([{x:695,y:388},{x:775,y:388}],{r:19,speed:135}),
      say(465,"Aperte e caminhe pelo teto."),coin(860));
   return q;
 }),
 B("49 · BREU E LÂMINAS",()=>{
   const q=shell();q.traps.push(new DarknessZone(240,600,{visibility:91}),
      new Saw([{x:420,y:437},{x:580,y:447},{x:695,y:437}],{r:17,speed:162}),
      new Laser({x:765,y:75,len:365,vertical:true,period:2.2,warn:.5,fire:.3}),
      say(470,"Siga o brilho. Não o barulho."),coin(860));
   return q;
 }),
 B("50 · OS VERDES NÃO PARAM",()=>{
   const q=shell();
   q.traps.push(new ZombieHorde({speed:171,spawnEvery:2.6,maxZombies:5}),
      new Saw([{x:480,y:438},{x:700,y:438}],{r:20,speed:175}),
      new PopSpikes(310,480,55,null,{period:2,holdOut:.55}),
      say(457,"Deixe os verdes caírem nas armadilhas."),coin(844));
   return q;
 }),
 B("51 · PORTAL TRAIÇOEIRO",()=>{
   const q=shell();q.traps.push(new DropPortal(200,416,620,80),
      new DropPortal(410,416,410,410,{kind:"kill"}),
      new DropPortal(770,416,270,75),
      new Saw([{x:650,y:388},{x:735,y:388}],{r:17,speed:130}),
      say(510,"Azul nem sempre é um bom sinal."),coin(842));
   return q;
 }),
 B("52 · BOTÃO, CAIXA E MURO",()=>{
   const q=shell();
   q.solids=[floorSeg(0,620),floorSeg(702,960),wallL(),wallR()];
   q.traps.push(new PushCrate(285,440),
      new SurpriseWall(355,320,{height:75,speed:135,drag:85}),
      new CrateLockGate(512,413,{y:292}),
      new StretchBridge(620,480,84,556),
      say(444,"Caixa libera muro; outro botão abre ponte."),coin(828));
   return q;
 }),
 B("53 · SUBA E NÃO OLHE PARA TRÁS",()=>{
   const q=shell();
   q.solids.push(R(235,426,65,54),R(355,377,76,103),R(493,333,86,147));
   q.traps.push(new SurpriseWall(350,315,{height:88,speed:120}),
      new Saw([{x:690,y:310},{x:755,y:390}],{r:18,speed:125}),
      new DropPortal(545,268,780,95),coin(823),
      say(410,"A escada pode ser uma armadilha.",256));
   return q;
 }),
 B("54 · A ÚLTIMA PEGADINHA",()=>{
   const q=shell(55,295);
   q.traps.push(new DarknessZone(315,495,{visibility:110}),
      new DecoyDoor(640,416,"teleport",65),
      new DecoyDoor(840,416,"kill"),
      new MorphPad(205,"slim",{duration:6}),
      new Saw([{x:475,y:340},{x:520,y:403}],{r:18,speed:145}),
      new Note(420,305,"Fim? Você já sabe desconfiar."),coin(185));
   return q;
 })
 ];
})();
