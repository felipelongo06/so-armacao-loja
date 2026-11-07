/* Só Armação — botão flutuante do WhatsApp.
 * Arquivo à parte: não depende do app.js e sai do site apagando este arquivo e a linha dele no index.html.
 * Só abre um link wa.me, sem carregar nada de fora (a CSP do vercel.json continua igual).
 */
(function () {
  'use strict';

  var NUMERO = '5511974124071';
  var MENSAGEM = 'Olá! Vim pelo site da Só Armação e tenho uma dúvida.';
  // Na hora de pagar, o botão só atrapalha.
  var OCULTAR = /^\/(checkout|pix|confirmacao)(\/|$)/;
  var ICONE = '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  // z-index 45: acima da barra de comprar (40), abaixo do cabeçalho (50), toast (90), popup (150) e lupa (200).
  var estilo = document.createElement('style');
  estilo.textContent =
    '.wa-botao{position:fixed;right:16px;bottom:calc(20px + env(safe-area-inset-bottom));z-index:45;width:56px;height:56px;border-radius:50%;' +
    'display:flex;align-items:center;justify-content:center;background:#25D366;color:#fff;box-shadow:0 4px 14px rgba(6,48,27,.35);transition:transform .15s ease}' +
    '.wa-botao:hover{transform:scale(1.06)}' +
    '.wa-botao:focus-visible{outline:3px solid #06301B;outline-offset:2px}' +
    '.wa-botao.acima{bottom:calc(84px + env(safe-area-inset-bottom))}' +
    '.wa-botao[hidden]{display:none}' +
    '@media (prefers-reduced-motion:reduce){.wa-botao{transition:none}}' +
    '@media print{.wa-botao{display:none}}';
  document.head.appendChild(estilo);

  var botao = document.createElement('a');
  botao.className = 'wa-botao';
  botao.target = '_blank';
  botao.rel = 'noopener';
  botao.title = 'Fale com a gente no WhatsApp';
  botao.setAttribute('aria-label', 'Falar com a Só Armação no WhatsApp (abre em nova aba)');
  botao.innerHTML = ICONE;

  function mensagem() {
    if (!/^\/p\//.test(location.pathname)) return MENSAGEM;
    var titulo = document.querySelector('#app h1');
    var nome = titulo ? titulo.textContent.trim() : '';
    return nome ? 'Olá! Tenho uma dúvida sobre o modelo ' + nome + ': ' + location.origin + location.pathname : MENSAGEM;
  }

  // O site troca de página sem recarregar: confere a cada mudança no conteúdo.
  function atualizar() {
    botao.hidden = OCULTAR.test(location.pathname);
    botao.href = 'https://wa.me/' + NUMERO + '?text=' + encodeURIComponent(mensagem());
    // No celular, a página do produto tem a barra "Comprar" presa no rodapé.
    botao.classList.toggle('acima', window.innerWidth < 820 && Boolean(document.querySelector('.barra-comprar')));
  }

  var marcado = false;
  function agendar() {
    if (marcado) return;
    marcado = true;
    requestAnimationFrame(function () { marcado = false; atualizar(); });
  }

  botao.addEventListener('click', function () {
    atualizar();
    if (window.gtag) window.gtag('event', 'whatsapp_click', { pagina: location.pathname });
    if (window.fbq) window.fbq('track', 'Contact');
  });

  function iniciar() {
    document.body.appendChild(botao);
    atualizar();
    var app = document.getElementById('app');
    if (app) new MutationObserver(agendar).observe(app, { childList: true, subtree: true });
    window.addEventListener('popstate', agendar);
    window.addEventListener('resize', agendar);
  }
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
