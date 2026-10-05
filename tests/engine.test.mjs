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
    run('S=JSON.parse(JSON.stringify(S));if(S.modal)S.modal=null;{const pi=cur();S.view=isHuman(pi)?pi:0;const c=candidates(pi)[0];CM=[];c.run();flushCoach();afterAction();}');
    steps++;
  }
  assert.ok(run('S.over'));
  assert.ok(JSON.stringify(run('S')).length < 900000, 'saved game must stay well under the 1 MB Firestore limit');
});
