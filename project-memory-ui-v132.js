(() => {
  'use strict';
  if (location.hostname !== 'chatgpt.com' || window.__NIAKGPT_PROJECT_MEMORY_UI_132__) return;
  window.__NIAKGPT_PROJECT_MEMORY_UI_132__ = true;

  let renderTimer = 0, rendering = false;
  const esc = value => String(value == null ? '' : value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const api = () => window.__NIAKGPT_PROJECT_MEMORY__;

  function humanDate(value) {
    const n = Number(value || 0);
    if (!n) return 'jamais';
    try { return new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short'}).format(new Date(n)); }
    catch { return new Date(n).toLocaleString(); }
  }

  function statusText(snapshot) {
    const s = snapshot && snapshot.state || {};
    if (s.mode === 'syncing') {
      const p = Number(s.projectTotal || 0) ? Math.round((Number(s.projectDone || 0) / Number(s.projectTotal || 1)) * 100) : 0;
      const chat = s.chatTitle ? ' · ' + s.chatTitle : '';
      return 'Synchronisation ' + p + '% · ' + (s.projectName || s.projectId || 'Project') + chat;
    }
    if (s.mode === 'error') return 'Erreur · ' + String(s.error || 'synchronisation interrompue');
    if (snapshot && snapshot.connected) return 'Connecté · dernière synchro ' + humanDate(s.lastSyncAt);
    if (snapshot && snapshot.configured && !snapshot.tokenAvailable) return 'Configuré · jeton GitHub à reconnecter pour cette session';
    return 'Non connecté';
  }

  async function render() {
    if (rendering) return;
    const grid = document.querySelector('#ng90-control .ng90-grid');
    const memory = api();
    if (!grid || !memory) return;
    rendering = true;
    try {
      const snapshot = await memory.status();
      let section = grid.querySelector(':scope > section[data-ng132-memory]');
      if (!section) {
        section = document.createElement('section');
        section.dataset.ng132Memory = '1';
        grid.appendChild(section);
      }
      const config = snapshot.config || {};
      const prefs = snapshot.prefs || {};
      const connected = snapshot.connected === true;
      const configured = snapshot.configured === true;

      section.innerHTML =
        '<h3>PROJECT MEMORY · GITHUB PRIVÉ</h3>' +
        '<div class="ng132-memory-status ' + (snapshot.state && snapshot.state.mode === 'error' ? 'error' : connected ? 'ok' : '') + '">' +
          '<b>' + esc(statusText(snapshot)) + '</b>' +
          '<small>La mémoire utilisateur n’est jamais écrite dans le dépôt public NiakGPT. Le dépôt choisi doit être privé ou la connexion est refusée.</small>' +
        '</div>' +
        '<div class="ng132-memory-form">' +
          '<label><span><b>Dépôt privé</b><small>owner/repository</small></span><input data-ng132-repo type="text" autocomplete="off" spellcheck="false" value="' + esc(config.repo || '') + '" placeholder="owner/niakgpt-memory"></label>' +
          '<label><span><b>Branche</b><small>Branche dédiée ou main</small></span><input data-ng132-branch type="text" autocomplete="off" spellcheck="false" value="' + esc(config.branch || 'main') + '" placeholder="main"></label>' +
          '<label><span><b>Dossier</b><small>Racine mémoire dans le dépôt</small></span><input data-ng132-root type="text" autocomplete="off" spellcheck="false" value="' + esc(config.root || '.niakgpt-memory') + '" placeholder=".niakgpt-memory"></label>' +
          '<label class="ng132-token"><span><b>Fine-grained token</b><small>Un seul dépôt · Contents R/W · Metadata R</small></span><input data-ng132-token type="password" autocomplete="off" spellcheck="false" placeholder="' + (configured ? 'Jeton non affiché — saisir pour reconnecter' : 'github_pat_…') + '"></label>' +
          '<label class="ng132-remember"><input data-ng132-remember type="checkbox" ' + (config.rememberToken ? 'checked' : '') + '><span><b>Mémoriser le jeton sur cet appareil</b><small>Optionnel. Sinon il reste seulement dans la session du navigateur et devra être ressaisi après redémarrage.</small></span></label>' +
        '</div>' +
        '<div class="ng132-memory-actions">' +
          '<button data-ng132-connect>' + (connected ? 'Revérifier / reconnecter' : 'Connecter et synchroniser') + '</button>' +
          '<button data-ng132-sync ' + (!connected ? 'disabled' : '') + '>Synchroniser maintenant</button>' +
          '<button data-ng132-force ' + (!connected ? 'disabled' : '') + '>Reprendre tout l’historique</button>' +
          '<button data-ng132-disconnect ' + (!configured ? 'disabled' : '') + '>Déconnecter</button>' +
        '</div>' +
        '<label class="ng132-option"><input data-ng132-auto type="checkbox" ' + (prefs.autoSync !== false ? 'checked' : '') + '><span><b>Synchronisation incrémentale</b><small>Après le bootstrap, seuls les fils modifiés sont relus. La synchro se met en pause pendant une génération ChatGPT.</small></span></label>' +
        '<label class="ng132-option"><input data-ng132-inject type="checkbox" ' + (prefs.injectOnNewChat !== false ? 'checked' : '') + '><span><b>Restaurer le checkpoint dans un nouveau fil</b><small>Ajoute une seule fois le contexte compact du Project au premier message du nouveau fil, jamais à chaque prompt.</small></span></label>' +
        '<div class="ng132-memory-info"><b>Bootstrap des Projects existants</b><span>À la première connexion, NiakGPT indexe automatiquement chaque Project non vide : contexte Project, historique des conversations, tâches/contraintes/architecture détectées et checkpoint compact.</span></div>' +
        '<div class="ng132-memory-info"><b>Historique complet ≠ prompt complet</b><span>Les conversations restent archivées dans GitHub. ChatGPT ne reçoit normalement que PROJECT_STATE.md, borné et mis à jour.</span></div>';

      const repo = section.querySelector('[data-ng132-repo]');
      const branch = section.querySelector('[data-ng132-branch]');
      const root = section.querySelector('[data-ng132-root]');
      const token = section.querySelector('[data-ng132-token]');
      const remember = section.querySelector('[data-ng132-remember]');

      section.querySelector('[data-ng132-connect]').onclick = async () => {
        const button = section.querySelector('[data-ng132-connect]');
        if (!token.value.trim()) {
          token.focus();
          token.setCustomValidity('Saisis le fine-grained token GitHub.');
          token.reportValidity();
          setTimeout(() => token.setCustomValidity(''), 1200);
          return;
        }
        button.disabled = true;
        button.textContent = 'Vérification du dépôt privé…';
        const result = await memory.connect({
          repo: repo.value.trim(),
          branch: branch.value.trim(),
          root: root.value.trim(),
          token: token.value.trim(),
          rememberToken: remember.checked
        });
        token.value = '';
        if (!result || !result.ok) {
          section.querySelector('.ng132-memory-status b').textContent = 'Connexion refusée · ' + String(result && result.error || 'erreur GitHub');
        }
        schedule(50);
      };

      section.querySelector('[data-ng132-sync]').onclick = async () => {
        section.querySelector('[data-ng132-sync]').disabled = true;
        await memory.syncNow({force:false});
        schedule(50);
      };

      section.querySelector('[data-ng132-force]').onclick = async () => {
        if (!confirm('Relire intégralement tous les fils des Projects non vides et reconstruire leurs checkpoints privés ?')) return;
        section.querySelector('[data-ng132-force]').disabled = true;
        await memory.syncNow({force:true});
        schedule(50);
      };

      section.querySelector('[data-ng132-disconnect]').onclick = async () => {
        if (!confirm('Déconnecter Project Memory de GitHub ? Les fichiers déjà présents dans le dépôt privé restent intacts.')) return;
        await memory.disconnect(false);
        schedule(50);
      };

      section.querySelector('[data-ng132-auto]').onchange = async event => {
        await memory.setPrefs(Object.assign({}, prefs, {autoSync:event.target.checked}));
        schedule(50);
      };
      section.querySelector('[data-ng132-inject]').onchange = async event => {
        await memory.setPrefs(Object.assign({}, prefs, {injectOnNewChat:event.target.checked}));
        schedule(50);
      };
    } finally {
      rendering = false;
    }
  }

  function schedule(delay) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, delay == null ? 80 : delay);
  }

  const observer = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node instanceof Element && (node.id === 'ng90-control' || node.querySelector && node.querySelector('#ng90-control'))))) schedule(40);
    else if (document.querySelector('#ng90-control.open')) schedule(120);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('niakgpt:project-memory-state',() => schedule(60));
  document.addEventListener('niakgpt:project-memory-synced',() => schedule(60));
  document.addEventListener('click',event => {
    if (event.target instanceof Element && event.target.closest('#ng90-settings-btn')) schedule(120);
  },true);
})();