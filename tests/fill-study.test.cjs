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
  const context = vm.createContext({
    document: { querySelector: selector => selector === '#app' ? app : data, createElement: tag => new Node(tag), body: { dataset: {} }, addEventListener() {} },
    location, history, URL, AbortController, setTimeout, clearTimeout,
    window: { addEventListener: (name, callback) => { events[name] = callback; }, scrollTo() {} },
    fetch: async url => {
      assert.equal(new URL(url).pathname, '/EnergyStudyApp/data/terms.json');
      if (fetchMode === 'fail') throw new Error('offline');
      return { ok: true, json: async () => [] };
    }
  });
  for (const key of ['localStorage', 'indexedDB', 'caches']) Object.defineProperty(context, key, { get() { throw new Error(`Unexpected storage access: ${key}`); } });
  const run = script => vm.runInContext(script, context);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
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
  app.querySelector('form').events.submit({ preventDefault() {} });
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
  const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(JSON.parse(source.match(/<script id="fill-study-data"[^>]*>([\s\S]*?)<\/script>/)[1]).length, 0);
  console.log('PASS: empty data, exact/space/alias/typo grading, independent blanks, original/source, fixed/registered-variable modes, next reset, history, 30 existing routes, written screen, fetch failure/retry, stale response, no storage access');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
