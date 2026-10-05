/* Online play: Firebase sign-in, lobby, seats, and syncing game state. */
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,signInAnonymously,onAuthStateChanged,connectAuthEmulator} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,onSnapshot,runTransaction,updateDoc,serverTimestamp,connectFirestoreEmulator} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig={
  apiKey:"AIzaSyCMNw2ChYhpO3SvCBlWLNBUNj3uCWFbHLw",
  authDomain:"brass-birmingham-5d8f7.firebaseapp.com",
  projectId:"brass-birmingham-5d8f7",
  storageBucket:"brass-birmingham-5d8f7.firebasestorage.app",
  messagingSenderId:"86442763123",
  appId:"1:86442763123:web:f0787ab62faeb73ce05b06"
};
const TITLE='Brass Birmingham';
const fb=initializeApp(firebaseConfig),auth=getAuth(fb),db=getFirestore(fb);
// Local testing only: add ?emu=1 when running the Firebase emulators on localhost.
if(['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('emu')){connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});connectFirestoreEmulator(db,'127.0.0.1',8080)}
const $L=document.getElementById('lobby'),$W=document.querySelector('.wrap'),$net=document.getElementById('net');
let uid=null,code=null,unsub=null,G=null,mySeat=-1,localVersion=0,saving=false,dirty=false,forceNext=false,lobbyErr='';
const e=t=>String(t??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const getName=()=>{try{return localStorage.getItem('bb-name')||''}catch(x){return''}};
const setName=n=>{try{localStorage.setItem('bb-name',n)}catch(x){}};
const gref=()=>doc(db,'games',code);
function toast(t){const el=document.getElementById('toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,3500)}
function link(){return location.origin+location.pathname+'?g='+code}
function showLobby(html){$W.hidden=true;$L.hidden=false;$L.innerHTML=`<div class="card2">${html}</div>`}

/* ---------- home ---------- */
function home(msg){if(unsub){unsub();unsub=null}code=null;G=null;ONLINE=false;clearTimeout(botTimer);history.replaceState(null,'',location.pathname);
 showLobby(`<h1>${e(TITLE)}</h1><p class="sub">Play with friends online. Bots can fill empty seats.</p>${msg?`<p class="err">${e(msg)}</p>`:''}
 <h2>Your name</h2><input type="text" id="lb-name" maxlength="20" value="${e(getName())}" placeholder="What friends will see">
 <h2>Start a new game</h2><p class="sub">How many players in total, including bots?</p>
 <div class="seg">${[2,3,4].map(n=>`<button type="button" class="primary" data-lb="create" data-n="${n}">${n} players</button>`).join('')}</div>
 <h2>Join a game</h2><div class="row"><input type="text" id="lb-code" maxlength="6" placeholder="Game code" style="flex:1;text-transform:uppercase"><button type="button" data-lb="join">Join</button></div>
 <h2>Practice</h2><button type="button" data-lb="offline" style="width:100%">Play offline on this device</button>`)}
function needName(){const n=(document.getElementById('lb-name')?.value||getName()).trim();if(!n){toast('Enter your name first.');return null}setName(n);return n}
async function create(n){const name=needName();if(!name)return;
 const A='ABCDEFGHJKLMNPQRSTUVWXYZ';for(let tries=0;tries<8;tries++){const c=Array.from({length:4},()=>A[Math.floor(Math.random()*A.length)]).join('');const ref=doc(db,'games',c);
  if((await getDoc(ref)).exists())continue;
  await setDoc(ref,{code:c,title:TITLE,hostUid:uid,status:'lobby',seats:Array.from({length:n},(_,i)=>i===0?{uid,name,bot:false}:{uid:null,name:'',bot:false}),version:0,state:null,lastHumanUid:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  join(c);return}
 toast('Could not create a game. Try again.')}
function join(c){c=(c||'').trim().toUpperCase();if(!c)return;if(unsub)unsub();code=c;localVersion=0;history.replaceState(null,'','?g='+c);
 showLobby('<p class="sub">Connecting…</p>');
 unsub=onSnapshot(gref(),snap=>{if(!snap.exists()){home(`No game found with code ${c}.`);return}G=snap.data();onGame()},err=>{console.error(err);home('Could not reach that game. Check the code and your connection.')})}

/* ---------- lobby ---------- */
function onGame(){IS_HOST=G.hostUid===uid;mySeat=G.seats.findIndex(s=>s.uid===uid);
 if(G.status==='lobby'){ONLINE=false;clearTimeout(botTimer);localVersion=0;UNDO=[];renderLobby();return}
 if(mySeat<0){showLobby(`<h1>${e(TITLE)}</h1><p>Game <b>${e(code)}</b> has already started, and you don't have a seat in it.</p><button type="button" data-lb="home">Back</button>`);return}
 ONLINE=true;$L.hidden=true;$W.hidden=false;
 if(G.version!==localVersion)apply();else renderNet()}
function renderLobby(){const me=mySeat;const seats=G.seats;const humans=seats.filter(s=>s.uid).length;
 const row=(s,i)=>{let who,act='';
  if(s.uid){who=`<b>${e(s.name||'Player')}</b>${s.uid===G.hostUid?' <small>(host)</small>':''}${s.uid===uid?' <small>(you)</small>':''}`;if(s.uid===uid&&!IS_HOST)act=`<button type="button" data-lb="leave" data-i="${i}">Leave seat</button>`;else if(IS_HOST&&s.uid!==uid)act=`<button type="button" data-lb="kick" data-i="${i}">Remove</button>`}
  else if(s.bot){who='Bot';if(IS_HOST)act=`<button type="button" data-lb="bot" data-i="${i}">Open seat</button>`}
  else{who='<small>Open seat</small>';if(me<0)act+=`<button type="button" class="primary" data-lb="sit" data-i="${i}">Sit here</button>`;if(IS_HOST)act+=` <button type="button" data-lb="bot" data-i="${i}">Make bot</button>`}
  return`<div class="seat"><span class="who">Seat ${i+1}: ${who}</span>${act}</div>`};
 showLobby(`<h1>${e(TITLE)}</h1><p class="sub">Game code</p><div class="codebox">${e(code)}</div>
 <div class="row"><button type="button" class="primary" data-lb="copy">Copy invite link</button><button type="button" data-lb="home">Leave</button></div>
 <h2>Seats</h2>${seats.map(row).join('')}
 ${me<0?`<h2>Your name</h2><input type="text" id="lb-name" maxlength="20" value="${e(getName())}">`:''}
 ${IS_HOST?`<h2>Players</h2><div class="seg">${[2,3,4].map(n=>`<button type="button" class="${seats.length===n?'on':''}" data-lb="size" data-n="${n}">${n}</button>`).join('')}</div>
 <p class="sub" style="margin-top:12px">Any seat still open when you start becomes a bot. Bots play from your browser, so keep the game open while they take turns.</p>
 <button type="button" class="primary" data-lb="start" style="width:100%;margin-top:8px">Start game</button>`:`<p class="sub" style="margin-top:14px">Waiting for the host to start the game.</p>`}
 ${lobbyErr?`<p class="err">${e(lobbyErr)}</p>`:''}`);lobbyErr=''}
async function seatTx(fn){try{await runTransaction(db,async tx=>{const s=await tx.get(gref());const d=s.data();if(d.status!=='lobby')throw new Error('The game has already started.');const seats=d.seats.map(x=>({...x}));const r=fn(seats,d);if(r)throw new Error(r);tx.update(gref(),{seats,updatedAt:serverTimestamp()})})}catch(err){lobbyErr=err.message;if(G)renderLobby()}}
async function startGame(){const seats=G.seats.map(s=>s.uid?{...s}:{uid:null,name:'',bot:true});
 const st=startOnline(seats);const out=JSON.parse(JSON.stringify(st));out.coach='';out.modal=null;
 try{await runTransaction(db,async tx=>{const s=await tx.get(gref());if(s.data().status!=='lobby')throw new Error('Already started.');tx.update(gref(),{seats,status:'playing',state:JSON.stringify(out),version:1,lastHumanUid:null,updatedAt:serverTimestamp()})});localVersion=0;DISMISSED=new Set()}catch(err){lobbyErr=err.message;renderLobby()}}

/* ---------- sync ---------- */
function apply(){let r;try{r=JSON.parse(G.state)}catch(x){return}
 if((r.schema||0)!==STATE_VERSION){showLobby(`<h1>${e(TITLE)}</h1><p>This game was saved by a different version of the app, so it can't be loaded safely.</p><p class="sub">The host can start a fresh game from the lobby.</p>${IS_HOST?'<button type="button" data-lb="relobby">Back to lobby</button> ':''}<button type="button" data-lb="home">Home</button>`);return}
 const keep=localVersion>0&&S?{coach:S.coach,coachTurn:S.coachTurn}:{coach:'',coachTurn:-1};
 const midAction=localVersion>0&&UI&&((UI.mode==='sell'&&UI.sold)||UI.mode==='link2');
 S=r;S.view=mySeat;S.coach=keep.coach||'';S.coachTurn=keep.coachTurn;
 if(G.lastHumanUid!==uid)UNDO=[];
 S.modal=S.eraNote&&!DISMISSED.has(S.eraNote.key)?{...S.eraNote}:null;
 localVersion=G.version;if(!midAction)resetUI();clearTimeout(botTimer);hideTip();renderNet();render();maybeBot()}
function stateOut(force){const c=JSON.parse(JSON.stringify(S));delete c.coach;delete c.coachTurn;c.modal=null;c.view=0;if(c.log.length>250)c.log=c.log.slice(-250);
 const lhu=force||(LAST_ACTOR!=null&&isHuman(LAST_ACTOR))?uid:(G?G.lastHumanUid:null);return{state:JSON.stringify(c),lhu}}
function push(force){if(!ONLINE||!code)return;dirty=true;if(force)forceNext=true;if(saving)return;saving=true;
 (async()=>{while(dirty){dirty=false;const f=forceNext;forceNext=false;const out=stateOut(f);let nv=null;
  try{await runTransaction(db,async tx=>{const s=await tx.get(gref());const v=s.data().version;if(!f&&v!==localVersion)throw new Error('conflict');nv=v+1;tx.update(gref(),{state:out.state,version:nv,status:S.over?'over':'playing',lastHumanUid:out.lhu,updatedAt:serverTimestamp()})});localVersion=nv}
  catch(err){if(err.message==='conflict'){toast('Someone else moved first. Showing the latest game.');localVersion=-1;const s=await getDoc(gref());G=s.data();apply();dirty=false}else{console.error(err);toast('Could not save your move. Check your connection.');}}}
  saving=false})()}
async function toLobby(){if(IS_HOST){if(!confirm('End this game for everyone and go back to the lobby?'))return;await updateDoc(gref(),{status:'lobby',state:null,version:0,lastHumanUid:null,updatedAt:serverTimestamp()})}else{if(confirm('Leave this game? Your seat stays yours if you come back with the same link.'))home()}}
function renderNet(){if(!code)return;const bots=G&&G.seats.some(s=>s.bot);
 $net.innerHTML=`<div class="netbar">Game <b>${e(code)}</b><button type="button" data-lb="copy">Copy invite link</button>${IS_HOST&&bots&&!S.over?'<span>Bots run in your browser; keep this open.</span>':''}</div>`;
 const rb=document.querySelector('[data-act="restart"]');if(rb)rb.textContent=IS_HOST?'Lobby':'Leave'}
window.NET={push,toLobby};

/* ---------- events ---------- */
document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-lb]');if(!b)return;const a=b.dataset.lb,i=+b.dataset.i;
 if(a==='create')create(+b.dataset.n);
 else if(a==='join'){if(!needName())return;join(document.getElementById('lb-code').value)}
 else if(a==='offline'){if(unsub)unsub();code=null;ONLINE=false;$L.hidden=true;$W.hidden=false;$net.innerHTML='';const rb=document.querySelector('[data-act="restart"]');if(rb)rb.textContent='New game';S.modal={setup:true};render()}
 else if(a==='home')home();
 else if(a==='copy'){try{await navigator.clipboard.writeText(link());toast('Invite link copied.')}catch(x){prompt('Copy this link:',link())}}
 else if(a==='sit'){const name=needName();if(!name)return;seatTx(seats=>{if(seats.some(s=>s.uid===uid))return'You already have a seat.';if(seats[i].uid||seats[i].bot)return'That seat was just taken.';seats[i]={uid,name,bot:false}})}
 else if(a==='leave'||a==='kick')seatTx(seats=>{seats[i]={uid:null,name:'',bot:false}});
 else if(a==='bot')seatTx(seats=>{if(seats[i].uid)return'Someone is sitting there.';seats[i]={uid:null,name:'',bot:!seats[i].bot}});
 else if(a==='size'){const n=+b.dataset.n;seatTx(seats=>{while(seats.length<n)seats.push({uid:null,name:'',bot:false});while(seats.length>n){const last=seats[seats.length-1];if(last.uid)return'Remove the player in the last seat first.';seats.pop()}})}
 else if(a==='start')startGame();
 else if(a==='relobby'){await updateDoc(gref(),{status:'lobby',state:null,version:0,lastHumanUid:null,updatedAt:serverTimestamp()})}});
document.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.id==='lb-code'){if(needName())join(ev.target.value)}});

onAuthStateChanged(auth,u=>{if(!u)return;const first=!uid;uid=u.uid;if(!first)return;const g=new URLSearchParams(location.search).get('g');if(g)join(g);else home()});
showLobby('<p class="sub">Connecting…</p>');
signInAnonymously(auth).catch(err=>{console.error(err);showLobby(`<h1>${e(TITLE)}</h1><p class="err">Couldn't sign in (${e(err.code||err.message)}). Make sure Anonymous sign-in is enabled in Firebase Authentication.</p><button type="button" data-lb="offline">Play offline instead</button>`)});
