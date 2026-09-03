/* eslint-disable */
/**
 * qbx_mdt — NUI bridge.
 *
 * The MDT interface is served by your platform deployment, so the resource
 * cannot hand it the token with SendNUIMessage directly. This page (which does
 * run on the resource's own nui:// origin) is the broker:
 *
 *   game    --SendNUIMessage({action:'open', token})-->  this file
 *   this    --postMessage({type:'mdt:init', token})-->   the tablet (iframe)
 *   tablet  --postMessage({type:'mdt:close'})-->         this file
 *   this    --fetch('https://qbx_mdt/close')-->          the game (NUI callback)
 *
 * No credentials are stored here beyond the session: the token lives in memory
 * for the lifetime of the page and is never written to disk.
 */
(function () {
  var boot = document.getElementById('boot');
  var frame = document.getElementById('tablet');
  var token = null;
  var character = null;
  var payload = null;

  function showTablet() {
    if (boot) boot.classList.add('boot--hidden');
    if (frame) frame.classList.add('tablet--ready');
  }

  function post(message) {
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage(message, '*');
  }

  /** Loads (or reloads) the tablet with the current token in the query string. */
  function loadTablet() {
    if (!payload) return;
    var base = (payload.ui && payload.ui.baseUrl) || '';
    var path = (payload.ui && payload.ui.path) || '/nui';
    var url = base.replace(/\/$/, '') + path + '?token=' + encodeURIComponent(token || '');
    if (frame) {
      frame.onload = function () {
        // The tablet announces itself; only then do we hand over the token and
        // character, so nothing is sent to a page that never loaded.
        post({ type: 'mdt:init', token: token, character: character, resource: 'qbx_mdt' });
      };
      frame.src = url;
    }
  }

  /** Requests a NUI callback on the resource (this page's own origin). */
  function nui(name, body) {
    return fetch('https://qbx_mdt/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).catch(function () {
      /* the resource is restarting */
    });
  }

  // Messages from the game (SendNUIMessage).
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.action === 'open') {
      payload = data;
      token = data.token || null;
      character = data.character || null;
      loadTablet();
      showTablet();
      return;
    }

    if (data.action === 'close') {
      if (frame) frame.src = 'about:blank';
      if (boot) boot.classList.remove('boot--hidden');
      if (frame) frame.classList.remove('tablet--ready');
      token = null;
      return;
    }
  });

  // Messages from the tablet (postMessage).
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
    if (!data.type.startsWith('mdt:')) return;
    // Messages from the game are plain objects with `action`; anything carrying
    // a `type` prefixed with "mdt:" came from the tablet.
    if (event.source !== (frame && frame.contentWindow)) return;

    if (data.type === 'mdt:ready') {
      post({ type: 'mdt:init', token: token, character: character, resource: 'qbx_mdt' });
      return;
    }

    if (data.type === 'mdt:close') {
      // The tablet never releases focus itself; the resource owns that.
      nui('close', {});
      return;
    }

    if (data.type === 'mdt:notify') {
      nui('notify', { level: data.level || 'info', message: data.message || '' });
    }
  });

  // Fail loudly but gracefully if the deployment is unreachable.
  if (frame) {
    frame.addEventListener('error', function () {
      if (boot) {
        boot.classList.remove('boot--hidden');
        var line = boot.querySelector('.boot__line');
        if (line) line.textContent = 'Cannot reach dispatch. Check Config.Api.BaseUrl.';
      }
    });
  }
})();
