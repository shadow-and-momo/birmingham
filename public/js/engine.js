/* Game engine and display: turns, actions, scoring, bots, coach, map drawing
   and controls. Loaded after data.js and shares its globals. */
let S,UI,CM=[],botTimer=null,UNDO=[];let ONLINE=false,IS_HOST=false,DISMISSED=new Set(),LAST_ACTOR=null;const SETUP={n:4,h:1,bot:'devious',colors:['#1F5FFF'],coach:false};

const $=id=>document.getElementById(id);
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function buildDeck(np){const c=Math.min(4,Math.max(2,np))-2,d=[];for(const k in DECK_TOWNS)for(let i=0;i<DECK_TOWNS[k][c];i++)d.push({t:'loc',k});for(const k in DECK_INDS)for(let i=0;i<DECK_INDS[k][c];i++)d.push({t:'ind',k});return shuffle(d)}
function cardLabel(c){if(c.t==='loc')return TOWNS[c.k].n;if(c.t==='wloc')return'Wild town';if(c.t==='wind')return'Wild industry';return c.k==='cg'?'Cotton / Manufacturer':IND[c.k].name}
function cardClass(c){return c.t==='loc'?'loc':c.t==='ind'?'ind':'wild'}
function makeMat(){const m={};for(const k in TILES){m[k]=[];TILES[k].forEach(d=>{for(let i=0;i<d.n;i++)m[k].push({...d})})}return m}
function newPlayer(name){return{name,money:17,pos:10,vp:0,hand:[],mat:makeMat(),loans:0}}
function lvl(s){s=Math.max(0,Math.min(99,s));if(s<=10)return s-10;if(s<=30)return Math.ceil((s-10)/2);if(s<=60)return 10+Math.ceil((s-30)/3);if(s<=96)return 20+Math.ceil((s-60)/4);return 30}
function topSpace(L){if(L<=0)return 10+L;if(L<=10)return 10+2*L;if(L<=20)return 30+3*(L-10);if(L<=29)return 60+4*(L-20);return 99}
function incOf(p){return lvl(p.pos)}
function WHO(i){return S.players[i].name}
function isHuman(i){return S.humanSeats?!!S.humanSeats[i]:i<S.humans}
function V(){return S.view}
function solo(i){return !ONLINE&&i===0&&S.humans===1}
function POSS(i){return solo(i)?'your':S.players[i].name+"'s"}
function CAPS(i){return solo(i)?'Your':S.players[i].name+"'s"}
function nodeName(k){return TOWNS[k]?TOWNS[k].n:MERCH[k].n}
function lower(ind){return IND[ind].name.toLowerCase()}
function acc(m){const s=new Set();(S.merchTiles[m]||[]).forEach(t=>{if(t==='any')SELLABLE.forEach(x=>s.add(x));else if(t!=='blank')s.add(t)});return[...s]}
function merchSpaces(m,n){if(n===2&&(m==='warrington'||m==='nottingham'))return 0;if(n===3&&m==='nottingham')return 0;return MERCH[m].beer}
function dealMerchants(n){const bag=shuffle({2:['cotton','goods','pottery','any','blank'],3:['cotton','cotton','goods','pottery','any','blank','blank'],4:['cotton','cotton','goods','goods','pottery','any','any','blank','blank']}[n]||[]);
 S.merchTiles={};S.merchBeer={};for(const m in MERCH){S.merchTiles[m]=bag.splice(0,merchSpaces(m,n));S.merchBeer[m]=S.merchTiles[m].filter(t=>t!=='blank').length}
 const sellable=Object.keys(MERCH).filter(m=>acc(m).length);if(SELLABLE.some(x=>!sellable.some(m=>acc(m).includes(x))))return dealMerchants(n)}
function cur(){return S.order[S.turnIdx]}
function log(t){S.log.push(t)}
function coach(t){S.pending.push(t)}
function coachAdd(t){CM.push(t)}
function flushCoach(){if(!CM.length)return;const m=CM;CM=[];if(isHuman(cur()))composeCoach(m);else S.pending.push(...m)}
function composeCoach(feedback){const pi=cur();if(!isHuman(pi)){return}S.seen[pi]=S.seen[pi]||{};const now=S.myTurns[pi];
 const tips=coachTips(pi).sort((a,b)=>b.pri-a.pri).filter(t=>S.seen[pi][t.id]===undefined||(S.seen[pi][t.id]!==now&&now-S.seen[pi][t.id]>=(t.pri>=8?1:3))).slice(0,2);
 tips.forEach(t=>S.seen[pi][t.id]=now);const lines=[...feedback,...tips.map(t=>t.text)];S.coach=lines.join('\n')||'No new advice.'}
function coachTips(pi){const p=S.players[pi],out=[],add=(id,pri,text)=>out.push({id,pri,text});
 if(S.era==='canal'&&S.round===1)add('r1',10,'Round 1: one action only.');
 const mine=S.tiles.filter(t=>t.owner===pi&&!t.flipped&&SELLABLE.includes(t.ind));
 mine.forEach(t=>{const e=evalSell(pi,t),nm=`${lower(t.ind)} in ${TOWNS[t.town].n}`;
  if(e.ok){add('sell'+t.id,10,`Sell now: ${nm} to ${MERCH[e.m].n} for ${t.def.vp} VP and +${t.def.inc} income${e.bp.merch?', plus the merchant bonus':''}.`);return}
  const d=bfs([t.town]);const routed=Object.keys(MERCH).some(m=>d[m]!==undefined&&acc(m).includes(t.ind));
  if(routed){add('beer'+t.id,8,`${nm[0].toUpperCase()+nm.slice(1)} has a buyer route but needs ${t.def.beer} beer. Build a brewery or reach a merchant with a barrel.`);return}
  const d0=routeDist(pi);let best=null;LINKS.forEach(l=>{const e2=evalLink(pi,l);if(!e2.ok)return;S.links.push({id:-1,a:l.a,b:l.b,owner:pi});const g=d0-routeDist(pi);S.links.pop();if(g>0&&(!best||g>best.g||(g===best.g&&e2.total<best.e.total)))best={g,e:e2}});
  add('route'+t.id+(best?best.e.l.id:''),8,`${nm[0].toUpperCase()+nm.slice(1)} can't reach a buyer yet.${best?` Next link: ${nodeName(best.e.l.a)} to ${nodeName(best.e.l.b)} (£${best.e.total}).`:' No link you can build gets closer right now.'}`)});
 if(incOf(p)<0)add('neg'+incOf(p),7,`Income is £${incOf(p)} a round. Flip tiles to raise it: sell goods, or get your coal and iron used.`);
 const early=S.round<=(S.era==='canal'?3:2);
 if(p.money<8&&early&&incOf(p)-3>=-10)add('cash'+S.era,6,`Only £${p.money}. Loans are cheapest now, early in the era.`);
 if(S.era==='rail'){const stuck=Object.keys(IND).filter(k=>p.mat[k][0]&&p.mat[k][0].canal);if(stuck.length)add('dev'+stuck.join(),9,`Your next ${stuck.map(lower).join(', ')} ${stuck.length>1?'are':'is'} level 1 and can't be built now. Develop past ${stuck.length>1?'them':'it'} (one iron each, £${mktCost('iron',1)} at market).`)}
 const cp=mktCost('coal',1);if(cp>=4)add('coal'+cp,5,`Market coal costs £${cp}. A coal mine linked to a merchant sells its coal instantly.`);
 const ip=mktCost('iron',1);if(ip>=4)add('iron'+ip,4,`Market iron costs £${ip}. A new ironworks sells into the market straight away.`);
 if(S.deck.length===0){const left=Math.ceil(p.hand.length/2);if(left>=1&&left<=2)add('end'+S.era+left,9,`The era ends after ${left} more turn${left>1?'s':''} of yours. Face-down tiles score nothing${S.era==='canal'?', and canals and level 1 tiles are removed afterwards':''}.`);
  let bl=null;LINKS.forEach(l=>{const e=evalLink(pi,l);if(e.ok){const v=icons(l.a)+icons(l.b);if(!bl||v>bl.v)bl={v,l,e}}});if(bl&&bl.v>=4)add('lk'+bl.l.id,6,`Best-scoring link open to you: ${nodeName(bl.l.a)} to ${nodeName(bl.l.b)}, ${bl.v} VP (£${bl.e.total}).`)}
 return out}
function resetUI(){UI={mode:null,card:null,sold:0,scout:[],note:'',opts:[]};SHOWPTS=false;PTSEL=null}

const STATE_VERSION=2;
function startOnline(seats){ONLINE=true;newGame(seats.length,1);clearTimeout(botTimer);let b=0;
 S.humanSeats=seats.map(s=>!s.bot);S.humans=S.humanSeats.filter(Boolean).length;
 {const bn=botNames(seats.filter(s=>s.bot).length,seats.filter(s=>!s.bot).map(s=>s.name));S.players.forEach((p,i)=>p.name=seats[i].bot?bn[b++]:seats[i].name)}
 S.schema=STATE_VERSION;S.order=shuffle(S.order.slice());S.turnIdx=0;startTurnReset();S.modal=null;S.log=[`Canal era begins. Turn order was drawn at random: ${S.order.map(i=>S.players[i].name).join(', ')}. ${S.players[S.order[0]].name} goes first.`];S.coach='';return S}
function startTurnReset(){S.actionsLeft=1}
const BOT_FIRST=['Ambrose','Bartholomew','Cornelius','Eliza','Ezekiel','Hortense','Lavinia','Mortimer','Octavia','Percival','Prudence','Rupert','Silas','Theodora','Wilhelmina','Augustus','Clementine','Edmund','Florence','Gideon','Harriet','Ignatius','Jemima','Leopold','Matilda','Phineas','Rosalind','Thaddeus','Winifred','Barnaby','Cordelia','Horatio','Philippa','Septimus','Agatha','Obadiah'];
const BOT_LAST=['Coggleworth','Thistlewaite','Pemberforth','Grimsditch','Fothergill','Bramblecott','Inkersole','Quillfeather','Mossington','Ravenhurst','Kettleby','Furnival','Brasswick','Cindersby','Ashcombe','Smokeley','Gearhart','Ironsby','Wexley','Puddlecombe','Hollowell','Crumpton','Bellweather','Sootworth','Nettlefold','Tolliver','Pennywhistle','Hargreave','Lockwood','Fairweather'];
function botNames(k,avoid){const used=new Set((avoid||[]).map(x=>x.toLowerCase())),out=[];const pick=a=>a[Math.floor(Math.random()*a.length)];let guard=0;
 while(out.length<k&&guard++<500){const f=pick(BOT_FIRST),l=pick(BOT_LAST),n=f+' '+l;if(used.has(n.toLowerCase())||out.some(o=>o.split(' ')[0]===f||o.split(' ')[1]===l))continue;out.push(n)}
 while(out.length<k)out.push('Bot '+(out.length+1));return out}
function newGame(n,hu){n=n||2;hu=Math.min(hu||1,n);clearTimeout(botTimer);UNDO=[];
 S={era:'canal',round:1,humans:hu,view:0,players:Array.from({length:n},(_,i)=>newPlayer(i<hu?(hu===1?'You':'Player '+(i+1)):(n-hu===1?'Bot':'Bot '+(i-hu+1)))),order:shuffle(Array.from({length:n},(_,i)=>i)),turnIdx:0,actionsLeft:1,deck:buildDeck(n),tiles:[],links:[],mkt:{coal:13,iron:8},merchBeer:{},colors:['#1F5FFF','#E3262E','#FF8A00','#D6249F'].slice(0,n),spent:Array(n).fill(0),seen:{},pending:[],turnSerial:0,myTurns:Array(n).fill(0),coachTurn:-1,log:[],over:false,nextId:1,coach:'',modal:null};
 dealMerchants(n);{const bn=botNames(n-hu);S.players.forEach((pl,i)=>{if(i>=hu)pl.name=bn[i-hu]})}
 S.players.forEach(p=>{for(let i=0;i<HAND;i++)p.hand.push(S.deck.pop());S.deck.pop()});
 resetUI();
 
 log(`Canal era begins. Turn order was drawn at random: ${S.order.map(i=>solo(i)?'you':WHO(i)).join(', ')}. ${solo(S.order[0])?'You go':WHO(S.order[0])+' goes'} first.`);render();maybeBot()}

/* graph */
function isKW(l){return(l.a==='kidder'&&l.b==='worcester')||(l.a==='worcester'&&l.b==='kidder')}
function adj(){const g={};const add=(a,b)=>{(g[a]=g[a]||[]).push(b);(g[b]=g[b]||[]).push(a)};S.links.forEach(l=>{add(l.a,l.b);if(isKW(l)){add('farmB','kidder');add('farmB','worcester')}});return g}
function bfs(starts){const g=adj(),d={},q=[];starts.forEach(s=>{d[s]=0;q.push(s)});while(q.length){const n=q.shift();(g[n]||[]).forEach(m=>{if(d[m]===undefined){d[m]=d[n]+1;q.push(m)}})}return d}
function reachesMerchant(d){return Object.keys(MERCH).some(m=>d[m]!==undefined)}
function network(pi){const s=new Set();S.tiles.forEach(t=>{if(t.owner===pi)s.add(t.town)});S.links.forEach(l=>{if(l.owner===pi){s.add(l.a);s.add(l.b);if(isKW(l))s.add('farmB')}});return s}

/* markets */
function mktCost(kind,n){let c=S.mkt[kind],cost=0;const P=PRICES[kind];for(let i=0;i<n;i++){if(c>0){cost+=P[P.length-c];c--}else cost+=FALL[kind]}return cost}
function mktTake(kind,n){S.mkt[kind]=Math.max(0,S.mkt[kind]-n)}
function mktSell(kind,n){const P=PRICES[kind];let sold=0,money=0;while(sold<n&&S.mkt[kind]<P.length){money+=P[P.length-S.mkt[kind]-1];S.mkt[kind]++;sold++}return{sold,money}}

/* resources */
function coalPlan(pi,starts,need){const r={ok:true,takes:[],mkt:0,cost:0};if(!need)return r;const d=bfs(starts);
 const mines=S.tiles.filter(t=>t.ind==='coal'&&t.cubes>0&&d[t.town]!==undefined).sort((a,b)=>(d[a.town]-d[b.town])||((b.owner===pi)-(a.owner===pi)));
 let left=need;for(const m of mines){if(!left)break;const n=Math.min(m.cubes,left);r.takes.push({t:m,n});left-=n}
 if(left){if(!reachesMerchant(d))return{ok:false,reason:`No coal can reach ${starts.map(nodeName).join(' or ')}. It needs a coal mine connected by links, or a link route to a merchant so you can buy coal from the market.`};r.mkt=left;r.cost=mktCost('coal',left)}return r}
function ironPlan(pi,need){const r={ok:true,takes:[],mkt:0,cost:0};if(!need)return r;const works=S.tiles.filter(t=>t.ind==='iron'&&t.cubes>0).sort((a,b)=>(b.owner===pi)-(a.owner===pi));
 let left=need;for(const w of works){if(!left)break;const n=Math.min(w.cubes,left);r.takes.push({t:w,n});left-=n}if(left){r.mkt=left;r.cost=mktCost('iron',left)}return r}
function consume(takes,byPi){takes.forEach(({t,n})=>{t.cubes-=n;if(t.cubes<=0&&!t.flipped)flip(t,byPi)})}
function flip(t,byPi){t.flipped=true;const o=S.players[t.owner];const before=incOf(o);o.pos=Math.min(99,o.pos+t.def.inc);const gain=incOf(o)-before;
 log(`${CAPS(t.owner)} ${lower(t.ind)} in ${TOWNS[t.town].n} flipped face up (income marker +${t.def.inc} spaces, now £${incOf(o)} a round).`);
 if(isHuman(t.owner)&&byPi!==t.owner)coachAdd(`${WHO(byPi)} emptied ${POSS(t.owner)} ${lower(t.ind)} in ${TOWNS[t.town].n}. It flipped: ${gain?`+£${gain} a round`:`+${t.def.inc} income spaces`}, ${t.def.vp} VP.`);
 }

/* build */
function slotsFor(town,ind){return TOWNS[town].slots.map((s,i)=>s.includes(ind)?i:-1).filter(i=>i>=0)}
function tileAt(town,slot){return S.tiles.find(t=>t.town===town&&t.slot===slot)}
function cardAllows(card,ind,town,pi){
 if(card.t==='loc')return card.k===town?null:`That card only builds in ${TOWNS[card.k].n}.`;
 if(TOWNS[town].farm&&(card.t==='loc'||card.t==='wloc'))return'Farm breweries have no town card. Build one with a brewery or wild industry card, inside your network.';
 if(card.t==='wloc')return null;
 if(card.t==='ind'){const ok=card.k==='cg'?(ind==='cotton'||ind==='goods'):card.k===ind;if(!ok)return'Wrong industry for that card.'}
 const net=network(pi);if(net.size&&!net.has(town))return`${TOWNS[town].n} isn't in your network. Industry cards only build where you already have a tile or a link touching the town; town cards ignore this.`;return null}
function evalBuild(pi,card,ind,town,slot){const p=S.players[pi];
 const r=cardAllows(card,ind,town,pi);if(r)return{ok:false,reason:r};
 const ex=tileAt(town,slot);const def=p.mat[ind][0];
 if(ex){if(ex.ind!==ind)return{ok:false,reason:'Every matching space there is taken.'};if(!def)return{ok:false,reason:`You have no ${lower(ind)} tiles left.`};
  if(def.l<=ex.def.l)return{ok:false,reason:`To overbuild the level ${ex.def.l} ${lower(ind)} in ${TOWNS[town].n} you need a higher level; your next is level ${def.l}.`};
  if(ex.owner!==pi){if(ind!=='coal'&&ind!=='iron')return{ok:false,reason:`You can only overbuild your own ${lower(ind)}. Other players' tiles can be overbuilt only if they're coal mines or ironworks.`};
   if(S.tiles.some(t=>t.ind===ind&&t.cubes>0)||S.mkt[ind]>0)return{ok:false,reason:`You can only overbuild another player's ${lower(ind)} when there's no ${ind} left on the board or in the market.`}}}
 if(S.era==='canal'&&S.tiles.some(t=>t.owner===pi&&t.town===town&&t!==ex))return{ok:false,reason:`In the canal era you may have only one tile per town, and you already have one in ${TOWNS[town].n}.`};
 if(!def)return{ok:false,reason:`You have no ${lower(ind)} tiles left.`};
 if(S.era==='canal'&&def.rail)return{ok:false,reason:`Your next ${lower(ind)} is level ${def.l}, which can only be built in the rail era.`};
 if(S.era==='rail'&&def.canal)return{ok:false,reason:`Your next ${lower(ind)} is level 1, which can't be built in the rail era. Develop past it first.`};
 const cp=coalPlan(pi,[town],def.coal||0);if(!cp.ok)return{ok:false,reason:cp.reason};
 const ip=ironPlan(pi,def.iron||0);
 const total=def.cost+cp.cost+ip.cost;if(p.money<total)return{ok:false,reason:`A level ${def.l} ${lower(ind)} there costs £${total}, but you have £${p.money}. A loan gives £30.`};
 return{ok:true,def,cp,ip,total,ind,town,slot,card,over:ex?ex.id:null}}
function allBuilds(pi,card){const res=[];const towns=card.t==='loc'?[card.k]:Object.keys(TOWNS);
 const inds=card.t==='ind'?(card.k==='cg'?['cotton','goods']:[card.k]):Object.keys(IND);
 for(const town of towns)for(const ind of inds)for(const slot of slotsFor(town,ind)){const r=evalBuild(pi,card,ind,town,slot);if(!r.ok){r.town=town;r.ind=ind;r.slot=slot}res.push(r)}return res}
function overTxt(b){if(b.over==null)return'';const o=S.tiles.find(x=>x.id===b.over);return o?` (overbuilds ${o.owner===V()?'your':POSS(o.owner)} level ${o.def.l})`:''}
function dedupe(builds){const m={};builds.forEach(b=>{const k=b.ind+b.town+(b.over!=null?'o'+b.slot:'');const w=TOWNS[b.town].slots[b.slot].length;if(!m[k]||w<m[k].w)m[k]={b,w,alts:[b.slot]};else if(w===m[k].w)m[k].alts.push(b.slot)});return Object.values(m).map(x=>{x.b.alts=x.alts;return x.b})}
function execBuild(pi,b){const p=S.players[pi];p.money-=b.total;S.spent[pi]+=b.total;
 consume(b.cp.takes,pi);if(b.cp.mkt)mktTake('coal',b.cp.mkt);consume(b.ip.takes,pi);if(b.ip.mkt)mktTake('iron',b.ip.mkt);
 p.mat[b.ind].shift();const def=b.def;
 const t={id:S.nextId++,owner:pi,ind:b.ind,def,town:b.town,slot:b.slot,cubes:0,flipped:false};
 if(b.ind==='coal'||b.ind==='iron')t.cubes=def.prod;if(b.ind==='brewery')t.cubes=S.era==='canal'?1:2;
 if(b.over!=null){const old=S.tiles.find(x=>x.id===b.over);if(old){S.tiles=S.tiles.filter(x=>x!==old);log(`${WHO(pi)} overbuilt ${old.owner===pi?(solo(pi)?'their own':'their own'):WHO(old.owner)+"'s"} level ${old.def.l} ${lower(old.ind)} in ${TOWNS[old.town].n}.`)}}
 S.tiles.push(t);
 log(`${p.name} built a level ${def.l} ${lower(b.ind)} in ${TOWNS[b.town].n} for £${b.total}.`);
 let sold=null;
 if(b.ind==='coal'&&reachesMerchant(bfs([b.town])))sold=mktSell('coal',t.cubes);
 if(b.ind==='iron')sold=mktSell('iron',t.cubes);
 if(sold&&sold.sold){t.cubes-=sold.sold;p.money+=sold.money;log(`${p.name} sold ${sold.sold} ${b.ind} to the market for £${sold.money}.`)}
 if(t.cubes===0&&(b.ind==='coal'||b.ind==='iron'))flip(t,pi);
 if(isHuman(pi))coachBuild(t,sold,b)}
function coachBuild(t,sold,b){let m='';
 if(t.ind==='coal'||t.ind==='iron')m=(sold&&sold.sold?`${sold.sold} ${t.ind} sold to the market for £${sold.money}. `:'')+(t.cubes?`${t.cubes} left on the board${t.ind==='coal'?' for anyone connected':' for anyone'}. It flips when emptied.`:'Sold out, so it flipped.');
 else if(t.ind==='brewery')m=`${t.cubes} beer. Yours from anywhere; others only if connected.`;
 else{const d=bfs([t.town]);const ms=Object.keys(MERCH).filter(x=>d[x]!==undefined&&acc(x).includes(t.ind));m=`Scores only once sold. Needs ${t.def.beer} beer and ${ms.length?`a buyer: ${ms.map(x=>MERCH[x].n).join(' or ')} is connected`:'a link route to a buyer, which it lacks'}.`}
 coachAdd(m)}

/* links */
function evalLink(pi,l){const p=S.players[pi];
 if(S.links.some(x=>x.id===l.id))return{ok:false,reason:'Already built.'};
 if(S.era==='canal'&&!l.canal)return{ok:false,reason:'That route is rail only.'};
 if(S.era==='rail'&&!l.rail)return{ok:false,reason:'That route is canal only.'};
 const net=network(pi);if(net.size&&!net.has(l.a)&&!net.has(l.b))return{ok:false,reason:'A new link must touch your network: a town where you have a tile, or the end of one of your links.'};
 if(S.era==='canal'){if(p.money<3)return{ok:false,reason:'A canal costs £3.'};return{ok:true,l,total:3,cp:{takes:[],mkt:0,cost:0}}}
 const cp=coalPlan(pi,[l.a,l.b],1);if(!cp.ok)return{ok:false,reason:`No coal reaches ${nodeName(l.a)} or ${nodeName(l.b)}. A rail needs one coal from a connected mine, or from the market via a merchant.`};
 const total=5+cp.cost;if(p.money<total)return{ok:false,reason:`That rail costs £${total}; you have £${p.money}.`};return{ok:true,l,total,cp}}
function execLink(pi,e){const p=S.players[pi];p.money-=e.total;S.spent[pi]+=e.total;consume(e.cp.takes,pi);if(e.cp.mkt)mktTake('coal',e.cp.mkt);
 S.links.push({id:e.l.id,a:e.l.a,b:e.l.b,owner:pi});
 log(`${WHO(pi)} built a ${S.era==='canal'?'canal':'rail'} between ${nodeName(e.l.a)} and ${nodeName(e.l.b)} (£${e.total}).`);
 if(isHuman(pi))coachAdd(icons(e.l.a)+icons(e.l.b)?`Worth ${icons(e.l.a)+icons(e.l.b)} VP if the era ended now.`:'Worth 0 VP so far: it scores for face-up tiles at its ends.')}

function evalLink2(pi,l){const p=S.players[pi];
 if(S.era!=='rail'||!l.rail)return{ok:false,reason:'Not a rail route.'};
 if(S.links.some(x=>x.id===l.id))return{ok:false,reason:'Already built.'};
 const net=network(pi);if(!net.has(l.a)&&!net.has(l.b))return{ok:false,reason:'The second rail must touch your network, which now includes the rail you just built.'};
 const cp=coalPlan(pi,[l.a,l.b],1);if(!cp.ok)return{ok:false,reason:`No coal reaches ${nodeName(l.a)} or ${nodeName(l.b)}.`};
 const d=bfs([l.a,l.b]);const brs=S.tiles.filter(b=>b.ind==='brewery'&&b.cubes>0&&(b.owner===pi||d[b.town]!==undefined)).sort((a,b)=>(b.owner===pi)-(a.owner===pi));const br=brs[0];
 if(!br)return{ok:false,reason:'A second rail needs a beer from a brewery: yours from anywhere, or another player\'s if connected. Merchant beer doesn\'t count.'};
 const total=10+cp.cost;if(p.money<total)return{ok:false,reason:`The second rail costs £${total}; you have £${p.money}.`};return{ok:true,l,total,cp,br,brs}}
function execLink2(pi,e){const p=S.players[pi];p.money-=e.total;S.spent[pi]+=e.total;consume(e.cp.takes,pi);if(e.cp.mkt)mktTake('coal',e.cp.mkt);consume([{t:e.br,n:1}],pi);
 S.links.push({id:e.l.id,a:e.l.a,b:e.l.b,owner:pi});
 log(`${WHO(pi)} added a second rail between ${nodeName(e.l.a)} and ${nodeName(e.l.b)} (£${e.total}, a coal and a beer from ${e.br.owner===pi?'its own':'the other'} brewery in ${TOWNS[e.br.town].n}).`.replace("its own",POSS(pi)+" own"));
 }
function bestLink2(pi){return LINKS.map(l=>evalLink2(pi,l)).filter(e=>e.ok).sort((a,b)=>scoreLink(pi,b)-scoreLink(pi,a))[0]}

/* develop, loan, scout */
function evalDevelop(pi,inds){const p=S.players[pi];const cnt={};for(const k of inds){cnt[k]=(cnt[k]||0)+1;if(p.mat[k].length<cnt[k])return{ok:false,reason:`Not enough ${lower(k)} tiles left.`};if(p.mat[k][cnt[k]-1].bulb)return{ok:false,reason:`Your next ${lower(k)} (level ${p.mat[k][cnt[k]-1].l}) has a lightbulb, so it can't be developed. It can only leave your mat by being built.`}}const ip=ironPlan(pi,inds.length);if(p.money<ip.cost)return{ok:false,reason:`Developing ${inds.length} tile${inds.length>1?'s':''} needs ${inds.length} iron, costing £${ip.cost} from the market.`};return{ok:true,inds,ip,total:ip.cost}}
function devOptions(pi){const ks=Object.keys(IND),o=[];ks.forEach(k=>o.push([k]));ks.forEach((a,i)=>ks.slice(i).forEach(b=>o.push([a,b])));return o.map(x=>evalDevelop(pi,x))}
function devLabel(pi,inds){const p=S.players[pi];if(inds.length===1)return`level ${p.mat[inds[0]][0].l} ${lower(inds[0])}`;if(inds[0]===inds[1])return`two ${lower(inds[0])} tiles (levels ${p.mat[inds[0]][0].l} and ${p.mat[inds[0]][1].l})`;return`level ${p.mat[inds[0]][0].l} ${lower(inds[0])} and level ${p.mat[inds[1]][0].l} ${lower(inds[1])}`}
function execDevelop(pi,e){const p=S.players[pi];p.money-=e.total;S.spent[pi]+=e.total;const label=devLabel(pi,e.inds);consume(e.ip.takes,pi);if(e.ip.mkt)mktTake('iron',e.ip.mkt);e.inds.forEach(k=>p.mat[k].shift());
 log(`${WHO(pi)} developed away the ${label}.`);
 if(isHuman(pi)){const u=[...new Set(e.inds)];coachAdd(`Next up: ${u.map(k=>p.mat[k][0]?`level ${p.mat[k][0].l} ${lower(k)}`:`no ${lower(k)} left`).join(', ')}.`)}}
function execLoan(pi){const p=S.players[pi];const L=incOf(p);p.money+=30;p.pos=topSpace(L-3);p.loans++;log(`${WHO(pi)} took a loan: +£30, income down 3 levels to £${incOf(p)}.`);
 if(isHuman(pi))coachAdd(`Income now £${incOf(p)} a round (was £${L}).`)}
function execScout(pi){S.players[pi].hand.push({t:'wloc'},{t:'wind'});log(`${WHO(pi)} scouted for two wild cards.`);
 }

/* sell */
function beerPlan(pi,t,m,d){let need=t.def.beer;const r={ok:true,merch:false,takes:[]};if(need&&S.merchBeer[m]){r.merch=true;need--}
 const brews=S.tiles.filter(b=>b.ind==='brewery'&&b.cubes>0&&(b.owner===pi||d[b.town]!==undefined)).sort((a,b)=>(b.owner===pi)-(a.owner===pi));
 for(const b of brews){if(!need)break;const n=Math.min(b.cubes,need);r.takes.push({t:b,n});need-=n}
 if(need)return{ok:false};return r}
function evalSellAll(pi,t){const e=evalSell(pi,t);if(!e.ok)return[];const d=bfs([t.town]);return Object.keys(MERCH).filter(m=>d[m]!==undefined&&acc(m).includes(t.ind)).sort((a,b)=>S.merchBeer[b]-S.merchBeer[a]).map(m=>{const bp=beerPlan(pi,t,m,d);return bp.ok?{ok:true,t,m,bp}:null}).filter(Boolean)}
function bonusTxt(m){const b=MERCH[m].bonus;return b.type==='money'?'+£'+b.v:b.type==='vp'?'+'+b.v+' VP':b.type==='income'?'+'+b.v+' income spaces':'a free develop'}
function evalSell(pi,t){if(t.owner!==pi||t.flipped||!SELLABLE.includes(t.ind))return{ok:false,reason:'Not sellable.'};
 const d=bfs([t.town]);const ms=Object.keys(MERCH).filter(m=>d[m]!==undefined&&acc(m).includes(t.ind));
 if(!ms.length)return{ok:false,reason:`${TOWNS[t.town].n} has no link route to a merchant that buys a ${lower(t.ind)}.`};
 ms.sort((a,b)=>S.merchBeer[b]-S.merchBeer[a]);
 for(const m of ms){const bp=beerPlan(pi,t,m,d);if(bp.ok)return{ok:true,t,m,bp}}
 return{ok:false,reason:`Not enough beer for the ${lower(t.ind)} in ${TOWNS[t.town].n}: it needs ${t.def.beer}. Build a brewery, or reach a merchant that still has its barrel.`}}
function execSell(pi,e){const p=S.players[pi];consume(e.bp.takes,pi);let bonus='';
 if(e.bp.merch){S.merchBeer[e.m]--;const b=MERCH[e.m].bonus;if(b.type==='money'){p.money+=b.v;bonus=`+£${b.v}`}else if(b.type==='vp'){p.vp+=b.v;p.mvp=(p.mvp||0)+b.v;bonus=`+${b.v} VP`}else if(b.type==='develop'&&isHuman(pi)&&!SEARCHING){const ok=Object.keys(IND).some(k=>p.mat[k].length&&!p.mat[k][0].bulb);if(ok){S.pendingDev={pi};bonus='a free develop of your choice'}else bonus='no tiles to develop'}
 else if(b.type==='develop'){const ks=Object.keys(IND).filter(k=>p.mat[k].length&&!p.mat[k][0].bulb);ks.sort((a,b2)=>(p.mat[b2][0].canal&&S.era==='rail')-(p.mat[a][0].canal&&S.era==='rail')||p.mat[a][0].l-p.mat[b2][0].l||(a==='coal'?-1:0));if(ks.length){const d=p.mat[ks[0]].shift();bonus=`free develop of a level ${d.l} ${lower(ks[0])}`}else bonus='no tiles to develop'}else{p.pos=Math.min(99,p.pos+b.v);bonus=`income +${b.v} spaces`}}
 log(`${WHO(pi)} sold the ${lower(e.t.ind)} in ${TOWNS[e.t.town].n} to ${MERCH[e.m].n}${bonus?`, using its beer barrel (${bonus})`:''}.`);
 flip(e.t,pi);
 if(isHuman(pi))coachAdd(`Sold: +${e.t.def.inc} income spaces, ${e.t.def.vp} VP per era.${bonus?` Bonus: ${bonus}.`:''}`)}
function beerText(e){const need=e.t.def.beer;if(!need)return'Needs no beer.';const parts=[];if(e.bp.merch)parts.push(`1 from ${MERCH[e.m].n}'s barrel (bonus: ${bonusTxt(e.m)})`);const by={};e.bp.takes.forEach(x=>{const k=YOURS(x.t.owner)+' brewery in '+TOWNS[x.t.town].n;by[k]=(by[k]||0)+x.n});for(const k in by)parts.push(`${by[k]} from ${k}`);return`Needs ${need} beer: ${parts.join(', ')}.`}
function sellAll(pi){let e;let guard=0;while(guard++<10){const list=S.tiles.filter(t=>t.owner===pi&&!t.flipped&&SELLABLE.includes(t.ind)).map(t=>evalSell(pi,t)).filter(x=>x.ok);if(!list.length)break;execSell(pi,list[0])}}

/* turns */
function discard(pi,idxs){const p=S.players[pi];[...idxs].sort((a,b)=>b-a).forEach(i=>p.hand.splice(i,1))}
function afterAction(){LAST_ACTOR=cur();const actor=cur();S.actionsLeft--;const p=S.players[cur()];if(S.actionsLeft<=0||p.hand.length===0)endTurn();if(isHuman(actor)&&cur()!==actor&&UNDO.length&&S.humans>1){UNDO_DEADLINE=Date.now()+UNDO_WINDOW;S.lockUntil=UNDO_DEADLINE;S.lockBy=actor}if(ONLINE&&window.NET)NET.push();render();maybeBot()}
function endTurn(){const p=S.players[cur()];p.hand.forEach(c=>delete c.fresh);while(p.hand.length<HAND&&S.deck.length){const c=S.deck.pop();c.fresh=true;p.hand.push(c)}S.turnIdx++;if(S.turnIdx>=S.order.length)endRound();else startTurn()}
function startTurn(){const p=S.players[cur()];S.turnSerial++;if(isHuman(cur())&&p.hand.length)S.myTurns[cur()]++;S.actionsLeft=(S.era==='canal'&&S.round===1)?1:2;
 if(p.hand.length===0){S.turnIdx++;if(S.turnIdx>=S.order.length)endRound();else startTurn()}}
function endRound(){const last=S.era==='rail'&&S.deck.length===0&&S.players.every(p=>p.hand.length===0);if(!last)S.players.forEach(p=>{p.money+=incOf(p);if(p.money<0){const short=-p.money;p.money=0;p.vp-=short;p.lostVp=(p.lostVp||0)+short;log(`${p.name} couldn't cover negative income and lost ${short} VP.`)}});
 if(!last)log(`Round ${S.round} over. Income paid: ${S.players.map((p,i)=>`${solo(i)?'you':p.name} £${incOf(p)}`).join(', ')}.`);
 const ord=[...S.order].sort((a,b)=>S.spent[a]-S.spent[b]);
 if(ord[0]!==S.order[0])log(`${solo(ord[0])?'You spent':WHO(ord[0])+' spent'} the least, so ${solo(ord[0])?'you go':'they go'} first next round.`);
 S.order=ord;S.spent=S.players.map(()=>0);S.turnIdx=0;
 if(S.deck.length===0&&S.players.every(p=>p.hand.length===0)){endEra();if(S.modal)S.eraNote={...S.modal,key:S.era+'-'+S.turnSerial+'-'+(S.over?'end':'mid')};return}
 S.round++;startTurn()}
function icons(node){if(MERCH[node])return 2;return S.tiles.filter(t=>t.town===node&&t.flipped).reduce((s,t)=>s+t.def.lk,0)}
function scoreEra(){const r=S.players.map(()=>({links:0,tiles:0,li:[],ti:[]}));S.links.forEach(l=>{const v=icons(l.a)+icons(l.b);r[l.owner].links+=v;r[l.owner].li.push([`${nodeName(l.a)}–${nodeName(l.b)}`,v])});S.tiles.forEach(t=>{if(t.flipped){r[t.owner].tiles+=t.def.vp;r[t.owner].ti.push([`${IND[t.ind].name} L${t.def.l}, ${nodeName(t.town)}`,t.def.vp])}});
 r.forEach((x,i)=>S.players[i].vp+=x.links+x.tiles);(S.eraScores=S.eraScores||[]).push({era:S.era,r:r.map(x=>({links:x.links,tiles:x.tiles,li:x.li.sort((a,b)=>b[1]-a[1]),ti:x.ti.sort((a,b)=>b[1]-a[1])}))});
 const lines=S.players.map((p,i)=>`${WHO(i)}: ${r[i].links} from links, ${r[i].tiles} from face-up tiles. Total ${p.vp} VP.`);
 log(`${S.era==='canal'?'Canal':'Rail'} era scored. ${lines.join(' ')}`);return lines}
function endEra(){const lines=scoreEra();
 if(S.era==='canal'){const lost=S.players.map((p,i)=>S.tiles.filter(t=>t.owner===i&&t.def.l===1).map(t=>`${IND[t.ind].name}, ${nodeName(t.town)}`));ERASEL=null;S.links=[];S.tiles=S.tiles.filter(t=>t.def.l!==1);for(const m in MERCH)S.merchBeer[m]=S.merchTiles[m].filter(t=>t!=='blank').length;S.era='rail';S.round=1;S.deck=buildDeck(S.players.length);
  S.players.forEach(p=>{p.hand=[];for(let i=0;i<HAND;i++)p.hand.push(S.deck.pop())});S.turnIdx=0;
  S.modal={eraEnd:true,lost,title:'Canal era scored',lines:[...lines,'All canals and level 1 tiles are now removed, and merchant beer is refilled. Your income stays.'],btn:'Start the rail era'};
  log('Rail era begins.');coach('Rail era: canals and level 1 tiles are gone, merchant beer is refilled. Rails cost £5 and a coal. Breweries make 2 beer.');startTurn()}
 else{S.over=true;const w=finalRank()[0];S.modal={final:true,title:solo(w)?'You win':`${WHO(w)} wins`,lines:lines,btn:'Close'}}}

/* bot / hints */
function hasUnsold(pi){return S.tiles.some(t=>t.owner===pi&&!t.flipped&&SELLABLE.includes(t.ind))}
function beerAccess(pi){return S.tiles.some(t=>t.ind==='brewery'&&t.owner===pi&&t.cubes>0)||Object.values(S.merchBeer).some(x=>x)}
function scoreBuild(pi,b){const d=b.def;let s=d.vp*0.8+d.inc*0.6-b.total*0.12;if(b.over!=null){const o=S.tiles.find(x=>x.id===b.over);if(o)s+=o.owner===pi?-(o.flipped?o.def.vp*1.2:o.def.vp*.4):1}
 if(b.ind==='coal'){const board=S.tiles.filter(t=>t.ind==='coal').reduce((a,t)=>a+t.cubes,0);s+=(14-S.mkt.coal)*0.4+1-board*0.6+(reachesMerchant(bfs([b.town]))?2.5:0)}
 if(b.ind==='iron')s+=(10-S.mkt.iron)*0.5+1;
 if(b.ind==='brewery'){const own=S.tiles.filter(t=>t.ind==='brewery'&&t.owner===pi&&t.cubes>0).length;s+=hasUnsold(pi)&&!own?5:own?-3.5:-1}
 if(SELLABLE.includes(b.ind)){const d2=bfs([b.town]);s+=Object.keys(MERCH).some(m=>d2[m]!==undefined&&acc(m).includes(b.ind))?3:-2;s+=beerAccess(pi)?1:-1.5;s-=4*S.tiles.filter(t=>t.owner===pi&&!t.flipped&&SELLABLE.includes(t.ind)).length}
 if(hasUnsold(pi)&&routed(pi)<S.tiles.filter(t=>t.owner===pi&&!t.flipped&&SELLABLE.includes(t.ind)).length)s-=S.players[pi].money-b.total<6?5:2;
 if(S.era==='rail')s+=d.vp*0.3;return s}
function routed(pi){return S.tiles.filter(t=>t.owner===pi&&!t.flipped&&SELLABLE.includes(t.ind)).filter(t=>{const d=bfs([t.town]);return Object.keys(MERCH).some(m=>d[m]!==undefined&&acc(m).includes(t.ind))}).length}
function hopDist(from){const built=new Set(S.links.map(x=>x.a+'|'+x.b));const g={};LINKS.forEach(l=>{const ok=built.has(l.a+'|'+l.b)||built.has(l.b+'|'+l.a);if(!ok&&!(S.era==='canal'?l.canal:l.rail))return;const w=ok?0:1;const e=(a,b)=>{(g[a]=g[a]||[]).push([b,w]);(g[b]=g[b]||[]).push([a,w])};e(l.a,l.b);if(isKW(l)){e('farmB','kidder');e('farmB','worcester')}});
 const d={[from]:0},dq=[from];while(dq.length){const n=dq.shift();(g[n]||[]).forEach(([m,w])=>{const nd=d[n]+w;if(d[m]===undefined||nd<d[m]){d[m]=nd;w?dq.push(m):dq.unshift(m)}})}return d}
function routeDist(pi){return S.tiles.filter(t=>t.owner===pi&&!t.flipped&&SELLABLE.includes(t.ind)).reduce((s,t)=>{const d=hopDist(t.town);const best=Math.min(6,...Object.keys(MERCH).filter(m=>acc(m).includes(t.ind)).map(m=>d[m]===undefined?6:d[m]));return s+best},0)}
function scoreLink(pi,e){const l=e.l;let s=1-e.total*0.15;const r0=routed(pi),d0=routeDist(pi);S.links.push({id:-1,a:l.a,b:l.b,owner:pi});const r1=routed(pi),d1=routeDist(pi);S.links.pop();s+=(r1-r0)*4+(d0-d1)*3.5;
 [l.a,l.b].forEach(n=>{if(MERCH[n]){s+=S.tiles.some(t=>t.owner===pi&&!t.flipped&&acc(n).includes(t.ind))?5:1.5}else{s+=icons(n)*0.35;s+=S.tiles.filter(t=>t.town===n&&t.owner===pi&&!t.flipped&&SELLABLE.includes(t.ind)).length*1.5}});
 if(S.era==='rail')s+=(icons(l.a)+icons(l.b))*0.3;return s}
function candidates(pi,noJitter){const p=S.players[pi];const C=[];if(!p.hand.length)return[{score:0,desc:'Pass',run(){}}];
 const useCount=p.hand.map(c=>allBuilds(pi,c).filter(b=>b.ok).length);const spare=useCount.indexOf(Math.min(...useCount));
 p.hand.forEach((c,ci)=>{dedupe(allBuilds(pi,c).filter(b=>b.ok)).forEach(b=>C.push({score:scoreBuild(pi,b),desc:`build a level ${b.def.l} ${lower(b.ind)} in ${TOWNS[b.town].n} with your "${cardLabel(c)}" card (£${b.total})`,run(){discard(pi,[ci]);execBuild(pi,b)}}))});
 const sells=S.tiles.filter(t=>t.owner===pi&&!t.flipped&&SELLABLE.includes(t.ind)).map(t=>evalSell(pi,t)).filter(e=>e.ok);
 if(sells.length)C.push({score:10+sells.reduce((s,e)=>s+e.t.def.vp,0)*0.5,desc:`sell your ${sells.map(e=>lower(e.t.ind)+' in '+TOWNS[e.t.town].n).join(' and ')}`,run(){discard(pi,[spare]);sellAll(pi)}});
 LINKS.forEach(l=>{const e=evalLink(pi,l);if(e.ok)C.push({score:scoreLink(pi,e),desc:`build a ${S.era==='canal'?'canal':'rail'} from ${nodeName(l.a)} to ${nodeName(l.b)} (£${e.total})`,run(){discard(pi,[spare]);execLink(pi,e);if(S.era==='rail'){const e2=bestLink2(pi);if(e2&&scoreLink(pi,e2)>2.5)execLink2(pi,e2)}}})});
 if(incOf(p)-3>=(!isHuman(pi)?-3:-10)){const early=S.round<=(S.era==='canal'?3:2);C.push({score:p.money<6?5:p.money<10?(early?7:1.5):(early&&p.money<20?2.5:-2),desc:'take a loan for £30',run(){discard(pi,[spare]);execLoan(pi)}})}
 if(S.era==='rail'){const stuck=Object.keys(IND).filter(k=>p.mat[k][0]&&p.mat[k][0].canal);if(stuck.length){const e=evalDevelop(pi,stuck.slice(0,2));if(e.ok)C.push({score:3+stuck.slice(0,2).length,desc:`develop past your ${devLabel(pi,e.inds)}`,run(){discard(pi,[spare]);execDevelop(pi,e)}})}}
 C.push({score:0,desc:'pass',run(){discard(pi,[spare]);log(`${WHO(pi)} passed.`)}});
 if(!isHuman(pi)&&!noJitter)C.forEach(c=>c.score+=Math.random()*1.2);return C.sort((a,b)=>b.score-a.score)}
function maybeBot(){if(S.over||S.modal)return;if(isHuman(cur())){if(ONLINE)return;if(cur()!==S.view){if(S.humans>1){S.modal={handoff:cur()};render()}else S.view=cur()}return}if(ONLINE&&!IS_HOST)return;{clearTimeout(botTimer);botTimer=setTimeout(botAct,Math.max(900,(S.lockUntil||0)-Date.now()+120))}}

/* ---------- Devious bot: looks ahead and plays to beat the leader ---------- */
const ROUNDS_PER_ERA={2:10,3:9,4:8};
function roundsLeft(){const per=ROUNDS_PER_ERA[S.players.length]||8;return Math.max(0,per-S.round)+(S.era==='canal'?per:0)}
function moneyVal(rl){return rl<=0?0.001:Math.min(0.32,0.045*rl+0.02)}
function projVP(i){const p=S.players[i],canal=S.era==='canal',rl=roundsLeft(),mv=moneyVal(rl);let v=p.vp,incGain=0;
 for(const t of S.tiles){if(t.owner!==i)continue;const again=canal&&t.def.l!==1?1.75:1;
  if(t.flipped){v+=t.def.vp*again;continue}
  if(SELLABLE.includes(t.ind)){const e=evalSell(i,t);let pr;if(e.ok)pr=.9;else{const d=bfs([t.town]);pr=Object.keys(MERCH).some(m=>d[m]!==undefined&&acc(m).includes(t.ind))?.5:.2}
   v+=t.def.vp*pr*again;incGain+=t.def.inc*pr}
  else if(t.cubes){let pr;if(t.ind==='brewery'){const want=S.tiles.filter(g=>!g.flipped&&SELLABLE.includes(g.ind)).length;pr=Math.min(.75,.2+.12*want)/Math.max(1,t.cubes)}else pr=(t.ind==='coal'?.4:.55)/Math.max(1,t.cubes/2);v+=t.def.vp*pr*again;incGain+=t.def.inc*pr}}
 const pend=n=>S.tiles.filter(t=>t.town===n&&!t.flipped).reduce((s,t)=>s+t.def.lk,0);
 for(const l of S.links)if(l.owner===i)v+=icons(l.a)+icons(l.b)+.35*(pend(l.a)+pend(l.b));
 const inc=lvl(p.pos+incGain*.5);v+=(p.money+inc*rl)*mv;
 if(inc<0)v+=inc*rl*.6;
 return v}
function utility(pi){const pv=S.players.map((p,i)=>projVP(i));const others=pv.filter((x,i)=>i!==pi);if(!others.length)return pv[pi];
 const mx=Math.max(...others),avg=others.reduce((a,b)=>a+b,0)/others.length;return pv[pi]-(0.7*mx+0.3*avg)}
function quiet(fn){const sL=S.log,sCM=CM;try{return fn()}finally{CM=sCM}}
let SEARCHING=false;
function searchBotAction(pi){SEARCHING=true;try{return searchBotActionInner(pi)}finally{SEARCHING=false}}
function searchBotActionInner(pi){const t0=Date.now(),root=structuredClone(S),realCM=CM;let bestI=0,bestV=-1e9;
 const K1=14,K2=8,np=S.order[(S.turnIdx+1)%S.order.length];
 try{S=structuredClone(root);const C1=candidates(pi,true).slice(0,K1);
  for(let i=0;i<C1.length;i++){if(Date.now()-t0>2200)break;
   S=structuredClone(root);CM=[];candidates(pi,true)[i].run();S.actionsLeft--;
   const after1=structuredClone(S);let val;
   const reply=()=>{if(np!==pi&&S.players[np]){const op=S.players[np];op.hand=[{t:'wind'},{t:'wloc'}];CM=[];const R=candidates(np,true);if(R[0])R[0].run()}return utility(pi)};
   if(S.actionsLeft>0&&S.players[pi].hand.length){let b2=-1e9;const C2n=Math.min(K2,candidates(pi,true).length);
    for(let j=0;j<C2n;j++){if(Date.now()-t0>2200&&j>0)break;S=structuredClone(after1);CM=[];candidates(pi,true)[j].run();b2=Math.max(b2,reply())}val=b2}
   else{S=after1;val=reply()}
   if(val>bestV){bestV=val;bestI=i}}}
 finally{S=root;CM=realCM}
 return bestI}
function botAct(){if(S.over||S.modal||isHuman(cur()))return;if(S.lockUntil&&Date.now()<S.lockUntil){maybeBot();return}const pi=cur();let best;if((S.botLevel||'devious')==='devious'){const i=searchBotAction(pi);best=candidates(pi,true)[i]}else best=candidates(pi)[0];CM=[];best.run();flushCoach();afterAction()}

/* rendering */
const T=24,STEP=27;
function gearPath(){let d='';const n=8;for(let i=0;i<n*2;i++){const r=i%2?7.2:9.6;const a0=(i/(n*2))*Math.PI*2,a1=((i+1)/(n*2))*Math.PI*2;const p=a=>`${(12+r*Math.cos(a)).toFixed(2)} ${(12+r*Math.sin(a)).toFixed(2)}`;d+=(i?'L':'M')+p(a0+0.08)+'L'+p(a1-0.08)}return d+'Z M12 9.2a2.8 2.8 0 1 0 0.01 0Z'}
const DEFS=`<defs>
<symbol id="ic-coal" viewBox="0 0 24 24"><path fill="currentColor" d="M6.3 10.2l1.5-3.1 2.5.7 1.5-2.4 2.7 1.1 1.9-1.6 2.2 2.6.9 2.7z M3.2 10.8h17.6l-2.3 7.2H5.5z"/><circle cx="8" cy="19.6" r="1.9" fill="currentColor"/><circle cx="16" cy="19.6" r="1.9" fill="currentColor"/></symbol>
<symbol id="ic-iron" viewBox="0 0 24 24"><path fill="currentColor" d="M2.5 7.2h13.6c1.4 1.9 3.5 2.6 5.4 2.6v1.7c-2.6.3-4.5 1.3-5.4 3.1H8.6C8.1 12.9 6.3 11.4 4 11z M9 15.3h6.6v2.2h2.6v2.9H6.4v-2.9H9z"/></symbol>
<symbol id="ic-brewery" viewBox="0 0 24 24"><path fill="currentColor" d="M4.5 8.5h11v10.2a2.3 2.3 0 0 1-2.3 2.3H6.8a2.3 2.3 0 0 1-2.3-2.3z M15.5 10.5h2.2a3 3 0 0 1 0 6h-2.2v-2h2.1a1 1 0 0 0 0-2h-2.1z M4.2 7.4c0-2.2 1.6-3.4 3.3-2.9 1-1.5 3.3-1.6 4.4-.1 1.8-.6 3.9.6 3.9 3z"/></symbol>
<symbol id="ic-cotton" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M2.5 21V11l5-4v4l5-4v4l5-4v14z M5 14h2.4v2.6H5z M10 14h2.4v2.6H10z M15 14h2.4v2.6H15z M18.5 3h3v18h-3z"/></symbol>
<symbol id="ic-goods" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="${gearPath()}"/></symbol>
<symbol id="ic-pottery" viewBox="0 0 24 24"><path fill="currentColor" d="M9 3h6v2c0 1.2 3.6 2.9 3.6 8 0 4.8-2.8 8-6.6 8s-6.6-3.2-6.6-8c0-5.1 3.6-6.8 3.6-8z"/></symbol>
<symbol id="ic-barrel" viewBox="0 0 24 24"><path fill="currentColor" d="M7 3h10c2 3 2 15 0 18H7C5 18 5 6 7 3z"/><path stroke="#fff" stroke-width="1.2" opacity=".6" d="M5.8 8h12.4M5.8 16h12.4"/></symbol>
<radialGradient id="vign" cx=".5" cy=".5" r=".75"><stop offset=".6" stop-color="#6b4a22" stop-opacity="0"/><stop offset="1" stop-color="#6b4a22" stop-opacity=".35"/></radialGradient><pattern id="bpgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width=".6"/></pattern><pattern id="bpgrid2" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width=".8"/></pattern><radialGradient id="glowg"><stop offset="0" stop-color="#FFC24A" stop-opacity=".95"/><stop offset=".55" stop-color="#F29A2E" stop-opacity=".45"/><stop offset="1" stop-color="#F29A2E" stop-opacity="0"/></radialGradient>
</defs>`;
const RES_COL={coal:'#2E2E2E',iron:'#B5652A',brewery:'#C08A1E'};
/* ---------- Space setting: same game, new names and look ---------- */
let SETTING=(()=>{try{return localStorage.getItem('bb-setting')||'classic'}catch(x){return'classic'}})();
const SPACE_WORDS={
 'Brass Birmingham':'Brass: Belt','Brass trainer':'Brass: Belt trainer',
 'North farm brewery':'North greenhouse dome','South farm brewery':'South greenhouse dome','Farm breweries':'Greenhouse domes','farm breweries':'greenhouse domes','Farm brewery':'Greenhouse dome','farm brewery':'greenhouse dome',
 'Coal mines':'Helium-3 extractors','coal mines':'helium-3 extractors','Coal mine':'Helium-3 extractor','coal mine':'helium-3 extractor',
 'Ironworks':'Alloy foundry','ironworks':'alloy foundry','Iron works':'Alloy foundry',
 'Breweries':'Hydroponics farms','breweries':'hydroponics farms','Brewery':'Hydroponics farm','brewery':'hydroponics farm',
 'Cotton mills':'Nanofiber mills','cotton mills':'nanofiber mills','Cotton mill':'Nanofiber mill','cotton mill':'nanofiber mill',
 'Cotton / Manufacturer':'Nanofiber / Robotics','cotton mill or manufacturer':'nanofiber mill or robotics plant',
 'Manufacturers':'Robotics plants','manufacturers':'robotics plants','Manufacturer':'Robotics plant','manufacturer':'robotics plant',
 'Potteries':'Crystal labs','potteries':'crystal labs','Pottery':'Crystal lab','pottery':'crystal lab',
 'Merchant beer':'Hub food','merchant beer':'hub food','beer barrels':'food crates','beer barrel':'food crate','barrels':'crates','barrel':'crate',
 'a beer':'some food','a coal':'some helium-3','Coal':'Helium-3','coal':'helium-3','Iron':'Alloy','iron':'alloy','Beer':'Food','beer':'food',
 'Canal era':'Orbital era','canal era':'orbital era','Rail era':'Hyperlane era','rail era':'hyperlane era','Canals':'Freight lanes','canals':'freight lanes','Canal':'Freight lane','canal':'freight lane',
 'Rails':'Hyperlanes','rails':'hyperlanes','Rail':'Hyperlane','rail':'hyperlane','railways':'hyperlanes','Railways':'Hyperlanes',
 'Merchants':'Trade hubs','merchants':'trade hubs','Merchant':'Trade hub','merchant':'trade hub',
 'Warrington':'Earth Gate','Nottingham':'Mars Exchange','Shrewsbury':'Titan Port','Gloucester':'Ceres Bazaar','Oxford':'Europa Relay',
 'Birmingham':'Nova Prime','Coventry':'Kestrel Station','Wolverhampton':"Wolf's Reach",'Walsall':'Halcyon','Dudley':'Dust Hollow','Cannock':'Cinder Moon','Tamworth':"Tamsin's Rock",'Nuneaton':'Nightfall','Redditch':'Redline Yard','Kidderminster':'Kepler Deep','Worcester':'Vesper',
 'Stoke-on-Trent':'Stellar Forge','Leek':'Lumen','Belper':'Bellatrix','Derby':'Derrion','Uttoxeter':'Umbra','Stone':'Obsidian','Stafford':'Starford','Burton-on-Trent':'Bastion','Coalbrookdale':'Coldbrook Spire'
};
(()=>{for(const k of Object.keys(SPACE_WORDS)){const U=k.toUpperCase();if(U!==k&&!(U in SPACE_WORDS))SPACE_WORDS[U]=SPACE_WORDS[k].toUpperCase()}})();
const SPACE_RE=new RegExp('(?<![\\w-])('+Object.keys(SPACE_WORDS).sort((a,b)=>b.length-a.length).map(k=>k.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&')).join('|')+')(?![\\w-])','g');
function sk(s){if(SETTING!=='space'||s==null)return s;return String(s).replace(SPACE_RE,m=>SPACE_WORDS[m]).replace(/£/g,'₡')}
function skinDOM(root){if(SETTING!=='space'||!root)return;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const t=n.nodeValue,s=sk(t);if(s!==t)n.nodeValue=s}}
const SPACE_SYMBOLS=`<symbol id="ic-coal" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M10.8 2.5h2.4l4.4 16.5h-2.3l-.9-3.3H9.6L8.7 19H6.4z M10.2 13.4h3.6L12 6.6z"/><rect x="3.5" y="19" width="17" height="2.4" rx="1" fill="currentColor"/></symbol>
<symbol id="ic-iron" viewBox="0 0 24 24"><path fill="currentColor" d="M6.5 6.5h11l4 6-4 6h-11l-4-6z"/><path d="M7.5 12.5h9" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/></symbol>
<symbol id="ic-brewery" viewBox="0 0 24 24"><path fill="currentColor" d="M2.5 18.5a9.5 9.5 0 0 1 19 0z"/><path d="M12 17.5v-6.5m0 2.5c-2.2 0-3.4-1.4-3.4-3.4 2.1 0 3.4 1.2 3.4 3.4zm0 1c2.2 0 3.4-1.4 3.4-3.4-2.1 0-3.4 1.2-3.4 3.4z" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.3"/><rect x="2" y="18.5" width="20" height="2.4" rx="1" fill="currentColor"/></symbol>
<symbol id="ic-cotton" viewBox="0 0 24 24"><path fill="currentColor" d="M5 3.5h14v3H5z M5 17.5h14v3H5z"/><path d="M8 7.5l8 2.5-8 2.5 8 2.5-8 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>
<symbol id="ic-goods" viewBox="0 0 24 24"><rect x="3" y="18.5" width="10" height="3" rx="1" fill="currentColor"/><path d="M8 18.5v-5l6-5.5 4.5 2.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="13.5" r="2" fill="currentColor"/><circle cx="14" cy="8" r="2" fill="currentColor"/><path d="M18.5 10.5l2.5-2M18.5 10.5l2.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></symbol>
<symbol id="ic-pottery" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l6.5 7.5L12 22 5.5 9.5z"/><path d="M5.5 9.5h13M12 2l-2.5 7.5L12 22l2.5-12.5z" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1"/></symbol>
<symbol id="ic-barrel" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" fill="currentColor"/><path d="M4 10h16M12 5v15" stroke="#fff" stroke-opacity=".55" stroke-width="1.3"/></symbol>`;
const DEFS_SPACE=DEFS.replace(/<symbol id="ic-[\s\S]*?<\/symbol>\n?/g,'').replace('<defs>','<defs>'+SPACE_SYMBOLS+'<radialGradient id="neb1"><stop offset="0" stop-color="#8A3CFF" stop-opacity=".45"/><stop offset="1" stop-color="#8A3CFF" stop-opacity="0"/></radialGradient><radialGradient id="neb2"><stop offset="0" stop-color="#1FC8E3" stop-opacity=".32"/><stop offset="1" stop-color="#1FC8E3" stop-opacity="0"/></radialGradient><linearGradient id="spacebg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A0E26"/><stop offset="1" stop-color="#170F33"/></linearGradient><radialGradient id="giant" cx=".35" cy=".35"><stop offset="0" stop-color="#F6C27A"/><stop offset=".7" stop-color="#C46A3C"/><stop offset="1" stop-color="#6E2E2A"/></radialGradient>');
function starfield(){let s='';let x=17;for(let i=0;i<150;i++){x=(x*9301+49297)%233280;const px=(x/233280)*400;x=(x*9301+49297)%233280;const py=(x/233280)*600;x=(x*9301+49297)%233280;const r=.3+(x/233280)*1.1;s+=`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r.toFixed(2)}" class="st${i%11===0?' tw':''}"/>`}return s}
const STARS=starfield();
function spaceBg(era){return`<rect width="400" height="600" fill="url(#spacebg)"/><ellipse cx="90" cy="180" rx="170" ry="120" fill="url(#neb1)"/><ellipse cx="300" cy="440" rx="180" ry="140" fill="url(#neb2)"/>${era==='rail'?'<ellipse cx="250" cy="250" rx="200" ry="150" fill="url(#neb1)" opacity=".7"/>':''}${STARS}
<path class="belt" d="M118 52 C130 110 210 120 238 165 S262 240 300 288 S370 330 404 322"/><path class="belt" d="M-4 282 C40 300 70 270 98 302 S110 380 92 440 S70 520 100 604"/>
<g transform="translate(340 46)"><ellipse rx="44" ry="9" class="ring" transform="rotate(-14)"/><circle r="27" fill="url(#giant)"/><path d="M-44 0a44 9 0 0 0 88 0" class="ring front" transform="rotate(-14)"/></g>`}
function setSetting(v){SETTING=v;try{localStorage.setItem('bb-setting',v)}catch(x){}if(v==='space'&&THEME!=='space')THEME='space';if(v==='classic'&&THEME==='space')THEME='poster';try{localStorage.setItem('bb-theme',THEME)}catch(x){}document.title=SETTING==='space'?sk(BASE_DOC_TITLE):BASE_DOC_TITLE;render();if(typeof CHART!=='undefined'&&CHART.open)renderChart()}
const BASE_DOC_TITLE=document.title;

function icon(ind,x,y,s,cls){return`<use href="#ic-${ind}" x="${x}" y="${y}" width="${s}" height="${s}" class="${cls||''}"/>`}
function pos(n){return TOWNS[n]?{x:TOWNS[n].x,y:TOWNS[n].y+T/2}:{x:MERCH[n].x,y:MERCH[n].y}}
function hashN(s,n){let h=7;for(const c of s)h=(h*31+c.charCodeAt(0))%9973;return h%n}
function skyline(k,cx,baseY,w){const t=TOWNS[k];let s='';
 if(t.farm){return`<path class="sil" d="M${cx-9} ${baseY} v-7 l9 -6 l9 6 v7 z"/><rect class="sil" x="${cx+5}" y="${baseY-12}" width="3" height="5"/>`}
 const big=t.slots.length>=3,n=big?6:4,bw=big?7:6,start=cx-n*bw/2;let x=start;
 for(let i=0;i<n;i++){const hh=5+hashN(k+i,6)+(big?2:0);const roof=hashN(k+'r'+i,3);
  s+=`<rect class="sil" x="${x}" y="${baseY-hh}" width="${bw-0.6}" height="${hh}"/>`;
  if(roof===0)s+=`<path class="sil" d="M${x} ${baseY-hh} l${(bw-0.6)/2} -3.5 l${(bw-0.6)/2} 3.5z"/>`;
  x+=bw}
 const ci=hashN(k+'c',n);s+=`<rect class="sil" x="${start+ci*bw+2}" y="${baseY-17}" width="2.2" height="17"/>`;
 if(big||hashN(k+'s',2)){const si=(ci+2)%n;const sx=start+si*bw+bw/2-0.3;s+=`<path class="sil" d="M${sx-2.5} ${baseY-9} L${sx} ${baseY-20} L${sx+2.5} ${baseY-9}z"/>`}
 return s}
function puffs(x,y){return`<g class="smoke" pointer-events="none">${[0,1.2,2.4].map(d=>`<circle cx="${x}" cy="${y}" r="2.4" class="puff" style="animation-delay:${d}s"/>`).join('')}</g>`}
let THEME=(()=>{try{return localStorage.getItem('bb-theme')||'poster'}catch(x){return'poster'}})();
const THEMES=[['poster','Poster'],['survey','Survey map'],['blueprint','Blueprint'],['transit','Transit'],['space','Deep space']];
const RIVERS=['M118 52 C130 110 210 120 238 165 S262 240 300 288 S370 330 404 322','M-4 282 C40 300 70 270 98 302 S110 380 92 440 S70 520 100 604'];
function hatch(cx,cy,n,sp){let d='';for(let i=0;i<n;i++){const x=cx+((i*37)%(sp*2))-sp,y=cy+((i*23)%(sp))-sp/2;d+=`M${x} ${y} q3 -6 6 0 `}return`<path class="hatch" d="${d}"/>`}
function bgArt(th,era){
 if(th==='space')return spaceBg(era);
 if(th==='survey')return`<rect width="400" height="600" class="paper"/>
<path class="wash-g" d="M0 140 C40 120 90 150 130 135 S200 160 230 150 L230 260 C170 275 120 250 70 270 S20 280 0 275Z"/><path class="wash-g" d="M260 110 C300 100 340 125 400 110 L400 230 C360 245 320 225 270 240 Z"/><path class="wash-g" d="M150 430 C200 415 260 440 300 425 S380 440 400 430 L400 520 C340 535 280 515 220 530 S170 525 150 520Z"/><path class="wash-b" d="M0 300 C40 285 80 310 120 298 S170 280 190 300 L190 360 C150 375 110 355 70 370 S20 372 0 368Z"/>
${RIVERS.map(d=>`<path class="riv1" d="${d}"/><path class="riv2" d="${d}"/>`).join('')}
${hatch(30,175,14,18)}${hatch(250,195,12,16)}${hatch(370,270,12,14)}${hatch(170,455,14,18)}${hatch(290,525,14,18)}${hatch(60,590,10,16)}${hatch(370,440,8,10)}
<g class="compass" transform="translate(382 508)"><circle r="12"/><path d="M0 -15 L3 0 L0 15 L-3 0Z M-15 0 L0 3 L15 0 L0 -3Z"/><text y="-17">N</text></g>
<rect x="3" y="3" width="394" height="594" class="frame1"/><rect x="7" y="7" width="386" height="586" class="frame2"/>
<rect width="400" height="600" fill="url(#vign)" pointer-events="none"/>${era==='rail'?'<rect width="400" height="600" class="age"/>':''}`;
 if(th==='blueprint')return`<rect width="400" height="600" class="bp"/><rect width="400" height="600" fill="url(#bpgrid)"/><rect width="400" height="600" fill="url(#bpgrid2)"/>
${RIVERS.map(d=>`<path class="bpriv" d="${d}"/>`).join('')}
<rect x="5" y="5" width="390" height="590" class="bpframe"/><rect x="9" y="9" width="382" height="582" class="bpframe thin"/>
<g class="bptitle"><rect x="262" y="572" width="128" height="18"/><text x="268" y="584">PLATE ${era==='rail'?'II':'I'} · ${era==='rail'?'RAILWAYS':'CANALS'}</text></g>`;
 if(th==='transit')return`<rect width="400" height="600" class="tr-bg"/>
<path class="tr-park" d="M0 140 C40 120 90 150 130 135 S200 160 230 150 L230 260 C170 275 120 250 70 270 S20 280 0 275Z"/><path class="tr-park" d="M150 430 C200 415 260 440 300 425 S380 440 400 430 L400 520 C340 535 280 515 220 530 S170 525 150 520Z"/>
${RIVERS.map(d=>`<path class="tr-riv" d="${d}"/>`).join('')}`;
 const ad=p=>(-((Date.now()/1000)%p)).toFixed(2);
 const F=['M0 140 C40 120 90 150 130 135 S195 152 214 150 Q231 149 231 167 L230 243 Q229 258 212 262 C170 275 120 250 70 270 S20 280 0 275Z','M400 110 C340 125 300 100 279 106 Q261 111 262 129 L268 221 Q270 239 288 236 C320 225 360 245 400 230Z','M169 427 C200 415 260 440 300 425 S380 440 400 430 L400 520 C340 535 280 515 220 530 S181 526 169 524 Q151 520 151 503 L151 446 Q151 430 169 427Z'];
 const H=['M0 300 C40 285 80 310 120 298 S160 284 174 288 Q191 293 191 312 L190 345 Q189 362 170 365 C140 368 110 355 70 370 S20 372 0 368Z','M269 357 C290 345 330 365 400 350 L400 400 C350 410 300 395 269 404 Q251 408 251 390 L251 374 Q251 360 269 357Z','M0 560 C60 545 140 575 220 560 S330 545 400 565 L400 600 L0 600Z'];
 const rays=Array.from({length:12},(_,k)=>{const a=k*(Math.PI*2/12)-0.2,b=a+0.12;return`<path d="M0 0L${(Math.cos(a)*420).toFixed(0)} ${(Math.sin(a)*420).toFixed(0)}L${(Math.cos(b)*420).toFixed(0)} ${(Math.sin(b)*420).toFixed(0)}Z"/>`}).join('');
 return`<defs><pattern id="pgDotsA" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="1.2" cy="1.2" r=".75" fill="#000" fill-opacity=".22"/></pattern></defs>
<rect width="400" height="600" class="pg-g1"/><rect width="400" height="70" class="pg-sky"/>
<g transform="translate(338 44)"><g class="sunrays" style="animation-delay:${ad(160)}s">${rays}</g></g><circle cx="338" cy="44" r="30" class="pg-sun"/>
<path class="pg-far" d="M0 60 C40 46 80 58 120 48 S200 38 240 50 S330 40 400 54 L400 80 L0 80Z"/>
<path class="pg-g1" d="M0 52 C50 40 90 62 140 50 S230 30 280 48 S360 66 400 50 L400 600 L0 600Z"/>
${F.map(d=>`<path d="${d}" class="fshadow" transform="translate(-4 6)"/>`).join('')}${F.map(d=>`<path d="${d}" class="pg-g3"/>`).join('')}
${H.map(d=>`<path d="${d}" class="hshadow" transform="translate(-4 6)"/>`).join('')}${H.map(d=>`<path d="${d}" class="pg-g2"/><path d="${d}" fill="url(#pgDotsA)"/>`).join('')}
${RIVERS.map(d=>`<path class="pg-bank" d="${d}"/><path class="pg-river" d="${d}"/>`).join('')}
${[[25,178],[245,196],[365,272],[160,456],[372,446],[285,522],[85,592],[365,588],[22,92],[188,560]].map(([x,y])=>`<g class="tree"><ellipse cx="${x-6}" cy="${y+6}" rx="10" ry="3" class="tshadow"/><rect x="${x-0.8}" y="${y}" width="1.6" height="5" class="sil"/><circle cx="${x}" cy="${y-2}" r="5.5" class="pg-tree"/><circle cx="${x+6}" cy="${y+1}" r="4" class="pg-tree"/><circle cx="${x-5.5}" cy="${y+1.5}" r="3.6" class="pg-tree"/><circle cx="${x+1.6}" cy="${y-3.8}" r="2.2" class="thl"/></g>`).join('')}
${era==='rail'?'<rect width="400" height="600" class="pg-haze"/>':''}`}
function mapSVG(){const era=S.era;let s=`<svg viewBox="0 0 400 600" role="img" aria-label="Map of towns, merchants and links" class="poster theme-${THEME} era-${era}">${SETTING==='space'?DEFS_SPACE:DEFS}${bgArt(THEME,era)}`;
 const legal=UI.legalLinks||new Set();
 const builtLine=(xy,o)=>era==='canal'?`<line ${xy} class="lk bank"/><line ${xy} class="lk core o${o}"/><line ${xy} class="lk shim"/>`:`<line ${xy} class="lk rties"/><line ${xy} class="lk rcore o${o}"/><line ${xy} class="lk trail"/>`;
 {const A=pos('kidder'),B=pos('worcester'),F=pos('farmB'),xy=`x1="${F.x}" y1="${F.y}" x2="${(A.x+B.x)/2}" y2="${(A.y+B.y)/2}"`,bl=S.links.find(x=>isKW(x));s+=bl?builtLine(xy,bl.owner):`<line ${xy} class="lk off"/>`}
 LINKS.forEach(l=>{const A=pos(l.a),B=pos(l.b);const built=S.links.find(x=>x.id===l.id);const xy=`x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"`;
  if(built){s+=builtLine(xy,built.owner)+`<line ${xy} class="hit" data-link="${l.id}"/>`;return}
  const avail=era==='canal'?l.canal:l.rail;
  if(legal.has(l.id))s+=`<line ${xy} class="lk legal"/><line ${xy} class="hit" data-act="pickLink" data-id="${l.id}" data-link="${l.id}"/>`;
  else if(!avail)s+=`<line ${xy} class="lk off"/>`;
  else s+=era==='canal'?`<line ${xy} class="lk canal"/>`:`<line ${xy} class="lk ties"/><line ${xy} class="lk rail"/>`;
  if(!legal.has(l.id))s+=`<line ${xy} class="hit" data-link="${l.id}" style="cursor:help"/>`});
 for(const k in MERCH){const m=MERCH[k];const mt=S.merchTiles[k].length?S.merchTiles[k]:['none'];const n=mt.length,w=10+n*13,x0=m.x-w/2,y0=m.y-9;const pw=Math.max(w,sk(m.n).length*(THEME==='survey'?5.4:4.7)+12);const mxc=Math.min(Math.max(m.x,pw/2+4),400-pw/2-4);
  s+=`<g data-merch="${k}"><rect x="${mxc-pw/2-3}" y="${y0-17}" width="${pw+6}" height="42" fill="transparent"/>
  <rect x="${mxc-pw/2}" y="${y0-15}" width="${pw}" height="12" rx="2.5" class="plaque"/><text x="${mxc}" y="${y0-6.4}" class="ptext">${sk(m.n).toUpperCase()}</text>
  <rect x="${x0}" y="${y0}" width="${w}" height="19" rx="3" class="mbox"/>`;
  mt.forEach((a,i)=>{const cx=x0+5+i*13;s+=a==='none'?`<text x="${cx+5.5}" y="${m.y+3}" class="anyt">—</text>`:a==='blank'?`<line x1="${cx+2}" y1="${m.y}" x2="${cx+9}" y2="${m.y}" class="blankln"/>`:a==='any'?`<text x="${cx+5.5}" y="${m.y+3}" class="anyt">ANY</text>`:icon(a,cx,m.y-5.5,11,'mico')});
  for(let bi=0;bi<S.merchBeer[k];bi++)s+=icon('barrel',x0+w-4-bi*8,y0-4,10,'beer');
  s+=`</g>`}
 const hi=UI.hiTowns||new Set(),hov=UI.hoverTowns||new Set();
 for(const k in TOWNS){const t=TOWNS[k];const n=t.slots.length,w=n*STEP-(STEP-T),x0=t.x-w/2;const name=sk(t.lbl||t.n).toUpperCase();const bw=Math.max(w,name.length*(THEME==='survey'?4.9:4.3)+10);
  s+=`<g data-town="${k}"><rect x="${Math.min(x0,t.x-bw/2)-4}" y="${t.y-22}" width="${Math.max(w,bw)+8}" height="${T+38}" fill="transparent"/>`;
  if(THEME==='poster'||THEME==='survey')s+=skyline(k,t.x,t.y-1,w);else if(THEME==='space')s+=`<ellipse cx="${t.x}" cy="${t.y+T/2}" rx="${w/2+14}" ry="${T/2+9}" class="orbit"/><circle cx="${t.x-w/2-9}" cy="${t.y-4}" r="${t.slots.length>=3?5:3.5}" class="moon"/>`;
  if(hov.has(k))s+=`<rect x="${x0-5}" y="${t.y-5}" width="${w+10}" height="${T+10}" rx="6" class="hov"/>`;
  if(hi.has(k))s+=`<rect x="${x0-3}" y="${t.y-3}" width="${w+6}" height="${T+6}" rx="5" class="hi"/>`;
  t.slots.forEach((types,i)=>{const x=x0+i*STEP,y=t.y;const tile=tileAt(k,i);
   if(!tile){s+=`<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="3" class="slot"/>`;if(UI.slotPick&&UI.slotPick.b.town===k&&UI.slotPick.b.alts.includes(i))s+=`<rect x="${x-2}" y="${y-2}" width="${T+4}" height="${T+4}" rx="4" class="slotpick" data-act="doSlot" data-s="${i}"/>`;
    if(types.length===1)s+=icon(types[0],x+5,y+5,14,'ghost');else s+=icon(types[0],x+1.5,y+7,10,'ghost')+icon(types[1],x+12.5,y+7,10,'ghost');return}
   const o=tile.owner;
   if(tile.ind==='brewery'&&!tile.flipped&&tile.cubes)s+=`<circle cx="${x+T/2}" cy="${y+T/2}" r="17" class="glow" pointer-events="none"/>`;
   if(tile.flipped){s+=`<g><rect x="${x}" y="${y}" width="${T}" height="${T}" rx="3" class="up f${o}"/>${icon(tile.ind,x+4,y+3,16,'wico')}<text x="${x+3}" y="${y+T-2.5}" class="lvl u">${tile.def.l}</text><text x="${x+T-2.5}" y="${y+T-2.5}" class="lvl u lkv">⇄${tile.def.lk}</text><circle cx="${x+T-1}" cy="${y+1}" r="5" class="star"/><text x="${x+T-1}" y="${y+3.4}" class="badge-t">★</text></g>`;
    if(tile.ind!=='brewery')s+=puffs(x+5,y-2)}
   else{s+=`<g><rect x="${x+1}" y="${y+1}" width="${T-2}" height="${T-2}" rx="3" class="down o${o}"/>${icon(tile.ind,x+4,y+3,16,'o'+o)}<text x="${x+3}" y="${y+T-2.5}" class="lvl d">${tile.def.l}</text>`;
    if(tile.cubes)s+=`<circle cx="${x+T-1}" cy="${y+1}" r="5" fill="${RES_COL[tile.ind]}" stroke="#fff" stroke-width="1"/><text x="${x+T-1}" y="${y+3.4}" class="badge-t">${tile.cubes}</text>`;
    else if(SELLABLE.includes(tile.ind)&&tile.def.beer)s+=`<circle cx="${x+T-1}" cy="${y+1}" r="5" class="beerneed"/><text x="${x+T-1}" y="${y+3.4}" class="badge-t beerneed-t">${tile.def.beer}</text>`;s+=`</g>`}});
  s+=`<rect x="${t.x-bw/2}" y="${t.y+T+2}" width="${bw}" height="11" rx="1.5" class="banner"/><text x="${t.x}" y="${t.y+T+10.2}" class="tname">${name}</text></g>`}
 return s+`</svg>`}
function legendHTML(){const sw=(c)=>`<svg viewBox="0 0 26 26" aria-hidden="true">${c}</svg>`;
 const ic=k=>`<span>${sw(icon(k,3,3,20,'licon'))}${IND[k].name}</span>`;
 return`<div class="lrow">${Object.keys(IND).map(ic).join('')}<span>${sw(icon('barrel',3,3,20,'beer'))}Merchant beer</span><span>${sw(`<circle cx="13" cy="13" r="9" fill="${RES_COL.coal}" stroke="#fff"/><text x="13" y="17" class="badge-t" style="font-size:11px">3</text>`)}Cubes left</span><span>${sw(`<circle cx="13" cy="13" r="9" class="beerneed" style="stroke-width:2"/><text x="13" y="17" class="badge-t beerneed-t" style="font-size:11px">1</text>`)}Beer needed to sell</span><span>${sw(`<circle cx="13" cy="13" r="9" fill="var(--brass)"/><text x="13" y="17.5" class="badge-t" style="font-size:12px">★</text>`)}Scoring</span></div><div class="lrow"><span>${sw(`<rect x="2" y="2" width="22" height="22" rx="4" class="down o0" style="fill:var(--panel)"/>`+icon('coal',5,5,16,'o0'))}Face down</span>
 <span>${sw(`<rect x="2" y="2" width="22" height="22" rx="4" class="up f0"/>`+icon('coal',5,5,16,'wico'))}Face up, scoring</span>
 <span><svg viewBox="0 0 34 12" aria-hidden="true">${S.era==='canal'?'<line x1="2" y1="6" x2="32" y2="6" class="lk canal"/>':'<line x1="2" y1="6" x2="32" y2="6" class="lk ties"/><line x1="2" y1="6" x2="32" y2="6" class="lk rail"/>'}</svg>Open ${S.era} route</span>
 ${S.players.map((p,i)=>`<span><i class="dot" style="background:var(--pc${i})"></i>${esc(p.name)}</span>`).join('')}</div>`}
function esc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function buildWhy(pi,card){const all=allBuilds(pi,card);const netR=all.filter(b=>!b.ok&&/isn't in your network/.test(b.reason));const other=topReasons(all.filter(b=>!b.ok&&!/isn't in your network/.test(b.reason)).map(b=>b.reason));
 const out=[...other];if(netR.length){const towns=[...new Set(netR.map(b=>TOWNS[b.town].n))];const net=[...network(pi)].map(nodeName);
  let m=`Places with a free space for this card that are outside your network: ${towns.slice(0,6).join(', ')}${towns.length>6?' and more':''}. Your network right now: ${net.join(', ')||'nothing yet'}. Build a link toward one of them, or use a town card instead.`;
  if(netR.some(b=>TOWNS[b.town].farm))m+=' Farm breweries count once they are linked: Cannock to the north one, or the Kidderminster to Worcester link for the south one.';out.push(m)}
 return out.length?out:['Every matching space is already taken.']}
function topReasons(list){const c={};list.forEach(r=>{if(r)c[r]=(c[r]||0)+1});const skip=['Wrong industry for that card.','Every matching space there is taken.','Already built.','That route is rail only.','That route is canal only.'];
 let keys=Object.keys(c).sort((a,b)=>c[b]-c[a]);const good=keys.filter(k=>!skip.includes(k));return(good.length?good:keys).slice(V(),2)}

function mktBlock(k){const P=PRICES[k],n=P.length,c=S.mkt[k],cols=n/2;
 const dots=P.map((pr,i)=>`<span class="md ${k}${i>=n-c?' full':''}" title="£${pr}"></span>`).join('');
 const prices=Array.from({length:cols},(_,j)=>`<span>£${P[j*2]}</span>`).join('');
 const next=c>0?`next £${mktCost(k,1)}`:`empty, £${FALL[k]} each`;
 return`<div class="mblock"><div class="mhead">${k==='coal'?'Coal':'Iron'} market <span class="mnext">${c} left · ${next}</span></div><div class="mdots" style="grid-template-columns:repeat(${cols},14px)" role="img" aria-label="${k} market: ${c} of ${n} cubes left">${dots}</div><div class="mprices" style="grid-template-columns:repeat(${cols},14px)">${prices}</div></div>`}
var TURN_TXT='';
function hpair(a,b,cls){return`<h2 class="hpair">${a}<span class="vgroove" aria-hidden="true"></span><span class="hmeta ${cls||''}">${b}</span></h2>`}
function actsLeftTxt(){return`${S.actionsLeft} action${S.actionsLeft>1?'s':''} left`}
function actsMeta(){const per=ROUNDS_PER_ERA[S.players.length]||8;return`Round ${Math.min(S.round,per)} of ${per}<span class="vgroove" aria-hidden="true"></span><span class="you">${actsLeftTxt()}</span>`}
function deckTxt(){return`${S.deck.length} card${S.deck.length===1?'':'s'} left in deck`}
function renderStatus(){const me=isHuman(cur());
 const turn=S.over?'Game over':me?`${(ONLINE?cur()===V():S.humans===1)?'Your':WHO(cur())+"'s"} turn: ${S.actionsLeft} action${S.actionsLeft>1?'s':''} left`:`${WHO(cur())} is taking its turn`;
 const mp=k=>S.mkt[k]>0?`£${mktCost(k,1)} (${S.mkt[k]} left)`:`£${FALL[k]} (empty)`;
 TURN_TXT=turn;$('status').innerHTML=`<div class="stats">
  ${S.order.map((i,k)=>[S.players[i],i,k]).map(([p,i,k])=>`<div class="pl c${i}${!S.over&&cur()===i?' now':''}"><div class="nm"><span class="tpos" title="Turn order this round">${["1st","2nd","3rd","4th"][k]}</span>${esc(p.name)}${isHuman(i)?'':' <span class="bottag">bot</span>'}</div><div class="cashrow"><span><span class="big">£${p.money}</span> cash</span><span class="spent" title="Spent this round. Whoever spends least goes first next round.">spent £${S.spent[i]}</span></div>Income £${incOf(p)}/round (space ${p.pos})<br>${p.vp} VP banked${p.loans?`, ${p.loans} loan${p.loans>1?'s':''}`:''}${isHuman(i)?'':`, ${p.hand.length} cards`}</div>`).join('')}
  <div class="mkts">${mktBlock('coal')}${mktBlock('iron')}</div>
 </div>`}
function cardIcons(c){if(c.t==='ind')return(c.k==='cg'?['cotton','goods']:[c.k]).map(k=>`<svg class="ci" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-${k}"/></svg>`).join('');return''}
function townIcons(c){if(c.t!=='loc')return'';const inds=[...new Set(TOWNS[c.k].slots.flat())];const ok=new Set(allBuilds(V(),c).filter(b=>b.ok).map(b=>b.ind));
 return`<span class="cardinds">${inds.map(k=>`<svg class="ci ${ok.has(k)?'':'ci-off'}" viewBox="0 0 24 24" role="img" aria-label="${IND[k].name}${ok.has(k)?'':' (not buildable now)'}"><title>${IND[k].name}${ok.has(k)?': you can build this now':': not buildable now'}</title><use href="#ic-${k}"/></svg>`).join('')}</span>`}
function handHTML(clickable,marks){const p=S.players[V()];if(!p.hand.length)return'<span class="sub">No cards left this era.</span>';
 const grouped=UI.mode!=='scout';
 const btn=(i,n)=>{const c=p.hand[i];const m=marks?marks[i]:'';return`<button type="button" class="card ${cardClass(c)} ${m||''}" data-hi="${i}" ${clickable?`data-act="pickCard" data-i="${i}"`:'aria-disabled="true"'}>${cardIcons(c)}${esc(cardLabel(c))}${townIcons(c)}${n>1?`<span class="cnt">×${n}</span>`:''}</button>`};
 const sect=(title,isTown)=>{const idx=p.hand.map((c,i)=>i).filter(i=>{const t=p.hand[i].t;return isTown?(t==='loc'||t==='wloc'):(t==='ind'||t==='wind')});if(!idx.length)return'';
  const build=list=>{if(grouped){const g=new Map();list.forEach(i=>{const c=p.hand[i];const key=c.t+':'+(c.k||'');if(!g.has(key))g.set(key,[]);g.get(key).push(i)});return[...g.values()].sort((a,b)=>cardLabel(p.hand[a[0]]).localeCompare(cardLabel(p.hand[b[0]]))).map(arr=>btn(arr[0],arr.length))}
   return list.sort((a,b)=>cardLabel(p.hand[a]).localeCompare(cardLabel(p.hand[b]))).map(i=>btn(i,1))};
  const old=idx.filter(i=>!p.hand[i].fresh),fresh=idx.filter(i=>p.hand[i].fresh);
  const items=build(old).concat(fresh.length?[`<span class="newsep" aria-label="Newly drawn">New</span>`,...build(fresh)]:[]);
  return`<div class="hgroup"><div class="hlabel">${title}</div><div class="cards">${items.join('')}</div></div>`};
 return sect('Industry cards',false)+sect('Town cards',true)}
function matHTML(){const p=S.players[V()];return`<table class="mat">${Object.keys(IND).map(k=>{const d=p.mat[k][0];const need=d?[d.coal?`${d.coal} coal`:'',d.iron?`${d.iron} iron`:''].filter(Boolean).join(', '):'';
 return`<tr><td><svg class="mi" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-${k}"/></svg>${IND[k].name}</td><td>${d?`next L${d.l}, £${d.cost}${need?' + '+need:''}`:'none left'}</td><td>${d?`${makesTxt(d,k)}${d.vp} VP, +${d.inc} income, ${d.lk} link pt${d.lk===1?'':'s'}${d.beer?`, sells with ${d.beer} beer`:''}${(d.canal&&S.era==='rail')||(d.rail&&S.era==='canal')?', can\'t build now':''}`:''}</td><td>${p.mat[k].length} left</td></tr>`}).join('')}</table>`}

function renderControls(){const el=$('controls');UI.legalLinks=null;UI.hiTowns=null;
 if(S.over){const online=typeof ONLINE!=="undefined"&&ONLINE;el.innerHTML=`<p class="step"><b>Game over.</b> The board stays as it ended.</p><div class="row"><button type="button" class="primary" data-act="showResults">Show final standings</button>${online?(IS_HOST?'<button type="button" data-act="restart">Back to lobby</button>':''):'<button type="button" data-act="playAgain">Play again</button>'}</div>`;return}
 const p=S.players[V()];
 if(cur()===V()&&S.lockUntil&&Date.now()<S.lockUntil&&S.lockBy!==V()){el.innerHTML=`<p class="step lockmsg">${esc(WHO(S.lockBy))} can still undo their turn for <b class="lockSecs">${Math.ceil((S.lockUntil-Date.now())/1000)}s</b>. You can play when it runs out.</p><hr class="groove">${hpair('Your hand',deckTxt())}${handHTML(false)}`;return}
 if(cur()!==V()){el.innerHTML=`${hpair('Your hand',deckTxt())}${handHTML(false)}<hr class="groove"><h2 class="h2row">Your next tiles <button type="button" class="linkbtn" data-act="openChart">All tile values</button></h2>${matHTML()}`;return}
 const M=UI.mode;let h='';
 if(S.pendingDev&&S.pendingDev.pi===V()){const p=S.players[V()];const ks=Object.keys(IND).filter(k=>p.mat[k].length&&!p.mat[k][0].bulb);
  h+=`<h2>Free develop</h2><p class="step">Gloucester's bonus: remove one tile from your mat for free, with no iron needed. Or skip it.</p><div class="opts">${ks.map(k=>{const cur=p.mat[k][0],nx=p.mat[k][1];return`<button type="button" class="opt" data-act="freeDev" data-k="${k}"><svg class="mi" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-${k}"/></svg>${IND[k].name}: remove level ${cur.l}<small>Removing ${tileSpec(cur,k)}</small><small>Next up: ${nx?tileSpec(nx,k):'nothing left of this industry'}</small></button>`}).join('')}</div><div class="row"><button type="button" data-act="freeDev" data-k="">Skip the free develop</button></div>`;el.innerHTML=h;return}
 if(!M){h+=`${hpair('Your actions',actsMeta())}<div class="acts">
  <button type="button" data-act="mode" data-m="build">Build</button><button type="button" data-act="mode" data-m="link">Link</button><button type="button" data-act="mode" data-m="sell">Sell</button><button type="button" data-act="mode" data-m="loan">Loan</button>
  <button type="button" data-act="mode" data-m="develop">Develop</button><button type="button" data-act="mode" data-m="scout">Scout</button><button type="button" data-act="mode" data-m="pass">Pass</button>${coachOn()?'<button type="button" data-act="hint">Hint</button>':''}</div>
  ${UI.note?`<p class="why">${esc(UI.note)}</p>`:''}<hr class="groove">${hpair('Your hand',deckTxt())}${handHTML(true)}<hr class="groove"><h2 class="h2row">Your next tiles <button type="button" class="linkbtn" data-act="openChart">All tile values</button></h2>${matHTML()}`;el.innerHTML=h;return}
 const names={dev2:'Develop a second tile?',build:'Build',link:'Link',link2:'Second rail',sell:'Sell',loan:'Loan',develop:'Develop',scout:'Scout',pass:'Pass'};
 h+=M==='dev2'||M==='link2'?`<h2>${names[M]}</h2>`:hpair(names[M],actsMeta());
 if(UI.beerPick&&(M==='link2'||M==='sell')){const bp=UI.beerPick;const what=bp.kind==='link2'?`your second rail, ${esc(nodeName(bp.e.l.a))} to ${esc(nodeName(bp.e.l.b))}`:`selling the ${lower(bp.e.t.ind)} in ${esc(TOWNS[bp.e.t.town].n)}`;
  const rv=bp.kind==='link2'?icons(bp.e.l.a)+icons(bp.e.l.b):0;const flipAdd=o=>{if(bp.kind!=='link2')return 0;const br=o.br||(o.takes&&o.takes[0]&&o.takes[0].t);return br&&br.cubes===1&&(br.town===bp.e.l.a||br.town===bp.e.l.b)?br.def.lk:0};
  h+=`<p class="step">Which beer for ${what}?${bp.kind==='link2'?` It's worth <b>${rv} VP</b> if the era ended now.`:''}</p><div class="opts">${bp.alts.map((o,j)=>{const L=beerAltLabel(o),fa=flipAdd(o);return`<button type="button" class="opt" data-act="chooseBeer" data-k="${j}">${esc(L.t)}${bp.kind==='link2'?`<span class="optvp">${rv+fa} VP</span>`:''}<small>${esc(L.s)}${fa?` Flipping it adds ${fa} link point${fa>1?'s':''}, so this rail would be worth ${rv+fa} VP.`:''}</small></button>`}).join('')}</div><div class="row"><button type="button" data-act="clearBeer">Back</button></div>`;el.innerHTML=h;return}
 if(M==='dev2'){const ok=Object.keys(IND).map(k=>evalDevelop(V(),[k])).filter(e=>e.ok);UI.opts=ok;
  h+=`<p class="step">Optional: remove one more tile in this same action, for one more iron.</p><div class="opts">${devOptsHTML(ok,'doDev2').join('')}</div><div class="row"><button type="button" class="primary" data-act="finishDev">Just the one</button></div>`;el.innerHTML=h;return}
 if(M==='link2'){const es=LINKS.map(l=>evalLink2(V(),l)),ok=es.filter(e=>e.ok).sort((a,b)=>scoreLink(V(),b)-scoreLink(V(),a));UI.opts=ok;UI.legalLinks=new Set(ok.map(e=>e.l.id));
  h+=`<p class="step">Add a second rail in this same action for £10 more, another coal and a beer? Tap a gold route or pick one.</p><div class="opts">${ok.map((e,k)=>`<button type="button" class="opt" data-act="doLink2" data-k="${k}">${nodeName(e.l.a)} to ${nodeName(e.l.b)}, £${e.total}<small>Worth ${icons(e.l.a)+icons(e.l.b)} VP if the era ended now. ${e.brs.length>1?`Beer: your choice of ${e.brs.length} breweries`:`Beer from ${YOURS(e.br.owner)} brewery in ${TOWNS[e.br.town].n}`}</small></button>`).join('')}</div><div class="row"><button type="button" class="primary" data-act="finishLink">Just the one rail</button></div>`;el.innerHTML=h;return}
 if(M==='scout'){const bad=p.hand.some(c=>c.t!=='loc'&&c.t!=='ind')?'You already hold a wild card, so you can\'t scout.':p.hand.length<3?'Scouting needs three cards to discard.':'';
  h+=bad?`<p class="why">${bad}</p>`:`<p class="step">Pick three cards to discard. You'll get a wild town and a wild industry card.</p>`;
  h+=handHTML(!bad,p.hand.map((c,i)=>UI.scout.includes(i)?'sel':''));
  h+=`<div class="row"><button type="button" data-act="cancel">Back</button>${bad?'':`<button type="button" class="primary" data-act="scoutGo" ${UI.scout.length===3?'':'disabled'}>Scout (${UI.scout.length}/3)</button>`}</div>`;el.innerHTML=h;return}
 if(M==='build'&&UI.slotPick){const sp=UI.slotPick,t=TOWNS[sp.b.town];const nm=x=>IND[x].name.toLowerCase();
  h+=`<p class="step">Which space in <b>${esc(t.n)}</b> for your level ${sp.b.def.l} ${lower(sp.b.ind)}? Tap one here or on the map.</p><div class="opts">${sp.b.alts.map(s=>{const left=t.slots.map((ty,i)=>i!==s&&!tileAt(sp.b.town,i)?ty.map(nm).join(' or '):null).filter(Boolean);return`<button type="button" class="opt" data-act="doSlot" data-s="${s}">Space ${s+1}: ${t.slots[s].map(nm).join(' or ')}<small>${left.length?'Leaves open: '+left.join('; '):'Fills the last free space'}</small></button>`}).join('')}</div><div class="row"><button type="button" data-act="clearSlot">Back</button></div>`;UI.hiTowns=new Set([sp.b.town]);el.innerHTML=h;return}
 if(M==='build'&&UI.atTown){const at=UI.atTown;h+=`<p class="step">Build in <b>${esc(TOWNS[at.k].n)}</b>:</p><div class="opts">${at.opts.map((o,j)=>`<button type="button" class="opt" data-act="doBuildAt" data-k="${j}">Level ${o.b.def.l} ${lower(o.b.ind)}${overTxt(o.b)}, £${o.b.total}<small>Uses your "${esc(cardLabel(p.hand[o.ci]))}" card. ${o.b.def.vp} VP, +${o.b.def.inc} income spaces and ${o.b.def.lk} link point${o.b.def.lk===1?'':'s'} once face up${SELLABLE.includes(o.b.ind)?`. Needs ${o.b.def.beer} beer to sell`:''}</small></button>`).join('')}</div><div class="row"><button type="button" data-act="clearAt">Back</button></div>`;UI.hiTowns=new Set([at.k]);el.innerHTML=h;return}
 if(UI.card===null){
  let marks=null,intro='';
  if(M==='build'){marks=p.hand.map(c=>allBuilds(V(),c).some(b=>b.ok)?'':'dim');UI.hiTowns=new Set(p.hand.flatMap(c=>allBuilds(V(),c).filter(b=>b.ok).map(b=>b.town)));intro='Tap a highlighted town on the map to build there, or choose the card to spend. Faded cards have no legal build right now (tap one to see why).'}
  else if(M==='loan')intro=incOf(p)-3<-10?'':'Choose any card to spend on the loan: +£30 cash, income down 3 levels.';
  else if(M==='pass')intro='Choose a card to throw away. Passing is rarely right unless nothing helps.';
  else if(M==='link')intro=`Choose any card to spend. ${S.era==='canal'?'A canal costs £3.':'A rail costs £5 plus a coal. Afterwards you can add a second rail for £10 more, another coal and a beer.'}`;
  else if(M==='sell')intro='Choose any card to spend. One sell action can sell several tiles.';
  else if(M==='develop')intro='Choose any card to spend. You can remove one or two of your lowest tiles, paying one iron each.';
  if(M==='loan'&&incOf(p)-3<-10)h+=`<p class="why">Your income is too low to take another loan.</p>`;else h+=`<p class="step">${intro}</p>${handHTML(true,marks)}`;
  if(UI.note)h+=`<p class="why">${esc(UI.note)}</p>`;
  h+=`<div class="row"><button type="button" data-act="cancel">Back</button></div>`;el.innerHTML=h;return}
 const card=UI.card==='spent'?null:p.hand[UI.card];
 if(card)h+=`<p class="step">Spending: <b>${esc(cardLabel(card))}</b></p>`;
 let opts=[],why=[];
 if(M==='build'){const all=allBuilds(V(),card);const ok=dedupe(all.filter(b=>b.ok)).sort((a,b)=>scoreBuild(V(),b)-scoreBuild(V(),a));UI.opts=ok;UI.hiTowns=new Set(ok.map(b=>b.town));
  opts=ok.map((b,k)=>{const extra=[b.cp.takes.length||b.cp.mkt?`coal from ${b.cp.takes.map(x=>TOWNS[x.t.town].n).concat(b.cp.mkt?['market']:[]).join(', ')}`:'',b.ip.takes.length||b.ip.mkt?`iron from ${b.ip.takes.map(x=>POSS(x.t.owner)+' ironworks').concat(b.ip.mkt?['market']:[]).join(', ')}`:''].filter(Boolean).join('; ');
   return`<button type="button" class="opt" data-act="doBuild" data-k="${k}">Level ${b.def.l} ${lower(b.ind)} in ${TOWNS[b.town].n}${overTxt(b)}, £${b.total}<small>${b.def.vp} VP, +${b.def.inc} income spaces and ${b.def.lk} link point${b.def.lk===1?'':'s'} once face up${SELLABLE.includes(b.ind)?`. Needs ${b.def.beer} beer to sell`:''}${extra?'. Uses '+extra:''}</small></button>`});
  if(!ok.length)why=buildWhy(V(),card)}
 if(M==='link'){const es=LINKS.map(l=>evalLink(V(),l));const ok=es.filter(e=>e.ok).sort((a,b)=>scoreLink(V(),b)-scoreLink(V(),a));UI.opts=ok;UI.legalLinks=new Set(ok.map(e=>e.l.id));
  opts=ok.map((e,k)=>`<button type="button" class="opt" data-act="doLink" data-k="${k}">${nodeName(e.l.a)} to ${nodeName(e.l.b)}, £${e.total}<small>Worth ${icons(e.l.a)+icons(e.l.b)} VP if the era ended now</small></button>`);
  if(ok.length)h+=`<p class="step">Tap a gold route on the map, or pick from the list.</p>`;else why=topReasons(es.map(e=>e.reason))}
 if(M==='develop'){const es=Object.keys(IND).map(k=>evalDevelop(V(),[k]));const ok=es.filter(e=>e.ok);UI.opts=ok;
  opts=devOptsHTML(ok,'doDevelop');if(ok.length)h+=`<p class="step">Pick one tile to remove. You can add a second one after, for one more iron.</p>`;
  if(!ok.length)why=topReasons(es.map(e=>e.reason))}
 if(M==='sell'){const mine=S.tiles.filter(t=>t.owner===V()&&!t.flipped&&SELLABLE.includes(t.ind));const es=mine.map(t=>evalSell(V(),t));const ok=mine.flatMap(t=>evalSellAll(V(),t));UI.opts=ok;UI.hiTowns=new Set(ok.map(e=>e.t.town));
  opts=ok.map((e,k)=>`<button type="button" class="opt" data-act="doSell" data-k="${k}">Sell the ${lower(e.t.ind)} in ${TOWNS[e.t.town].n} to ${MERCH[e.m].n}<small>Flips it: ${e.t.def.vp} VP, +${e.t.def.inc} income spaces. ${beerText(e)}</small></button>`);
  if(!mine.length)why=['You have no face-down cotton mills, manufacturers or potteries to sell. Build one first.'];else if(!ok.length)why=topReasons(es.map(e=>e.reason))}
 h+=opts.length?`<div class="opts">${opts.join('')}</div>`:'';
 if(why.length)h+=why.map(w=>`<p class="why">${esc(w)}</p>`).join('');
 h+=`<div class="row">${UI.sold?`<button type="button" class="primary" data-act="finishSell">Finish selling</button>`:`<button type="button" data-act="cancel">Back</button>`}</div>`;
 el.innerHTML=h}
let TURN_KEY='',TURN_T=Date.now(),NUDGED=false,NUDGE_DISMISSED=false;const BASE_TITLE=document.title;
const NUDGE_LINES=[n=>`No rush${n}. It's your move whenever you're ready.`,n=>`Still mulling it over${n}? Take your time.${coachOn()?" Hint is there if you'd like a suggestion.":''}`,n=>`Just a gentle reminder${n}: the table is waiting on your move.`];
function nudgeCheck(){if(!S||S.over||S.modal||!isHuman(cur())||(ONLINE&&cur()!==V())){if(NUDGED){NUDGED=false;renderNudge()}return}
 const key=S.turnSerial+'-'+S.actionsLeft+'-'+cur();if(key!==TURN_KEY){TURN_KEY=key;TURN_T=Date.now();NUDGED=false;NUDGE_DISMISSED=false;renderNudge();return}
 if(!NUDGED&&!NUDGE_DISMISSED&&Date.now()-TURN_T>=120000){NUDGED=true;renderNudge()}}
function renderNudge(){const el=document.getElementById('nudge');if(!el)return;
 if(!NUDGED||NUDGE_DISMISSED){el.innerHTML='';document.title=BASE_TITLE;return}
 const pi=cur(),n=S.humans>1||(typeof ONLINE!=='undefined'&&ONLINE)?', '+S.players[pi].name:'';const line=NUDGE_LINES[S.turnSerial%NUDGE_LINES.length](n);
 el.innerHTML=`<div class="nudge" role="status"><span class="nudge-ic" aria-hidden="true">☕</span><span class="nudge-t">${esc(line)}</span><span class="nudge-b">${coachOn()?'<button type="button" data-act="hint">Hint</button>':''}<button type="button" data-act="dismissNudge">Thanks</button></span></div>`;document.title='• Your move · '+BASE_TITLE}
setInterval(nudgeCheck,5000);
const CHART={open:false,tab:'all',sort:'level'};
const HOW={coal:'Flips when its last coal is used, by anyone.',iron:'Flips when its last iron is used, by anyone.',brewery:'Flips when its last beer is used. Makes 1 beer in the canal era, 2 in the rail era.',cotton:'Flips when you sell it.',goods:'Flips when you sell it.',pottery:'Flips when you sell it.'};
const ROMAN=['','I','II','III','IV','V','VI','VII','VIII'];
function renderChart(){const el=document.getElementById('chart');if(!CHART.open){el.hidden=true;el.innerHTML='';return}
 const p=S&&S.players&&S.players[V()];const mine=k=>{const c={};(p?p.mat[k]:[]).forEach(d=>c[d.l]=(c[d.l]||0)+1);return c};
 const ic=k=>`<svg class="mi" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-${k}"/></svg>`;
 const table=k=>{const rows=TILES[k].slice();const sell=SELLABLE.includes(k);const own=mine(k);const nextL=p&&p.mat[k][0]?p.mat[k][0].l:null;
  if(CHART.sort==='vp')rows.sort((a,b)=>b.vp-a.vp||a.l-b.l);else if(CHART.sort==='inc')rows.sort((a,b)=>b.inc-a.inc||a.l-b.l);else if(CHART.sort==='lk')rows.sort((a,b)=>b.lk-a.lk||a.l-b.l);
  const need=d=>[d.coal?`${d.coal} coal`:'',d.iron?`${d.iron} iron`:''].filter(Boolean).join(', ')||'—';
  const makes=d=>k==='coal'?`${d.prod} coal`:k==='iron'?`${d.prod} iron`:d.rail?'2 beer':'1 / 2 beer';
  const tags=d=>[d.canal?'Canal only':'',d.rail?'Rail only':'',d.bulb?"Can't develop":''].filter(Boolean).map(t=>`<span class="ch-tag">${t}</span>`).join('');
  return`<div class="ch-card"><div class="ch-h">${ic(k)}<b>${IND[k].name}</b></div><div class="ch-how">${HOW[k]}</div><div class="ch-scroll"><table class="ch-t"><thead>
  <tr><th colspan="5"></th><th colspan="3" class="ch-f ch-grp">When flipped</th><th colspan="2"></th></tr>
  <tr><th class="l">Level</th><th>Copies</th><th>Cost</th><th>Needs</th><th>${sell?'Beer to sell':'Makes'}</th><th class="ch-f">VP</th><th class="ch-f">Income</th><th class="ch-f">Links</th><th>Yours left</th><th>Notes</th></tr></thead><tbody>
  ${rows.map(d=>`<tr class="${own[d.l]?'':'ch-gone'}"><td class="l"><b>${ROMAN[d.l]}</b> <small>level ${d.l}</small>${d.l===nextL?' <span class="ch-next">Next</span>':''}</td><td>${d.n}</td><td>£${d.cost}</td><td>${need(d)}</td><td>${sell?(d.beer||0):makes(d)}</td><td class="ch-f ch-vp">${d.vp}</td><td class="ch-f ch-inc">+${d.inc}</td><td class="ch-f ch-lk">${d.lk}</td><td>${own[d.l]||0}</td><td>${tags(d)}</td></tr>`).join('')}
  </tbody></table></div></div>`};
 el.hidden=false;
 setTimeout(()=>skinDOM(el),0);el.innerHTML=`<div class="ch-box" role="dialog" aria-modal="true" aria-label="Tile values"><div class="ch-top"><h2>What each tile is worth</h2><button type="button" data-act="closeChart">Close</button></div>
 <p class="ch-sub">Shaded columns are what a tile gives once it flips face up: VP at the end of each era it survives, income spaces straight away, and link points for every link touching its town. "Yours left" counts the tiles still on your mat; faded rows are ones you've used up.</p>
 <div class="ch-tabs">${[['all','All'],...Object.keys(IND).map(k=>[k,IND[k].name])].map(([k,n])=>`<button type="button" class="${CHART.tab===k?'on':''}" data-act="chartTab" data-t="${k}">${k==='all'?'':ic(k)}${n}</button>`).join('')}</div>
 <div class="ch-sort">Sort by: ${[['level','Level'],['vp','VP'],['inc','Income'],['lk','Links']].map(([k,n])=>`<button type="button" class="${CHART.sort===k?'on':''}" data-act="chartSort" data-s="${k}">${n}</button>`).join('')}</div>
 ${(CHART.tab==='all'?Object.keys(IND):[CHART.tab]).map(table).join('')}
 <p class="ch-sub">Income is in spaces on the income track: about £1 per space near the bottom, then 2, 3 and 4 spaces per £ as you climb. Merchants count as 2 link points.</p></div>`}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&CHART.open){CHART.open=false;renderChart()}});
function finalRank(){return S.players.map((p,i)=>i).sort((a,b)=>(S.players[b].vp-S.players[a].vp)||(incOf(S.players[b])-incOf(S.players[a]))||(S.players[b].money-S.players[a].money))}
const PCOL=['--pc0','--pc1','--pc2','--pc3'];
function finalHTML(){const rank=finalRank();const P=S.players;const tie=(a,b)=>P[a].vp===P[b].vp&&incOf(P[a])===incOf(P[b])&&P[a].money===P[b].money;
 let pos=[];rank.forEach((pi,k)=>pos.push(k&&tie(rank[k-1],pi)?pos[k-1]:k+1));
 const w=rank[0],winners=rank.filter((pi,k)=>pos[k]===1);const es=S.eraScores||[];
 const era=(pi,e)=>{const x=es.find(z=>z.era===e);return x?x.r[pi].links+x.r[pi].tiles:null};
 const medal=n=>n===1?'gold':n===2?'silver':n===3?'bronze':'plain';
 const confetti=Array.from({length:28},(_,k)=>`<i style="left:${(k*37)%100}%;background:var(${PCOL[k%P.length]});animation-delay:${(k%7)*0.35}s;animation-duration:${3.2+(k%5)*0.5}s"></i>`).join('');
 const title=winners.length>1?'A tie at the top':(solo(w)?'You win!':`${esc(WHO(w))} wins!`);
 const rows=rank.map((pi,k)=>{const c=era(pi,'canal'),r=era(pi,'rail'),bonus=P[pi].vp-(c||0)-(r||0);
  return`<li class="fr ${medal(pos[k])}"><span class="fpos">${pos[k]}</span><span class="fbar" style="background:var(${PCOL[pi]})"></span><span class="fname"><b>${esc(P[pi].name)}</b><small>${c!==null?`Canal era ${c}`:''}${r!==null?` · Rail era ${r}`:''}${bonus>0?` · Merchant bonuses +${bonus}`:bonus<0?` · Unpaid income ${bonus}`:''} · Income £${incOf(P[pi])} · £${P[pi].money} cash</small></span><span class="fvp">${P[pi].vp}<small>VP</small></span></li>`}).join('');
 const online=typeof ONLINE!=='undefined'&&ONLINE;
 const again=online?(IS_HOST?'<button type="button" data-act="restart">Back to lobby</button>':''):'<button type="button" data-act="playAgain">Play again</button>';
 return`<div class="modal fin"><div class="fconf" aria-hidden="true">${confetti}</div><div class="box fbox${SHOWPTS?' wide':''}" role="dialog" aria-modal="true" aria-label="Final standings">
 <div class="fribbon">Final standings</div>
 <svg class="ftrophy" viewBox="0 0 64 64" aria-hidden="true"><path d="M18 8h28v10c0 9-6 16-14 16s-14-7-14-16z" fill="#E2B13C"/><path d="M18 12H9c0 9 5 14 11 14M46 12h9c0 9-5 14-11 14" fill="none" stroke="#E2B13C" stroke-width="4"/><rect x="28" y="33" width="8" height="10" fill="#C9962A"/><rect x="20" y="43" width="24" height="7" rx="2" fill="#E2B13C"/><rect x="16" y="50" width="32" height="6" rx="2" fill="#B9852A"/><path d="M26 14l3 5 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z" fill="#FFF3C4" opacity=".9" transform="translate(6 -2) scale(.8)"/></svg>
 <h2 class="ftitle">${title}</h2><p class="fsub">${winners.length>1?'Tied on VP, income and cash.':`${P[w].vp} VP${rank.length>1?`, ${P[w].vp-P[rank[1]].vp} ahead of second`:''}`}</p>
 <ol class="flist">${rows}</ol>
 <p class="fnote">Ties are broken by income, then cash.</p>
 ${SHOWPTS?pointsHTML(rank):""}
 <div class="row"><button type="button" class="primary" data-act="viewBoard">View the board</button><button type="button" data-act="showPoints">${SHOWPTS?'Hide all points':'Show all points'}</button>${again}</div></div></div>`}
var SHOWPTS=false,PTSEL=null;
var ERASEL=null;
function eraEndHTML(m){const P=S.players,es=(S.eraScores||[]).find(z=>z.era==='canal');if(!es)return'';
 const sc=P.map((p,i)=>({i,l:es.r[i].links,t:es.r[i].tiles,li:es.r[i].li||[],ti:es.r[i].ti||[]}));sc.forEach(x=>x.v=x.l+x.t);
 const rank=[...sc].sort((a,b)=>b.v-a.v),max=Math.max(1,...sc.map(x=>x.v)),me=V();
 if(!ERASEL||!P[ERASEL[0]]){const r=sc[me]||rank[0];ERASEL=[r.i,r.t>=r.l?1:0]}
 const bars=rank.map(x=>`<div class="pbrow"><span class="pbname"><i style="background:var(${PCOL[x.i]})"></i>${esc(P[x.i].name)}</span><span class="pbtrack"><span class="pbbar" style="width:${x.v/max*100}%">${[x.l,x.t].map((v,j)=>v>0?`<button type="button" class="pbseg s${j}${ERASEL[0]===x.i&&ERASEL[1]===j?' on':''}" data-act="eraSeg" data-pi="${x.i}" data-j="${j}" style="flex:${v}" aria-label="${esc(P[x.i].name)}: ${j?'face-up tiles':'canal links'} ${v} VP">${v}</button>`:'').join('')}</span></span><span class="pbtot">${x.v}</span></div>`).join('');
 const s=sc[ERASEL[0]],j=ERASEL[1],items=(j?s.ti:s.li).filter(z=>z[1]>0),zero=(j?s.ti:s.li).length-items.length;
 const info=`<div class="pbinfo"><b>${esc(P[s.i].name)} · ${j?'Face-up tiles':'Canal links'} · ${j?s.t:s.l} VP</b><div>${items.length?items.map(z=>`${esc(z[0])} <b>${z[1]}</b>`).join(' · ')+(zero?` · plus ${zero} worth 0`:''):'Nothing scored here.'}</div><small>${j?'Only flipped tiles score.':'Each canal scores 1 per link icon on the face-up tiles at both ends (merchants count 2).'}</small></div>`;
 const lost=(m.lost&&m.lost[me])||[],inc=incOf(P[me]);
 return`<div class="modal fin era"><div class="box fbox wide erabox" role="dialog" aria-modal="true" aria-label="Canal era scored">
 <div class="fribbon">Canal era scored</div>
 <h2 class="ftitle" style="margin-top:6px!important">Halfway there</h2><p class="fsub">Points scored this era, from canal links and face-up tiles</p>
 <div class="fpts">${bars}${info}<div class="pbkey"><span><i class="s0"></i>Canal links</span><span><i class="s1"></i>Face-up tiles</span><span style="color:#866219">Tap a bar to list each link and tile</span></div></div>
 <div class="echg">
 <div><span class="eic">≈</span><span><b>All canals removed.</b> Your network starts over from your remaining tiles.</span></div>
 <div><span class="eic">✕</span><span><b>Level 1 tiles removed.</b> ${lost.length?`You lose ${lost.length}:<span class="elost">${lost.map(x=>`<span>${esc(x)}</span>`).join('')}</span>`:'You had none, so nothing of yours goes.'}</span></div>
 <div><span class="eic">◉</span><span><b>Merchant beer refilled</b> at every merchant.</span></div>
 <div><span class="eic">▤</span><span><b>New hand of ${HAND}.</b> Your income stays at £${inc} a round.</span></div>
 </div>
 <div class="row"><button type="button" class="primary" data-act="closeModal">${esc(m.btn||'Start the rail era')}</button></div></div></div>`}
function refreshEra(){const b=document.querySelector('.erabox');if(!b||!S.modal||!S.modal.eraEnd)return render();const w=document.createElement('div');w.innerHTML=eraEndHTML(S.modal);const nb=w.querySelector('.erabox');b.replaceWith(nb);if(typeof skinDOM==='function')skinDOM(nb)}

const PTK=[['Canal links','canal','li','links'],['Canal tiles','canal','ti','tiles'],['Rail links','rail','li','links'],['Rail tiles','rail','ti','tiles']];
function ptSegs(pi){const es=S.eraScores||[],P=S.players[pi];const g=PTK.map(([n,e,it,k])=>{const x=es.find(z=>z.era===e);const r=x&&x.r[pi];return{n,v:r?r[k]:0,items:r&&r[it]?r[it]:[]}});
 if(P.mvp)g.push({n:'Merchant bonuses',v:P.mvp,items:[]});return g}
function pointsHTML(rank){const P=S.players;const max=Math.max(1,...rank.map(pi=>ptSegs(pi).reduce((a,x)=>a+x.v,0)));
 if(!PTSEL){const pi=rank[0],sg=ptSegs(pi);let j=0;sg.forEach((x,k)=>{if(x.v>sg[j].v)j=k});PTSEL=[pi,j]}
 const bars=rank.map(pi=>{const sg=ptSegs(pi),t=sg.reduce((a,x)=>a+x.v,0);
  return`<div class="pbrow"><span class="pbname"><i style="background:var(${PCOL[pi]})"></i>${esc(P[pi].name)}</span><span class="pbtrack"><span class="pbbar" style="width:${t/max*100}%">${sg.map((x,j)=>x.v>0?`<button type="button" class="pbseg s${j}${PTSEL[0]===pi&&PTSEL[1]===j?' on':''}" data-act="ptSeg" data-pi="${pi}" data-j="${j}" style="flex:${x.v}" aria-label="${esc(P[pi].name)}: ${x.n} ${x.v} VP">${x.v}</button>`:'').join('')}</span></span><span class="pbtot">${P[pi].vp}</span></div>`}).join('');
 const [spi,sj]=PTSEL,sg=ptSegs(spi)[sj]||{n:'',v:0,items:[]},sp=P[spi];
 const shown=sg.items.filter(x=>x[1]>0),zero=sg.items.length-shown.length;
 const list=sg.n==='Merchant bonuses'?'VP from merchant bonus tiles when selling.':shown.length?shown.map(x=>`${esc(x[0])} <b>${x[1]}</b>`).join(' · ')+(zero?` · plus ${zero} worth 0`:''):'Nothing scored here.';
 const note=sg.n.endsWith('links')?'Each link scores 1 per link icon on the face-up tiles at both ends (merchants count 2).':sg.n.endsWith('tiles')?'Only flipped (sold or used) tiles score.':'';
 const lost=sp.lostVp?` · Lost ${sp.lostVp} VP to unpaid income`:'';
 return`<div class="fpts"><div class="fptitle">Where the points came from</div>${bars}
 <div class="pbinfo"><b>${esc(sp.name)} · ${sg.n} · ${sg.v} VP</b><div>${list}</div><small>${note}${note?' ':''}Income £${incOf(sp)}, £${sp.money} cash${lost}</small></div>
 <div class="pbkey">${PTK.map((x,j)=>`<span><i class="s${j}"></i>${x[0]}</span>`).join('')}${rank.some(pi=>P[pi].mvp)?'<span><i class="s4"></i>Merchant bonuses</span>':''}</div></div>`}
function refreshPoints(){const b=document.querySelector('.fbox');if(!b)return render();const old=b.querySelector('.fpts'),btn=b.querySelector('[data-act="showPoints"]');
 if(btn)btn.textContent=SHOWPTS?'Hide all points':'Show all points';b.classList.toggle('wide',SHOWPTS);
 if(!SHOWPTS){if(old)old.remove();return}const h=pointsHTML(finalRank());if(old)old.outerHTML=h;else b.querySelector('.fnote').insertAdjacentHTML('afterend',h);if(typeof skinDOM==='function')skinDOM(b)}
const COLOURS=[['Blue','#1F5FFF'],['Red','#E3262E'],['Orange','#FF8A00'],['Magenta','#D6249F']];
function fixSetupColours(){const used=[];SETUP.colors=SETUP.colors.slice(0,SETUP.h).filter(c=>{if(used.includes(c))return false;used.push(c);return true});for(const[,c]of COLOURS){if(SETUP.colors.length>=SETUP.h)break;if(!SETUP.colors.includes(c))SETUP.colors.push(c)}}
function setupColourRows(){fixSetupColours();return SETUP.colors.map((mine,k)=>`<div class="row" style="align-items:center;margin-top:4px">${SETUP.h>1?`<span style="min-width:70px">Player ${k+1}</span>`:''}<div class="swatches">${COLOURS.map(([n,c])=>{const who=SETUP.colors.indexOf(c);return`<button type="button" class="sw${c===mine?' on':''}${who>=0&&who!==k?' taken':''}" style="background:${c}" data-act="pickCol" data-k="${k}" data-c="${c}" aria-label="${n}${who>=0&&who!==k?', chosen by Player '+(who+1)+' (swap)':''}" title="${n}"></button>`}).join('')}</div></div>`).join('')}
function applyColours(){if(!document.documentElement)return;const r=document.documentElement.style;for(let i=0;i<4;i++){const c=S&&S.colors&&S.colors[i];if(c)r.setProperty('--pc'+i,c);else r.removeProperty('--pc'+i)}}
let LOGOPEN=false;
function renderFullLog(){const el=document.getElementById('fulllog');if(!el||typeof el.querySelector!=='function')return;
 el.innerHTML=`<button type="button" class="linkbtn" data-act="openLog">View full game log (${S.log.length} ${S.log.length===1?'entry':'entries'})</button>`;if(LOGOPEN)renderLogModal()}
function renderLogModal(){const ov=document.getElementById('logov');if(!ov)return;if(!LOGOPEN){ov.hidden=true;ov.innerHTML='';return}
 const old=ov.querySelector('.flog-list'),atBottom=!old||old.scrollTop+old.clientHeight>=old.scrollHeight-8,prevTop=old?old.scrollTop:0;
 const rows=S.log.map((t,i)=>{const cls=/^(Canal|Rail) era (begins|scored)/.test(t)?'era':/^Round \d+ over/.test(t)?'round':'';return`<li class="${cls}"><span class="n">${i+1}</span>${esc(t)}</li>`}).join('');
 ov.hidden=false;ov.innerHTML=`<div class="ch-box logbox" role="dialog" aria-modal="true" aria-label="Full game log"><div class="ch-top"><h2>Full game log <span class="sub" style="font-size:14px">(${S.log.length} ${S.log.length===1?'entry':'entries'})</span></h2><button type="button" data-act="closeLog">Close</button></div><ol class="flog-list">${rows}</ol></div>`;
 if(typeof skinDOM==='function')skinDOM(ov);const l=ov.querySelector('.flog-list');l.scrollTop=(!old||atBottom)?l.scrollHeight:prevTop}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&LOGOPEN){LOGOPEN=false;renderLogModal()}});
function coachOn(){return!!(S&&S.coachOn)}

/* ---------- Sound effects (Web Audio, nothing to download) ---------- */
const SOUND={sfx:(()=>{try{return localStorage.getItem('bb-sfx')!=='off'}catch(x){return true}})()};
let AC=null,SFXG=null,LAST_LOG_LEN=-1,LAST_CHIME=-1;
function audioReady(){if(AC)return true;const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;AC=new C();SFXG=AC.createGain();SFXG.gain.value=.5;SFXG.connect(AC.destination);return true}
document.addEventListener('pointerdown',()=>{if(!audioReady())return;if(AC.state==='suspended')AC.resume()},{passive:true});
function tone(f,t,dur,type,vol,dest,f2){const o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(dest||SFXG);o.start(t);o.stop(t+dur+.05)}
function noise(t,dur,vol,freq){const n=AC.createBufferSource(),len=Math.floor(AC.sampleRate*dur),buf=AC.createBuffer(1,len,AC.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);n.buffer=buf;const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=freq||900;f.Q.value=1.2;const g=AC.createGain();g.gain.value=vol;n.connect(f);f.connect(g);g.connect(SFXG);n.start(t)}
function sfx(kind,vol){if(!SOUND.sfx||!AC||AC.state!=='running')return;const t=AC.currentTime+.01,v=vol||1;
 if(kind==='build'){noise(t,.12,.5*v,500);tone(150,t,.22,'sine',.6*v,null,80);tone(980,t+.03,.12,'triangle',.12*v)}
 else if(kind==='link'){noise(t,.09,.35*v,1400);noise(t+.13,.09,.3*v,1200);tone(330,t,.25,'triangle',.18*v,null,440)}
 else if(kind==='sell'){tone(1318,t,.12,'square',.08*v);tone(1760,t+.09,.35,'triangle',.18*v);tone(2637,t+.09,.25,'sine',.06*v)}
 else if(kind==='turn'){tone(880,t,1.3,'sine',.22*v);tone(1760,t,.6,'sine',.05*v);tone(1174.7,t+.2,1.4,'sine',.2*v);tone(2349,t+.2,.6,'sine',.04*v)}}
function soundFromLog(){if(!S||!S.log)return;const n=S.log.length;if(LAST_LOG_LEN<0||n<LAST_LOG_LEN||n-LAST_LOG_LEN>14){LAST_LOG_LEN=n;return}
 const fresh=S.log.slice(LAST_LOG_LEN);LAST_LOG_LEN=n;let k=0;const me=V(),myName=S.players[me]?S.players[me].name:'';
 for(const t of fresh){let kind=null;if(/ built a level /.test(t)||/ overbuilt /.test(t))kind='build';else if(/ built a (canal|rail) | added a second rail /.test(t))kind='link';else if(/ sold the /.test(t))kind='sell';if(!kind)continue;
  const mine=t.startsWith('You ')||(myName&&t.startsWith(myName+' '));setTimeout(()=>sfx(kind,mine?1:.5),k*160);if(++k>=3)break}}
function turnChime(){if(!S||S.over||S.modal)return;if(isHuman(cur())&&cur()===V()&&S.turnSerial!==LAST_CHIME){LAST_CHIME=S.turnSerial;sfx('turn')}}
function render(){applyColours();try{soundFromLog();turnChime()}catch(x){}renderCore();skinDOM(document.querySelector('.wrap'));skinDOM(document.getElementById('modal'))}
function renderCore(){const ss=document.getElementById('styleSel');if(ss&&!(document.activeElement&&ss.contains(document.activeElement)))ss.innerHTML=`<div class="setgrid"><label>Sound effects<select data-chg="sfx" aria-label="Sound effects"><option value="on"${SOUND.sfx?' selected':''}>On</option><option value="off"${SOUND.sfx?'':' selected'}>Off</option></select></label><label>Setting<select data-chg="setting" aria-label="Setting"><option value="classic"${SETTING==='classic'?' selected':''}>Classic</option><option value="space"${SETTING==='space'?' selected':''}>Space</option></select></label><label>Map style<select data-chg="theme" aria-label="Map style">${THEMES.map(([k,n])=>`<option value="${k}"${THEME===k?' selected':''}>${n}</option>`).join('')}</select></label></div>`;if(typeof tipKey!=='undefined'&&tipKey&&tipKey.startsWith('c:'))hideTip();if(!S.over&&!S.modal&&isHuman(cur())&&cur()===V()&&S.coachTurn!==S.turnSerial){S.coachTurn=S.turnSerial;const pend=S.pending;S.pending=[];composeCoach(pend)}
 nudgeCheck();renderNudge();renderStatus();renderControls();renderUndo();$('map').innerHTML=mapSVG();$('legend').innerHTML=$('legend2').innerHTML=legendHTML();
 $('latest').innerHTML=S.log.slice(-4).reverse().map(t=>`<li>${esc(t)}</li>`).join('');renderFullLog();
 {const cb=$('coach');if(coachOn()){cb.hidden=false;cb.innerHTML=`<span class="who">Coach</span><br>${esc(S.coach).replace(/\n/g,'<br>')}`}else{cb.hidden=true;cb.innerHTML=''}}
 if(S.modal&&S.modal.handoff!==undefined){$('modal').innerHTML=`<div class="modal solid"><div class="box" role="dialog" aria-modal="true"><h2>${esc(WHO(S.modal.handoff))}, you're up</h2><p>Pass the device to ${esc(WHO(S.modal.handoff))}. Your hand stays hidden until you tap below.</p><div class="row"><button type="button" class="primary" data-act="takeTurn">Show my hand</button></div></div></div>`;return}
 if(S.modal&&S.modal.setup){const sel=(k,v)=>SETUP[k]===v?'primary':'';$('modal').innerHTML=`<div class="modal"><div class="box" role="dialog" aria-modal="true"><h2>New game</h2><p>How many players in total?</p><div class="row setup">${[2,3,4].map(n=>`<button type="button" class="${sel('n',n)}" data-act="selN" data-n="${n}">${n}</button>`).join('')}</div><p style="margin-top:12px">How many of them are people? The rest are bots. People take turns on this device.</p><div class="row setup">${Array.from({length:SETUP.n},(_,i)=>i+1).map(k=>`<button type="button" class="${sel('h',k)}" data-act="selH" data-n="${k}">${k}</button>`).join('')}</div><p style="margin-top:12px">${SETUP.h>1?'Colours':'Your colour'}</p>${setupColourRows()}<p style="margin-top:12px">Coach and hints</p><div class="row setup"><button type="button" class="${SETUP.coach?'primary':''}" data-act="selCoach" data-v="on">On</button><button type="button" class="${SETUP.coach?'':'primary'}" data-act="selCoach" data-v="off">Off</button></div><p class="sub" style="margin:4px 0 0">Tips on your turn and the Hint button. This can't be changed once the game starts.</p><p style="margin-top:12px">Bot strength</p><div class="row setup"><button type="button" class="${SETUP.bot==='devious'?'primary':''}" data-act="selBot" data-v="devious">Devious</button><button type="button" class="${SETUP.bot==='normal'?'primary':''}" data-act="selBot" data-v="normal">Normal</button></div><p class="sub" style="margin:4px 0 0">Devious bots look a few moves ahead and play to beat whoever is leading. Normal bots play simpler, for learning.</p><div class="row"><button type="button" class="primary" data-act="start">Start game</button></div>${S.modal.canCancel?'<div class="row"><button type="button" data-act="cancelSetup">Keep playing this game</button></div>':''}</div></div>`;return}
 if(S.modal&&S.modal.final){$('modal').innerHTML=finalHTML();return}
 if(S.modal&&S.modal.eraEnd){$('modal').innerHTML=eraEndHTML(S.modal);return}
 $('modal').innerHTML=S.modal?`<div class="modal"><div class="box" role="dialog" aria-modal="true"><h2>${esc(S.modal.title)}</h2>${S.modal.lines.map(l=>`<p>${esc(l)}</p>`).join('')}<div class="row"><button type="button" class="primary" data-act="closeModal">${esc(S.modal.btn)}</button></div></div></div>`:''}

/* input */
function snap(){UNDO_DEADLINE=0;UNDO.push(JSON.stringify(S));if(UNDO.length>40)UNDO.shift()}
let UNDO_DEADLINE=0;const UNDO_WINDOW=10000;
function renderUndo(){const el=document.getElementById('undo');if(!el)return;if(UNDO_DEADLINE&&Date.now()>=UNDO_DEADLINE){UNDO=[];UNDO_DEADLINE=0}
 if(!UNDO.length){el.innerHTML='';return}const secs=UNDO_DEADLINE?Math.max(1,Math.ceil((UNDO_DEADLINE-Date.now())/1000)):0;const label=`Undo ${S.humans>1?'last move':'my last move'}`;
 el.innerHTML=`<button type="button" class="undo${secs?' timed':''}" data-act="undo">${label}${secs?` <span class="usecs">${secs}s</span>`:''}${secs?`<span class="ubar" style="--s:${((UNDO_DEADLINE-Date.now())/UNDO_WINDOW).toFixed(3)};animation-duration:${UNDO_DEADLINE-Date.now()}ms"></span>`:''}</button>`;if(typeof skinDOM==='function')skinDOM(el)}
setInterval(()=>{if(S&&S.lockUntil){const ls=document.querySelector('.lockSecs');if(Date.now()>=S.lockUntil){S.lockUntil=0;render()}else if(ls)ls.textContent=Math.ceil((S.lockUntil-Date.now())/1000)+'s'}if(!UNDO_DEADLINE)return;if(Date.now()>=UNDO_DEADLINE){renderUndo();return}const s=document.querySelector('.usecs');if(s)s.textContent=Math.max(1,Math.ceil((UNDO_DEADLINE-Date.now())/1000))+'s';else renderUndo()},250);
function firstLink(e){snap();CM=[];discard(V(),[UI.card]);execLink(V(),e);if(S.era==='rail'&&bestLink2(V())){flushCoach();resetUI();UI.mode='link2';render()}else{flushCoach();resetUI();afterAction()}}
function makesTxt(d,ind){return ind==='coal'?`makes ${d.prod} coal, `:ind==='iron'?`makes ${d.prod} iron, `:ind==='brewery'?`makes ${d.rail||S.era==='rail'?2:1} beer, `:''}
function tileSpec(d,ind){const need=[d.coal?`${d.coal} coal`:'',d.iron?`${d.iron} iron`:''].filter(Boolean).join(' + ');return`level ${d.l}: £${d.cost}${need?' + '+need:''}, ${ind?makesTxt(d,ind):''}${d.vp} VP, +${d.inc} income, ${d.lk} link point${d.lk===1?'':'s'}${d.beer?`, sells with ${d.beer} beer`:''}${d.canal?', canal era only':''}${d.rail?', rail era only':''}${d.bulb?', can\'t be developed':''}`}
function devOptsHTML(list,act){const p=S.players[V()];return list.map((e,k)=>{const ind=e.inds[0],cur=p.mat[ind][0],nx=p.mat[ind][1];
 const iron=e.ip.takes.length?`Iron from ${POSS(e.ip.takes[0].t.owner)} ironworks in ${TOWNS[e.ip.takes[0].t.town].n} (free)`:`Iron from the market: £${e.total}`;
 return`<button type="button" class="opt" data-act="${act}" data-k="${k}"><svg class="mi" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-${ind}"/></svg>${IND[ind].name}: remove level ${cur.l}<small>Removing ${tileSpec(cur,ind)}</small><small>Next up: ${nx?tileSpec(nx,ind):'nothing left of this industry'}</small><small>${iron}. ${p.mat[ind].length-1} left after this.</small></button>`})}
function firstDevelop(e){snap();CM=[];discard(V(),[UI.card]);execDevelop(V(),e);const more=Object.keys(IND).some(k=>evalDevelop(V(),[k]).ok);if(!more){const p=S.players[V()],ip=ironPlan(V(),1);coachAdd(p.money<ip.cost?`No second develop: another iron would cost £${ip.cost} and you have £${p.money}.`:'No second develop: nothing else on your mat can be developed.')}flushCoach();resetUI();if(more){UI.mode='dev2';render()}else afterAction()}
function YOURS(i){return i===V()?'your':POSS(i)}
function beerAltLabel(o){if(o.merch){const b=MERCH[o.m].bonus;return{t:`${MERCH[o.m].n}'s beer barrel`,s:`Bonus: ${b.type==='money'?'+£'+b.v:b.type==='vp'?'+'+b.v+' VP':b.type==='income'?'+'+b.v+' income spaces':'a free develop'}`}}
 const br=o.br||o.takes[0].t;const own=br.owner===V();return{t:`${own?'Your':POSS(br.owner)[0].toUpperCase()+POSS(br.owner).slice(1)} brewery in ${TOWNS[br.town].n} (${br.cubes} left)`,s:own?(br.cubes===1?'Uses your last beer there, which flips your brewery.':'Keeps more of your other beer for later.'):(br.cubes===1?`Their last beer there: it flips ${POSS(br.owner)} brewery and raises their income.`:`Uses ${POSS(br.owner)} beer instead of yours.`)}}
function pickRail2(e){if(e.brs&&e.brs.length>1){UI.beerPick={kind:'link2',e,alts:e.brs.map(br=>({br}))};render();return}userAction([],()=>execLink2(V(),e))}
function sellBeerAlts(pi,t,only){if(t.def.beer!==1)return[];const d=bfs([t.town]);const ms=Object.keys(MERCH).filter(m=>d[m]!==undefined&&acc(m).includes(t.ind)&&(!only||m===only));if(!ms.length)return[];const out=[];
 ms.forEach(m=>{if(S.merchBeer[m]>0)out.push({m,merch:true,takes:[]})});
 S.tiles.filter(b=>b.ind==='brewery'&&b.cubes>0&&(b.owner===pi||d[b.town]!==undefined)).sort((a,b)=>(b.owner===pi)-(a.owner===pi)).forEach(b=>out.push({m:ms[0],merch:false,takes:[{t:b,n:1}]}));return out}
function sellNow(e){CM=[];if(UI.card!=='spent'){snap();discard(V(),[UI.card]);UI.card='spent'}execSell(V(),e);UI.sold++;UI.beerPick=null;
 const more=S.tiles.filter(t=>t.owner===V()&&!t.flipped&&SELLABLE.includes(t.ind)).some(t=>evalSell(V(),t).ok);
 if(more)coachAdd('You can sell another in this action.');flushCoach();
 if(S.pendingDev&&S.pendingDev.pi===V()){UI.afterDevMore=more;render();return}
 if(!more){resetUI();afterAction()}else render()}
function startBuild(b,ci){if(b.alts&&b.alts.length>1){UI.slotPick={b,ci};render();return}userAction([ci],()=>execBuild(V(),b))}
function userAction(cards,fn){if(UI.mode!=='link2'&&UI.mode!=='dev2')snap();CM=[];discard(V(),cards);fn();flushCoach();resetUI();afterAction()}
const H={
 mode(el){if(cur()!==V())return;resetUI();UI.mode=el.dataset.m;render()},
 cancel(){if(UI.sold)return;resetUI();render()},
 pickCard(el){if(cur()!==V()||S.over)return;const i=+el.dataset.i;const p=S.players[V()];
  if(!UI.mode){UI.note='Choose an action first, then the card to spend on it.';render();return}
  if(UI.mode==='scout'){const k=UI.scout.indexOf(i);if(k>=0)UI.scout.splice(k,1);else if(UI.scout.length<3)UI.scout.push(i);render();return}
  if(UI.mode==='loan'){userAction([i],()=>execLoan(V()));return}
  if(UI.mode==='pass'){userAction([i],()=>{log(`${solo(V())?'You':WHO(V())} passed.`);coachAdd('Passed.')});return}
  if(UI.mode==='build'&&!allBuilds(V(),p.hand[i]).some(b=>b.ok)){const r=buildWhy(V(),p.hand[i]);UI.note=`"${cardLabel(p.hand[i])}" can't build anything now. ${r.join(' ')}`;render();return}
  UI.note='';UI.card=i;render()},
 doBuildAt(el){const o=UI.atTown&&UI.atTown.opts[+el.dataset.k];if(o)startBuild(o.b,o.ci)},
 doSlot(el){const sp=UI.slotPick;if(!sp)return;const s=+el.dataset.s;if(!sp.b.alts.includes(s))return;userAction([sp.ci],()=>execBuild(V(),{...sp.b,slot:s}))},
 clearSlot(){UI.slotPick=null;render()},
 clearAt(){UI.atTown=null;UI.note='';render()},
 doBuild(el){const b=UI.opts[+el.dataset.k];if(b)startBuild(b,UI.card)},
 doLink(el){const e=UI.opts[+el.dataset.k];if(e)firstLink(e)},
 pickLink(el){const id=+el.dataset.id;if(UI.mode==='link2'){const e=UI.opts.find(x=>x.l.id===id);if(e)pickRail2(e);return}if(UI.mode!=='link'||UI.card===null)return;const e=UI.opts.find(x=>x.l.id===id);if(e)firstLink(e)},
 doLink2(el){const e=UI.opts[+el.dataset.k];if(e)pickRail2(e)},
 chooseBeer(el){const bp=UI.beerPick;if(!bp)return;const o=bp.alts[+el.dataset.k];UI.beerPick=null;if(bp.kind==='link2')userAction([],()=>execLink2(V(),{...bp.e,br:o.br}));else sellNow({...bp.e,m:o.m,bp:{ok:true,merch:o.merch,takes:o.takes}})},
 clearBeer(){UI.beerPick=null;render()},
 finishLink(){resetUI();afterAction()},
 doDevelop(el){const e=UI.opts[+el.dataset.k];if(e)firstDevelop(e)},
 doDev2(el){const e=UI.opts[+el.dataset.k];if(e)userAction([],()=>execDevelop(V(),e))},
 finishDev(){resetUI();afterAction()},
 doSell(el){const e=UI.opts[+el.dataset.k];if(!e)return;const alts=sellBeerAlts(V(),e.t,e.m);if(alts.length>1){UI.beerPick={kind:'sell',e,alts};render();return}sellNow(e)},
 finishSell(){resetUI();afterAction()},
 scoutGo(){if(UI.scout.length!==3)return;const c=[...UI.scout];userAction(c,()=>execScout(V()))},
 setSetting(el){setSetting(el.dataset.v)},
 setColour(el){if(!S.colors)return;const me=V(),c=el.dataset.c,other=S.colors.indexOf(c);if(other===me)return;if(other>=0)S.colors[other]=S.colors[me];S.colors[me]=c;if(typeof ONLINE!=='undefined'&&ONLINE&&window.NET)NET.push();render()},
 toggleSfx(){SOUND.sfx=!SOUND.sfx;try{localStorage.setItem('bb-sfx',SOUND.sfx?'on':'off')}catch(x){}render();if(SOUND.sfx&&audioReady()){AC.resume();sfx('build')}},
 setTheme(el){THEME=el.dataset.t;try{localStorage.setItem('bb-theme',THEME)}catch(x){}render()},
 dismissNudge(){NUDGE_DISMISSED=true;renderNudge()},
 openChart(){CHART.open=true;hideTip();renderChart()},
 closeChart(){CHART.open=false;renderChart()},
 chartTab(el){CHART.tab=el.dataset.t;renderChart()},
 chartSort(el){CHART.sort=el.dataset.s;renderChart()},
 viewBoard(){if(typeof ONLINE!=='undefined'&&ONLINE&&S.eraNote)DISMISSED.add(S.eraNote.key);S.modal=null;render()},
 showResults(){S.modal={final:true};render()},
 showPoints(){SHOWPTS=!SHOWPTS;refreshPoints()},
 eraSeg(el){ERASEL=[+el.dataset.pi,+el.dataset.j];refreshEra()},
 ptSeg(el){PTSEL=[+el.dataset.pi,+el.dataset.j];refreshPoints()},
 playAgain(){S.modal={setup:true};render()},
 openLog(){LOGOPEN=true;hideTip();renderLogModal()},
 closeLog(){LOGOPEN=false;renderLogModal()},
 freeDev(el){const pd=S.pendingDev;if(!pd||pd.pi!==V())return;const p=S.players[pd.pi],k=el.dataset.k;CM=[];
  if(k&&p.mat[k].length&&!p.mat[k][0].bulb){const d=p.mat[k].shift();log(`${WHO(pd.pi)} used Gloucester's free develop to remove a level ${d.l} ${lower(k)}.`);coachAdd(`Free develop: next ${lower(k)} is ${p.mat[k][0]?'level '+p.mat[k][0].l:'none'}.`)}else log(`${WHO(pd.pi)} skipped Gloucester's free develop.`);
  S.pendingDev=null;flushCoach();const more=UI.afterDevMore;UI.afterDevMore=null;if(more)render();else{resetUI();afterAction()}},
 undo(){if(!UNDO.length)return;if(UNDO_DEADLINE&&Date.now()>=UNDO_DEADLINE){UNDO=[];UNDO_DEADLINE=0;renderUndo();return}UNDO_DEADLINE=0;clearTimeout(botTimer);S=JSON.parse(UNDO.pop());resetUI();S.coach='Move undone.';hideTip();if(ONLINE){S.modal=null;NET.push(true)}render();maybeBot()},
 hint(){if(!coachOn())return;let c;try{const i=searchBotAction(V());c=candidates(V(),true)[i]}catch(x){c=candidates(V())[0]}S.coach=`Suggestion: ${c.desc}.`;render()},
 closeModal(){if(ONLINE){if(S.eraNote)DISMISSED.add(S.eraNote.key);S.modal=null;render();maybeBot();return}if(S.over){S.modal={setup:true};render();return}S.modal=null;render();maybeBot()},
 restart(){if(ONLINE){NET.toLobby();return}clearTimeout(botTimer);S.prevModal=S.modal;S.modal={setup:true,canCancel:!S.over&&S.started};render()},
 selN(el){SETUP.n=+el.dataset.n;SETUP.h=Math.min(SETUP.h,SETUP.n);render()},
 selH(el){SETUP.h=+el.dataset.n;render()},
 pickCol(el){fixSetupColours();const k=+el.dataset.k,c=el.dataset.c,o=SETUP.colors.indexOf(c);if(o>=0&&o!==k)SETUP.colors[o]=SETUP.colors[k];SETUP.colors[k]=c;render()},
 start(){newGame(SETUP.n,SETUP.h);S.botLevel=SETUP.bot;S.coachOn=SETUP.coach;fixSetupColours();{const mine=SETUP.colors.slice(0,SETUP.h),rest=COLOURS.map(x=>x[1]).filter(c=>!mine.includes(c));S.colors=mine.concat(rest).slice(0,S.players.length);render()}S.started=true},
 selBot(el){SETUP.bot=el.dataset.v;render()},
 selCoach(el){SETUP.coach=el.dataset.v==='on';render()},
 takeTurn(){S.view=S.modal.handoff;S.modal=null;resetUI();render()},
 cancelSetup(){S.modal=S.prevModal||null;render();maybeBot()}
};
function townTip(k){const t=TOWNS[k],pi=V(),p=S.players[pi];let h=`<b>${esc(t.n)}</b>`;
 h+='<ul>'+t.slots.map((types,i)=>{const tile=tileAt(k,i);if(!tile)return`<li>Empty: ${types.map(x=>IND[x].name).join(' or ')}</li>`;return`<li>${CAPS(tile.owner)} level ${tile.def.l} ${lower(tile.ind)}, ${tile.flipped?'face up (scoring)':'face down'}${tile.cubes?`, ${tile.cubes} ${tile.ind==='brewery'?'beer':tile.ind} left`:''}${SELLABLE.includes(tile.ind)&&!tile.flipped?`, needs ${tile.def.beer} beer to sell`:''}. ${tile.def.lk} link point${tile.def.lk===1?'':'s'}${tile.flipped?'':' once face up'}</li>`}).join('')+'</ul>';
 {const ic=icons(k);h+=`<div>Each link into ${esc(t.n)} scores ${ic} VP right now.</div>`}
 if(S.over||!p.hand.length)return h;
 const best={};const fails=[];p.hand.forEach(c=>allBuilds(pi,c).forEach(b=>{if(b.town!==k)return;if(b.ok){const cur=best[b.ind];if(!cur||b.total<cur.total)best[b.ind]={...b,cl:cardLabel(c)}}else fails.push(b.reason)}));
 const opts=Object.values(best);const head=isHuman(cur())&&cur()===pi?'You can build here now:':'With your hand, on your turn you could build:';
 if(opts.length)h+=`<div class="t-h">${head}</div><ul>${opts.map(b=>`<li>Level ${b.def.l} ${lower(b.ind)}${overTxt(b)}, £${b.total}${SELLABLE.includes(b.ind)?`, sells with ${b.def.beer} beer`:''} (${esc(b.cl)} card)</li>`).join('')}</ul>`;
 else{const free=t.slots.some((s,i)=>!tileAt(k,i));let why;if(!free)why='Every space here is taken.';else if(!fails.length)why='No card in your hand matches these spaces.';else{const nw=fails.every(r=>/isn't in your network|only builds in/.test(r));why=nw?(t.farm?`It isn't in your network. ${k==='farmB'?'The Kidderminster to Worcester link connects it':'Link it to Cannock'}, then use a Brewery or Wild industry card.`:`No card reaches it: you'd need a ${esc(t.n)} card, or a link into it so an industry card works.`):topReasons(fails.filter(r=>!/only builds in|Wrong industry/.test(r)))[0]||topReasons(fails)[0]}
  h+=`<div class="t-h t-no">You can't build here right now.</div><div>${esc(why)}</div>`}
 return h}
function merchTip(k){const m=MERCH[k],b=m.bonus;const bt=b.type==='money'?`+£${b.v}`:b.type==='vp'?`+${b.v} VP`:b.type==='income'?`+${b.v} income spaces`:'a free develop';
 const a=acc(k);return`<b>${esc(m.n)}</b><div>Buys: ${a.length?a.map(x=>IND[x].name.toLowerCase()).join(', '):'nothing this game (blank tiles)'}</div><div>Merchant tiles: ${S.merchTiles[k].length?'':'none in a game this size'}${S.merchTiles[k].map(t=>t==='blank'?'blank':t==='any'?'any goods':IND[t].name.toLowerCase()).join(', ')}</div><div>Beer barrels left: ${S.merchBeer[k]}</div><div>Bonus for using its beer: ${bt}</div>`}
let tipKey=null,tipPinned=false;
function hideTip(){const t=$('tip');t.hidden=true;tipKey=null;tipPinned=false}
function linkTip(id){const l=LINKS[id],pi=V();const b=S.links.find(x=>x.id===id);const ia=icons(l.a),ib=icons(l.b);
 let h=`<b>${esc(nodeName(l.a))} to ${esc(nodeName(l.b))}</b>`;
 h+=`<div>${b?`${CAPS(b.owner)} ${S.era==='canal'?'canal':'rail'}`:l.canal&&l.rail?'Canal or rail route':l.canal?'Canal only':'Rail only'}</div>`;
 h+=`<div class="t-h">Worth ${ia+ib} VP if the era ended now</div><div>${esc(nodeName(l.a))}: ${ia} link point${ia===1?'':'s'}. ${esc(nodeName(l.b))}: ${ib}.</div>`;
 h+='<div class="sub" style="margin-top:3px">Face-up tiles at each end add their link points; merchants count 2.</div>';
 if(!b&&!S.over){const e=evalLink(pi,l);h+=e.ok?`<div class="t-h">You can build it now for £${e.total}.</div>`:`<div class="t-no">${esc(e.reason)}</div>`}
 return h}
function showTip(g,x,y){const t=$('tip');const key=g.dataset.town?'t:'+g.dataset.town:g.dataset.merch?'m:'+g.dataset.merch:'l:'+g.dataset.link;if(key!==tipKey){t.innerHTML=g.dataset.town?townTip(g.dataset.town):g.dataset.merch?merchTip(g.dataset.merch):linkTip(+g.dataset.link);tipKey=key}
 skinDOM(t);t.hidden=false;const r=t.getBoundingClientRect();let lx=x+16,ly=y+16;if(lx+r.width>innerWidth-8)lx=x-r.width-16;if(ly+r.height>innerHeight-8)ly=Math.max(8,innerHeight-r.height-8);if(lx<8)lx=8;t.style.left=lx+'px';t.style.top=ly+'px'}
$('map').addEventListener('mousemove',e=>{if(tipPinned)return;const g=e.target.closest('[data-town],[data-merch],[data-link]');if(!g){if(tipKey)hideTip();return}showTip(g,e.clientX,e.clientY)});
$('map').addEventListener('mouseleave',()=>{if(!tipPinned)hideTip()});
function buildAt(k){const pi=V(),p=S.players[pi];const cards=UI.card!==null&&UI.card!=='spent'?[UI.card]:p.hand.map((c,i)=>i);let opts=[];const seen=new Set();
 cards.forEach(ci=>dedupe(allBuilds(pi,p.hand[ci]).filter(b=>b.ok&&b.town===k)).forEach(b=>{const key=b.ind+'|'+cardLabel(p.hand[ci]);if(!seen.has(key)){seen.add(key);opts.push({b,ci})}}));
 if(!opts.length){const fails=cards.flatMap(ci=>allBuilds(pi,p.hand[ci]).filter(b=>!b.ok&&b.town===k).map(b=>b.reason));const t=TOWNS[k];const free=t.slots.some((s,i)=>!tileAt(k,i));
  const nw=fails.length&&fails.every(r=>/isn't in your network|only builds in|Wrong industry/.test(r));
  UI.note=`Can't build in ${t.n}. `+(!free?'Every space there is taken.':!fails.length?'No card matches its spaces.':nw?(t.farm?'Link it first, then use a Brewery or Wild industry card.':`You need a ${t.n} card, or a link into it for an industry card.`):(topReasons(fails.filter(r=>!/only builds in|Wrong industry/.test(r)))[0]||topReasons(fails)[0]));UI.atTown=null;render();return}
 UI.note='';if(opts.length===1){const o=opts[0];startBuild(o.b,o.ci);return}
 UI.atTown={k,opts};render()}
$('map').addEventListener('click',e=>{if(e.target.closest('[data-act]'))return;const bt=e.target.closest('[data-town]');if(bt&&UI.mode==='build'&&cur()===V()&&!S.over&&!S.modal){hideTip();buildAt(bt.dataset.town);e.stopPropagation();return}const g=e.target.closest('[data-town],[data-merch],[data-link]');if(!g){hideTip();return}tipKey=null;showTip(g,e.clientX,e.clientY);tipPinned=true;e.stopPropagation()});
document.addEventListener('click',e=>{if(tipPinned&&!e.target.closest('#map'))hideTip()});
function cardTip(card){const pi=V();const ok=dedupe(allBuilds(pi,card).filter(b=>b.ok)).sort((a,b)=>TOWNS[a.town].n.localeCompare(TOWNS[b.town].n)||a.total-b.total);
 let h=`<b>${esc(cardLabel(card))}</b>`;
 if(card.t==='loc')h+=`<div>Builds anything that fits in ${esc(TOWNS[card.k].n)}, even outside your network.</div>`;else if(card.t==='ind')h+=`<div>Builds ${card.k==='cg'?'a cotton mill or manufacturer':card.k==='iron'?'an ironworks':'a '+lower(card.k)} anywhere in your network.</div>`;else if(card.t==='wloc')h+='<div>Builds anything in any town.</div>';else h+='<div>Builds any industry in your network.</div>';
 if(ok.length){h+=`<div class="t-h">You can build:</div><ul>${ok.slice(0,9).map(b=>`<li>${esc(TOWNS[b.town].n)}: level ${b.def.l} ${lower(b.ind)}${overTxt(b)}, £${b.total}${SELLABLE.includes(b.ind)?`, sells with ${b.def.beer} beer`:''}</li>`).join('')}${ok.length>9?`<li>and ${ok.length-9} more</li>`:''}</ul>`}
 else h+=`<div class="t-h t-no">Nothing it can build right now.</div><div>${esc(buildWhy(pi,card)[0])}</div>`;
 h+='<div class="sub" style="margin-top:4px">Any card can also pay for a link, sale, loan, develop or pass.</div>';return h}
$('controls').addEventListener('mouseover',e=>{const c=e.target.closest('[data-hi]');if(!c)return;const card=S.players[V()].hand[+c.dataset.hi];if(!card)return;
 const set=card.t==='loc'?new Set([card.k]):new Set(allBuilds(V(),card).filter(b=>b.ok).map(b=>b.town));UI.hoverTowns=set;$('map').innerHTML=mapSVG();
 if(tipPinned||!matchMedia('(hover: hover)').matches)return;const t=$('tip');t.innerHTML=cardTip(card);skinDOM(t);tipKey='c:'+c.dataset.hi;t.hidden=false;const r=c.getBoundingClientRect(),tr=t.getBoundingClientRect();let lx=r.left-tr.width-12,ly=r.top;if(lx<8)lx=Math.min(innerWidth-tr.width-8,r.left);if(lx===r.left||lx<8)ly=r.bottom+8;if(ly+tr.height>innerHeight-8)ly=Math.max(8,innerHeight-tr.height-8);t.style.left=lx+'px';t.style.top=ly+'px'});
$('controls').addEventListener('pointerdown',()=>{if(tipKey&&tipKey.startsWith('c:'))hideTip()});
$('controls').addEventListener('mouseout',e=>{const c=e.target.closest('[data-hi]');if(!c||c.contains(e.relatedTarget))return;UI.hoverTowns=null;$('map').innerHTML=mapSVG();if(!tipPinned&&tipKey&&tipKey.startsWith('c:'))hideTip()});
document.addEventListener('change',e=>{const s=e.target.closest('select[data-chg]');if(!s)return;const v=s.value;s.blur();
 if(s.dataset.chg==='sfx'){if((v==='on')!==SOUND.sfx)H.toggleSfx()}
 else if(s.dataset.chg==='setting'){if(v!==SETTING)setSetting(v)}
 else if(s.dataset.chg==='theme'){H.setTheme({dataset:{t:v}})}});
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const a=el.dataset.act;if(H[a])H[a](el)});
newGame(2);S.modal={setup:true};render();
