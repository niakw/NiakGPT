(() => {
  'use strict';

  const status = document.getElementById('status');
  const fail = message => {
    if (status) status.textContent = String(message || 'Impossible de préparer la connexion GitHub.');
  };

  chrome.runtime.sendMessage({ type: 'niakgpt:memory-github-manifest-v132' }, response => {
    if (chrome.runtime.lastError) {
      fail(chrome.runtime.lastError.message);
      return;
    }
    if (!response?.ok || !response.manifest || !response.state) {
      fail(response?.error || 'Flux GitHub expiré. Ferme cette fenêtre et réessaie.');
      return;
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://github.com/settings/apps/new';

    const manifest = document.createElement('input');
    manifest.type = 'hidden';
    manifest.name = 'manifest';
    manifest.value = JSON.stringify(response.manifest);

    const state = document.createElement('input');
    state.type = 'hidden';
    state.name = 'state';
    state.value = response.state;

    form.append(manifest, state);
    document.body.appendChild(form);
    if (status) status.textContent = 'Redirection sécurisée vers GitHub…';
    form.submit();
  });
})();
