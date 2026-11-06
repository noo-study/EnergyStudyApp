// 실행: node tests/fill-study.test.cjs
// 아래 문자열은 프로그램 검증용이며 법령·학습자료가 아닙니다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

class Node {
  constructor(tag = '') { this.tag = tag; this.children = []; this.events = {}; this.value = ''; this.isConnected = true; }
  set innerHTML(value) {
    this.html = value;
    this.children = [new Node('h1'), Object.assign(new Node('ul'), { id: 'home-categories' })];
  }
  get innerHTML() { return this.html; }
  append(...nodes) { nodes.forEach(node => { node.parent = this; }); this.children.push(...nodes); }
  detach() { this.isConnected = false; this.children.forEach(node => node.detach()); }
  replaceChildren(...nodes) { this.children.forEach(node => node.detach()); this.children = []; this.append(...nodes); }
  remove() { this.detach(); if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  setAttribute(key, value) { this[key] = value; }
  getAttribute(key) { return this[key] || null; }
  addEventListener(name, callback) { this.events[name] = callback; }
  focus() {}
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const matches = [];
    for (const node of this.children) {
      if (selector === node.tag || selector === `#${node.id}` ||
          (selector.startsWith('.') && node.className?.split(' ').includes(selector.slice(1)))) matches.push(node);
      matches.push(...node.querySelectorAll(selector));
    }
    return matches;
  }
}

async function main() {
  const app = new Node('main'); app.innerHTML = 'home';
  const data = new Node('script'); data.textContent = '[]';
  const events = {};
  const location = { protocol: 'https:', hash: '', href: 'https://example.test/EnergyStudyApp/index.html' };
  const entries = [{ state: null, hash: '' }]; let cursor = 0;
  const apply = hash => { location.hash = hash; location.href = `https://example.test/EnergyStudyApp/index.html${hash}`; };
  const history = {
    get state() { return entries[cursor].state; },
    replaceState(state, _, url) { const hash = url.includes('#') ? url.slice(url.indexOf('#')) : ''; entries[cursor] = { state, hash }; apply(hash); },
    pushState(state, _, hash) { entries.splice(++cursor); entries.push({ state, hash }); apply(hash); },
    back() { apply(entries[--cursor].hash); events.popstate(); },
    forward() { apply(entries[++cursor].hash); events.popstate(); }
  };
  let fetchMode = 'fail';
  const storageKey = 'bea.fillStudy.statuses.v1';
  const stored = new Map([['existing-user-data', '{"keep":true}']]);
  const writes = [];
  let readFailure = false;
  let writeFailure = false;
  const storage = {
    getItem(key) { if (readFailure) throw new Error('Read denied'); return stored.has(key) ? stored.get(key) : null; },
    setItem(key, value) { if (writeFailure) throw new Error('Quota exceeded'); writes.push({ key, value }); stored.set(key, value); }
  };
  const context = vm.createContext({
    document: { querySelector: selector => selector === '#app' ? app : data, createElement: tag => new Node(tag), body: { dataset: {} }, addEventListener() {} },
    location, history, URL, AbortController, setTimeout, clearTimeout, localStorage: storage,
    window: { addEventListener: (name, callback) => { events[name] = callback; }, scrollTo() {} },
    fetch: async url => {
      assert.equal(new URL(url).pathname, '/EnergyStudyApp/data/terms.json');
      if (fetchMode === 'fail') throw new Error('offline');
      return { ok: true, json: async () => [] };
    }
  });
  for (const key of ['indexedDB', 'caches']) Object.defineProperty(context, key, { get() { throw new Error(`Unexpected storage access: ${key}`); } });
  const run = script => vm.runInContext(script, context);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  assert.equal(app.querySelectorAll('.card-label')[5].textContent, '법령 암기');
  run("navigate('#/category/06')");
  assert.equal(context.document.body.dataset.screen, 'sage');
  assert.equal(app.querySelector('h1').textContent, '법령 암기');
  assert.deepEqual(app.querySelectorAll('.card-label').map(node => node.textContent), ['용어의 정의', '법령 빈칸 채우기']);
  assert.deepEqual(app.querySelectorAll('a').map(node => node.href), ['#/category/06/terms', '#/category/06/law']);
  run("navigate('#/category/06/law')");
  assert.equal(app.querySelector('h1').textContent, '법령 빈칸 채우기');
  assert.equal(app.querySelector('.material-notice').textContent, '학습자료 준비 중');
  assert.equal(app.querySelector('form'), null);
  app.querySelector('.back-button').events.click(); assert.equal(location.hash, '#/category/06');
  history.forward(); assert.equal(location.hash, '#/category/06/law'); history.back();
  run("navigate('#/category/06/terms')");
  assert.equal(context.document.body.dataset.screen, 'sage');
  assert.equal(app.querySelector('h1').textContent, '용어의 정의');
  assert.deepEqual(app.querySelectorAll('a').map(node => node.href), ['#/category/06/terms/fill', '#/category/06/terms/written']);
  run("navigate('#/category/06/terms/fill')"); await flush();
  assert.equal(app.querySelector('.material-notice').textContent, '등록된 학습자료가 없습니다');
  app.querySelector('.back-button').events.click(); assert.equal(location.hash, '#/category/06/terms');
  run("navigate('#/category/06/terms/written')");
  assert.equal(app.querySelector('.material-notice').textContent, '학습자료 준비 중');
  app.querySelector('.back-button').events.click();
  app.querySelector('.back-button').events.click(); assert.equal(location.hash, '#/category/06');
  app.querySelector('.back-button').events.click(); assert.equal(location.hash, '');
  run("navigate('#/category/06/fill')"); await flush();
  assert.equal(app.querySelector('.material-notice').textContent, '등록된 학습자료가 없습니다');
  assert.equal(app.querySelector('form'), null);

  const fixture = {
    id: 'test-only-1', term: '프로그램 검증용 문자열',
    definitionParts: ['TEST ', { id: 'a', text: 'AL PHA', core: true, acceptedAnswers: ['검증별칭'] },
      ' / ', { id: 'b', text: 'BETA', core: true, acceptedAnswers: [] },
      ' / ', { id: 'c', text: 'GAMMA', core: false, acceptedAnswers: [] }],
    blankSets: [['a'], ['b', 'c']], source: { law: '테스트용 출처', article: '테스트용 항목' }
  };
  data.textContent = JSON.stringify([fixture, { ...fixture, id: 'test-only-2' }]);
  // 새 경로도 기존 빈칸 학습 화면을 그대로 사용합니다.
  history.replaceState({ bea: true, depth: 0 }, '', '#/category/06/terms/fill');
  run('render()'); await flush(); assert.equal(app.querySelectorAll('input').length, 2);
  app.querySelector('.back-button').events.click(); assert.equal(location.hash, '#/category/06/terms');
  // 나머지 기존 테스트는 구 주소 호환성과 저장 데이터 보존도 함께 검사합니다.
  history.replaceState({ bea: true, depth: 0 }, '', 'https://example.test/EnergyStudyApp/index.html');
  run('render()');
  run("navigate('#/category/06/fill')");
  run('render()'); await flush();
  assert.equal(app.querySelectorAll('input').length, 2);
  // 함수 검증은 앱과 동일한 실행 컨텍스트를 사용합니다.
  context.fixture = fixture;
  assert.equal(run("gradeFillAnswer(fixture.definitionParts[1], ' A L P H A ')"), true);
  assert.equal(run("gradeFillAnswer(fixture.definitionParts[1], '검증 별칭')"), true);
  for (const answer of ['ALPHX', 'alpha', '', '등록되지않은동의어']) {
    context.answer = answer; assert.equal(run('gradeFillAnswer(fixture.definitionParts[1], answer)'), false);
  }
  assert.equal(run("normalizeFillAnswer('가') === normalizeFillAnswer('가')"), true);
  assert.equal(JSON.stringify(run("fillBlankIds(fixture, 'fixed')")), '["a","b"]');
  assert.equal(JSON.stringify(run("fillBlankIds(fixture, 'varied', () => 0.99)")), '["b","c"]');
  assert.throws(() => run('validateFillTerms([{...fixture, blankSets: [["unknown"]]}])'));
  assert.throws(() => run('validateFillTerms([{...fixture, source: {}}])'));
  const inputs = app.querySelectorAll('input'); inputs[0].value = 'ALPHA'; inputs[1].value = 'TYPO';
  assert.equal(writes.length, 0); // 학습·입력만으로는 저장하지 않습니다.
  const reviewButton = app.querySelector('.fill-review');
  assert.equal(reviewButton.textContent, '다시 볼 문제');
  reviewButton.events.click();
  assert.equal(reviewButton.textContent, '복습 등록됨');
  assert.equal(reviewButton.disabled, true);
  assert.equal(reviewButton['aria-pressed'], 'true');
  assert.equal(inputs[0].value, 'ALPHA');
  assert.deepEqual(JSON.parse(stored.get(storageKey)), [{ id: fixture.id, status: 'review' }]);
  reviewButton.events.click(); run(`registerReview('${fixture.id}')`);
  assert.equal(writes.length, 1); // 중복 요청에서도 추가 저장하지 않습니다.
  app.querySelector('form').events.submit({ preventDefault() {} });
  assert.equal(writes.length, 1); // 오답은 자동 등록하지 않습니다.
  assert.equal(app.querySelector('.fill-summary').textContent, '2개 중 1개 정답');
  assert.equal(inputs[0]['aria-invalid'], 'false'); assert.equal(inputs[1]['aria-invalid'], 'true');
  assert(inputs.every(input => input.readOnly));
  assert.equal(app.querySelector('.fill-original').querySelector('p').textContent, 'TEST AL PHA / BETA / GAMMA');
  assert.equal(app.querySelector('.fill-source').textContent, '테스트용 출처 · 테스트용 항목');
  app.querySelector('.fill-next').events.click();
  assert.equal(app.querySelector('.fill-progress').textContent, '2 / 2');
  assert(app.querySelectorAll('input').every(input => input.value === ''));
  assert.equal(app.querySelector('.fill-original'), null); assert.equal(app.querySelector('.fill-summary').textContent, undefined);
  const select = app.querySelector('select'); select.value = 'varied'; select.events.change();
  assert(app.querySelectorAll('input').length > 0);
  assert.equal(app.querySelector('.fill-review').textContent, '다시 볼 문제');
  app.querySelector('form').events.submit({ preventDefault() {} });
  assert.equal(writes.length, 1);
  app.querySelector('.fill-review').events.click(); // 채점 후에도 수동 등록 가능
  assert.equal(JSON.parse(stored.get(storageKey)).length, 2);
  run('render()'); await flush();
  assert.equal(app.querySelector('.fill-review').textContent, '복습 등록됨');
  assert.equal(stored.get('existing-user-data'), '{"keep":true}');
  app.querySelector('.back-button').events.click(); assert.equal(location.hash, '');
  history.forward(); await flush(); assert(app.querySelector('form'));
  run("navigate('#/category/06/written')"); assert.equal(app.querySelector('.material-notice').textContent, '학습자료 준비 중');
  for (const category of run('categories').slice(0, 5)) {
    category.topics.forEach((_, index) => {
      for (const mode of ['theory', 'past']) {
        run(`navigate('#/category/${category.id}/${String(index + 1).padStart(2, '0')}/${mode}')`);
        assert.equal(app.querySelector('.material-notice').textContent, '학습자료 준비 중');
      }
    });
  }
  data['data-src'] = './data/terms.json';
  run("navigate('#/category/06/fill')"); await flush();
  assert(app.querySelector('.material-notice').textContent.includes('불러오지 못했습니다'));
  fetchMode = 'empty'; app.querySelector('.fill-button').events.click(); await flush();
  assert.equal(app.querySelector('.material-notice').textContent, '등록된 학습자료가 없습니다');
  delete data['data-src']; data.textContent = '[]';
  run('render()'); run("navigate('#/category/06/written')"); await flush();
  assert.equal(app.querySelector('.material-notice').textContent, '학습자료 준비 중');
  // 저장소 오류 및 기존 상태 보존: 모든 실패는 학습 화면을 유지해야 합니다.
  data.textContent = JSON.stringify([fixture]);
  const validSaved = stored.get(storageKey);
  for (const bad of ['not-json', '{}', '[{"id":"old","status":"unknown"}]']) {
    stored.set(storageKey, bad);
    run("navigate('#/category/06/fill')"); await flush();
    assert(app.querySelector('form'));
    app.querySelector('.fill-review').events.click();
    assert(app.querySelector('.fill-review-notice').textContent.includes('저장하지 못했습니다'));
    assert.equal(stored.get(storageKey), bad);
  }
  stored.set(storageKey, validSaved); readFailure = true;
  run('render()'); await flush();
  assert(app.querySelector('.fill-review-notice').textContent.includes('읽을 수 없습니다'));
  app.querySelector('.fill-review').events.click();
  assert(app.querySelector('input')); assert.equal(stored.get(storageKey), validSaved);
  readFailure = false;
  Object.defineProperty(context, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  run('render()'); await flush();
  assert(app.querySelector('.fill-review-notice').textContent.includes('읽을 수 없습니다'));
  app.querySelector('.fill-review').events.click(); assert(app.querySelector('form'));
  Object.defineProperty(context, 'localStorage', { configurable: true, writable: true, value: storage });
  const prior = JSON.stringify([{ id: 'unrelated-term', status: 'completed' }]);
  stored.set(storageKey, prior); writeFailure = true;
  run('render()'); await flush(); app.querySelector('.fill-review').events.click();
  assert.equal(stored.get(storageKey), prior);
  assert.equal(app.querySelector('.fill-review').textContent, '다시 볼 문제');
  assert(app.querySelector('.fill-review-notice').textContent.includes('저장하지 못했습니다'));
  app.querySelector('form').events.submit({ preventDefault() {} });
  assert(app.querySelector('.fill-summary').textContent.includes('정답'));
  writeFailure = false; app.querySelector('.fill-review').events.click();
  assert.deepEqual(JSON.parse(stored.get(storageKey)), [{ id: 'unrelated-term', status: 'completed' }, { id: fixture.id, status: 'review' }]);
  const completed = JSON.stringify([{ id: fixture.id, status: 'completed' }]);
  stored.set(storageKey, completed); run('render()'); await flush();
  assert.equal(app.querySelector('.fill-review').textContent, '복습 등록됨');
  assert.equal(run(`registerReview('${fixture.id}')`), 'completed');
  assert.equal(stored.get(storageKey), completed);
  // 새 JavaScript 실행 컨텍스트에서도 동일한 저장소로 등록 상태가 복원됩니다.
  const restarted = vm.createContext({ document: context.document, window: context.window, location, history,
    URL, AbortController, setTimeout, clearTimeout, localStorage: storage, fetch: context.fetch });
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), restarted); await flush();
  assert.equal(app.querySelector('.fill-review').textContent, '복습 등록됨');
  assert.equal(stored.get('existing-user-data'), '{"keep":true}');
  assert(writes.every(write => write.key === storageKey));
  assert(writes.every(write => JSON.parse(write.value).every(record =>
    Object.keys(record).sort().join(',') === 'id,status')));
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(JSON.parse(source.match(/<script id="fill-study-data"[^>]*>([\s\S]*?)<\/script>/)[1]).length, 0);
  console.log('PASS: blank study/grading/history regression; manual-only registration before/after grading; deduplication; restart persistence; read/write/invalid-data errors; completed and unrelated data preserved; ID/status only; no IndexedDB/cache access');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
