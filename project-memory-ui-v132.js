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
    const github = snapshot && snapshot.github || {};
    if (s.mode === 'syncing') {
      const p = Number(s.projectTotal || 0) ? Math.round((Number(s.projectDone || 0) / Number(s.projectTotal || 1)) * 100) : 0;
      const chat = s.chatTitle ? ' · ' + s.chatTitle : '';
      return 'Synchronisation ' + p + '% · ' + (s.projectName || s.projectId || 'Project') + chat;
    }
    if (s.mode === 'error') return 'Erreur · ' + String(s.error || 'synchronisation interrompue');
    if (s.mode === 'queued') return 'Coffre connecté · bootstrap en attente · ' + Number(s.queuedProjects || snapshot?.queue?.pending?.length || 0) + ' Project(s)';
    if (snapshot && snapshot.connected && !Number(s.lastSyncAt || 0)) return 'Coffre initialisé · première synchronisation en attente';
    if (snapshot && snapshot.connected) return 'Connecté · dernière synchro ' + humanDate(s.lastSyncAt);
    if (github.authenticated) return 'GitHub connecté · choisis le dépôt coffre';
    if (snapshot && snapshot.configured && snapshot.config?.authMode === 'pat' && !snapshot.tokenAvailable) return 'Configuré · PAT à reconnecter pour cette session';
    return 'Non connecté';
  }

  function optionsHtml(repositories, selected) {
    if (!repositories.length) return '<option value="">Aucun dépôt privé autorisé</option>';
    return repositories.map(item => {
      const value = String(item.fullName || '');
      const label = value + (item.defaultBranch ? ' · ' + item.defaultBranch : '');
      return '<option value="' + esc(value) + '"' + (value === selected ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
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
      const github = snapshot.github || {};
      const repositories = Array.isArray(github.repositories) ? github.repositories : [];
      const connected = snapshot.connected === true;
      const configured = snapshot.configured === true;
      const githubConnected = github.authenticated === true;
      const githubRegistered = github.registered === true;
      const selectedRepo = repositories.some(item => item.fullName === config.repo) ? config.repo : (repositories[0]?.fullName || '');
      const selectedMeta = repositories.find(item => item.fullName === selectedRepo) || {};
      const branchValue = config.authMode === 'github-app' && config.repo === selectedRepo ? (config.branch || selectedMeta.defaultBranch || 'main') : (selectedMeta.defaultBranch || 'main');
      const rootValue = config.root || '.niakgpt-memory';

      let githubBlock = '';
      if (!githubConnected) {
        githubBlock =
          '<div class="ng132-github-connect">' +
            '<div><b>Connexion simple</b><small>GitHub ouvre son écran officiel, te demande les droits minimaux puis te laisse choisir exactement le ou les dépôts autorisés.</small></div>' +
            '<button class="ng132-primary" data-ng132-github-login>' + (githubRegistered ? 'Reprendre la connexion GitHub' : 'Se connecter avec GitHub') + '</button>' +
          '</div>';
      } else {
        githubBlock =
          '<div class="ng132-github-connected">' +
            '<div class="ng132-github-account"><span class="ng132-github-dot" aria-hidden="true"></span><span><b>GitHub connecté' + (github.account?.login ? ' · @' + esc(github.account.login) : '') + '</b><small>NiakGPT voit uniquement les dépôts accordés au connecteur privé.</small></span></div>' +
            '<div class="ng132-repo-picker">' +
              '<label><span><b>Dépôt coffre</b><small>Dépôts privés autorisés dans GitHub</small></span><select data-ng132-repo-select>' + optionsHtml(repositories, selectedRepo) + '</select></label>' +
              '<label><span><b>Branche</b><small>Par défaut : branche principale</small></span><input data-ng132-app-branch type="text" autocomplete="off" spellcheck="false" value="' + esc(branchValue) + '"></label>' +
              '<label><span><b>Dossier</b><small>Racine mémoire dans le dépôt</small></span><input data-ng132-app-root type="text" autocomplete="off" spellcheck="false" value="' + esc(rootValue) + '"></label>' +
            '</div>' +
            '<div class="ng132-memory-actions">' +
              '<button class="ng132-primary" data-ng132-use-repo ' + (!selectedRepo ? 'disabled' : '') + '>' + (connected && config.authMode === 'github-app' ? 'Revérifier ce dépôt' : 'Utiliser ce dépôt') + '</button>' +
              '<button data-ng132-refresh-repos>Actualiser les dépôts</button>' +
              (github.manageUrl ? '<button data-ng132-manage-repos>Gérer les accès GitHub</button>' : '') +
              '<button data-ng132-github-logout>Déconnecter GitHub</button>' +
            '</div>' +
          '</div>';
      }

      const queuePending = Array.isArray(snapshot.queue?.pending) ? snapshot.queue.pending.length : 0;
      const stateInfo = snapshot.state || {};
      const progressText = queuePending
        ? ('File persistante · ' + queuePending + ' Project(s) restant(s)')
        : (Number(stateInfo.lastSyncAt || 0) ? ('Dernière synchro · ' + humanDate(stateInfo.lastSyncAt) + ' · ' + Number(stateInfo.changed || 0) + ' fil(s) modifié(s)') : 'Aucune synchronisation complète enregistrée');

      section.innerHTML =
        '<h3>PROJECT MEMORY · COFFRE GITHUB PRIVÉ</h3>' +
        '<div class="ng132-memory-status ' + (snapshot.state && snapshot.state.mode === 'error' ? 'error' : connected ? 'ok' : '') + '">' +
          '<b>' + esc(statusText(snapshot)) + '</b>' +
          '<small>' + esc(progressText) + '</small>' +
          '<small>Le dépôt public NiakGPT ne reçoit aucun nom de coffre, token ou secret. L’autorisation GitHub appartient à ton profil navigateur.</small>' +
        '</div>' +
        githubBlock +
        '<div class="ng132-memory-actions ng132-sync-actions">' +
          '<button data-ng132-sync ' + (!connected ? 'disabled' : '') + '>Synchroniser maintenant</button>' +
          '<button data-ng132-force ' + (!connected ? 'disabled' : '') + '>Reprendre tout l’historique</button>' +
          '<button data-ng132-disconnect ' + (!configured ? 'disabled' : '') + '>Déconnecter le coffre</button>' +
        '</div>' +
        '<details class="ng132-advanced">' +
          '<summary>Avancé · PAT manuel</summary>' +
          '<div class="ng132-advanced-body">' +
            '<small>Fallback pour les comptes ou organisations où l’installation d’une GitHub App est interdite. Ce n’est plus le parcours recommandé.</small>' +
            '<div class="ng132-memory-form">' +
              '<label><span><b>Dépôt privé</b><small>owner/repository</small></span><input data-ng132-repo type="text" autocomplete="off" spellcheck="false" value="' + esc(config.authMode === 'pat' ? (config.repo || '') : '') + '" placeholder="owner/niakgpt-memory"></label>' +
              '<label><span><b>Branche</b><small>Branche dédiée ou main</small></span><input data-ng132-branch type="text" autocomplete="off" spellcheck="false" value="' + esc(config.authMode === 'pat' ? (config.branch || 'main') : 'main') + '" placeholder="main"></label>' +
              '<label><span><b>Dossier</b><small>Racine mémoire</small></span><input data-ng132-root type="text" autocomplete="off" spellcheck="false" value="' + esc(config.authMode === 'pat' ? (config.root || '.niakgpt-memory') : '.niakgpt-memory') + '" placeholder=".niakgpt-memory"></label>' +
              '<label class="ng132-token"><span><b>Fine-grained PAT</b><small>Un seul dépôt · Contents R/W · Metadata R</small></span><input data-ng132-token type="password" autocomplete="off" spellcheck="false" placeholder="' + (config.authMode === 'pat' && configured ? 'Jeton non affiché — saisir pour reconnecter' : 'github_pat_…') + '"></label>' +
              '<label class="ng132-remember"><input data-ng132-remember type="checkbox" ' + (config.authMode === 'pat' && config.rememberToken ? 'checked' : '') + '><span><b>Mémoriser le PAT sur cet appareil</b><small>Sinon il reste uniquement dans la session du navigateur.</small></span></label>' +
            '</div>' +
            '<div class="ng132-memory-actions"><button data-ng132-connect>Connecter avec le PAT</button></div>' +
          '</div>' +
        '</details>' +
        '<label class="ng132-option"><input data-ng132-auto type="checkbox" ' + (prefs.autoSync !== false ? 'checked' : '') + '><span><b>Synchronisation incrémentale</b><small>Après le bootstrap, seuls les fils modifiés sont relus. La synchro se met en pause pendant une génération ChatGPT.</small></span></label>' +
        '<label class="ng132-option"><input data-ng132-inject type="checkbox" ' + (prefs.injectOnNewChat !== false ? 'checked' : '') + '><span><b>Restaurer le checkpoint dans un nouveau fil</b><small>Ajoute une seule fois le contexte compact du Project au premier message du nouveau fil, jamais à chaque prompt.</small></span></label>' +
        '<div class="ng132-memory-info"><b>Bootstrap des Projects existants</b><span>À la première connexion, NiakGPT indexe automatiquement chaque Project non vide : contexte Project, historique des conversations, tâches/contraintes/architecture détectées et checkpoint compact.</span></div>' +
        '<div class="ng132-memory-info"><b>Historique complet ≠ prompt complet</b><span>Les conversations restent archivées dans GitHub. ChatGPT ne reçoit normalement que PROJECT_STATE.md, borné et mis à jour.</span></div>';

      const status = section.querySelector('.ng132-memory-status b');
      const setFailure = (prefix, result) => {
        status.textContent = prefix + ' · ' + String(result && result.error || 'erreur GitHub');
      };

      const githubLogin = section.querySelector('[data-ng132-github-login]');
      if (githubLogin) githubLogin.onclick = async () => {
        githubLogin.disabled = true;
        githubLogin.textContent = 'Ouverture de GitHub…';
        const result = await memory.githubLogin();
        if (!result || !result.ok) {
          setFailure('Connexion GitHub refusée', result);
          githubLogin.disabled = false;
          githubLogin.textContent = 'Réessayer avec GitHub';
          return;
        }
        schedule(50);
      };

      const repoSelect = section.querySelector('[data-ng132-repo-select]');
      const appBranch = section.querySelector('[data-ng132-app-branch]');
      const appRoot = section.querySelector('[data-ng132-app-root]');
      if (repoSelect && appBranch) repoSelect.onchange = () => {
        const meta = repositories.find(item => item.fullName === repoSelect.value);
        appBranch.value = meta?.defaultBranch || 'main';
      };

      const useRepo = section.querySelector('[data-ng132-use-repo]');
      if (useRepo) useRepo.onclick = async () => {
        useRepo.disabled = true;
        useRepo.textContent = 'Vérification du coffre…';
        const result = await memory.githubConnectRepo({
          repo: repoSelect?.value || '',
          branch: appBranch?.value.trim() || '',
          root: appRoot?.value.trim() || '.niakgpt-memory'
        });
        if (!result || !result.ok) {
          setFailure('Connexion au coffre refusée', result);
          useRepo.disabled = false;
          useRepo.textContent = 'Réessayer ce dépôt';
          return;
        }
        status.textContent = 'Coffre connecté · bootstrap planifié · ' + Number(result.queuedProjects || 0) + ' Project(s)';
        schedule(50);
      };

      const refreshRepos = section.querySelector('[data-ng132-refresh-repos]');
      if (refreshRepos) refreshRepos.onclick = async () => {
        refreshRepos.disabled = true;
        refreshRepos.textContent = 'Actualisation…';
        const result = await memory.githubRepositories();
        if (!result || !result.ok) {
          setFailure('Actualisation impossible', result);
          refreshRepos.disabled = false;
          refreshRepos.textContent = 'Réessayer';
          return;
        }
        schedule(50);
      };

      const manageRepos = section.querySelector('[data-ng132-manage-repos]');
      if (manageRepos) manageRepos.onclick = () => {
        const url = String(github.manageUrl || '');
        if (/^https:\/\/github\.com\//i.test(url)) window.open(url, '_blank', 'noopener,noreferrer');
      };

      const githubLogout = section.querySelector('[data-ng132-github-logout]');
      if (githubLogout) githubLogout.onclick = async () => {
        if (!confirm('Déconnecter GitHub de NiakGPT sur cet appareil ? Le dépôt et son contenu restent intacts.')) return;
        await memory.githubLogout();
        schedule(50);
      };

      const repo = section.querySelector('[data-ng132-repo]');
      const branch = section.querySelector('[data-ng132-branch]');
      const root = section.querySelector('[data-ng132-root]');
      const token = section.querySelector('[data-ng132-token]');
      const remember = section.querySelector('[data-ng132-remember]');
      const manualConnect = section.querySelector('[data-ng132-connect]');

      if (manualConnect) manualConnect.onclick = async () => {
        if (!token.value.trim()) {
          token.focus();
          token.setCustomValidity('Saisis le fine-grained PAT GitHub.');
          token.reportValidity();
          setTimeout(() => token.setCustomValidity(''), 1200);
          return;
        }
        manualConnect.disabled = true;
        manualConnect.textContent = 'Vérification du dépôt privé…';
        const draft = {
          repo: repo.value.trim(),
          branch: branch.value.trim(),
          root: root.value.trim(),
          token: token.value,
          rememberToken: remember.checked
        };
        const result = await memory.connect(draft);
        if (!result || !result.ok) {
          setFailure('Connexion PAT refusée', result);
          manualConnect.disabled = false;
          manualConnect.textContent = 'Réessayer avec le PAT';
          repo.value = draft.repo;
          branch.value = draft.branch;
          root.value = draft.root;
          token.value = draft.token;
          remember.checked = draft.rememberToken;
          token.focus();
          return;
        }
        token.value = '';
        schedule(50);
      };

      section.querySelector('[data-ng132-sync]').onclick = async () => {
        const button=section.querySelector('[data-ng132-sync]');
        button.disabled = true;
        const result=await memory.syncNow({force:false});
        if(!result?.ok){setFailure('Synchronisation impossible',result);button.disabled=false;}
        schedule(50);
      };

      section.querySelector('[data-ng132-force]').onclick = async () => {
        if (!confirm('Relire intégralement tous les fils des Projects non vides et reconstruire leurs checkpoints privés ?')) return;
        const button=section.querySelector('[data-ng132-force]');
        button.disabled = true;
        const result=await memory.syncNow({force:true});
        if(!result?.ok){setFailure('Reprise intégrale impossible',result);button.disabled=false;}
        schedule(50);
      };

      section.querySelector('[data-ng132-disconnect]').onclick = async () => {
        if (!confirm('Déconnecter Project Memory ? Les fichiers déjà présents dans le dépôt privé restent intacts.')) return;
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
    const controlAdded = records.some(record => [...record.addedNodes].some(node => node instanceof Element && (node.id === 'ng90-control' || node.querySelector && node.querySelector('#ng90-control'))));
    const openWithoutMemory = !!document.querySelector('#ng90-control.open .ng90-grid') && !document.querySelector('#ng90-control [data-ng132-memory]');
    if (controlAdded || openWithoutMemory) schedule(40);
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('niakgpt:project-memory-state',() => schedule(60));
  document.addEventListener('niakgpt:project-memory-synced',() => schedule(60));
  document.addEventListener('niakgpt:control-center-rendered',() => schedule(0));
  document.addEventListener('click',event => {
    if (!(event.target instanceof Element) || !event.target.closest('#ng90-settings-btn')) return;
    if (!document.querySelector('#ng90-control [data-ng132-memory]')) schedule(120);
  },true);
  schedule(0);
})();
