// 실행: node tests/fill-study.test.cjs
// 아래 문자열은 프로그램 검증용이며 법령·학습자료가 아닙니다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

class Node {
  constructor(tag = '') { this.tag = tag; this.children = []; this.events = {}; this.value = ''; this.isConnected = true; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text ?? '') + this.children.map(node => node.textContent).join(''); }
  set innerHTML(value) {
    this.html = value;
    this.children = [new Node('h1'), Object.assign(new Node('ul'), { id: 'home-categories' })];
  }
  get innerHTML() { return this.html; }
  append(...nodes) { nodes.forEach(node => { node.parent = this; }); this.children.push(...nodes); }
  detach() { this.isConnected = false; this.children.forEach(node => node.detach()); }
  replaceChildren(...nodes) { this.children.forEach(node => node.detach()); this.text = ''; this.children = []; this.append(...nodes); }
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
  const homeLink = new Node('a');
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
    document: { querySelector: selector => selector === '#app' ? app : selector === '.brand-home' ? homeLink : data, createElement: tag => new Node(tag), body: { dataset: {} }, addEventListener() {} },
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
  run("navigate('#/category/06/terms/written')"); await flush();
  assert.equal(app.querySelector('.material-notice').textContent, '등록된 학습자료가 없습니다');
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
  assert.equal(app.querySelector('.fill-mode-title').textContent, '빈칸 모드');
  assert.equal(app.querySelector('.fill-term'), null);
  assert.equal(app.querySelector('.fill-progress').textContent, '1 / 2');
  assert.equal(app.querySelector('form').children[1], app.querySelector('.fill-definition'));
  assert.equal(app.querySelector('.fill-summary').hidden, true);
  // 함수 검증은 앱과 동일한 실행 컨텍스트를 사용합니다.
  context.fixture = fixture;
  assert.equal(run("gradeFillAnswer(fixture.definitionParts[1], ' A L P H A ')"), true);
  assert.equal(run("gradeFillAnswer(fixture.definitionParts[1], '검증 별칭')"), true);
  for (const answer of ['ALPHX', 'alpha', '', '등록되지않은동의어']) {
    context.answer = answer; assert.equal(run('gradeFillAnswer(fixture.definitionParts[1], answer)'), false);
  }
  assert.equal(run("normalizeFillAnswer('가') === normalizeFillAnswer('가')"), true);
  for (const [length, width] of [[1, 'short'], [4, 'short'], [5, 'medium'], [10, 'medium'], [11, 'long'], [20, 'long'], [21, 'wide']]) {
    context.widthAnswer = '가'.repeat(length);
    assert.equal(run('fillWidthClass(widthAnswer)'), width);
  }
  assert.equal(JSON.stringify(run("fillBlankIds(fixture, 'fixed')")), '["a","b"]');
  assert.equal(JSON.stringify(run("fillBlankIds(fixture, 'varied', () => 0.99)")), '["b","c"]');
  assert.throws(() => run('validateFillTerms([{...fixture, blankSets: [["unknown"]]}])'));
  assert.throws(() => run('validateFillTerms([{...fixture, source: {}}])'));
  const inputs = app.querySelectorAll('input'); inputs[0].value = 'ALPHA'; inputs[1].value = 'TYPO';
  assert.equal(inputs[0]['aria-label'], '빈칸 1');
  assert.equal(app.querySelectorAll('.fill-field')[0].className, 'fill-field fill-field--medium');
  assert.equal(app.querySelectorAll('.fill-field')[1].className, 'fill-field fill-field--short');
  assert.equal(writes.length, 0); // 학습·입력만으로는 저장하지 않습니다.
  const reviewButton = app.querySelector('.fill-review');
  const actionRow = app.querySelector('.fill-actions');
  const questionCard = app.querySelector('form');
  assert.deepEqual(actionRow.children.map(node => node.textContent), ['채점하기', '다시 볼 문제']);
  assert.equal(actionRow.children[0].type, 'submit');
  assert.equal(actionRow.children[1], reviewButton);
  const actionIndex = questionCard.children.indexOf(actionRow);
  assert(questionCard.children.indexOf(app.querySelector('.fill-definition')) < actionIndex);
  assert.equal(questionCard.children[actionIndex + 1], app.querySelector('.fill-summary'));
  assert.equal(reviewButton.textContent, '다시 볼 문제');
  reviewButton.events.click();
  assert.equal(reviewButton.textContent, '복습 등록됨');
  assert.equal(reviewButton.disabled, true);
  assert.equal(reviewButton['aria-pressed'], 'true');
  assert.equal(app.querySelector('.fill-actions'), actionRow);
  assert.equal(actionRow.children[1], reviewButton);
  assert.equal(inputs[0].value, 'ALPHA');
  assert.deepEqual(JSON.parse(stored.get(storageKey)), [{ id: fixture.id, status: 'review' }]);
  reviewButton.events.click(); run(`registerReview('${fixture.id}')`);
  assert.equal(writes.length, 1); // 중복 요청에서도 추가 저장하지 않습니다.
  app.querySelector('form').events.submit({ preventDefault() {} });
  assert.equal(writes.length, 1); // 오답은 자동 등록하지 않습니다.
  assert.equal(app.querySelector('.fill-summary').textContent, '2개 중 1개 정답');
  assert.equal(app.querySelector('.fill-summary').hidden, false);
  assert(app.querySelector('.fill-summary').className.includes('fill-summary--incorrect'));
  assert.equal(app.querySelector('.fill-actions'), actionRow);
  assert.equal(actionRow.children[1], reviewButton);
  assert.equal(questionCard.children[actionIndex + 1], app.querySelector('.fill-summary'));
  const completedAnswers = app.querySelectorAll('.fill-completed-answer');
  assert(completedAnswers[0].className.includes('fill-completed-answer--correct'));
  assert(completedAnswers[1].className.includes('fill-completed-answer--incorrect'));
  assert.deepEqual(completedAnswers.map(node => node.textContent), ['AL PHA', 'BETA']);
  assert(app.querySelectorAll('.fill-completed-blank').every(node => node.className.includes('fill-field--')));
  assert.equal(app.querySelectorAll('.fill-completed-blank')[0].className, 'fill-field fill-field--medium fill-completed-blank');
  assert.equal(app.querySelector('input'), null);
  for (const selector of ['.fill-result', '.fill-verdict', '.fill-original', '.fill-original-toggle', '.fill-reveal']) assert.equal(app.querySelector(selector), null);
  assert.equal(app.querySelector('.fill-definition').textContent, 'TEST AL PHA / BETA / GAMMA');
  assert(inputs.every(input => input.readOnly));
  assert.equal(app.querySelector('.fill-source').textContent, '테스트용 출처 · 테스트용 항목');
  app.querySelector('.fill-next').events.click();
  assert.equal(app.querySelector('.fill-progress').textContent, '2 / 2');
  assert(app.querySelectorAll('input').every(input => input.value === ''));
  assert.equal(app.querySelector('.fill-original'), null); assert.equal(app.querySelector('.fill-summary').textContent, '');
  const select = app.querySelector('select'); select.value = 'varied'; select.events.change();
  assert(app.querySelectorAll('input').length > 0);
  assert.equal(app.querySelector('.fill-review').textContent, '다시 볼 문제');
  app.querySelector('form').events.submit({ preventDefault() {} });
  assert.equal(writes.length, 1);
  assert(app.querySelector('.fill-summary').textContent.includes('0개 정답'));
  assert(app.querySelector('.fill-summary').className.includes('fill-summary--incorrect'));
  app.querySelector('.fill-review').events.click(); // 채점 후에도 수동 등록 가능
  assert.equal(JSON.parse(stored.get(storageKey)).length, 2);
  run('render()'); await flush();
  assert.equal(app.querySelector('.fill-review').textContent, '복습 등록됨');
  assert.equal(stored.get('existing-user-data'), '{"keep":true}');
  app.querySelector('.back-button').events.click(); assert.equal(location.hash, '');
  history.forward(); await flush(); assert(app.querySelector('form'));
  run("navigate('#/category/06/written')"); await flush();
  app.querySelector('.fill-question').querySelector('button').events.click();
  assert.equal(app.querySelector('.written-answer').querySelector('p').textContent, 'TEST AL PHA / BETA / GAMMA');
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
  assert.equal(app.querySelector('.material-notice').textContent, '등록된 학습자료가 없습니다');
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
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  assert.match(css, /\.fill-select, \.fill-input\s*\{[^}]*font-size:\s*16px/);
  assert.match(css, /\.fill-definition--exercise\s*\{[^}]*font-size:\s*16px[^}]*line-height:\s*40px/);
  assert.match(css, /\.fill-input-label\s*\{[^}]*height:\s*32px[^}]*margin:\s*0[^}]*padding:\s*0/);
  assert.match(css, /\.fill-field\s*\{[^}]*display:\s*inline-block[^}]*vertical-align:\s*middle[^}]*line-height:\s*0/);
  assert.match(css, /\.fill-field\s*\{[^}]*max-width:\s*calc\(100% - 4px\)/);
  assert.match(css, /\.fill-input\s*\{[^}]*height:\s*32px[^}]*padding:\s*4px 6px[^}]*line-height:\s*22px/);
  assert.match(css, /\.fill-input\s*\{[^}]*text-align:\s*center/);
  assert.match(css, /\.fill-completed-answer\s*\{[^}]*text-align:\s*center/);
  assert.match(css, /\.fill-actions\s*\{[^}]*display:\s*flex[^}]*justify-content:\s*space-between[^}]*flex-wrap:\s*wrap[^}]*gap:\s*10px 12px/);
  assert.match(css, /\.fill-actions > \.fill-button\s*\{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.fill-actions \.fill-review\s*\{[^}]*margin-left:\s*auto/);
  assert.match(css, /\.fill-completed-answer\s*\{[^}]*display:\s*block[^}]*min-height:\s*32px[^}]*padding:\s*4px 6px[^}]*border:\s*1px solid[^}]*border-radius:\s*8px[^}]*background:\s*var\(--mono-white\)[^}]*font-size:\s*16px[^}]*line-height:\s*22px[^}]*font-weight:\s*700[^}]*white-space:\s*pre-wrap[^}]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.fill-completed-blank\s*\{[^}]*width:\s*max-content[^}]*min-width:\s*min\(var\(--fill-width\), calc\(100% - 4px\)\)/);
  assert.match(css, /\.fill-completed-answer--correct\s*\{[^}]*color:\s*var\(--answer-correct\)/);
  assert.match(css, /\.fill-completed-answer--incorrect\s*\{[^}]*color:\s*var\(--answer-incorrect\)/);
  assert.match(css, /\.fill-completed-answer--correct\s*\{[^}]*border-color:\s*var\(--answer-correct\)/);
  assert.match(css, /\.fill-completed-answer--incorrect\s*\{[^}]*border-color:\s*var\(--answer-incorrect\)/);
  assert.match(css, /\.fill-input:focus\s*\{[^}]*outline:\s*2px solid[^}]*outline-offset:\s*-3px/);
  assert.match(css, /\.fill-summary\s*\{[^}]*font-weight:\s*700/);
  assert.match(css, /\.fill-summary--correct\s*\{[^}]*color:\s*var\(--sage-green-text\)/);
  assert.match(css, /\.fill-summary--incorrect\s*\{[^}]*color:\s*var\(--answer-incorrect\)/);
  assert.match(css, /\.fill-term-emphasis\s*\{[^}]*font-weight:\s*700/);
  assert.match(css, /\.fill-mode-title\s*\{[^}]*font-weight:\s*700/);
  assert.match(css, /\.fill-progress \+ \.fill-definition--exercise\s*\{[^}]*margin-top:\s*0/);
  const highlighted = new Node('p');
  const highlightSource = '<em>"외단열"</em>이라 함은 외단열을 말한다.';
  context.highlighted = highlighted; context.highlightSource = highlightSource;
  run("appendTermText(highlighted, highlightSource, '외단열')");
  assert.equal(highlighted.children.map(child => child.textContent).join(''), highlightSource);
  assert.deepEqual(highlighted.querySelectorAll('strong').map(node => node.textContent), ['"외단열"', '외단열']);
  assert.equal(highlighted.querySelector('em'), null); // HTML처럼 보이는 문자열도 텍스트입니다.
  const repeated = {
    term: '외단열',
    definitionParts: ['"', { id: 'term', text: '외단열' }, '"의 ', { id: 'one', text: '열교' },
      '와 ', { id: 'two', text: '열교' }, ' <img src=x onerror=alert(1)>']
  };
  context.repeated = repeated;
  const repeatedOriginal = run('originalDefinitionNode(repeated)');
  assert.equal(repeatedOriginal.textContent, '"외단열"의 열교와 열교 <img src=x onerror=alert(1)>');
  assert.deepEqual(repeatedOriginal.querySelectorAll('strong').map(node => node.textContent), ['"외단열"']);
  assert.equal(repeatedOriginal.querySelector('img'), null);
  const writtenOriginal = run('originalDefinitionNode(repeated)');
  assert.equal(writtenOriginal.textContent, repeatedOriginal.textContent);
  assert.deepEqual(writtenOriginal.querySelectorAll('strong').map(node => node.textContent), ['"외단열"']);
  const legalTerms = JSON.parse(source.match(/<script id="fill-study-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.equal(legalTerms.length, 3);
  assert.deepEqual(legalTerms.map(term => term.id), [
    'energy-saving-design-art5-10-cha', 'energy-saving-design-art5-10-ka', 'energy-saving-design-art5-10-ta'
  ]);
  context.legalTerms = legalTerms;
  const prepared = run('validateFillTerms(legalTerms)');
  for (const term of prepared) {
    assert.equal(term.definitionParts.map(part => typeof part === 'string' ? part : part.text).join(''), term.definition);
    assert.equal(term.source.noticeNumber, '국토교통부고시 제2025-738호');
    assert.equal(term.source.effectiveDate, '2025-12-31');
    assert(term.blanks.every(blank => blank.acceptedAnswers.length === 0));
    for (let i = 0; i < term.blankSets.length; i++) {
      context.actualTerm = term;
      context.choice = (i + 0.5) / term.blankSets.length;
      assert.equal(JSON.stringify(run("fillBlankIds(actualTerm, 'varied', () => choice)")), JSON.stringify(term.blankSets[i]));
      const original = run('originalDefinitionNode(actualTerm)');
      assert.equal(original.textContent, term.definition);
    }
  }
  assert.throws(() => run('validateFillTerms([{...legalTerms[0], blanks: [{...legalTerms[0].blanks[0], end: 999}]}])'));
  data.textContent = JSON.stringify(legalTerms);
  for (const wrong of [false, true]) {
    run("navigate('#/category/06/terms/fill')"); await flush();
    for (const term of prepared) {
      assert.equal(app.querySelector('.fill-term'), null);
      assert.equal(app.querySelector('.fill-progress').textContent, `${prepared.indexOf(term) + 1} / 3`);
      assert.equal(app.querySelector('strong').textContent, `"${term.term}"`);
      const candidates = term.definitionParts.filter(part => typeof part !== 'string' && part.core);
      const fields = app.querySelectorAll('input'); assert.equal(fields.length, candidates.length);
      fields.forEach((input, index) => { input.value = wrong && index === 0 ? '오답' : candidates[index].text.split('').join(' '); });
      app.querySelector('form').events.submit({ preventDefault() {} });
      assert(app.querySelectorAll('.fill-completed-answer')[0].className.includes(wrong ? 'fill-completed-answer--incorrect' : 'fill-completed-answer--correct'));
      assert(app.querySelector('.fill-summary').className.includes(wrong ? 'fill-summary--incorrect' : 'fill-summary--correct'));
      assert.equal(app.querySelector('.fill-summary').hidden, false);
      assert.equal(app.querySelector('.fill-definition').textContent, term.definition);
      assert.deepEqual(app.querySelectorAll('.fill-completed-answer').map(node => node.textContent), Array.from(candidates, candidate => candidate.text));
      assert.equal(app.querySelector('input'), null);
      assert.equal(app.querySelector('.fill-original'), null);
      assert(app.querySelector('.fill-source').textContent.includes(term.source.noticeNumber));
      app.querySelector('.fill-review').events.click();
      app.querySelector('.fill-review').events.click();
      const records = JSON.parse(stored.get(storageKey));
      assert.equal(records.filter(record => record.id === term.id).length, 1);
      assert(records.some(record => record.id === fixture.id && record.status === 'completed'));
      app.querySelector('.fill-next').events.click();
      assert(app.querySelectorAll('input').every(input => input.value === ''));
      assert.equal(app.querySelector('.fill-original'), null);
      assert.equal(app.querySelector('.fill-summary').hidden, true);
    }
  }
  // 위치 변경 모드에서도 출제한 빈칸을 정답으로 채워 원문 전체를 완성합니다.
  run("navigate('#/category/06/terms/fill')"); await flush();
  run('Math.random = () => 0.99');
  const varied = app.querySelector('select'); varied.value = 'varied'; varied.events.change();
  app.querySelector('form').events.submit({ preventDefault() {} });
  assert.deepEqual(app.querySelectorAll('.fill-completed-answer').map(node => node.textContent), ['구조체', '모서리 부위']);
  assert(app.querySelectorAll('.fill-completed-answer').every(node => node.className.includes('fill-completed-answer--incorrect')));
  assert.equal(app.querySelector('.fill-definition').textContent, legalTerms[0].definition);
  // 모든 위치 변경 조합: 띄어쓰기 차이·오타·미입력을 섞어도 표시는 원문과 같습니다.
  for (const rawTerm of legalTerms) {
    data.textContent = JSON.stringify([rawTerm]);
    for (let choiceIndex = 0; choiceIndex < rawTerm.blankSets.length; choiceIndex++) {
      run("navigate('#/category/06/terms/fill')"); await flush();
      context.randomChoice = (choiceIndex + 0.5) / rawTerm.blankSets.length;
      run('Math.random = () => randomChoice');
      const modeSelect = app.querySelector('select'); modeSelect.value = 'varied'; modeSelect.events.change();
      const selectedIds = rawTerm.blankSets[choiceIndex];
      const expected = rawTerm.blanks.filter(blank => selectedIds.includes(blank.id)).sort((a, b) => a.start - b.start);
      const editable = app.querySelectorAll('input');
      assert.equal(editable.length, expected.length);
      editable.forEach((input, i) => { input.value = i === 0 ? expected[i].answer.split('').join(' ') : i === 1 ? '' : '오타'; });
      app.querySelector('form').events.submit({ preventDefault() {} });
      const answers = app.querySelectorAll('.fill-completed-answer');
      assert.deepEqual(answers.map(node => node.textContent), expected.map(blank => blank.answer));
      assert(answers[0].className.includes('fill-completed-answer--correct'));
      assert(answers.slice(1).every(node => node.className.includes('fill-completed-answer--incorrect')));
      assert.equal(app.querySelector('.fill-definition').textContent, rawTerm.definition);
      assert.equal(app.querySelector('input'), null);
      assert.equal(app.querySelector('.fill-original'), null);
      app.querySelector('.fill-next').events.click(); // 1문제일 때 다시 풀기도 초기화합니다.
      assert.equal(app.querySelector('.fill-completed-answer'), null);
      assert(app.querySelectorAll('input').every(input => input.value === ''));
    }
  }
  data.textContent = JSON.stringify([fixture]);
  run("navigate('#/category/06/terms/fill')"); await flush();
  const aliasInputs = app.querySelectorAll('input'); aliasInputs[0].value = '검증별칭'; aliasInputs[1].value = 'BETA';
  app.querySelector('form').events.submit({ preventDefault() {} });
  assert(app.querySelector('.fill-summary').className.includes('fill-summary--correct'));
  assert.equal(app.querySelector('.fill-definition').textContent, 'TEST AL PHA / BETA / GAMMA');
  data.textContent = JSON.stringify(legalTerms);
  run("navigate('#/category/06/terms/written')"); await flush();
  for (const term of legalTerms) {
    assert.equal(app.querySelector('.fill-term').textContent, term.term);
    assert.equal(app.querySelector('.written-answer').children.length, 0);
    app.querySelector('.fill-question').querySelector('button').events.click();
    assert.equal(app.querySelector('.written-answer').querySelector('p').textContent, term.definition);
    assert(app.querySelector('.written-answer').querySelectorAll('strong').every(node => node.textContent === term.term || node.textContent === `"${term.term}"`));
    app.querySelector('.fill-next').events.click();
  }
  const savedBeforeHome = [...stored.entries()];
  const writesBeforeHome = writes.length;
  function clickHome() {
    let prevented = false;
    homeLink.events.click({ button: 0, preventDefault() { prevented = true; } });
    assert(prevented);
  }
  for (const route of ['#/category/06/terms/fill', '#/category/06/terms/written', '#/category/06',
    '#/category/01/01/theory', '#/category/02', '#/category/03', '#/category/04', '#/category/05']) {
    run(`navigate('${route}')`); await flush();
    if (app.querySelector('input')) app.querySelector('input').value = '미채점 입력';
    clickHome();
    assert.equal(location.hash, '#/');
    assert.equal(app.querySelectorAll('.card-label').length, 6);
    const homeCursor = cursor;
    const homeState = history.state;
    const homeChildren = app.children;
    clickHome();
    assert.equal(cursor, homeCursor); // 이미 홈이면 이력·화면을 새로 만들지 않습니다.
    assert.equal(history.state, homeState);
    assert.equal(app.children, homeChildren);
    history.back(); await flush(); assert.equal(location.hash, route);
    if (route.endsWith('/fill')) {
      assert.equal(app.querySelector('.fill-review').textContent, '복습 등록됨');
      assert(app.querySelectorAll('input').every(input => input.value === ''));
    }
    history.forward(); assert.equal(location.hash, '#/');
  }
  assert.deepEqual([...stored.entries()], savedBeforeHome);
  assert.equal(writes.length, writesBeforeHome);
  assert.match(source, /<a class="brand-home" href="#\/" aria-label="에평사 홈으로 이동">\s*<img class="brand-icon"[\s\S]*?<span class="brand-name">에평사<\/span>\s*<\/a>/);
  assert.match(css, /\.brand-home\s*\{[^}]*gap:\s*12px[^}]*cursor:\s*pointer/);
  console.log('PASS: blank study/grading/history regression; manual-only registration before/after grading; deduplication; restart persistence; read/write/invalid-data errors; completed and unrelated data preserved; ID/status only; no IndexedDB/cache access');
  console.log('PASS: 3 actual definitions, source metadata, blank offsets and registered sets, correct/incorrect grading, completed definition text, manual review deduplication, next reset, shared written-study data');
  console.log('PASS: bucketed widths retained after grading; 32px input/answer boxes; exercise line-height and vertical alignment CSS; inset focus; green/red bold answers and borders; no separate verdict/reveal UI');
  console.log('PASS: fixed and all registered varied combinations complete exact original text; whitespace/alias answers accepted; typo/empty answers replaced; expanding/wrapping answer CSS; written term-only reveal preserved');
  console.log('PASS: shared accessible logo link; home navigation from fill/written/law/01-05; home no-op; back/forward; review and unrelated storage preserved; ungraded input follows existing reset rules');
  console.log('PASS: grade/review action row order retained across registration and grading; summary below actions; centered input/completed-answer CSS; responsive wrapping action row');
  console.log('PASS: bold mode label only; fill title removed without changing term data; numbering and body emphasis retained; written-study titles retained');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
