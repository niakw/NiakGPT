(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const allowedStates = new Set(['ready','loading','waiting','thinking','executing','error']);
  const labels = {
    ready:'PRÊT', loading:'CHARGEMENT', waiting:'ATTENTE', thinking:'RÉFLEXION / ANALYSE', executing:'EXÉCUTION', error:'ERREUR'
  };

  const activeChat = document.getElementById('lab-chat-active');
  const activeProjectLinks = [...document.querySelectorAll('a[href*="g-p-1111111111111111"]')];
  const status = document.getElementById('ng8-status');
  const statusState = status?.querySelector('.ng86-status-state');
  const activity = document.getElementById('lab-activity');
  const conversation = document.getElementById('lab-conversation');
  let state = allowedStates.has(params.get('state')) ? params.get('state') : 'ready';

  function applyState(next) {
    state = allowedStates.has(next) ? next : 'ready';
    document.documentElement.dataset.ng86Activity = state;
    document.documentElement.dataset.ng8Running = ['loading','waiting','thinking','executing'].includes(state) ? '1' : '0';
    if (status) status.dataset.ng86Activity = state;
    if (statusState) statusState.textContent = labels[state];

    if (activeChat) {
      activeChat.dataset.ng86Activity = state;
      activeChat.classList.toggle('ng86-active-chat', state !== 'ready');
      activeChat.classList.add('ng86-current-chat');
    }
    for (const link of activeProjectLinks) {
      link.dataset.ng86Activity = state;
      link.classList.toggle('ng86-active-project', state !== 'ready');
    }
    document.querySelectorAll('.lab-controls [data-state]').forEach(b => b.toggleAttribute('aria-pressed', b.dataset.state === state));
  }

  function addHeavyTurns() {
    if (!conversation || conversation.dataset.heavyBuilt) return;
    conversation.dataset.heavyBuilt = '1';
    document.documentElement.dataset.ng8Heavy = '1';
    for (let i = 5; i <= 84; i++) {
      const role = i % 2 ? 'user' : 'assistant';
      const article = document.createElement('article');
      article.className = 'lab-turn';
      article.dataset.testid = `conversation-turn-${i}`;
      article.setAttribute('data-testid', `conversation-turn-${i}`);
      article.dataset.ng8Turn = String(i - 1);
      article.dataset.ng8Role = role;
      article.innerHTML = `<small>${role === 'user' ? 'UTILISATEUR' : 'ASSISTANT'} · ${String(i).padStart(2,'0')}</small><div data-message-author-role="${role}"><p>Bloc de conversation longue ${i}. Il sert à tester le scroll, content-visibility, la stabilité du composer et la densité visuelle.</p>${i % 12 === 0 ? '<pre><code>for (const item of longThread) render(item);</code></pre>' : ''}</div>`;
      conversation.appendChild(article);
    }
  }

  function openActivity() {
    if (!activity) return;
    activity.hidden = false;
    document.body.classList.add('lab-activity-open');
  }
  function closeActivity() {
    if (!activity) return;
    activity.hidden = true;
    document.body.classList.remove('lab-activity-open');
  }

  function openGovernance() {
    if (document.getElementById('ng85-governance')) return;
    const tpl = document.getElementById('lab-governance-template');
    if (!tpl) return;
    document.body.appendChild(tpl.content.cloneNode(true));
    document.querySelector('#ng85-governance header button')?.addEventListener('click', () => document.getElementById('ng85-governance')?.remove());
  }

  function drawMatrix() {
    const canvas = document.getElementById('ng8-matrix');
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * .5));
      canvas.height = Math.max(1, Math.floor(r.height * .5));
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.font = '9px Consolas, monospace';
      for (let x = 4; x < canvas.width; x += 18) {
        for (let y = (x * 7) % 36; y < canvas.height; y += 34) {
          ctx.fillStyle = ((x + y) % 5 === 0) ? 'rgba(28,255,88,.42)' : 'rgba(28,255,88,.18)';
          ctx.fillText(((x + y) % 3 === 0) ? '0' : ((x + y) % 3 === 1 ? '1' : 'ア'), x, y);
        }
      }
    };
    resize();
    addEventListener('resize', resize, {passive:true});
  }

  document.querySelectorAll('.lab-controls [data-state]').forEach(button => button.addEventListener('click', () => applyState(button.dataset.state)));
  activity?.querySelector('.ng8-activity-close')?.addEventListener('click', closeActivity);

  const scene = params.get('scene') || 'base';
  if (scene === 'heavy') addHeavyTurns();
  if (scene === 'activity') openActivity();
  if (scene === 'governance') openGovernance();
  if (scene === 'heavy-activity') { addHeavyTurns(); openActivity(); }

  applyState(state);
  drawMatrix();
  window.NiakGPTVisualLab = { applyState, addHeavyTurns, openActivity, closeActivity, openGovernance };
})();
