/* Só Armação — início da página (carregado no <head>, antes do CSS).
 * Fica num arquivo (e não inline no index.html) pra CSP do vercel.json poder
 * proibir qualquer script inline: só roda JS servido por origens da lista.
 */
(function () {
  'use strict';

  // Começa a baixar o catálogo já aqui, em paralelo com fontes/CSS/JS (o app.js aproveita
  // esta mesma requisição). Se o navegador já guardou um catálogo recente, nem precisa.
  (function () {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
    try { var c = JSON.parse(localStorage.getItem('sa_catalogo') || 'null'); if (c && c.dados && Date.now() - c.ts < 864e5) return; } catch (e) {}
    window.__catalogo = fetch('https://api.soarmacao.com.br/api/catalogo', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('catalogo ' + r.status); return r.json(); });
    window.__catalogo.catch(function () {});
  })();

  // Clique de anúncio do Google: gclid/gbraid/wbraid só vêm na URL da página de CHEGADA.
  // Guarda já aqui (antes de qualquer navegação) por até 90 dias, a janela de conversão
  // do Ads; o checkout manda pro backend gravar no pedido. Clique mais novo substitui.
  (function () {
    try {
      var q = new URLSearchParams(location.search), clique = {};
      ['gclid', 'gbraid', 'wbraid'].forEach(function (k) { var v = q.get(k); if (v && /^[\w.-]{1,200}$/.test(v)) clique[k] = v; });
      if (clique.gclid || clique.gbraid || clique.wbraid) { clique.ts = Date.now(); localStorage.setItem('sa_ads_clique', JSON.stringify(clique)); }
    } catch (e) {}
  })();

  // Login (área do cliente): links de confirmação/recuperação de senha e a volta do
  // Google trazem um código de uso único na URL. Tira da barra ANTES do GA, Meta e
  // Clarity lerem o endereço; o app.js pega daqui e troca pela sessão.
  (function () {
    try {
      if (!/^\/conta(\/|$)/.test(location.pathname)) return;
      var q = new URLSearchParams(location.search), achou = {};
      ['code', 'token_hash', 'type', 'error_description'].forEach(function (k) { var v = q.get(k); if (v) { achou[k] = v.slice(0, 2000); q.delete(k); } });
      if (!Object.keys(achou).length) return;
      sessionStorage.setItem('sa_auth_url', JSON.stringify(achou));
      var resto = q.toString();
      history.replaceState(history.state, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
    } catch (e) {}
  })();

  // GA4 + Google Ads (o gtag.js é carregado pelo <script async> do index.html)
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-TMYDVM5TM1', { send_page_view: false });
  // Google Ads (remarketing e base pras conversões); usa o mesmo gtag.js do GA4
  window.gtag('config', 'AW-18408434452');

  // Meta Pixel
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', '2145904552977134');

  // Microsoft Clarity (projeto z71b3umyh3)
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', 'z71b3umyh3');
})();
