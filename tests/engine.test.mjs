// Plays full bot-vs-bot games in Node to catch rule-engine breakage.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadEngine() {
  const el = () => ({ innerHTML: '', textContent: '', hidden: true, style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }) });
  const els = {};
  const ctx = {
    console, Math, JSON, Date, Set, Map, Array, Object, String, Number,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    confirm: () => true, prompt: () => '', innerWidth: 1200, innerHeight: 800,
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null, setItem() {} },
    document: { title: '', getElementById: id => (els[id] ||= el()), querySelector: () => el(), addEventListener() {} },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const data = readFileSync(new URL('../public/js/data.js', import.meta.url), 'utf8');
  const engine = readFileSync(new URL('../public/js/engine.js', import.meta.url), 'utf8')
    .replace('newGame(2);S.modal={setup:true};render();', '');
  // Expose the engine's top-level let/const bindings for the test.
  vm.runInContext(data + '\n' + engine + '\n;globalThis.__get=()=>({S,UI});', ctx);
  return ctx;
}

function playOut(ctx, maxSteps = 5000) {
  const run = code => vm.runInContext(code, ctx);
  let steps = 0, canalRounds = 0;
  while (!run('S.over') && steps < maxSteps) {
    run('if(S.shortfalls&&S.shortfalls.length)settleAllShortAuto()');
    run('if(S.modal)S.modal=null');
    if (run("S.era==='canal'")) canalRounds = run('S.round');
    run('{const pi=cur();if(isHuman(pi))S.view=pi;const c=candidates(pi)[0];CM=[];c.run();flushCoach();afterAction();}');
    steps++;
  }
  return { steps, canalRounds, railRounds: run('S.round'), over: run('S.over'), vp: run('S.players.map(p=>p.vp)') };
}

test('decks match the official card distribution', () => {
  const ctx = loadEngine();
  assert.deepEqual([...vm.runInContext('[2,3,4].map(n=>buildDeck(n).length)', ctx)], [40, 54, 64]);
});

test('each player mat has the 45 tiles from the real game', () => {
  const ctx = loadEngine();
  const counts = vm.runInContext("(()=>{const m=makeMat();return Object.fromEntries(Object.keys(m).map(k=>[k,m[k].length]))})()", ctx);
  assert.deepEqual({ ...counts }, { coal: 7, iron: 4, brewery: 7, cotton: 11, goods: 11, pottery: 5 });
});

for (const [n, rounds] of [[2, 10], [3, 9], [4, 8]]) {
  test(`${n}-player game plays to the end with ${rounds} rounds per era`, () => {
    for (let g = 0; g < 5; g++) {
      const ctx = loadEngine();
      vm.runInContext(`newGame(${n},1);S.humanSeats=S.players.map(()=>false);S.humans=0;`, ctx);
      const r = playOut(ctx);
      assert.ok(r.over, 'game should finish');
      assert.equal(r.canalRounds, rounds, 'canal era rounds');
      assert.equal(r.railRounds, rounds, 'rail era rounds');
      assert.ok(r.vp.some(v => v > 0), 'someone should score');
    }
  });
}

test('online game state survives a JSON round trip every move', () => {
  const ctx = loadEngine();
  const run = code => vm.runInContext(code, ctx);
  run("NET={push(){}};startOnline([{uid:'a',name:'A',bot:false},{uid:null,name:'',bot:true},{uid:'b',name:'B',bot:false}]);");
  assert.equal(run('S.schema'), run('STATE_VERSION'));
  let steps = 0;
  while (!run('S.over') && steps < 5000) {
    run('S=JSON.parse(JSON.stringify(S));if(S.shortfalls&&S.shortfalls.length)settleAllShortAuto();if(S.modal)S.modal=null;{const pi=cur();S.view=isHuman(pi)?pi:0;const c=candidates(pi)[0];CM=[];c.run();flushCoach();afterAction();}');
    steps++;
  }
  assert.ok(run('S.over'));
  assert.ok(JSON.stringify(run('S')).length < 900000, 'saved game must stay well under the 1 MB Firestore limit');
});

test('a tile connected to two buyers can be sold to either one', () => {
  const ctx = loadEngine();
  const run = code => vm.runInContext(code, ctx);
  run(`newGame(4,1);S.era='rail';S.tiles=[];S.links=[];
    S.merchTiles.oxford=['pottery','goods'];S.merchTiles.gloucester=['any','cotton'];S.merchBeer.oxford=1;S.merchBeer.gloucester=2;
    const L=(a,b)=>LINKS.find(l=>(l.a===a&&l.b===b)||(l.a===b&&l.b===a));
    for(const [a,b] of [['coventry','bham'],['bham','oxford'],['bham','redditch'],['redditch','gloucester']]){const l=L(a,b);S.links.push({id:l.id,a:l.a,b:l.b,owner:1})}
    S.tiles.push({id:900,owner:0,ind:'pottery',def:TILES.pottery[2],town:'coventry',slot:0,cubes:0,flipped:false});
    S.tiles.push({id:901,owner:0,ind:'brewery',def:TILES.brewery[1],town:'uttoxeter',slot:0,cubes:2,flipped:false});`);
  const ms = run("evalSellAll(0,S.tiles.find(t=>t.id===900)).map(e=>e.m).sort().join(',')");
  assert.equal(ms, 'gloucester,oxford');
});

test('negative income: a person chooses tiles to remove, play waits, VP never goes below 0', () => {
  const ctx = loadEngine();
  const run = code => vm.runInContext(code, ctx);
  run(`newGame(2,1);S.tiles=[];S.links=[];S.order=[0,1];S.turnIdx=1;S.deck=[];
    S.players[0].pos=3;S.players[0].money=0;S.players[0].vp=2;
    S.tiles.push({id:800,owner:0,ind:'cotton',def:TILES.cotton[1],town:'leek',slot:0,cubes:0,flipped:false});
    S.tiles.push({id:801,owner:0,ind:'coal',def:TILES.coal[0],town:'tamworth',slot:0,cubes:1,flipped:false});
    S.players[1].pos=3;S.players[1].money=0;S.players[1].vp=1;S.players[1].hand=[{t:'ind',k:'coal'}];S.players[0].hand=[{t:'ind',k:'coal'}];
    endRound();`);
  // income level at space 3 is -7: the person (seat 0) is asked, the bot (no tiles) loses only the VP it has
  assert.equal(run('S.shortfalls.length'), 1);
  assert.equal(run('S.shortfalls[0].pi'), 0);
  assert.equal(run('S.shortfalls[0].need'), 7);
  assert.equal(run('S.players[1].vp'), 0, 'VP stops at 0');
  run('S.view=0;H.shortTile({dataset:{id:"800"}})'); // cotton mill L2 costs 14: +7 covers it exactly
  assert.equal(run('S.shortfalls'), null, 'round continues once covered');
  assert.equal(run('S.players[0].money'), 0);
  assert.equal(run('S.players[0].vp'), 2, 'no VP lost when tiles cover it');
  assert.equal(run('S.tiles.some(t=>t.id===800)'), false);
  assert.equal(run('S.tiles.some(t=>t.id===801)'), true, 'stops removing once covered');
});

test('bots cover a shortfall by removing tiles before losing VP', () => {
  const ctx = loadEngine();
  const run = code => vm.runInContext(code, ctx);
  run(`newGame(2,1);S.tiles=[];S.players[1].money=0;S.players[1].vp=5;
    S.tiles.push({id:810,owner:1,ind:'goods',def:TILES.goods[1],town:'bham',slot:1,cubes:0,flipped:false});
    settleShortAuto(1,8);`);
  assert.equal(run('S.tiles.length'), 0);
  assert.equal(run('S.players[1].money'), 0);
  assert.equal(run('S.players[1].vp'), 2, 'manufacturer L2 gives £5, the other £3 costs 3 VP');
});

test('players choose the ironworks, and between equally close coal mines', () => {
  const ctx = loadEngine();
  const run = code => vm.runInContext(code, ctx);
  run(`newGame(3,1);S.tiles=[];S.links=[];S.view=0;
    S.tiles.push({id:820,owner:1,ind:'iron',def:TILES.iron[1],town:'coalbrook',slot:0,cubes:2,flipped:false});
    S.tiles.push({id:821,owner:2,ind:'iron',def:TILES.iron[1],town:'derby',slot:2,cubes:1,flipped:false});
    S.tiles.push({id:822,owner:1,ind:'coal',def:TILES.coal[1],town:'cannock',slot:0,cubes:2,flipped:false});
    S.tiles.push({id:823,owner:2,ind:'coal',def:TILES.coal[1],town:'tamworth',slot:0,cubes:2,flipped:false});
    S.tiles.push({id:824,owner:2,ind:'coal',def:TILES.coal[1],town:'dudley',slot:0,cubes:2,flipped:false});
    const L=(a,b)=>LINKS.find(l=>(l.a===a&&l.b===b)||(l.a===b&&l.b===a));
    for(const [a,b] of [['walsall','cannock'],['walsall','tamworth'],['walsall','wolves'],['wolves','dudley']]){const l=L(a,b);S.links.push({id:l.id,a:l.a,b:l.b,owner:1})}`);
  assert.equal(run("srcOpts({kind:'iron'},[]).map(o=>o.id).join()"), '820,821');
  assert.equal(run("srcOpts({kind:'iron'},[821]).map(o=>o.id).join()"), '820', 'an emptied ironworks drops out');
  assert.equal(run("srcOpts({kind:'coal',starts:['walsall']},[]).map(o=>o.id).sort().join()"), '822,823', 'only the closest mines, not Dudley');
  assert.equal(run("planPicks('coal',[823,823,822],3).takes.map(x=>x.t.id+':'+x.n).join()"), '823:2,822:1');
});

test('a 2-beer sale lets the player pick each barrel, including the merchant barrel', () => {
  const ctx = loadEngine();
  const run = code => vm.runInContext(code, ctx);
  run(`newGame(3,1);S.tiles=[];S.links=[];S.view=0;S.merchBeer.oxford=1;
    S.tiles.push({id:830,owner:0,ind:'brewery',def:TILES.brewery[1],town:'uttoxeter',slot:0,cubes:1,flipped:false});
    S.tiles.push({id:831,owner:0,ind:'brewery',def:TILES.brewery[1],town:'stone',slot:0,cubes:2,flipped:false});`);
  assert.equal(run("srcOpts({kind:'beer',starts:['coventry'],m:'oxford'},[]).map(o=>o.id).join()"), 'm,830,831');
  assert.equal(run("srcOpts({kind:'beer',starts:['coventry'],m:'oxford'},['m']).map(o=>o.id).join()"), '830,831', 'merchant barrel only once');
});
