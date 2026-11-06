// 카테고리와 소분류 이름은 이곳에서 수정합니다. 학습자료는 저장하지 않습니다.
const categories = [
  { id: '01', name: '건축환경계획', topics: ['기본', '열환경', '공기환경'] },
  { id: '02', name: '기계설비', topics: ['공조설비', '난방설비', '열원 및 냉방설비', '열역학, 유체역학, 연소공학'] },
  { id: '03', name: '전기설비', topics: ['기본개념', '변압기', '전동기', '조명설비'] },
  { id: '04', name: '신재생설비', topics: ['태양광', '지열'] },
  { id: '05', name: 'ZEB평가', topics: ['제로에너지건축물인증', '건축물에너지절약설계기준'] },
  { id: '06', name: '법령 암기', topics: [] }
];
const lawSections = [{ id: 'terms', name: '용어의 정의' }, { id: 'law', name: '법령 빈칸 채우기' }];
const modes = [{ id: 'theory', name: '이론' }, { id: 'past', name: '기출' }];
const termModes = [
  { id: 'fill', name: '빈칸 채우기', description: '핵심 단어와 구절을 직접 입력하여 암기' },
  { id: 'written', name: '전체 서술형', description: '정의를 머릿속으로 떠올린 후 정답 확인' }
];
const reviewStorageKey = 'bea.fillStudy.statuses.v1';
const app = document.querySelector('#app');
const homeMarkup = app.innerHTML;
const number = index => String(index + 1).padStart(2, '0');

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(id, name, route, description) {
  const item = element('li', '');
  const link = element('a', 'category-card');
  link.href = route;
  link.append(element('span', 'card-number', id));
  if (description) {
    const text = element('span', 'card-text');
    text.append(element('span', 'card-label', name), element('span', 'card-description', description));
    link.append(text);
  } else {
    link.append(element('span', 'card-label', name));
  }
  const arrow = element('span', 'card-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  link.append(arrow);
  item.append(link);
  return item;
}

// #/category/01/01/theory のような住所から画面を決めます。
function resolveRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (!hash || hash === '#/' || hash === '#') return { type: 'home' };
  const category = categories.find(item => item.id === parts[1]);
  if (parts[0] !== 'category' || !category) return { type: 'invalid' };
  if (category.id === '06') {
    if (parts.length === 2) return { type: 'topics', category };
    // 이전에 사용한 용어 학습 주소도 계속 열 수 있게 유지합니다.
    const legacyMode = termModes.find(item => item.id === parts[2]);
    if (parts.length === 3 && legacyMode) return { type: 'material', category, topic: '용어의 정의', termMode: legacyMode };
    const section = lawSections.find(item => item.id === parts[2]);
    if (!section) return { type: 'invalid' };
    if (parts.length === 3) return { type: section.id === 'terms' ? 'modes' : 'material', category, topic: section.name };
    const termMode = termModes.find(item => item.id === parts[3]);
    return section.id === 'terms' && parts.length === 4 && termMode
      ? { type: 'material', category, topic: section.name, termMode } : { type: 'invalid' };
  }
  if (parts.length === 2) return { type: 'topics', category };
  const index = category.topics.findIndex((_, i) => number(i) === parts[2]);
  if (index < 0) return { type: 'invalid' };
  const topic = category.topics[index];
  if (parts.length === 3) return { type: 'modes', category, topic, topicId: parts[2] };
  const mode = modes.find(item => item.id === parts[3]);
  return parts.length === 4 && mode ? { type: 'material', category, topic, mode } : { type: 'invalid' };
}

function parentRoute() {
  if (/^#\/category\/06\/(fill|written)$/.test(location.hash)) return '#/category/06/terms';
  const parts = location.hash.split('/');
  parts.pop();
  return parts.length > 2 ? parts.join('/') : '#/';
}

function screenName(route) {
  const view = resolveRoute(route);
  if (view.type === 'home' || view.type === 'invalid') return '홈';
  if (view.termMode) return view.termMode.name;
  if (view.mode) return `${view.topic} · ${view.mode.name}`;
  return view.topic || view.category.name;
}

function render(moveFocus = false) {
  const view = resolveRoute(location.hash);
  document.body.dataset.screen = view.type === 'topics' || view.type === 'modes' ? 'sage' : view.type === 'home' ? 'home' : 'ivory';
  if (view.type === 'home') {
    app.innerHTML = homeMarkup;
    const list = app.querySelector('#home-categories');
    categories.forEach(item => list.append(card(item.id, item.name, `#/category/${item.id}`)));
    document.title = '에평사 | 건축물에너지평가사 2차 학습노트';
  } else {
    app.replaceChildren();
    const previousRoute = history.state?.bea && history.state.depth > 0
      ? history.state.backRoute || parentRoute()
      : view.type === 'invalid' ? '#/' : parentRoute();
    const previousName = screenName(previousRoute);
    const back = element('button', 'back-button');
    back.type = 'button';
    back.setAttribute('aria-label', `${previousName}(으)로 뒤로 가기`);
    const chevron = element('span', 'back-chevron');
    chevron.setAttribute('aria-hidden', 'true');
    back.append(chevron, element('span', 'back-label', previousName));
    back.addEventListener('click', () => {
      if (history.state?.bea && history.state.depth > 0) history.back();
      else navigate(previousRoute, true);
    });
    app.append(back);
    const section = element('section', 'detail-panel');
    const title = view.type === 'invalid' ? '화면을 찾을 수 없습니다' : view.termMode?.name || view.topic || view.category.name;
    if (view.topic || view.termMode) section.append(element('p', 'detail-context', view.termMode ? '용어의 정의' : view.category.name));
    const heading = element('h1', 'detail-title', title);
    heading.id = 'detail-title';
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading);
    if (view.type === 'topics' || view.type === 'modes') {
      const list = element('ul', 'category-grid detail-list');
      if (view.type === 'topics') {
        if (view.category.id === '06') {
          lawSections.forEach((item, index) => list.append(card(number(index), item.name, `#/category/06/${item.id}`)));
        } else {
          view.category.topics.forEach((name, index) => list.append(card(number(index), name, `#/category/${view.category.id}/${number(index)}`)));
        }
      } else if (view.category.id === '06') {
        termModes.forEach((mode, index) => list.append(card(number(index), mode.name, `#/category/06/terms/${mode.id}`, mode.description)));
      } else {
        modes.forEach((mode, index) => list.append(card(number(index), mode.name, `#/category/${view.category.id}/${view.topicId}/${mode.id}`)));
      }
      section.append(list);
    } else if (view.termMode?.id === 'fill') {
      mountFillStudy(section);
    } else {
      if (view.mode) section.append(element('p', 'material-mode', view.mode.name));
      section.append(element('p', 'material-notice', view.type === 'invalid' ? '주소를 확인하거나 뒤로 가기를 눌러 주세요.' : '학습자료 준비 중'));
    }
    app.append(section);
    document.title = `${title}${view.mode ? ` · ${view.mode.name}` : ''} | 에평사`;
  }
  if (moveFocus) {
    const heading = app.querySelector('h1');
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function navigate(route, replace = false) {
  const depth = history.state?.bea ? history.state.depth : 0;
  const backRoute = replace ? null : location.hash || '#/';
  history[replace ? 'replaceState' : 'pushState']({ bea: true, depth: replace ? depth : depth + 1, backRoute }, '', route);
  render(true);
}

app.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#/"]');
  if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(link.getAttribute('href'));
});
window.addEventListener('popstate', () => render(true));
window.addEventListener('hashchange', () => render(true));
if (!history.state?.bea) history.replaceState({ bea: true, depth: 0 }, '', location.href);
render();

// 배포할 때만 실제 커밋 ID와 실행 번호로 치환됩니다. 로컬 파일에서는 확인하지 않습니다.
const deploymentVersion = '__DEPLOY_VERSION__';
const deploymentBuild = /* DEPLOY_BUILD */ 0;
let updateCheckRunning = false;
let lastUpdateCheck = 0;
let dismissedVersion = '';
let updateNotice;

function showUpdateNotice(version) {
  if (version === dismissedVersion) return;
  updateNotice?.remove();
  updateNotice = element('section', 'update-notice');
  updateNotice.setAttribute('aria-label', '앱 업데이트');
  const message = element('p', 'update-message', '새 버전이 있습니다. 지금 갱신할까요?');
  message.setAttribute('role', 'status');
  const actions = element('div', 'update-actions');
  const refresh = element('button', 'update-button', '지금 갱신');
  refresh.type = 'button';
  refresh.addEventListener('click', () => {
    // 주소의 화면(#)과 다른 쿼리는 유지하고 HTML을 새로운 주소로 요청합니다.
    const url = new URL(location.href);
    url.searchParams.set('app-update', version);
    url.searchParams.set('update-check', String(Date.now()));
    location.replace(url.href);
  });
  const later = element('button', 'update-button update-later', '나중에');
  later.type = 'button';
  later.addEventListener('click', () => {
    dismissedVersion = version; // 현재 실행 중에만 기억하며 저장 데이터는 건드리지 않습니다.
    updateNotice.remove();
    updateNotice = null;
  });
  actions.append(refresh, later);
  updateNotice.append(message, actions);
  app.before(updateNotice);
}

async function checkForUpdate() {
  if (!/^https?:$/.test(location.protocol) || !deploymentBuild ||
      document.visibilityState === 'hidden' || updateCheckRunning ||
      Date.now() - lastUpdateCheck < 60000) return;
  updateCheckRunning = true;
  lastUpdateCheck = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = new URL('./version.json', location.href);
    url.searchParams.set('check', String(Date.now()));
    const response = await fetch(url.href, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return;
    const latest = await response.json();
    // 오래된 CDN 응답이나 잘못된 응답으로는 갱신 안내를 표시하지 않습니다.
    if (/^[a-f0-9]{40}$/.test(latest.version) && Number.isSafeInteger(latest.build) &&
        latest.build > deploymentBuild && latest.version !== deploymentVersion) {
      showUpdateNotice(latest.version);
    }
  } catch {
    // 오프라인이나 통신 오류가 발생해도 현재 학습 화면은 그대로 유지합니다.
  } finally {
    clearTimeout(timeout);
    updateCheckRunning = false;
  }
}

window.addEventListener('pageshow', checkForUpdate);
window.addEventListener('online', checkForUpdate);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkForUpdate();
});
checkForUpdate();

// 빈칸 학습: 데이터 형식과 순수 채점 함수를 화면 표시와 분리합니다.
function normalizeFillAnswer(value) {
  return value.normalize('NFC').replace(/\s/gu, '');
}

function validateFillTerms(terms) {
  if (!Array.isArray(terms)) throw new Error('학습자료는 JSON 배열이어야 합니다.');
  const ids = new Set();
  const nonempty = value => typeof value === 'string' && value.trim().length > 0;
  for (const term of terms) {
    if (!term || !nonempty(term.id) || ids.has(term.id) || !nonempty(term.term) ||
        !nonempty(term.source?.law) || !nonempty(term.source?.article) ||
        !Array.isArray(term.definitionParts) || !term.definitionParts.length) throw new Error('용어 또는 출처 형식 오류');
    ids.add(term.id);
    const candidates = new Map();
    for (const part of term.definitionParts) {
      if (typeof part === 'string') continue;
      if (!part || !nonempty(part.id) || candidates.has(part.id) || !nonempty(part.text) ||
          typeof part.core !== 'boolean' || !Array.isArray(part.acceptedAnswers) ||
          !part.acceptedAnswers.every(nonempty)) throw new Error('빈칸 후보 형식 오류');
      candidates.set(part.id, part);
    }
    if (![...candidates.values()].some(part => part.core) ||
        !Array.isArray(term.blankSets) || !term.blankSets.length ||
        !term.blankSets.every(set => Array.isArray(set) && set.length > 0 && new Set(set).size === set.length &&
          set.every(id => candidates.has(id)))) throw new Error('빈칸 조합 형식 오류');
  }
  return terms;
}

function fillBlankIds(term, mode, random = Math.random) {
  if (mode === 'fixed') return term.definitionParts.filter(part => typeof part !== 'string' && part.core).map(part => part.id);
  return [...term.blankSets[Math.floor(random() * term.blankSets.length)]];
}

function gradeFillAnswer(candidate, input) {
  const answer = normalizeFillAnswer(input);
  return answer.length > 0 && [candidate.text, ...candidate.acceptedAnswers]
    .some(value => normalizeFillAnswer(value) === answer);
}

// 이 앱 전용 키만 읽고 씁니다. 잘못된 기존 값은 덮어쓰지 않습니다.
function readReviewStates() {
  const raw = localStorage.getItem(reviewStorageKey);
  if (raw === null) return [];
  const records = JSON.parse(raw);
  const ids = new Set();
  if (!Array.isArray(records)) throw new Error('복습 저장 형식 오류');
  for (const record of records) {
    if (!record || typeof record.id !== 'string' || !record.id.trim() || ids.has(record.id) ||
        !['review', 'completed'].includes(record.status) ||
        Object.keys(record).length !== 2) throw new Error('복습 저장 형식 오류');
    ids.add(record.id);
  }
  return records;
}

function registerReview(id) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('문제 ID 오류');
  const records = readReviewStates();
  const existing = records.find(record => record.id === id);
  if (existing) return existing.status; // completed도 임의로 review로 바꾸지 않습니다.
  records.push({ id, status: 'review' });
  localStorage.setItem(reviewStorageKey, JSON.stringify(records));
  return 'review';
}

async function readFillTerms() {
  const data = document.querySelector('#fill-study-data');
  if (!data) throw new Error('학습자료 설정이 없습니다.');
  const source = data.getAttribute('data-src');
  if (!source) return validateFillTerms(JSON.parse(data.textContent));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(new URL(source, location.href).href, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('학습자료 요청 실패');
    return validateFillTerms(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

async function mountFillStudy(section) {
  const host = element('div', 'fill-study');
  host.append(element('p', 'material-notice', '학습자료를 확인하고 있습니다.'));
  section.append(host);
  try {
    const terms = await readFillTerms();
    if (!host.isConnected) return; // 이전 화면의 늦은 응답은 반영하지 않습니다.
    if (!terms.length) {
      host.replaceChildren(element('p', 'material-notice', '등록된 학습자료가 없습니다'));
      return;
    }
    let index = 0;
    let mode = 'fixed';
    function drawQuestion() {
      host.replaceChildren();
      const term = terms[index];
      const selected = new Set(fillBlankIds(term, mode));
      const modeLabel = element('label', 'fill-mode', '빈칸 모드');
      const select = element('select', 'fill-select');
      for (const [value, name] of [['fixed', '핵심 빈칸 고정'], ['varied', '빈칸 위치 변경']]) {
        const option = element('option', '', name);
        option.value = value;
        select.append(option);
      }
      select.value = mode;
      select.addEventListener('change', () => { mode = select.value; drawQuestion(); });
      modeLabel.append(select);
      host.append(modeLabel);
      const question = element('form', 'fill-question');
      question.append(element('p', 'fill-progress', `${index + 1} / ${terms.length}`));
      question.append(element('h2', 'fill-term', term.term));
      const review = element('button', 'fill-button fill-review', '다시 볼 문제');
      review.type = 'button';
      review.setAttribute('aria-pressed', 'false');
      const reviewNotice = element('p', 'fill-review-notice');
      reviewNotice.setAttribute('role', 'status');
      function showRegistered(status) {
        review.textContent = '복습 등록됨';
        review.setAttribute('aria-pressed', 'true');
        review.disabled = true;
        reviewNotice.textContent = status === 'completed' ? '기존 학습 완료 상태를 유지합니다.' : '';
      }
      try {
        const saved = readReviewStates().find(record => record.id === term.id);
        if (saved) showRegistered(saved.status);
      } catch {
        reviewNotice.textContent = '복습 등록 상태를 읽을 수 없습니다. 기존 저장 데이터는 변경하지 않았습니다.';
      }
      review.addEventListener('click', () => {
        try {
          showRegistered(registerReview(term.id));
        } catch {
          reviewNotice.textContent = '복습 등록을 저장하지 못했습니다. 저장소 접근 권한이나 여유 공간을 확인한 뒤 다시 눌러 주세요.';
        }
      });
      question.append(review, reviewNotice);
      const definition = element('p', 'fill-definition');
      const fields = [];
      for (const part of term.definitionParts) {
        if (typeof part === 'string' || !selected.has(part.id)) {
          definition.append(element('span', '', typeof part === 'string' ? part : part.text));
          continue;
        }
        const field = element('span', 'fill-field');
        const label = element('label', 'fill-input-label', `빈칸 ${fields.length + 1}`);
        const input = element('input', 'fill-input');
        input.type = 'text';
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.setAttribute('autocorrect', 'off');
        input.setAttribute('autocapitalize', 'off');
        const result = element('span', 'fill-result');
        result.id = `fill-result-${fields.length + 1}`;
        input.setAttribute('aria-describedby', result.id);
        label.append(input);
        field.append(label, result);
        definition.append(field);
        fields.push({ candidate: part, input, result });
      }
      question.append(definition);
      const summary = element('p', 'fill-summary');
      summary.setAttribute('role', 'status');
      const grade = element('button', 'fill-button', '채점하기');
      grade.type = 'submit';
      const reveal = element('div', 'fill-reveal');
      question.addEventListener('submit', event => {
        event.preventDefault();
        let correctCount = 0;
        for (const field of fields) {
          const correct = gradeFillAnswer(field.candidate, field.input.value);
          if (correct) correctCount++;
          field.result.textContent = `${correct ? '정답' : '오답'} · 정답: ${field.candidate.text}`;
          if (field.candidate.acceptedAnswers.length) field.result.textContent += ` / 허용 정답: ${field.candidate.acceptedAnswers.join(', ')}`;
          field.input.setAttribute('aria-invalid', String(!correct));
          field.input.readOnly = true;
        }
        summary.textContent = `${fields.length}개 중 ${correctCount}개 정답`;
        grade.disabled = true;
        const details = element('details', 'fill-original');
        details.append(element('summary', '', '정의 원문 확인'));
        details.append(element('p', 'fill-definition', term.definitionParts.map(part => typeof part === 'string' ? part : part.text).join('')));
        reveal.replaceChildren(details);
      });
      question.append(grade, summary, reveal);
      question.append(element('p', 'fill-source', `${term.source.law} · ${term.source.article}`));
      const next = element('button', 'fill-button fill-next', terms.length > 1 ? '다음 문제' : '다시 풀기');
      next.type = 'button';
      next.addEventListener('click', () => {
        index = (index + 1) % terms.length;
        drawQuestion(); // 입력값·결과는 새 문제 DOM을 만들며 초기화합니다.
        host.querySelector('input')?.focus({ preventScroll: true });
      });
      host.append(question, next);
    }
    drawQuestion();
  } catch {
    if (!host.isConnected) return;
    const notice = element('p', 'material-notice', '학습자료를 불러오지 못했습니다. 연결 또는 자료 형식을 확인해 주세요.');
    const retry = element('button', 'fill-button', '다시 확인');
    retry.type = 'button';
    retry.addEventListener('click', () => { host.remove(); mountFillStudy(section); });
    host.replaceChildren(notice, retry);
  }
}
