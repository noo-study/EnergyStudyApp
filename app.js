// 카테고리와 소분류 이름은 이곳에서 수정합니다. 학습자료는 저장하지 않습니다.
const categories = [
  { id: '01', name: '건축환경계획', topics: ['기본', '열환경', '공기환경'] },
  { id: '02', name: '기계설비', topics: ['공조설비', '난방설비', '열원 및 냉방설비', '열역학, 유체역학, 연소공학'] },
  { id: '03', name: '전기설비', topics: ['기본개념', '변압기', '전동기', '조명설비'] },
  { id: '04', name: '신재생설비', topics: ['태양광', '지열'] },
  { id: '05', name: 'ZEB평가', topics: ['제로에너지건축물인증', '건축물에너지절약설계기준'] },
  { id: '06', name: '용어의 정의', topics: [] }
];
const modes = [{ id: 'theory', name: '이론' }, { id: 'past', name: '기출' }];
const termModes = [
  { id: 'fill', name: '빈칸 채우기', description: '핵심 단어와 구절을 직접 입력하여 암기' },
  { id: 'written', name: '전체 서술형', description: '정의를 머릿속으로 떠올린 후 정답 확인' }
];
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
    if (parts.length === 2) return { type: 'modes', category };
    const termMode = termModes.find(item => item.id === parts[2]);
    return parts.length === 3 && termMode ? { type: 'material', category, termMode } : { type: 'invalid' };
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
    if (view.topic || view.termMode) section.append(element('p', 'detail-context', view.category.name));
    const heading = element('h1', 'detail-title', title);
    heading.id = 'detail-title';
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading);
    if (view.type === 'topics' || view.type === 'modes') {
      const list = element('ul', 'category-grid detail-list');
      if (view.type === 'topics') {
        view.category.topics.forEach((name, index) => list.append(card(number(index), name, `#/category/${view.category.id}/${number(index)}`)));
      } else if (view.category.id === '06') {
        termModes.forEach((mode, index) => list.append(card(number(index), mode.name, `#/category/06/${mode.id}`, mode.description)));
      } else {
        modes.forEach((mode, index) => list.append(card(number(index), mode.name, `#/category/${view.category.id}/${view.topicId}/${mode.id}`)));
      }
      section.append(list);
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
