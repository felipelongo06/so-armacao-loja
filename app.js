/* Só Armação — loja
 * Uma página só (SPA). O catálogo vem do backend (/api/catalogo, alimentado pelo Bling);
 * preço, desconto do 2º óculos (-30%) e frete são sempre os que o servidor devolve (/api/cotar);
 * o pagamento é criado pelo /api/checkout e acompanhado pelo /api/pedido/:id.
 * O navegador nunca manda preço: só sku e quantidade.
 */
(function () {
  'use strict';

  var CONFIG = {
    // Em localhost a loja fala com /api na mesma origem (proxy de desenvolvimento).
    api: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '' : 'https://api.soarmacao.com.br',
    email: 'contato@soarmacao.com.br',
    site: 'https://soarmacao.com.br',
    nome: 'Só Armação',
    cacheCatalogoMs: 5 * 60 * 1000,      // depois disso renova em segundo plano
    validadeCatalogoMs: 24 * 60 * 60 * 1000, // até aqui o catálogo guardado ainda abre a loja na hora
    pixJanelaSeg: 15 * 60,
    pollingMs: 4000,
    // Login (Supabase Auth): chave PÚBLICA do projeto (publishable/anon), feita pra ficar no
    // navegador. Quem protege os dados é o backend, que confere o token a cada chamada.
    // Login com Google pelo botão oficial (Google Identity Services): a janela do Google
    // mostra soarmacao.com.br, não o endereço do Supabase. ID público do cliente OAuth.
    googleClientId: '470502882842-f2n1i7r9a4ddg049lpck0af76o4a5q3k.apps.googleusercontent.com',
    supabaseChave: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsemlwcnJua2FiaWxnZXd4dnFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNTMwNTQsImV4cCI6MjEwNDgyOTA1NH0.5F9BEDWa_mKanKOx_lZt_3McCo-upSpEaWKI0l0nBvs'
  };

  // ---------------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------------
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function fmt(v) { return brl.format(Number(v) || 0); }
  function h(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function digitos(s) { return String(s || '').replace(/\D/g, ''); }
  function ler(chave, padrao, storage) {
    try { var v = (storage || localStorage).getItem(chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
  }
  function gravar(chave, valor, storage) {
    try { (storage || localStorage).setItem(chave, JSON.stringify(valor)); } catch (e) { /* modo privado */ }
  }
  function apagar(chave, storage) { try { (storage || localStorage).removeItem(chave); } catch (e) {} }
  function cookie(nome) {
    var alvo = nome + '=';
    var parte = document.cookie.split('; ').find(function (c) { return c.indexOf(alvo) === 0; });
    return parte ? decodeURIComponent(parte.slice(alvo.length)) : '';
  }
  function gaClientId() {
    var p = cookie('_ga').split('.');
    return p.length >= 4 ? p.slice(-2).join('.') : '';
  }
  // ID da sessão do GA4 (cookie _ga_<contêiner>). Vai no checkout pro servidor mandar a
  // compra na MESMA sessão do clique no anúncio — sem isso o GA4 (e a conversão importada
  // no Google Ads) atribui a venda como "direto". Formatos: GS1.1.<sessão>.… e GS2.1.s<sessão>$o…
  // Clique do Google Ads guardado na chegada (boot.js). Reserva: cookie _gcl_aw da tag do
  // Ads ("GCL.<quando>.<gclid>"), caso o clique tenha chegado antes do boot.js existir.
  function cliqueAds() {
    var c = ler('sa_ads_clique', null);
    if (c && c.ts && Date.now() - c.ts < 90 * 864e5) return { gclid: c.gclid || '', gbraid: c.gbraid || '', wbraid: c.wbraid || '', clique_em: c.ts };
    var aw = cookie('_gcl_aw').split('.');
    if (aw.length >= 3 && aw[2]) return { gclid: aw.slice(2).join('.'), gbraid: '', wbraid: '', clique_em: Number(aw[1]) * 1000 || null };
    return null;
  }
  function gaSessionId() {
    var partes = cookie('_ga_TMYDVM5TM1').split('.');
    var m = /^s?(\d+)/.exec(partes[2] || '');
    return m ? m[1] : '';
  }
  var toastTimer = null;
  function toast(html, ms) {
    toastEl.innerHTML = html;
    toastEl.classList.add('visivel');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('visivel'); }, ms || 3200);
  }
  function titulo(t, desc) {
    document.title = t ? t + ' — Só Armação' : 'Só Armação — armações de grau a partir de ' + fmt(estado.precoMinimo || 49);
    var m = document.querySelector('meta[name="description"]');
    if (m && desc) m.setAttribute('content', desc);
    var c = document.querySelector('link[rel="canonical"]');
    if (c) c.setAttribute('href', CONFIG.site + location.pathname);
  }
  // "Não indexar" pro Google em páginas que não devem aparecer na busca (modelo que
  // não existe, carrinho/checkout). Endereço inventado nem chega aqui: a Vercel devolve 404.
  function naoIndexar(sim) {
    var m = document.querySelector('meta[name="robots"]');
    if (sim && !m) { m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m); }
    else if (!sim && m) m.remove();
  }
  function jsonLd(obj) {
    var antigo = document.getElementById('ld-pagina');
    if (antigo) antigo.remove();
    if (!obj) return;
    var s = document.createElement('script');
    s.type = 'application/ld+json'; s.id = 'ld-pagina';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // Rastreio (GA4 + Meta). A compra (purchase) é enviada pelo servidor, no webhook
  // de pagamento — nunca daqui, pra não duplicar quando a página recarrega.
  // ---------------------------------------------------------------------------
  function track(nome, params) {
    var ev = Object.assign({ event: nome }, params || {});
    (window.dataLayer = window.dataLayer || []).push(ev);
    try {
      var gtag = window.gtag, fbq = window.fbq;
      if (nome === 'page_view') {
        if (gtag) gtag('event', 'page_view', { page_title: document.title, page_location: location.href, page_path: location.pathname + location.search });
        if (fbq) fbq('track', 'PageView');
      } else if (nome === 'view_item' || nome === 'add_to_cart') {
        var it = params.items || [];
        if (gtag) gtag('event', nome, { currency: 'BRL', value: params.value, items: it });
        if (fbq) fbq('track', nome === 'view_item' ? 'ViewContent' : 'AddToCart', {
          content_type: 'product', content_ids: it.map(function (i) { return i.item_id; }),
          content_name: it.length ? it[0].item_name : '', currency: 'BRL', value: params.value
        });
      } else if (nome === 'view_cart') {
        if (gtag) gtag('event', 'view_cart', { currency: 'BRL', value: params.value, items: params.items });
      } else if (nome === 'begin_checkout') {
        var it2 = params.items || [];
        if (gtag) gtag('event', 'begin_checkout', { currency: 'BRL', value: params.value, items: it2 });
        if (fbq) fbq('track', 'InitiateCheckout', {
          content_type: 'product', content_ids: it2.map(function (i) { return i.item_id; }),
          contents: it2.map(function (i) { return { id: i.item_id, quantity: i.quantity }; }),
          num_items: it2.reduce(function (s, i) { return s + i.quantity; }, 0), currency: 'BRL', value: params.value
        });
      } else if (nome === 'add_payment_info') {
        if (gtag) gtag('event', 'add_payment_info', { currency: 'BRL', value: params.value, payment_type: params.payment_type, items: params.items });
        if (fbq) fbq('track', 'AddPaymentInfo', { currency: 'BRL', value: params.value });
      }
    } catch (e) { /* rastreio nunca derruba a loja */ }
  }

  // ---------------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------------
  var estado = {
    catalogo: null,        // resposta do /api/catalogo
    porCodigo: {},         // codigo (maiúsculo) -> produto
    porSku: {},            // sku (maiúsculo) -> { produto, variacao }
    regras: { leve2_pct: 30, max_unidades: 20 },
    precoMinimo: null,
    carrinho: ler('sa_cart_v2', []),
    cep: ler('sa_cep', ''),
    freteOpcao: ler('sa_frete', 'ECONOMICO'),  // 'ECONOMICO' | 'EXPRESSO'
    cotacao: null,         // último resumo do /api/cotar
    cotacaoErro: '',
    form: ler('sa_checkout', {}, sessionStorage),
    pix: ler('sa_pix', null, sessionStorage),
    timers: []
  };

  function limparTimers() {
    estado.timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
    estado.timers = [];
    if (typeof lupaFechar === 'function') lupaFechar();
  }

  // ---------------------------------------------------------------------------
  // Catálogo
  // ---------------------------------------------------------------------------
  function indexar(cat) {
    estado.catalogo = cat;
    estado.porCodigo = {}; estado.porSku = {};
    estado.regras = Object.assign(estado.regras, cat.regras || {});
    var min = null;
    (cat.produtos || []).forEach(function (p) {
      estado.porCodigo[String(p.codigo).toUpperCase()] = p;
      if (p.slug) estado.porCodigo[String(p.slug).toUpperCase()] = p;
      // endereço de SEO (/p/oculos-ibiza-gatinho-yf8636/) vindo do backend
      var seg = String(p.url || '').split('/')[2];
      if (seg) estado.porCodigo[seg.toUpperCase()] = p;
      (p.variacoes || []).forEach(function (v) {
        estado.porSku[String(v.sku).toUpperCase()] = { produto: p, variacao: v };
        if (v.estoque > 0 && v.preco > 0 && (min == null || v.preco < min)) min = v.preco;
      });
    });
    estado.precoMinimo = min;
  }
  function carregarCatalogo(forcar) {
    // O catálogo fica guardado no navegador: quem volta à loja vê tudo na hora e a
    // versão nova chega em segundo plano (preço e estoque são reconferidos no checkout).
    var cache = ler('sa_catalogo', null);
    if (!forcar && cache && cache.ts && Date.now() - cache.ts < CONFIG.validadeCatalogoMs && cache.dados) {
      indexar(cache.dados);
      return Promise.resolve(estado.catalogo);
    }
    // Primeira visita: o index.html já disparou o download no <head>, antes do app.js chegar.
    var pedido = !forcar && window.__catalogo;
    window.__catalogo = null;
    return (pedido || fetch(CONFIG.api + '/api/catalogo', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('catalogo ' + r.status); return r.json(); }))
      .then(function (dados) {
        indexar(dados);
        gravar('sa_catalogo', { ts: Date.now(), dados: dados });
        return dados;
      });
  }
  function produtoPorRota(codigo) {
    var c = String(codigo || '').toUpperCase().replace(/\/+$/, '');
    if (estado.porCodigo[c]) return { produto: estado.porCodigo[c], variacao: null };
    if (estado.porSku[c]) return estado.porSku[c];
    var s = slug(c).toUpperCase();
    if (estado.porCodigo[s]) return { produto: estado.porCodigo[s], variacao: null };
    // Nome mudou no Bling depois que o link circulou: acha pelo código no fim do endereço.
    var lista = (estado.catalogo && estado.catalogo.produtos) || [];
    for (var i = 0; i < lista.length; i++) {
      var cod = slug(lista[i].codigo).toUpperCase();
      if (cod && s.slice(-(cod.length + 1)) === '-' + cod) return { produto: lista[i], variacao: null };
    }
    return null;
  }
  function precoSegunda(preco) { return preco * (1 - (estado.regras.leve2_pct || 0) / 100); }
  // O cadastro do Bling ainda traz "garantia de 1 ano e troca em até 30 dias" nas descrições;
  // a loja não promete garantia e a troca grátis é de 7 dias úteis. Limpa na exibição.
  function limparDescricao(texto) {
    return String(texto || '')
      .replace(/compre com nota fiscal,?\s*garantia de 1 ano( contra defeito de fabricação)?\s*e\s*troca em até 30 dias\.?/gi, 'Compre com nota fiscal e troca grátis em até 7 dias úteis.')
      .replace(/,?\s*garantia de 1 ano( contra defeito de fabricação)?/gi, '')
      .replace(/,?\s*(e\s*)?troca (grátis )?em até 30 dias/gi, '')
      .replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
  }
  // Fotos do modelo: a frontal ({SKU}.jpg) é a do card; no detalhe entram também
  // -detalhe.jpg e -lateral.jpg do repositório de fotos (some sozinha se a foto não existir).
  var RE_FOTO_CDN = /^(.*\/so-armacao-fotos@[^/]+\/[^/]+?)\.(jpe?g|png|webp)$/i;
  // A CDN manda cache de 7 dias pro navegador. Quando uma foto é trocada no repositório
  // (mesmo nome de arquivo), sobe esta versão pra todo mundo buscar a nova.
  var FOTOS_VERSAO = '2';
  function foto(url) {
    if (!url) return url;
    return RE_FOTO_CDN.test(url) && url.indexOf('?') < 0 ? url + '?v=' + FOTOS_VERSAO : url;
  }
  var TIPOS = { grau: 'De grau', sol: 'De sol', 'grau-e-sol': 'Grau ou sol' };
  function rotuloTipo(p, v) { return v && v.tipo ? (TIPOS[v.tipo] || '') : (TIPOS[p.tipo] || ''); }
  function fotosDaVariacao(v, p) {
    var base = (v.imagens && v.imagens.length ? v.imagens : [v.imagem || p.imagem]).filter(Boolean);
    var lista = base.map(function (src, i) { return { src: foto(src), rotulo: i === 0 ? 'Frente' : 'Foto ' + (i + 1) }; });
    var m = base.length === 1 && base[0].match(RE_FOTO_CDN);
    if (m) {
      lista.push({ src: foto(m[1] + '-detalhe.' + m[2]), rotulo: 'Detalhe', opcional: true });
      lista.push({ src: foto(m[1] + '-lateral.' + m[2]), rotulo: 'Lateral', opcional: true });
    }
    return lista;
  }
  function rotuloEstoque(n) { return n === 1 ? 'Última unidade' : 'Últimas ' + n + ' unidades'; }
  function itemGA(p, v, qty) {
    return { item_id: v ? v.sku : p.codigo, item_name: p.nome + (v && v.cor ? ' — ' + v.cor : ''), item_category: p.formato || '', item_variant: v ? v.cor : undefined, price: v ? v.preco : p.preco, quantity: qty || 1 };
  }

  // ---------------------------------------------------------------------------
  // Carrinho (só sku e quantidade contam; o resto é lembrete visual até a cotação)
  // ---------------------------------------------------------------------------
  function salvarCarrinho() {
    gravar('sa_cart_v2', estado.carrinho);
    estado.cotacao = null;
    atualizarBadge();
  }
  function unidadesCarrinho() { return estado.carrinho.reduce(function (s, i) { return s + i.qty; }, 0); }
  function atualizarBadge() {
    var b = document.getElementById('carrinho-badge');
    var n = unidadesCarrinho();
    if (b) b.textContent = n ? String(n) : '';
  }
  function adicionarAoCarrinho(p, v, ficar) {
    var atual = estado.carrinho.find(function (i) { return i.sku === v.sku; });
    var novaQtd = (atual ? atual.qty : 0) + 1;
    if (v.estoque != null && novaQtd > v.estoque) { toast('Só temos ' + v.estoque + ' unidade' + (v.estoque === 1 ? '' : 's') + ' dessa cor em estoque.'); return; }
    if (unidadesCarrinho() + 1 > (estado.regras.max_unidades || 20)) { toast('Máximo de ' + estado.regras.max_unidades + ' unidades por pedido.'); return; }
    if (atual) atual.qty = novaQtd;
    else estado.carrinho.push({ sku: v.sku, qty: 1, codigo: p.codigo, nome: p.nome, cor: v.cor, preco: v.preco, imagem: v.imagem || p.imagem });
    salvarCarrinho();
    track('add_to_cart', { value: v.preco, items: [itemGA(p, v, 1)] });
    if (ficar) toast('Adicionado ao carrinho. <a href="/carrinho" data-link>Ver carrinho →</a>', 4000);
    else navegar('/carrinho');
  }
  function alterarQtd(sku, delta) {
    var i = estado.carrinho.findIndex(function (x) { return x.sku === sku; });
    if (i < 0) return;
    estado.carrinho[i].qty += delta;
    if (estado.carrinho[i].qty <= 0) estado.carrinho.splice(i, 1);
    salvarCarrinho();
  }
  function removerDoCarrinho(sku) {
    estado.carrinho = estado.carrinho.filter(function (x) { return x.sku !== sku; });
    salvarCarrinho();
  }
  function itensPedido() { return estado.carrinho.map(function (i) { return { sku: i.sku, qty: i.qty }; }); }

  // `cliente` ({ cpf, email, telefone }) só no checkout: com CPF válido o servidor
  // confere o desconto de 1ª compra e já devolve o total com ele.
  function cotar(cep, cliente) {
    var body = { itens: itensPedido(), frete: estado.freteOpcao };
    var cepLimpo = digitos(cep);
    if (cepLimpo.length === 8) body.cep = cepLimpo;
    if (cliente && cpfValido(cliente.cpf)) body.cliente = cliente;
    return fetch(CONFIG.api + '/api/cotar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, dados: d }; }); })
      .catch(function (e) { if (e && /fetch|network|json/i.test(String(e.message))) throw new Error('Não foi possível calcular o pedido agora. Confira sua conexão e tente de novo.'); throw e; })
      .then(function (res) {
        if (!res.ok) throw new Error(res.dados && res.dados.erro ? res.dados.erro : 'Não foi possível calcular o pedido agora.');
        estado.cotacao = res.dados;
        estado.cotacaoErro = '';
        if (res.dados.regras) estado.regras = Object.assign(estado.regras, res.dados.regras);
        // A opção pedida pode não existir pro CEP (ex.: Expresso onde não há
        // entrega rápida): o servidor volta pra Econômico e a UI acompanha.
        if (res.dados.resumo && res.dados.resumo.frete_opcao) estado.freteOpcao = res.dados.resumo.frete_opcao;
        return res.dados;
      });
  }

  // Cards "Econômico / Expresso" — só aparecem quando há 2 opções pro CEP.
  // A transportadora não é exibida (regra do Felipe): só título, prazo e preço.
  function seletorFreteHtml(r) {
    if (!r || !r.frete_opcoes || r.frete_opcoes.length < 2) return '';
    return '<div class="frete-opcoes" role="group" aria-label="Forma de entrega">' + r.frete_opcoes.map(function (o) {
      var ativo = o.codigo === r.frete_opcao;
      return '<button type="button" class="frete-opcao' + (ativo ? ' ativo' : '') + '" data-action="frete" data-frete="' + h(o.codigo) + '" aria-pressed="' + (ativo ? 'true' : 'false') + '">' +
        '<span class="frete-tit">' + h(o.titulo) + '</span>' +
        '<span class="frete-prazo">' + h(o.prazo) + '</span>' +
        '<span class="frete-preco">' + (o.preco === 0 ? 'grátis' : h(fmt(o.preco))) + '</span>' +
        '</button>';
    }).join('') + '</div>';
  }

  // ---------------------------------------------------------------------------
  // Desconto de 1ª compra
  // ---------------------------------------------------------------------------
  // Sem cadastro: quem decide é o servidor, pelo CPF/e-mail/telefone do checkout.
  // Aqui só o aviso: aparece uma vez, no 2º modelo aberto (sinal de interesse),
  // e some pra sempre depois que o navegador fecha uma compra.
  var POPUP_1A = { desktop: '/popup-1a-compra-desktop.webp', mobile: '/popup-1a-compra-mobile.webp', modelosAteAviso: 2 };
  function pct1a() { return Number(estado.regras.primeira_compra_pct) || 0; }
  function jaComprou() { return !!ler('sa_ja_comprou', false); }
  function oferta1aAtiva() { return pct1a() > 0 && !jaComprou(); }
  function imagemPopup1a() { return window.matchMedia('(min-width: 820px)').matches ? POPUP_1A.desktop : POPUP_1A.mobile; }
  function registrarModeloVisto(codigo) {
    var vistos = ler('sa_vistos', []);
    if (vistos.indexOf(codigo) < 0) { vistos.push(codigo); gravar('sa_vistos', vistos.slice(-30)); }
    if (!oferta1aAtiva() || ler('sa_popup_1a', null)) return;
    // Baixa a arte já no 1º modelo, pra ela estar pronta quando o aviso abrir.
    if (vistos.length >= POPUP_1A.modelosAteAviso - 1) new Image().src = imagemPopup1a();
    if (vistos.length >= POPUP_1A.modelosAteAviso) estado.timers.push(setTimeout(abrirPopup1a, 1500));
  }
  function abrirPopup1a() {
    if (document.getElementById('popup-1a')) return;
    gravar('sa_popup_1a', Date.now());
    var el = document.createElement('div');
    el.id = 'popup-1a';
    el.className = 'popup-1a';
    el.innerHTML = '<div class="popup-1a-caixa" role="dialog" aria-modal="true" aria-labelledby="popup-1a-titulo">' +
      '<button type="button" class="popup-1a-fechar" data-action="fechar-1a" aria-label="Fechar">×</button>' +
      '<picture class="popup-1a-arte"><source media="(min-width: 820px)" srcset="' + POPUP_1A.desktop + '"><img src="' + POPUP_1A.mobile + '" alt="Só Armação: ' + pct1a() + '% off na primeira compra" width="1080" height="810"></picture>' +
      '<div class="popup-1a-texto">' +
        '<h2 class="display" id="popup-1a-titulo">' + pct1a() + '% off na sua 1ª compra</h2>' +
        '<p>Já vai aplicado no checkout: sem cupom e sem cadastro. Vale pra quem ainda não comprou com a gente e soma com o -' + estado.regras.leve2_pct + '% da 2ª armação.</p>' +
        '<button type="button" class="btn btn-laranja btn-bloco" data-action="fechar-1a">Bora escolher</button>' +
      '</div></div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('aberto'); });
    var btn = el.querySelector('.btn'); if (btn) btn.focus();
    track('primeira_compra_aviso', {});
  }
  function fecharPopup1a() {
    var el = document.getElementById('popup-1a');
    if (!el) return;
    el.classList.remove('aberto');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 250);
  }
  // Abaixo do total (carrinho e checkout): quanto o pedido fica na 1ª compra, antes
  // do CPF. O valor vem do servidor (resumo.previa_primeira), igual ao que será
  // cobrado depois de confirmado. `d` é a resposta inteira do /api/cotar.
  function nota1aHtml(d, noCheckout) {
    if (!oferta1aAtiva() || !d || !d.resumo) return '';
    var pc = d.primeira_compra || {}, pv = d.resumo.previa_primeira;
    if (d.resumo.desconto_primeira > 0) return '';
    if (pc.verificado && pc.ja_comprou) return '<p class="nota-1a volta">Você já é cliente Só Armação 💚 O desconto de 1ª compra vale só no primeiro pedido.</p>';
    if (pc.verificado && pc.elegivel === false) return '<p class="nota-1a neutra">O desconto de 1ª compra não se aplica a este pedido.</p>';
    if (!pv) return '';
    return '<div class="previa-1a"><span>Na 1ª compra, seu total fica</span><strong>' + h(fmt(pv.total)) + '</strong>' +
      '<small>-' + pv.pct + '% (' + h(fmt(pv.desconto)) + ') · ' + (noCheckout ? 'ativa ao preencher o CPF' : 'ativa ao informar o CPF no checkout') + '</small></div>';
  }
  // Balão preso ao campo de CPF no checkout: diz o que ativa o desconto e confirma quando ativou.
  function bolha1aHtml(d) {
    if (!oferta1aAtiva()) return '';
    var r = d && d.resumo, pc = (d && d.primeira_compra) || {};
    if (r && r.desconto_primeira > 0) return '<div class="bolha-1a ok" role="status">✓ Desconto de 1ª compra ativado: -' + h(fmt(r.desconto_primeira)) + '</div>';
    // Já comprou (por CPF, e-mail ou WhatsApp): boas-vindas de volta, sem cara de recusa.
    if (pc.verificado && pc.ja_comprou) return '<div class="bolha-1a volta" role="status">💚 Que bom te ver de novo! Você já comprou com a gente, então o desconto de 1ª compra já foi usado' +
      (estado.regras.leve2_pct ? ' — mas a 2ª armação continua saindo com -' + estado.regras.leve2_pct + '%.' : '.') + '</div>';
    if (pc.verificado && pc.elegivel === false) return '';
    return '<div class="bolha-1a" role="status"><span class="bolha-tag">-' + pct1a() + '%</span> Preencha seu CPF para ativar o desconto de 1ª compra</div>';
  }

  // ---------------------------------------------------------------------------
  // Roteamento
  // ---------------------------------------------------------------------------
  function navegar(caminho, substituir) {
    if (substituir) history.replaceState({}, '', caminho); else history.pushState({}, '', caminho);
    rotear();
  }
  function query() {
    var q = {};
    new URLSearchParams(location.search).forEach(function (v, k) { q[k] = v; });
    return q;
  }
  // `empilhar`: cria entrada no histórico (o "voltar" do navegador volta a página da vitrine).
  function setQuery(obj, empilhar) {
    var u = new URL(location.href);
    Object.keys(obj).forEach(function (k) { if (obj[k]) u.searchParams.set(k, obj[k]); else u.searchParams.delete(k); });
    // Mudou filtro/ordem/busca: volta pra página 1 da vitrine.
    if (Object.keys(obj).some(function (k) { return k !== 'pagina'; })) u.searchParams.delete('pagina');
    history[empilhar ? 'pushState' : 'replaceState']({}, '', u.pathname + (u.search || ''));
  }
  var rotas = [
    { re: /^\/$/, view: viewHome, nav: 'home' },
    { re: /^\/modelos\/?$/, view: viewModelos, nav: 'modelos' },
    { re: /^\/p\/([^/]+)\/?$/, view: viewProduto, nav: 'modelos' },
    { re: /^\/carrinho\/?$/, view: viewCarrinho, nav: 'carrinho' },
    { re: /^\/checkout\/?$/, view: viewCheckout, nav: 'carrinho' },
    { re: /^\/pix\/?$/, view: viewPix, nav: 'carrinho' },
    { re: /^\/confirmacao\/?$/, view: viewConfirmacao, nav: 'carrinho' },
    { re: /^\/ajuda\/?$/, view: viewAjuda, nav: 'ajuda' },
    { re: /^\/garantia\/?$/, view: function () { navegar('/trocas-e-devolucoes', true); }, nav: 'ajuda' },
    { re: /^\/avaliar\/([A-Za-z0-9_-]{20,64})\/?$/, view: viewAvaliar, nav: 'modelos', semCatalogo: true },
    { re: /^\/entrar\/?$/, view: viewEntrar, nav: 'conta' },
    { re: /^\/conta\/confirmar\/?$/, view: viewConfirmarConta, nav: 'conta' },
    { re: /^\/conta(?:\/(compras|favoritos|avaliacoes|pagamentos|atendimentos))?(?:\/(SA-[A-Z0-9]+-[A-Z0-9]{4}|\d{1,9}))?\/?$/, view: viewConta, nav: 'conta' },
    { re: /^\/atendimento\/([A-Za-z0-9_-]{20,128})\/?$/, view: viewAtendimento, nav: 'ajuda', semCatalogo: true },
    { re: /^\/(quem-somos|como-comprar|entrega|pagamento|trocas-e-devolucoes|privacidade|termos|contato)\/?$/, view: viewInstitucional, nav: 'ajuda' }
  ];
  var geracao = 0; // muda a cada rota: resposta atrasada de uma tela antiga não sobrescreve a atual
  function rotear() {
    limparTimers();
    geracao++;
    app.oninput = app.onchange = app.onsubmit = null;
    estado.aoSairDoCampo = null;
    var caminho = location.pathname.replace(/\/{2,}/g, '/');
    if (caminho.length > 1 && /\/$/.test(caminho) && !/^\/p\//.test(caminho)) caminho = caminho.replace(/\/$/, '');
    var rota = null, m = null;
    for (var i = 0; i < rotas.length; i++) { m = caminho.match(rotas[i].re); if (m) { rota = rotas[i]; break; } }
    document.querySelectorAll('.nav a[data-nav]').forEach(function (a) { a.classList.toggle('ativo', !!rota && a.getAttribute('data-nav') === rota.nav); });
    jsonLd(null);
    naoIndexar(!rota || rota.nav === 'carrinho' || rota.nav === 'conta');
    window.scrollTo(0, 0);
    if (!rota) { titulo('Página não encontrada'); app.innerHTML = '<div class="container institucional"><h1 class="display">Essa página não existe.</h1><p>O endereço pode ter mudado. <a href="/modelos" data-link>Ver todos os modelos →</a></p></div>'; track('page_view', { page: '404' }); return; }
    var precisaCatalogo = rota.nav !== 'ajuda' || !estado.catalogo;
    if (precisaCatalogo && !estado.catalogo) {
      app.innerHTML = '<div class="carregando"><span class="spinner"></span> Carregando o catálogo…</div>';
      carregarCatalogo().then(function () { rota.view(m); track('page_view', { page: rota.nav }); renovarSeVelho(); }).catch(function (e) {
        console.error(e);
        app.innerHTML = '<div class="container institucional"><h1 class="display">Catálogo indisponível</h1><p>Não conseguimos carregar os modelos agora. <button class="link" data-action="recarregar">Tentar de novo</button></p></div>';
      });
      return;
    }
    rota.view(m);
    track('page_view', { page: rota.nav });
    renovarSeVelho();
  }
  // renova o catálogo em silêncio se estiver velho
  function renovarSeVelho() {
    var cache = ler('sa_catalogo', null);
    if (cache && Date.now() - cache.ts > CONFIG.cacheCatalogoMs) carregarCatalogo(true).catch(function () {});
  }

  // ---------------------------------------------------------------------------
  // Componentes
  // ---------------------------------------------------------------------------
  function cardProduto(p) {
    var tipoFiltro = (query().tipo || '');
    var vs = (p.variacoes || []).slice();
    // Filtrando por sol/grau, o card mostra a cor daquele tipo (ex.: a lente marrom, não a cristal).
    if (tipoFiltro && vs.some(function (v) { return v.tipo === tipoFiltro; })) vs = vs.filter(function (v) { return v.tipo === tipoFiltro; });
    var v0 = vs.find(function (v) { return v.estoque > 0; }) || vs[0] || {};
    var esgotado = !(p.estoque_total > 0);
    var baixo = !esgotado && p.estoque_total <= 5;
    var img = foto(tipoFiltro ? (v0.imagem || p.imagem) : (p.imagem || v0.imagem));
    var preco = tipoFiltro && v0.preco ? v0.preco : p.preco;
    var url = tipoFiltro && v0.url ? v0.url : (p.url || '/p/' + p.codigo + '/');
    var cores = (p.cores || []).length;
    var tipo = tipoFiltro ? TIPOS[tipoFiltro] : (p.tipo && p.tipo !== 'grau' ? TIPOS[p.tipo] : '');
    return '<a class="card" href="' + h(url) + '" data-link data-codigo="' + h(p.codigo) + '">' +
      (esgotado ? '<span class="badge esgotado">Esgotado</span>' : baixo ? '<span class="badge">' + rotuloEstoque(p.estoque_total) + '</span>' : '') +
      '<div class="card-foto' + (img ? '' : ' sem-foto') + '">' + (img ? '<img src="' + h(img) + '" alt="' + h(p.nome) + '" loading="lazy" width="400" height="400">' : 'foto em breve') + '</div>' +
      '<div class="card-info">' +
        '<span class="card-linha">' + h(p.formato || 'Armação') + (tipo ? ' · ' + h(tipo) : '') + '</span>' +
        '<span class="card-nome">' + h(p.nome) + '</span>' +
        (cores > 1 ? '<span class="card-cores">' + cores + ' cores</span>' : '') +
        '<span class="card-preco"><span class="valor">' + h(fmt(preco)) + '</span><span class="no-pix">no Pix</span></span>' +
        '<span class="card-segunda">a 2ª sai por ' + h(fmt(precoSegunda(preco))) + '</span>' +
      '</div></a>';
  }

  // Vitrine: um card por COR. Os filtros valem pro modelo (gênero, formato...) e, dentro
  // do modelo, a cor escolhida e o tipo (sol/grau) escolhem quais cores entram.
  function coresNaVitrine(p, q) {
    var vs = (p.variacoes || []).slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    if (q.cor) vs = vs.filter(function (v) { return (v.cor_slug || slug(v.cor)) === q.cor; });
    if (q.tipo && vs.some(function (v) { return v.tipo === q.tipo; })) vs = vs.filter(function (v) { return v.tipo === q.tipo; });
    return vs.map(function (v) { return { p: p, v: v }; });
  }
  function cardCor(item) {
    var p = item.p, v = item.v;
    var esgotado = !(v.estoque > 0);
    var baixo = !esgotado && v.estoque <= 5;
    var img = foto(v.imagem || (v.imagens || [])[0] || p.imagem);
    var tipo = v.tipo && v.tipo !== 'grau' ? TIPOS[v.tipo] : '';
    var alt = p.nome + (v.cor ? ' — ' + v.cor : '');
    return '<a class="card" href="' + h(v.url || p.url) + '" data-link data-codigo="' + h(p.codigo) + '" data-sku="' + h(v.sku) + '">' +
      (esgotado ? '<span class="badge esgotado">Esgotado</span>' : baixo ? '<span class="badge">' + rotuloEstoque(v.estoque) + '</span>' : '') +
      '<div class="card-foto' + (img ? '' : ' sem-foto') + '">' + (img ? '<img src="' + h(img) + '" alt="' + h(alt) + '" loading="lazy" width="400" height="400">' : 'foto em breve') + '</div>' +
      '<div class="card-info">' +
        '<span class="card-linha">' + h(p.formato || 'Armação') + (tipo ? ' · ' + h(tipo) : '') + '</span>' +
        '<span class="card-nome">' + h(p.nome) + '</span>' +
        notaCardHtml(p) +
        (v.cor ? '<span class="card-cores">' + h(v.cor) + '</span>' : '') +
        '<span class="card-preco"><span class="valor">' + h(fmt(v.preco)) + '</span><span class="no-pix">no Pix</span></span>' +
        '<span class="card-segunda">a 2ª sai por ' + h(fmt(precoSegunda(v.preco))) + '</span>' +
      '</div></a>';
  }

  // ---------------------------------------------------------------------------
  // Avaliações (só compradores; moderadas; agrupadas por modelo, com a cor comprada)
  // ---------------------------------------------------------------------------
  function estrelas(nota) {
    var n = Math.round(Number(nota) || 0);
    return '<span class="estrelas" aria-hidden="true">' + '★★★★★'.slice(0, n) + '<span class="apagada">' + '★★★★★'.slice(n) + '</span></span>';
  }
  function notaFmt(m) { return String(m).replace('.', ','); }
  // Nos cards, a nota só aparece com volume mínimo (menos que isso não diz muito).
  function notaCardHtml(p) {
    var a = p.avaliacao;
    if (!a || a.total < 3) return '';
    return '<span class="card-nota" aria-label="Nota ' + notaFmt(a.media) + ' de 5, ' + a.total + ' avaliações">' + estrelas(a.media) + ' ' + notaFmt(a.media) + ' <small>(' + a.total + ')</small></span>';
  }
  function carregarAvaliacoes(p) {
    var g = geracao;
    fetch(CONFIG.api + '/api/avaliacoes?modelo=' + encodeURIComponent(p.codigo))
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (d) {
        var el = document.getElementById('avaliacoes');
        if (g !== geracao || !el) return;
        var lista = (d && d.avaliacoes) || [];
        el.innerHTML = '<div class="secao-titulo"><h2 class="display">Avaliações</h2>' +
          (lista.length ? '<span class="aval-resumo">' + estrelas(d.media) + ' <strong>' + notaFmt(d.media) + '</strong> de 5 · ' + d.total + ' avaliaç' + (d.total === 1 ? 'ão' : 'ões') + ' de compra verificada</span>' : '') + '</div>' +
          (lista.length ? '<div class="aval-lista">' + lista.map(function (a) {
            return '<article class="aval">' +
              '<div class="aval-topo">' + estrelas(a.nota) + '<span class="aval-quem">' + h(a.nome) + ' <span class="selo-verificada">✓ compra verificada</span></span></div>' +
              (a.cor ? '<div class="aval-cor">Cor: ' + h(a.cor) + '</div>' : '') +
              '<p>' + h(a.texto).replace(/\n/g, '<br>') + '</p>' +
              (a.midias && a.midias.length ? '<div class="aval-midias">' + a.midias.map(function (m) {
                return m.tipo === 'video'
                  ? '<video src="' + h(m.url) + '" controls preload="metadata" playsinline></video>'
                  : '<a href="' + h(m.url) + '" target="_blank" rel="noopener"><img src="' + h(m.url) + '" alt="Foto enviada por ' + h(a.nome) + '" loading="lazy"></a>';
              }).join('') + '</div>' : '') +
              '<div class="aval-data">' + h(a.data.split('-').reverse().join('/')) + '</div></article>';
          }).join('') + '</div>' : '<p class="aval-vazio">Ainda sem avaliações deste modelo. Quem compra recebe um link para avaliar depois da entrega.</p>');
      });
  }

  function viewAvaliar(m) {
    titulo('Avaliar compra');
    naoIndexar(true);
    var token = m[1];
    var g = geracao;
    var midias = [];   // { caminho, tipo, nome, pronto }
    app.innerHTML = '<div class="container"><div class="carregando"><span class="spinner"></span> Carregando…</div></div>';
    fetch(CONFIG.api + '/api/avaliacoes?convite=' + encodeURIComponent(token))
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .catch(function () { return { ok: false, d: { erro: 'Não foi possível abrir agora. Tente de novo em instantes.' } }; })
      .then(function (res) {
        if (g !== geracao) return;
        if (!res.ok) { app.innerHTML = '<div class="container confirmacao"><h1 class="display">Ops.</h1><p>' + h(res.d.erro || 'Link inválido.') + '</p><a class="btn btn-laranja" href="/modelos" data-link>Ver modelos</a></div>'; return; }
        var c = res.d, L = c.limites || { fotos: 5, videos: 1, textoMin: 20, textoMax: 2000 };
        app.innerHTML = '<div class="container avaliar">' +
          '<h1 class="display">Como foi a sua compra?</h1>' +
          '<div class="avaliar-produto">' + (c.imagem ? '<img src="' + h(foto(c.imagem)) + '" alt="">' : '') + '<div><strong>' + h(c.nome_modelo || 'Sua armação') + '</strong>' + (c.cor ? '<span>' + h(c.cor) + '</span>' : '') + '</div></div>' +
          '<form class="form-grid painel" data-action="avaliar" novalidate>' +
            '<div class="campo"><span class="rotulo-nota" id="rotulo-nota">Sua nota</span><div class="nota-escolha" role="radiogroup" aria-labelledby="rotulo-nota">' + [5, 4, 3, 2, 1].map(function (n) { return '<input type="radio" id="nota' + n + '" name="nota" value="' + n + '"><label for="nota' + n + '" title="' + n + ' de 5" aria-label="' + n + ' de 5">★</label>'; }).join('') + '</div></div>' +
            '<div class="campo"><label for="av-texto">Conte como foi (mínimo ' + L.textoMin + ' caracteres)</label><textarea id="av-texto" name="texto" rows="5" maxlength="' + L.textoMax + '" placeholder="Acabamento, conforto, se ficou bem no rosto, entrega…"></textarea><span class="ajuda" id="av-contador">0 / ' + L.textoMin + '</span></div>' +
            '<div class="campo"><label for="av-nome">Como quer aparecer</label><input id="av-nome" name="nome" maxlength="40" placeholder="Ex.: Maria S." autocomplete="off"><span class="ajuda">Use o primeiro nome e a inicial do sobrenome.</span></div>' +
            '<div class="campo"><label for="av-arquivos">Fotos e vídeo (opcional)</label><input id="av-arquivos" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple><span class="ajuda">Até ' + L.fotos + ' fotos (10 MB cada) e ' + L.videos + ' vídeo (50 MB). Mostre a armação no rosto!</span><div class="av-previas" id="av-previas"></div></div>' +
            '<div class="isca" aria-hidden="true"><label>Site <input name="site" tabindex="-1" autocomplete="off"></label></div>' +
            '<label class="aceite"><input type="checkbox" name="aceite"> Autorizo a Só Armação a exibir na loja o nome, o texto e as fotos/vídeo desta avaliação.</label>' +
            '<div id="av-aviso"></div>' +
            '<button class="btn btn-laranja btn-bloco" type="submit">Enviar avaliação</button>' +
          '</form></div>';

        var form = app.querySelector('form[data-action="avaliar"]');
        var aviso = document.getElementById('av-aviso');
        var avisar = function (txt, tipo) { aviso.innerHTML = txt ? '<div class="aviso ' + (tipo || 'erro') + '">' + h(txt) + '</div>' : ''; };
        form.querySelector('#av-texto').addEventListener('input', function (e) { document.getElementById('av-contador').textContent = e.target.value.trim().length + ' / ' + L.textoMin; });

        form.querySelector('#av-arquivos').addEventListener('change', function (e) {
          Array.prototype.forEach.call(e.target.files, function (arq) {
            var video = /^video\//.test(arq.type);
            var qtd = midias.filter(function (x) { return (x.tipo === 'video') === video; }).length;
            if (video ? qtd >= L.videos : qtd >= L.fotos) { avisar(video ? 'Só 1 vídeo por avaliação.' : 'No máximo ' + L.fotos + ' fotos.'); return; }
            if (arq.size > (video ? 50 : 10) * 1024 * 1024) { avisar(arq.name + ': arquivo grande demais.'); return; }
            var item = { nome: arq.name, tipo: video ? 'video' : 'foto', pronto: false, local: URL.createObjectURL(arq) };
            midias.push(item); desenharPrevias();
            fetch(CONFIG.api + '/api/avaliacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'upload', token: token, arquivo: arq.name }) })
              .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'Falha no envio.'); return d; }); })
              .then(function (d) { return fetch(d.url, { method: 'PUT', headers: { 'Content-Type': arq.type || d.contentType }, body: arq }).then(function (r) { if (!r.ok) throw new Error('Falha ao enviar ' + arq.name + '.'); item.caminho = d.caminho; item.pronto = true; }); })
              .catch(function (err) { item.erro = true; avisar(err.message); })
              .then(desenharPrevias);
          });
          e.target.value = '';
        });
        function desenharPrevias() {
          var box = document.getElementById('av-previas');
          if (!box) return;
          box.innerHTML = midias.map(function (x, i) {
            return '<div class="av-previa' + (x.erro ? ' erro' : x.pronto ? '' : ' subindo') + '">' + (x.tipo === 'video' ? '<video src="' + x.local + '" muted playsinline></video>' : '<img src="' + x.local + '" alt="">') +
              '<button type="button" data-remover="' + i + '" aria-label="Remover">×</button>' + (x.pronto || x.erro ? '' : '<span>enviando…</span>') + '</div>';
          }).join('');
        }
        document.getElementById('av-previas').addEventListener('click', function (e) {
          var b = e.target.closest('[data-remover]'); if (!b) return;
          midias.splice(Number(b.dataset.remover), 1); desenharPrevias();
        });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var fd = new FormData(form);
          var corpo = { acao: 'enviar', token: token, nota: Number(fd.get('nota')), texto: String(fd.get('texto') || ''), nome: String(fd.get('nome') || ''), aceite: !!fd.get('aceite'), site: String(fd.get('site') || ''),
            midias: midias.filter(function (x) { return x.pronto; }).map(function (x) { return x.caminho; }) };
          if (!corpo.nota) return avisar('Escolha uma nota de 1 a 5 estrelas.');
          if (corpo.texto.trim().length < L.textoMin) return avisar('Conte um pouco mais (mínimo de ' + L.textoMin + ' caracteres).');
          if (corpo.nome.trim().length < 2) return avisar('Informe como quer aparecer.');
          if (!corpo.aceite) return avisar('Marque a autorização para podermos publicar.');
          if (midias.some(function (x) { return !x.pronto && !x.erro; })) return avisar('Espere os arquivos terminarem de enviar.');
          var btn = form.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = 'Enviando…';
          fetch(CONFIG.api + '/api/avaliacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
            .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.erro || 'Não foi possível enviar.'); }); })
            .then(function () {
              track('avaliacao_enviada', { nota: corpo.nota, midias: corpo.midias.length });
              app.innerHTML = '<div class="container confirmacao"><div class="selo-ok">✓</div><h1 class="display">Valeu pela avaliação!</h1><p>Ela passa por uma revisão rápida e logo aparece na página do modelo.</p><a class="btn btn-laranja" href="/modelos" data-link>Ver mais modelos</a></div>';
            })
            .catch(function (err) { btn.disabled = false; btn.textContent = 'Enviar avaliação'; avisar(err.message); });
        });
      });
  }

  var ORDENACOES = { destaque: 'Destaques', 'menor-preco': 'Menor preço', 'maior-preco': 'Maior preço', 'a-z': 'Nome (A–Z)', novidades: 'Novidades' };
  var ATRIBUTOS = [
    { chave: 'tipo', rotulo: 'Tipo' }, { chave: 'formato', rotulo: 'Formato' }, { chave: 'cor', rotulo: 'Cor' }, { chave: 'genero', rotulo: 'Gênero' },
    { chave: 'material', rotulo: 'Material' }, { chave: 'ocasiao', rotulo: 'Ocasião' }, { chave: 'tom_pele', rotulo: 'Tom de pele' }
  ];
  function filtrar(produtos, q) {
    var lista = produtos.slice();
    ATRIBUTOS.forEach(function (a) {
      var val = q[a.chave];
      if (!val) return;
      lista = lista.filter(function (p) {
        if (a.chave === 'cor') return (p.variacoes || []).some(function (v) { return (v.cor_slug || slug(v.cor)) === val; });
        if (a.chave === 'tipo') return (p.tipos || [p.tipo]).indexOf(val) >= 0;
        // Armação unissex serve nos dois públicos: Feminino e Masculino também listam os Unissex.
        // Sem gênero cadastrado no Bling: aparece em todos (melhor que sumir de todos os filtros).
        if (a.chave === 'genero') { var g = slug(p.genero); return !g || g === val || (g === 'unissex' && (val === 'feminino' || val === 'masculino')); }
        return slug(p[a.chave]) === val;
      });
    });
    if (q.q) {
      var termo = slug(q.q);
      lista = lista.filter(function (p) { return slug(p.nome + ' ' + p.codigo + ' ' + p.formato + ' ' + (p.cores || []).join(' ')).indexOf(termo) >= 0; });
    }
    var ordem = q.ordem || 'destaque';
    var comp = {
      destaque: function (a, b) { return ((b.estoque_total > 0) - (a.estoque_total > 0)) || (a.preco - b.preco) || a.nome.localeCompare(b.nome); },
      'menor-preco': function (a, b) { return a.preco - b.preco; },
      'maior-preco': function (a, b) { return b.preco - a.preco; },
      'a-z': function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); },
      novidades: function (a, b) { return String(b.criado_em).localeCompare(String(a.criado_em)); }
    }[ordem] || null;
    if (comp) lista.sort(comp);
    return lista;
  }
  function linhaChips(chave, rotulo, opcoes, q, todos) {
    if (!(opcoes || []).length) return '';
    return '<div class="chips-linha"><span class="chips-rotulo">' + h(rotulo) + '</span><div class="chips" role="tablist">' +
      '<button class="chip' + (!q[chave] ? ' ativo' : '') + '" data-action="filtro" data-chave="' + chave + '" data-valor="">' + h(todos) + '</button>' +
      opcoes.map(function (o) {
        return '<button class="chip' + (q[chave] === o.slug ? ' ativo' : '') + '" data-action="filtro" data-chave="' + chave + '" data-valor="' + h(o.slug) + '">' + h(o.valor) + '</button>';
      }).join('') + '</div></div>';
  }
  function blocoFiltros(q, total) {
    var f = estado.catalogo.facetas || {};
    // Gênero e formato são os filtros principais: ficam como botões, sempre à vista.
    var ordemGenero = { feminino: 1, masculino: 2, unissex: 3 };
    var generos = (f.genero || []).slice().sort(function (a, b) { return (ordemGenero[a.slug] || 9) - (ordemGenero[b.slug] || 9); });
    var tipos = (f.tipo || []).length ? f.tipo : [{ valor: 'De grau', slug: 'grau' }, { valor: 'De sol', slug: 'sol' }];
    var chips = linhaChips('tipo', 'Tipo', tipos, q, 'Todos') + linhaChips('genero', 'Para quem', generos, q, 'Todos') + linhaChips('formato', 'Formato', f.formato || [], q, 'Todos');
    var selects = ATRIBUTOS.filter(function (a) { return a.chave !== 'formato' && a.chave !== 'genero' && a.chave !== 'tipo' && (f[a.chave] || []).length; }).map(function (a) {
      return '<label>' + h(a.rotulo) + '<select data-action="filtro" data-chave="' + a.chave + '"><option value="">Todas</option>' +
        (f[a.chave] || []).map(function (o) { return '<option value="' + h(o.slug) + '"' + (q[a.chave] === o.slug ? ' selected' : '') + '>' + h(o.valor) + ' (' + o.total + ')</option>'; }).join('') +
        '</select></label>';
    }).join('');
    selects += '<label>Ordenar<select data-action="filtro" data-chave="ordem">' +
      Object.keys(ORDENACOES).map(function (k) { return '<option value="' + k + '"' + ((q.ordem || 'destaque') === k ? ' selected' : '') + '>' + ORDENACOES[k] + '</option>'; }).join('') + '</select></label>';
    var ativos = ATRIBUTOS.some(function (a) { return q[a.chave]; }) || q.q;
    return '<div class="filtros">' + chips + '<div class="selects">' + selects + '</div>' +
      (ativos ? '<button class="link filtros-limpar" data-action="limpar-filtros">Limpar filtros</button>' : '') + '</div>';
  }
  function gradeProdutos(q) {
    var modelos = filtrar(estado.catalogo.produtos || [], q);
    var itens = [];
    modelos.forEach(function (p) { itens = itens.concat(coresNaVitrine(p, q)); });
    // Mesma ordem dos modelos; dentro dela, cor esgotada vai pro fim da vitrine.
    var pos = itens.map(function (_, i) { return i; });
    pos.sort(function (a, b) { return ((itens[b].v.estoque > 0) - (itens[a].v.estoque > 0)) || (a - b); });
    itens = pos.map(function (i) { return itens[i]; });
    var rotulo = modelos.length + ' modelo' + (modelos.length === 1 ? '' : 's') + (itens.length !== modelos.length ? ' · ' + itens.length + ' cores' : '');
    // Paginação: VITRINE_POR_PAGINA cards por página, página atual na URL (?pagina=2).
    var paginas = Math.max(1, Math.ceil(itens.length / VITRINE_POR_PAGINA));
    var pagina = Math.min(Math.max(parseInt(q.pagina, 10) || 1, 1), paginas);
    var daPagina = itens.slice((pagina - 1) * VITRINE_POR_PAGINA, pagina * VITRINE_POR_PAGINA);
    return { html: '<div class="grade">' + (daPagina.length ? daPagina.map(cardCor).join('') : '<p class="vazio">Nenhum modelo com esses filtros. <button class="link" data-action="limpar-filtros">Limpar filtros</button></p>') + '</div>' + paginacaoHtml(pagina, paginas), total: modelos.length, rotulo: rotulo };
  }
  var VITRINE_POR_PAGINA = 20;
  function paginacaoHtml(pagina, paginas) {
    if (paginas <= 1) return '';
    var botao = function (n, rotulo, classe, aria) {
      var fora = n < 1 || n > paginas;
      return '<button type="button" class="btn ' + classe + '" data-action="pagina" data-pagina="' + n + '"' + (fora ? ' disabled' : '') + ' aria-label="' + aria + '">' + rotulo + '</button>';
    };
    return '<nav class="paginacao" aria-label="Páginas da vitrine">' +
      botao(pagina - 1, '← Anterior', 'btn-contorno', 'Página anterior') +
      '<span class="pagina-atual" aria-current="page">Página <strong>' + pagina + '</strong> de <strong>' + paginas + '</strong></span>' +
      botao(pagina + 1, 'Próxima →', 'btn-verde', 'Próxima página') +
      '</nav>';
  }

  // ---------------------------------------------------------------------------
  // Páginas
  // ---------------------------------------------------------------------------
  function viewHome() {
    titulo('');
    var q = query();
    var grade = gradeProdutos(q);
    var l2 = estado.regras.leve2_pct;
    app.innerHTML =
      '<section class="hero"><div class="container">' +
        '<div class="hero-texto">' +
          '<h1 class="display"><span>Chega de</span><span>pagar caro.</span></h1>' +
          '<div class="etiqueta"><small>A partir de</small><strong>' + h(fmt(estado.precoMinimo || 49)).replace(',', '<sup>,') + '</sup></strong></div>' +
          '<ul><li>Pix aprovado na hora</li><li>Troca grátis em até 7 dias úteis</li><li>A 2ª sai com -' + l2 + '%</li></ul>' +
          '<a class="btn btn-laranja" href="/modelos" data-link>Só vem →</a>' +
          '<p class="tagline">Ninguém faz melhor por menos.</p>' +
        '</div>' +
        '<div class="hero-selo">Só<br>vem.</div>' +
        '<div class="hero-foto"><picture><source media="(min-width: 1024px)" srcset="/hero-desktop.webp" width="1278" height="1230"><img src="/hero.webp" alt="" width="640" height="1136" fetchpriority="high"></picture></div>' +
      '</div></section>' +
      '<div class="fita"></div>' +
      '<section class="beneficios"><div class="container">' +
        beneficio('qualidade', 'A melhor qualidade') + beneficio('preco', 'O menor preço') + beneficio('online', '100% online, 0% vitrine') + beneficio('troca', 'Troca grátis em até 7 dias úteis') +
      '</div></section>' +
      '<section class="secao" id="modelos"><div class="container">' +
        '<div class="secao-titulo"><h2 class="display">Todos os modelos</h2><span class="contagem" id="contagem">' + h(grade.rotulo) + '</span></div>' +
        blocoFiltros(q, grade.total) + '<div id="grade">' + grade.html + '</div>' +
      '</div></section>' +
      '<section class="leve2"><div class="container">' +
        '<h2 class="display">A 2ª armação sai com <em>-' + l2 + '%.</em></h2>' +
        '<p>Levando 2 no mesmo pedido, a 2ª sai com ' + l2 + '% de desconto, que aparece sozinho no carrinho. O frete é um só pro pedido inteiro. Uma pro trampo, uma pro rolê.</p>' +
        '<a class="btn btn-laranja" href="/modelos" data-link style="justify-self:start">Escolher modelos</a>' +
        '<div class="passos"><div class="passo"><strong>1ª</strong><span>preço cheio</span></div><div class="passo"><strong>-' + l2 + '%</strong><span>na 2ª armação</span></div><div class="passo"><strong>1</strong><span>frete pro pedido inteiro</span></div></div>' +
      '</div></section>' +
      '<section class="secao"><div class="container">' +
        '<div class="secao-titulo"><h2 class="display">Como funciona</h2></div>' +
        '<div class="passos-compra">' +
          passo(1, 'Escolha a armação', 'Filtre por formato e cor. Todas as medidas estão na página do modelo.') +
          passo(2, 'Adicione ao carrinho', 'Levando 2, a 2ª sai com -' + l2 + '%. O frete é calculado pelo seu CEP.') +
          passo(3, 'Pague no Pix ou cartão', 'No Pix a confirmação é automática, em segundos. No cartão, dá pra parcelar.') +
          passo(4, 'Receba em casa', 'Postagem com rastreio e nota fiscal. Não serviu? Troca grátis em até 7 dias úteis.') +
        '</div>' +
      '</div></section>' +
      '<section class="secao faq"><div class="container">' +
        '<div class="secao-titulo"><h2 class="display">Perguntas frequentes</h2></div>' + faq() +
      '</div></section>';
  }
  function beneficio(tipo, texto) {
    var icones = {
      qualidade: '<svg viewBox="0 0 32 32" fill="none" stroke="#0B6B3A" stroke-width="2.2"><path d="M16 3l3.5 3.8 5.1-.7.7 5.1 3.7 3.6-3.7 3.6-.7 5.1-5.1-.7L16 26.6l-3.5-3.8-5.1.7-.7-5.1L3 15.8l3.7-3.6.7-5.1 5.1.7z"/><path d="M11 16l3.2 3.2L21 12.5"/></svg>',
      preco: '<svg viewBox="0 0 32 32" fill="none" stroke="#0B6B3A" stroke-width="2.2"><path d="M4 16.5V6a2 2 0 012-2h10.5L28 15.5 17.5 26z"/><circle cx="10" cy="10" r="1.8" fill="#0B6B3A"/></svg>',
      online: '<svg viewBox="0 0 32 32" fill="none" stroke="#0B6B3A" stroke-width="2.2"><rect x="3" y="9" width="17" height="12" rx="1"/><path d="M20 13h5l4 4v4h-9zM7 25h.01M25 25h.01"/><circle cx="8" cy="24" r="2"/><circle cx="24" cy="24" r="2"/></svg>',
      troca: '<svg viewBox="0 0 32 32" fill="none" stroke="#0B6B3A" stroke-width="2.2"><path d="M7 12a10 10 0 0117-3l3 3M25 20a10 10 0 01-17 3l-3-3"/><path d="M27 6v6h-6M5 26v-6h6"/></svg>'
    };
    return '<div class="beneficio">' + icones[tipo] + '<span>' + h(texto) + '</span></div>';
  }
  function passo(n, t, d) { return '<div class="passo-compra"><div class="n">' + n + '</div><h3>' + h(t) + '</h3><p>' + h(d) + '</p></div>'; }
  function faq() {
    var l2 = estado.regras.leve2_pct;
    var itens = [
      ['A armação vem com as lentes?', 'Não — vendemos só a armação, que é o que encarece na ótica. Você leva a nossa armação pra colocar as lentes do seu grau na ótica ou no laboratório da sua confiança.'],
      ['Como funciona a troca grátis?', 'Compra online tem direito de arrependimento: em até 7 dias úteis depois de receber, se não serviu, não gostou ou mudou de ideia, a gente troca por outro modelo ou devolve o dinheiro — sem custo, você não paga o frete da devolução. Depois desse prazo, a troca é só por defeito de fabricação.'],
      ['Quanto tempo demora pra chegar?', 'Até 3 dias úteis na Grande São Paulo e até 5 dias úteis pro resto do Brasil, contados da confirmação do pagamento. O código de rastreio chega no seu e-mail.'],
      ['Como funciona o desconto da 2ª armação?', 'Levando 2 armações no mesmo pedido, a 2ª (a de menor valor) sai com ' + l2 + '% de desconto, que aparece sozinho no carrinho. A cada 2 armações, uma sai com ' + l2 + '% off.'],
      ['Tem nota fiscal?', 'Sempre. Todo pedido sai com NF-e no seu nome, enviada por e-mail.'],
      ['E se a armação vier com defeito?', 'Passados os 7 dias úteis de arrependimento, a troca é só por defeito de fabricação, como manda o Código de Defesa do Consumidor: até 90 dias depois do recebimento. É só mandar um e-mail com o número do pedido e uma foto. Não oferecemos garantia além do que a lei determina.'],
      ['Quais as formas de pagamento?', 'Pix, com confirmação automática em segundos, ou cartão de crédito, parcelado. O cartão é processado numa página segura da operadora — seus dados não passam pelo nosso site.']
    ];
    return itens.map(function (i) { return '<details><summary>' + h(i[0]) + '</summary><p>' + h(i[1]) + '</p></details>'; }).join('');
  }

  function viewModelos() {
    var q = query();
    var tituloPag = tituloModelos(q);
    var grade = gradeProdutos(q);
    app.innerHTML = '<section class="secao"><div class="container">' +
      '<div class="secao-titulo"><h1 class="display" style="font-size:clamp(30px,6vw,48px)">' + h(tituloPag) + '</h1><span class="contagem" id="contagem">' + h(grade.rotulo) + '</span></div>' +
      blocoFiltros(q, grade.total) + '<div id="grade">' + grade.html + '</div></div></section>';
  }
  function tituloModelos(q) {
    var t = q.tipo === 'sol' ? 'Óculos de sol' : q.tipo === 'grau' ? 'Óculos de grau' : 'Todos os modelos';
    titulo(t, (q.tipo === 'sol' ? 'Óculos de sol da Só Armação' : q.tipo === 'grau' ? 'Armações de óculos de grau da Só Armação' : 'Todas as armações da Só Armação') + ': gatinho, redondo, retangular, quadrado e hexagonal. Preço baixo todo dia e troca grátis em até 7 dias úteis.');
    return t;
  }
  function atualizarGrade() {
    var q = query();
    var grade = gradeProdutos(q);
    var h1 = document.querySelector('.secao-titulo h1');
    if (h1) h1.textContent = tituloModelos(q);
    var g = document.getElementById('grade');
    var c = document.getElementById('contagem');
    var f = document.querySelector('.filtros');
    if (g) g.innerHTML = grade.html;
    if (c) c.textContent = grade.rotulo;
    if (f) f.outerHTML = blocoFiltros(q, grade.total);
  }

  function viewProduto(m) {
    var achado = produtoPorRota(decodeURIComponent(m[1]));
    // Não achou: pode ser catálogo ou site desatualizado na aba (aberta antes de uma
    // atualização). Tenta o catálogo novo; se ainda não achar, recarrega a página uma
    // vez pra pegar o site mais novo. Só então diz que o modelo não existe.
    if (!achado && !estado.recatalogado) {
      estado.recatalogado = true;
      app.innerHTML = '<div class="carregando"><span class="spinner"></span> Carregando…</div>';
      carregarCatalogo(true).then(rotear, rotear);
      return;
    }
    if (!achado && !ler('sa_recarregou', false, sessionStorage)) {
      gravar('sa_recarregou', true, sessionStorage);
      location.reload();
      return;
    }
    apagar('sa_recarregou', sessionStorage);
    estado.recatalogado = false;
    if (!achado) { naoIndexar(true); titulo('Modelo não encontrado'); app.innerHTML = '<div class="container institucional"><h1 class="display">Não achamos esse modelo.</h1><p>Ele pode ter saído de linha. <a href="/modelos" data-link>Ver todos os modelos →</a></p></div>'; return; }
    var p = achado.produto;
    var q = query();
    var variacoes = (p.variacoes || []).slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    var v = achado.variacao || variacoes.find(function (x) { return q.cor && (x.cor_slug || slug(x.cor)) === q.cor; }) || variacoes.find(function (x) { return x.estoque > 0; }) || variacoes[0];
    if (!v) { naoIndexar(true); app.innerHTML = '<div class="container institucional"><h1 class="display">Modelo sem variações.</h1></div>'; return; }
    // Endereço oficial (SEO): /p/YF8636/ ou /p/<SKU>/ antigos viram /p/oculos-ibiza-gatinho-yf8636/
    // na barra, sem recarregar; a cor vai em ?cor= e o resto da URL (utm, gclid) fica.
    var oficial = String(p.url || '').split('?')[0];
    if (oficial && location.pathname !== oficial) {
      var params = new URLSearchParams(location.search);
      if (achado.variacao) params.set('cor', v.cor_slug || slug(v.cor));
      var busca = params.toString();
      history.replaceState(history.state, '', oficial + (busca ? '?' + busca : '') + location.hash);
    }
    var fotos = fotosDaVariacao(v, p);
    var imagens = fotos.map(function (f) { return f.src; });
    var esgotado = !(v.estoque > 0);
    var desc = limparDescricao(p.descricao);
    titulo(p.nome + (v.cor ? ' ' + v.cor : ''), desc.slice(0, 155));
    jsonLd({ '@context': 'https://schema.org', '@type': 'Product', name: p.nome, sku: v.sku, brand: { '@type': 'Brand', name: p.marca || 'Só Armação' }, description: desc, image: imagens, color: v.cor,
      offers: { '@type': 'Offer', url: CONFIG.site + (v.url || p.url), priceCurrency: 'BRL', price: v.preco, availability: esgotado ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' } });
    var med = p.medidas || {};
    var relacionados = (estado.catalogo.produtos || []).filter(function (x) { return x.codigo !== p.codigo && x.formato === p.formato && x.estoque_total > 0; }).slice(0, 4);
    app.innerHTML = '<div class="container">' +
      '<nav class="migalhas" aria-label="Você está em"><a href="/" data-link>Início</a> › <a href="/modelos" data-link>Modelos</a> › ' + (p.formato ? '<a href="/modelos?formato=' + h(slug(p.formato)) + '" data-link>' + h(p.formato) + '</a> › ' : '') + '<span>' + h(p.nome) + '</span></nav>' +
      '<div class="produto">' +
        galeriaHtml(fotos, p.nome + (v.cor ? ' ' + v.cor : ''), esgotado ? '<span class="badge esgotado">Esgotado</span>' : (v.estoque <= 5 ? '<span class="badge">' + rotuloEstoque(v.estoque) + '</span>' : '')) +
        '<div class="produto-info">' +
          '<div><span class="card-linha">' + h(p.formato || 'Armação') + (rotuloTipo(p, v) ? ' · ' + h(rotuloTipo(p, v)) : '') + (p.marca ? ' · ' + h(p.marca) : '') + '</span><h1 class="display">' + h(p.nome) + '</h1></div>' +
          '<div class="preco-bloco"><span class="valor">' + h(fmt(v.preco)) + '<small>no Pix</small></span>' +
            '<span class="segunda">Levando 2, a 2ª sai por ' + h(fmt(precoSegunda(v.preco))) + '</span>' +
            '<span class="parcelas">ou no cartão em até 6x</span></div>' +
          (variacoes.length > 1 ? '<div class="cores"><span class="rotulo">Cor: ' + h(v.cor) + '</span><div class="opcoes">' + variacoes.map(function (x) {
              return '<a class="cor-opcao' + (x.sku === v.sku ? ' ativo' : '') + (x.estoque > 0 ? '' : ' esgotado') + '" href="' + h(x.url) + '" data-link title="' + h(x.cor) + '">' + (x.imagem ? '<img src="' + h(foto(x.imagem)) + '" alt="">' : '') + '<span>' + h(x.cor) + (x.tipo === 'sol' ? ' <small>(sol)</small>' : '') + '</span></a>';
            }).join('') + '</div></div>' : (v.cor ? '<div class="cores"><span class="rotulo">Cor: ' + h(v.cor) + '</span></div>' : '')) +
          (esgotado ? '<p class="estoque-aviso zero">Essa cor está esgotada no momento.</p>' : (v.estoque <= 5 ? '<p class="estoque-aviso">' + rotuloEstoque(v.estoque) + ' em estoque.</p>' : '')) +
          '<div class="acoes">' +
            '<button class="btn btn-laranja btn-bloco" data-action="comprar" data-sku="' + h(v.sku) + '"' + (esgotado ? ' disabled' : '') + '>Comprar agora</button>' +
            '<button class="btn btn-contorno btn-bloco" data-action="adicionar" data-sku="' + h(v.sku) + '"' + (esgotado ? ' disabled' : '') + '>Adicionar ao carrinho</button>' +
            '<button type="button" class="btn-favorito" data-action="favoritar" data-codigo="' + h(p.codigo) + '" aria-pressed="false"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z"/></svg><span>Favoritar</span></button>' +
          '</div>' +
          '<ul class="garantias"><li>Nota fiscal em todo pedido</li><li>Troca grátis em até 7 dias úteis (arrependimento)</li><li>Depois, troca só por defeito de fabricação, conforme o Código de Defesa do Consumidor</li><li>Pix aprovado na hora · cartão em até 6x</li></ul>' +
          '<div><div class="bloco-titulo">Medidas</div><table class="medidas"><tbody>' +
            (med.lente ? '<tr><th>Largura da lente</th><td>' + med.lente + ' mm</td></tr>' : '') +
            (med.ponte ? '<tr><th>Ponte</th><td>' + med.ponte + ' mm</td></tr>' : '') +
            (med.haste ? '<tr><th>Haste</th><td>' + med.haste + ' mm</td></tr>' : '') +
            (med.frontal ? '<tr><th>Largura frontal</th><td>' + med.frontal + ' mm</td></tr>' : '') +
            (p.peso_gramas ? '<tr><th>Peso</th><td>' + p.peso_gramas + ' g</td></tr>' : '') +
            '<tr><th>Tipo</th><td>' + h(v.tipo === 'sol' ? 'Óculos de sol' : 'Óculos de grau (armação, sem as lentes)') + '</td></tr>' +
            (p.material ? '<tr><th>Material</th><td>' + h(p.material) + '</td></tr>' : '') +
            (p.genero ? '<tr><th>Gênero</th><td>' + h(p.genero) + '</td></tr>' : '') +
            '<tr><th>Código</th><td>' + h(v.sku) + '</td></tr>' +
          '</tbody></table></div>' +
          (desc ? '<div><div class="bloco-titulo">Sobre o modelo</div><p class="descricao">' + h(desc) + '</p></div>' : '') +
        '</div>' +
      '</div>' +
      '<section class="secao" id="avaliacoes" aria-live="polite"></section>' +
      (relacionados.length ? '<section class="secao"><div class="secao-titulo"><h2 class="display">Combina com</h2></div><div class="grade">' + relacionados.map(cardProduto).join('') + '</div></section>' : '') +
      '</div>' +
      (esgotado ? '' : '<div class="barra-comprar"><div class="container"><button class="btn btn-laranja btn-bloco" data-action="comprar" data-sku="' + h(v.sku) + '">Comprar agora · ' + h(fmt(v.preco)) + '</button></div></div>');
    track('view_item', { value: v.preco, items: [itemGA(p, v, 1)] });
    registrarModeloVisto(p.codigo);
    carregarAvaliacoes(p);
    conferirFavorito(p.codigo);
  }

  // Carrossel de fotos do produto: trilho com rolagem por toque (scroll-snap), setas e miniaturas.
  function galeriaHtml(fotos, alt, badge) {
    if (!fotos.length) return '<div class="galeria"><div class="galeria-principal">' + badge + '<span class="sem-foto">foto em breve</span></div></div>';
    return '<div class="galeria" id="galeria">' +
      '<div class="galeria-principal">' + badge +
        '<div class="galeria-trilho" id="galeria-trilho">' + fotos.map(function (f, i) {
          return '<figure class="galeria-slide" data-i="' + i + '"><img src="' + h(f.src) + '" alt="' + h(alt + ' — ' + f.rotulo.toLowerCase()) + '" width="800" height="800"' + (i ? ' loading="lazy"' : ' fetchpriority="high"') + (f.opcional ? ' data-opcional="1"' : '') + '></figure>';
        }).join('') + '</div>' +
        '<button class="galeria-seta anterior" type="button" data-action="galeria" data-dir="-1" aria-label="Foto anterior">‹</button>' +
        '<button class="galeria-seta proxima" type="button" data-action="galeria" data-dir="1" aria-label="Próxima foto">›</button>' +
        '<button class="galeria-lupa" type="button" data-action="lupa" aria-label="Ampliar foto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21M8 10.5h5M10.5 8v5"/></svg><span>Zoom</span></button>' +
      '</div>' +
      '<div class="galeria-thumbs" role="tablist">' + fotos.map(function (f, i) {
        return '<button type="button" class="' + (i === 0 ? 'ativo' : '') + '" data-action="foto" data-i="' + i + '" role="tab" aria-label="' + h(f.rotulo) + '"><img src="' + h(f.src) + '" alt="" loading="lazy"' + (f.opcional ? ' data-opcional="1"' : '') + '><span>' + h(f.rotulo) + '</span></button>';
      }).join('') + '</div>' +
    '</div>';
  }
  function galeriaIr(i, suave) {
    var trilho = document.getElementById('galeria-trilho');
    if (!trilho) return;
    var slides = trilho.querySelectorAll('.galeria-slide');
    if (!slides.length) return;
    i = Math.max(0, Math.min(slides.length - 1, i));
    trilho.scrollTo({ left: slides[i].offsetLeft - trilho.offsetLeft, behavior: suave === false ? 'auto' : 'smooth' });
    galeriaMarcar(i);
  }
  function galeriaMarcar(i) {
    var g = document.getElementById('galeria');
    if (!g) return;
    var thumbs = g.querySelectorAll('.galeria-thumbs button');
    thumbs.forEach(function (b, k) { b.classList.toggle('ativo', k === i); b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    g.classList.toggle('so-uma', g.querySelectorAll('.galeria-slide').length < 2);
  }
  function galeriaIndice() {
    var trilho = document.getElementById('galeria-trilho');
    if (!trilho || !trilho.clientWidth) return 0;
    return Math.round(trilho.scrollLeft / trilho.clientWidth);
  }
  // Foto opcional (detalhe/lateral) que não existe no repositório: some do carrossel e das miniaturas.
  function galeriaRemover(src) {
    var g = document.getElementById('galeria');
    if (!g || !src) return;
    g.querySelectorAll('.galeria-slide img, .galeria-thumbs button img').forEach(function (im) {
      if (im.getAttribute('src') !== src) return;
      var alvo = im.closest('.galeria-slide') || im.closest('button');
      if (alvo) alvo.remove();
    });
    g.querySelectorAll('.galeria-slide').forEach(function (s, k) { s.setAttribute('data-i', k); });
    g.querySelectorAll('.galeria-thumbs button').forEach(function (b, k) { b.setAttribute('data-i', k); });
    galeriaMarcar(Math.min(galeriaIndice(), g.querySelectorAll('.galeria-slide').length - 1));
  }

  // ---------------------------------------------------------------------------
  // Zoom nas fotos: no desktop, passar o mouse amplia dentro da própria foto (lupa);
  // em qualquer tela, tocar/clicar abre em tela cheia com pinça, arrastar,
  // duplo toque e roda do mouse. As fotos têm 1200px, então dá pra chegar a 4x.
  // ---------------------------------------------------------------------------
  var MOUSE_FINO = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lupa = { aberta: false, fotos: [], i: 0, s: 1, tx: 0, ty: 0, ponteiros: {}, gesto: null, ultimoToque: 0, moveu: false };
  var MAX_ZOOM = 4, ZOOM_TOQUE = 2.5;

  function lupaEls() {
    return { raiz: document.getElementById('lupa'), img: document.getElementById('lupa-img'), palco: document.getElementById('lupa-palco'), legenda: document.getElementById('lupa-legenda'), dica: document.getElementById('lupa-dica') };
  }
  function lupaFotosDaGaleria() {
    var g = document.getElementById('galeria');
    if (!g) return [];
    return Array.prototype.map.call(g.querySelectorAll('.galeria-slide img'), function (im) { return { src: im.getAttribute('src'), rotulo: (im.getAttribute('alt') || '').split(' — ').pop() }; });
  }
  function lupaAbrir(i) {
    var e = lupaEls();
    if (!e.raiz) return;
    lupa.fotos = lupaFotosDaGaleria();
    if (!lupa.fotos.length) return;
    lupa.aberta = true;
    e.raiz.hidden = false;
    document.body.classList.add('lupa-aberta');
    e.dica.textContent = MOUSE_FINO ? 'Roda do mouse pra ampliar · arraste pra mover · Esc fecha' : 'Faça pinça pra ampliar · toque 2x pra dar zoom · arraste pra mover';
    lupaMostrar(i || 0);
    track('zoom_foto', { sku: lupa.fotos[lupa.i] && lupa.fotos[lupa.i].src });
  }
  function lupaFechar() {
    var e = lupaEls();
    if (!e.raiz || !lupa.aberta) return;
    lupa.aberta = false; lupa.ponteiros = {}; lupa.gesto = null;
    e.raiz.hidden = true;
    document.body.classList.remove('lupa-aberta');
  }
  function lupaMostrar(i) {
    var e = lupaEls(), n = lupa.fotos.length;
    lupa.i = ((i % n) + n) % n;
    lupa.s = 1; lupa.tx = 0; lupa.ty = 0;
    e.img.src = lupa.fotos[lupa.i].src;
    e.legenda.textContent = (lupa.fotos[lupa.i].rotulo || '') + (n > 1 ? ' · ' + (lupa.i + 1) + '/' + n : '');
    e.raiz.classList.toggle('so-uma', n < 2);
    lupaAplicar(false);
  }
  function lupaAplicar(animar) {
    var e = lupaEls();
    if (!e.img) return;
    // Mantém a foto dentro da tela: a translação não passa da metade do que "sobra" ao ampliar.
    var base = { w: e.img.offsetWidth, h: e.img.offsetHeight }; // tamanho de layout, sem o transform
    var maxX = Math.max(0, (base.w * lupa.s - e.palco.clientWidth) / 2 + 40), maxY = Math.max(0, (base.h * lupa.s - e.palco.clientHeight) / 2 + 40);
    lupa.tx = Math.max(-maxX, Math.min(maxX, lupa.tx)); lupa.ty = Math.max(-maxY, Math.min(maxY, lupa.ty));
    e.img.style.transition = animar ? 'transform .18s ease-out' : 'none';
    e.img.style.transform = 'translate(' + lupa.tx + 'px, ' + lupa.ty + 'px) scale(' + lupa.s + ')';
    e.raiz.classList.toggle('ampliada', lupa.s > 1.01);
  }
  // Ponto (x,y) da tela relativo ao centro do palco — é onde o zoom "ancora".
  function lupaRel(x, y) {
    var r = lupaEls().palco.getBoundingClientRect();
    return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) };
  }
  function lupaZoomEm(s1, x, y, animar) {
    var q = lupaRel(x, y), s0 = lupa.s;
    s1 = Math.max(1, Math.min(MAX_ZOOM, s1));
    // Mantém sob o dedo/cursor o mesmo ponto da foto: t1 = q - (q - t0) * s1/s0
    lupa.tx = q.x - (q.x - lupa.tx) * (s1 / s0);
    lupa.ty = q.y - (q.y - lupa.ty) * (s1 / s0);
    lupa.s = s1;
    if (s1 <= 1.001) { lupa.tx = 0; lupa.ty = 0; }
    lupaAplicar(animar);
  }
  function lupaPointerDown(ev) {
    if (!lupa.aberta || ev.target.closest('button')) return;
    ev.preventDefault();
    lupa.ponteiros[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    try { lupaEls().palco.setPointerCapture(ev.pointerId); } catch (e) { /* ignora */ }
    var ids = Object.keys(lupa.ponteiros);
    if (ids.length === 1) {
      lupa.gesto = { tipo: 'arrasto', x0: ev.clientX, y0: ev.clientY, tx0: lupa.tx, ty0: lupa.ty, s0: lupa.s, t0: Date.now() };
      lupa.moveu = false;
    } else if (ids.length === 2) {
      var a = lupa.ponteiros[ids[0]], b = lupa.ponteiros[ids[1]];
      lupa.gesto = { tipo: 'pinca', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid0: lupaRel((a.x + b.x) / 2, (a.y + b.y) / 2), s0: lupa.s, tx0: lupa.tx, ty0: lupa.ty };
      lupa.moveu = true;
    }
  }
  function lupaPointerMove(ev) {
    if (!lupa.aberta || !lupa.ponteiros[ev.pointerId]) return;
    ev.preventDefault();
    lupa.ponteiros[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    var g = lupa.gesto, ids = Object.keys(lupa.ponteiros);
    if (!g) return;
    if (g.tipo === 'pinca' && ids.length >= 2) {
      var a = lupa.ponteiros[ids[0]], b = lupa.ponteiros[ids[1]];
      var d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      var s1 = Math.max(1, Math.min(MAX_ZOOM, g.s0 * d / g.d0));
      var mid = lupaRel((a.x + b.x) / 2, (a.y + b.y) / 2);
      // Zoom em torno do ponto entre os dedos + arraste pelo movimento dele.
      lupa.tx = mid.x - (g.mid0.x - g.tx0) * (s1 / g.s0);
      lupa.ty = mid.y - (g.mid0.y - g.ty0) * (s1 / g.s0);
      lupa.s = s1;
      lupaAplicar(false);
    } else if (g.tipo === 'arrasto') {
      var dx = ev.clientX - g.x0, dy = ev.clientY - g.y0;
      if (Math.abs(dx) + Math.abs(dy) > 6) lupa.moveu = true;
      if (lupa.s > 1.01) { lupa.tx = g.tx0 + dx; lupa.ty = g.ty0 + dy; lupaAplicar(false); }
      else { lupaEls().img.style.transform = 'translate(' + dx + 'px, 0) scale(1)'; } // arrasto lateral = trocar de foto
    }
  }
  function lupaPointerUp(ev) {
    if (!lupa.aberta || !lupa.ponteiros[ev.pointerId]) return;
    delete lupa.ponteiros[ev.pointerId];
    var g = lupa.gesto, restantes = Object.keys(lupa.ponteiros);
    if (g && g.tipo === 'pinca') {
      lupa.gesto = null;
      if (lupa.s < 1.05) { lupa.s = 1; lupa.tx = 0; lupa.ty = 0; }
      lupaAplicar(true);
      if (restantes.length === 1) { var p = lupa.ponteiros[restantes[0]]; lupa.gesto = { tipo: 'arrasto', x0: p.x, y0: p.y, tx0: lupa.tx, ty0: lupa.ty, s0: lupa.s, t0: Date.now() }; lupa.moveu = true; }
      return;
    }
    if (g && g.tipo === 'arrasto') {
      lupa.gesto = null;
      var dx = ev.clientX - g.x0;
      if (lupa.s <= 1.01 && Math.abs(dx) > 60 && lupa.fotos.length > 1) { lupaMostrar(lupa.i + (dx < 0 ? 1 : -1)); return; }
      if (!lupa.moveu) {
        var agora = Date.now();
        if (agora - lupa.ultimoToque < 320) { // duplo toque / duplo clique
          lupa.ultimoToque = 0;
          if (lupa.s > 1.01) { lupa.s = 1; lupa.tx = 0; lupa.ty = 0; lupaAplicar(true); }
          else lupaZoomEm(ZOOM_TOQUE, ev.clientX, ev.clientY, true);
          return;
        }
        lupa.ultimoToque = agora;
      }
      lupaAplicar(true);
    }
  }
  function lupaWheel(ev) {
    if (!lupa.aberta) return;
    ev.preventDefault();
    lupaZoomEm(lupa.s * (ev.deltaY < 0 ? 1.18 : 1 / 1.18), ev.clientX, ev.clientY, false);
  }
  // Lupa no hover (só desktop): amplia a própria foto do carrossel a partir do ponto do mouse.
  function lupaHover(ev) {
    if (!MOUSE_FINO) return;
    var img = ev.target.closest('.galeria-slide img');
    var ativo = document.querySelector('.galeria-slide.zoom');
    if (!img) { if (ativo && ev.type === 'mousemove' && !ev.target.closest('.galeria-slide')) { ativo.classList.remove('zoom'); ativo.querySelector('img').style.transformOrigin = ''; } return; }
    var slide = img.closest('.galeria-slide'), r = img.getBoundingClientRect();
    var px = Math.max(0, Math.min(100, (ev.clientX - r.left) / r.width * 100)), py = Math.max(0, Math.min(100, (ev.clientY - r.top) / r.height * 100));
    img.style.transformOrigin = px + '% ' + py + '%';
    slide.classList.add('zoom');
  }
  function lupaHoverSair(ev) {
    var slide = ev.target.closest && ev.target.closest('.galeria-slide');
    if (slide) { slide.classList.remove('zoom'); var im = slide.querySelector('img'); if (im) im.style.transformOrigin = ''; }
  }

  function progressoLeve(unidades) {
    var l2 = estado.regras.leve2_pct, msg, pct, pares = Math.floor(unidades / 2);
    if (unidades <= 1) { msg = 'Falta 1 pro desconto: a 2ª armação sai com -' + l2 + '%'; pct = 50; }
    else if (unidades % 2 === 0) { msg = 'Desconto ativado: ' + (pares === 1 ? 'a 2ª armação sai' : pares + ' armações saem') + ' com -' + l2 + '%'; pct = 100; }
    else { msg = 'Desconto ativado em ' + pares + (pares === 1 ? ' armação' : ' armações') + ' — mais 1 e a próxima também sai com -' + l2 + '%'; pct = 100; }
    return '<div class="progresso"><span class="msg">' + h(msg) + '</span><div class="barra"><i style="width:' + pct + '%"></i></div></div>';
  }
  function resumoHtml(r, comCta) {
    if (!r) return '';
    return '<div class="resumo-linha"><span>Subtotal (' + r.unidades + ' ' + (r.unidades === 1 ? 'armação' : 'armações') + ')</span><span>' + h(fmt(r.subtotal)) + '</span></div>' +
      (r.desconto > 0 ? '<div class="resumo-linha desconto"><span>2ª armação com -' + (r.desconto_pct || estado.regras.leve2_pct) + '%' + (r.unidades_com_desconto > 1 ? ' (×' + r.unidades_com_desconto + ')' : '') + '</span><span>-' + h(fmt(r.desconto)) + '</span></div>' : '') +
      (r.desconto_primeira > 0 ? '<div class="resumo-linha desconto"><span>1ª compra -' + r.desconto_primeira_pct + '%</span><span>-' + h(fmt(r.desconto_primeira)) + '</span></div>' : '') +
      '<div class="resumo-linha"><span>Frete' + (r.frete_titulo ? ' · ' + h(r.frete_titulo) : '') + (r.frete_prazo ? ' <small>(' + h(r.frete_prazo) + ')</small>' : '') + '</span><span>' + (r.frete == null ? 'informe o CEP' : (r.frete === 0 ? 'grátis' : h(fmt(r.frete)))) + '</span></div>' +
      '<div class="resumo-linha total"><span>Total</span><span class="num">' + h(fmt(r.total)) + '</span></div>';
  }

  function viewCarrinho() {
    titulo('Carrinho');
    if (!estado.carrinho.length) {
      app.innerHTML = '<div class="container confirmacao"><h1 class="display">Seu carrinho está vazio.</h1><p>Escolha uma armação — e lembra: a 2ª sai com -' + estado.regras.leve2_pct + '%.</p><a class="btn btn-laranja" href="/modelos" data-link>Ver modelos</a></div>';
      return;
    }
    function render(resumo, erro, carregando) {
      var itens = resumo ? resumo.itens : estado.carrinho.map(function (i) { return { sku: i.sku, nome: i.nome + (i.cor ? ' — ' + i.cor : ''), qty: i.qty, preco: i.preco, total: i.preco * i.qty, imagem: i.imagem }; });
      var unidades = resumo ? resumo.unidades : unidadesCarrinho();
      app.innerHTML = '<div class="container"><div class="secao-titulo" style="margin-top:20px"><h1 class="display" style="font-size:clamp(30px,6vw,48px)">Carrinho</h1><a class="link" href="/modelos" data-link>Continuar comprando</a></div>' +
        '<div class="carrinho"><div>' + progressoLeve(unidades) + '<div class="itens" style="margin-top:10px">' +
          itens.map(function (it) {
            var local = estado.carrinho.find(function (c) { return c.sku === it.sku; }) || {};
            var img = foto(it.imagem || local.imagem);
            return '<div class="item">' + (img ? '<img src="' + h(img) + '" alt="">' : '<div></div>') + '<div>' +
              '<div class="nome">' + h(it.nome) + '</div><div class="unit">' + h(fmt(it.preco)) + ' cada · <button class="link" data-action="remover" data-sku="' + h(it.sku) + '">remover</button></div>' +
              '<div class="linha"><div class="qtd"><button data-action="qtd" data-sku="' + h(it.sku) + '" data-delta="-1" aria-label="Menos">−</button><span>' + it.qty + '</span><button data-action="qtd" data-sku="' + h(it.sku) + '" data-delta="1" aria-label="Mais">+</button></div><span class="total">' + h(fmt(it.total)) + '</span></div>' +
              '</div></div>';
          }).join('') + '</div>' +
          (erro ? '<div class="aviso erro" style="margin-top:10px">' + h(erro) + '</div>' : '') +
        '</div>' +
        '<div class="painel"><h2 class="display">Resumo</h2>' +
          '<form class="cep-linha" data-action="cep"><div class="campo"><label for="cep">CEP pra calcular o frete</label><input id="cep" name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" value="' + h(estado.cep) + '" maxlength="9"></div><button class="btn btn-verde" type="submit" style="align-self:end">OK</button></form>' +
          (resumo && resumo.endereco ? '<p class="endereco-resolvido">' + h([resumo.endereco.logradouro, resumo.endereco.bairro, resumo.endereco.cidade ? resumo.endereco.cidade + '/' + resumo.endereco.uf : ''].filter(Boolean).join(', ')) + '</p>' : '') +
          (carregando ? '' : seletorFreteHtml(resumo ? resumo.resumo : null)) +
          (carregando ? '<p class="endereco-resolvido"><span class="spinner"></span> Calculando…</p>' : resumoHtml(resumo ? Object.assign({}, resumo.resumo, { endereco: undefined }) : null) + nota1aHtml(resumo ? { resumo: resumo.resumo } : null, false)) +
          '<a class="btn btn-laranja btn-bloco" href="/checkout" data-link' + (erro ? ' aria-disabled="true" style="pointer-events:none;opacity:.55"' : '') + '>Fechar pedido →</a>' +
          '<p class="endereco-resolvido">Pix aprovado na hora · cartão em até 6x · nota fiscal · troca grátis em até 7 dias úteis</p>' +
        '</div></div></div>';
    }
    render(null, '', true);
    var g = geracao;
    cotar(estado.cep).then(function (d) {
      if (g !== geracao) return;
      render({ itens: d.resumo.itens, unidades: d.resumo.unidades, resumo: d.resumo, endereco: d.endereco }, '', false);
      track('view_cart', { value: d.resumo.total, items: d.resumo.itens.map(function (i) { return { item_id: i.sku, item_name: i.nome, price: i.preco, quantity: i.qty }; }) });
    }).catch(function (e) { if (g === geracao) render(null, e.message, false); });
  }

  // Máscaras simples de digitação
  function mascara(tipo, v) {
    var d = digitos(v);
    if (tipo === 'cpf') { d = d.slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); }
    if (tipo === 'cep') { d = d.slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; }
    if (tipo === 'tel') { d = d.slice(0, 11); if (!d) return ''; if (d.length <= 2) return '(' + d; var p = '(' + d.slice(0, 2) + ') '; if (d.length <= 6) return p + d.slice(2); if (d.length <= 10) return p + d.slice(2, 6) + '-' + d.slice(6); return p + d.slice(2, 7) + '-' + d.slice(7); }
    return v;
  }
  function cpfValido(cpf) {
    var c = digitos(cpf);
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    var calc = function (n) { var s = 0; for (var i = 0; i < n; i++) s += parseInt(c[i], 10) * (n + 1 - i); var r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return calc(9) === parseInt(c[9], 10) && calc(10) === parseInt(c[10], 10);
  }
  function validarForm(f) {
    var erros = {};
    if (!f.nome || f.nome.trim().length < 3 || f.nome.trim().indexOf(' ') < 0) erros.nome = 'Informe o nome completo.';
    if (!cpfValido(f.cpf)) erros.cpf = 'CPF inválido.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email || '')) erros.email = 'E-mail inválido.';
    if (digitos(f.telefone).length < 10) erros.telefone = 'Informe o WhatsApp com DDD.';
    if (digitos(f.cep).length !== 8) erros.cep = 'CEP inválido.';
    if (!f.numero || !String(f.numero).trim()) erros.numero = 'Informe o número.';
    return erros;
  }

  function viewCheckout() {
    titulo('Finalizar pedido');
    if (!estado.carrinho.length) { navegar('/carrinho', true); return; }
    var f = estado.form || {};
    if (!f.cep && estado.cep) f.cep = estado.cep;
    f.metodo = f.metodo || 'PIX'; f.parcelas = f.parcelas || 1;
    var erros = {};
    var logado = !!sessaoLocal();
    // Cartões salvos da conta (o valor do rádio é "SALVO:<id>"; o token nunca vem pro navegador).
    function cartoesSalvos() { return logado && estado.conta ? (estado.conta.cartoes || []) : []; }
    function cartaoEscolhido() { var m = /^SALVO:(\d+)$/.exec(f.metodo || ''); return m ? cartoesSalvos().find(function (c) { return String(c.id) === m[1]; }) : null; }
    function cepDoCartao(c) { var cep = mascara('cep', f.cep || ''); return (c.ceps || []).indexOf(cep) >= 0; }
    if (/^SALVO:/.test(f.metodo) && !logado) f.metodo = 'CREDIT_CARD';
    function campo(nome, rotulo, attrs, ajuda, extraHtml) {
      return '<div class="campo' + (erros[nome] ? ' invalido' : '') + '"><label for="f-' + nome + '">' + h(rotulo) + '</label><input id="f-' + nome + '" name="' + nome + '" value="' + h(f[nome] || '') + '" ' + attrs + '>' + (erros[nome] ? '<span class="erro-campo">' + h(erros[nome]) + '</span>' : (extraHtml || (ajuda ? '<span class="ajuda">' + h(ajuda) + '</span>' : ''))) + '</div>';
    }
    function parcelasHtml(r, operadora) {
      return '<div class="campo" style="margin-top:8px" id="bloco-parcelas"><label for="f-parcelas">Parcelas</label><select id="f-parcelas" name="parcelas">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<option value="' + n + '"' + (Number(f.parcelas) === n ? ' selected' : '') + '>' + n + 'x' + (r ? ' de ' + fmt(r.total / n) : '') + '</option>'; }).join('') + '</select>' + (operadora ? '<span class="ajuda">Valor final das parcelas confirmado na página da operadora.</span>' : '') + '</div>';
    }
    function render(resumo, aviso, enviando) {
      var r = resumo ? resumo.resumo : null;
      var end = resumo ? resumo.endereco : null;
      // não perde o campo em foco quando a cotação chega no meio da digitação
      var ativo = document.activeElement;
      var foco = ativo && ativo.id && app.contains(ativo) ? { id: ativo.id, pos: ativo.selectionStart } : null;
      app.innerHTML = '<div class="container"><div class="secao-titulo" style="margin-top:20px"><h1 class="display" style="font-size:clamp(30px,6vw,48px)">Finalizar pedido</h1><a class="link" href="/carrinho" data-link>Voltar ao carrinho</a></div>' +
        '<form class="checkout" data-action="checkout" novalidate>' +
          '<div class="painel form-grid">' +
            '<h2 class="display">Seus dados</h2>' +
            (logado ? '<p class="checkout-conta">Comprando como <strong>' + h((sessaoLocal().user || {}).email || '') + '</strong> · <a href="/conta" data-link>Minha conta</a></p>'
              : '<p class="checkout-conta">Já tem conta? <a href="/entrar?voltar=%2Fcheckout" data-link>Entrar</a> preenche seus dados e guarda o cartão (opcional).</p>') +
            campo('nome', 'Nome completo', 'autocomplete="name" required') +
            '<div class="dupla">' + campo('cpf', 'CPF', 'inputmode="numeric" autocomplete="off" data-mascara="cpf" placeholder="000.000.000-00" required', 'Vai na nota fiscal.', bolha1aHtml(resumo)) + campo('telefone', 'WhatsApp', 'inputmode="tel" autocomplete="tel" data-mascara="tel" placeholder="(11) 90000-0000" required') + '</div>' +
            campo('email', 'E-mail', 'type="email" inputmode="email" autocomplete="email" required', 'Nota fiscal e rastreio chegam aqui.') +
            '<h2 class="display" style="margin-top:8px">Entrega</h2>' +
            '<div class="dupla">' + campo('cep', 'CEP', 'inputmode="numeric" autocomplete="postal-code" data-mascara="cep" placeholder="00000-000" required') + campo('numero', 'Número', 'autocomplete="address-line2" inputmode="numeric" required') + '</div>' +
            (end && end.logradouro ? '<p class="endereco-resolvido">' + h([end.logradouro, end.bairro, end.cidade ? end.cidade + '/' + end.uf : ''].filter(Boolean).join(', ')) + '</p>' : (digitos(f.cep).length === 8 ? '<p class="endereco-resolvido"><span class="spinner"></span> Buscando o endereço…</p>' : '')) +
            campo('complemento', 'Complemento (opcional)', 'autocomplete="address-line3" placeholder="apto, bloco, referência"') +
            '<h2 class="display" style="margin-top:8px">Pagamento</h2>' +
            '<div class="pagamento-opcoes">' +
              '<label class="pag-opcao' + (f.metodo === 'PIX' ? ' ativo' : '') + '"><input type="radio" name="metodo" value="PIX"' + (f.metodo === 'PIX' ? ' checked' : '') + '><div><strong>Pix <span class="recomendado">Na hora</span></strong><span>QR Code ou copia-e-cola. O pedido confirma sozinho em segundos.</span></div></label>' +
              cartoesSalvos().map(function (c) {
                var valor = 'SALVO:' + c.id, ativo = f.metodo === valor, serve = cepDoCartao(c);
                return '<label class="pag-opcao' + (ativo ? ' ativo' : '') + (serve ? '' : ' indisponivel') + '"><input type="radio" name="metodo" value="' + valor + '"' + (ativo ? ' checked' : '') + (serve ? '' : ' disabled') + '><div><strong>' + h(c.bandeira ? c.bandeira.charAt(0) + c.bandeira.slice(1).toLowerCase() : 'Cartão') + ' final ' + h(c.final || '') + ' <span class="recomendado">1 clique</span></strong>' +
                  '<span>' + (serve ? 'Cartão salvo na sua conta. Paga aqui mesmo, sem digitar nada.' : 'Pra entregar neste CEP, use “Cartão de crédito” abaixo: endereço novo pede o cartão na página segura.') + '</span>' +
                  (ativo ? parcelasHtml(r, false) : '') + '</div></label>';
              }).join('') +
              '<label class="pag-opcao' + (f.metodo === 'CREDIT_CARD' ? ' ativo' : '') + '"><input type="radio" name="metodo" value="CREDIT_CARD"' + (f.metodo === 'CREDIT_CARD' ? ' checked' : '') + '><div><strong>Cartão de crédito</strong><span>Pagamento numa página segura da operadora. Parcele em até 6x.</span>' +
                (f.metodo === 'CREDIT_CARD' ? parcelasHtml(r, true) : '') +
              '</div></label>' +
            '</div>' +
            (f.metodo === 'CREDIT_CARD' && logado ? '<label class="salvar-cartao"><input type="checkbox" name="salvar_cartao"' + (f.salvar_cartao !== false ? ' checked' : '') + '><span>Salvar este cartão para as próximas compras <small>O cartão fica guardado com o Asaas; a gente só vê a bandeira e o final.</small></span></label>' : '') +
            (aviso ? '<div class="aviso erro">' + h(aviso) + '</div>' : '') +
            '<button class="btn btn-laranja btn-bloco" type="submit"' + (enviando || !r ? ' disabled' : '') + '>' + (enviando ? (cartaoEscolhido() ? 'Pagando…' : 'Gerando pagamento…') : (cartaoEscolhido() ? 'Pagar com final ' + h(cartaoEscolhido().final || '') : f.metodo === 'CREDIT_CARD' ? 'Pagar no cartão' : 'Pagar no Pix')) + (r ? ' · ' + h(fmt(r.total)) : '') + '</button>' +
            '<p class="ajuda" style="font-size:12px;color:var(--texto-suave)">Ao pagar, você concorda com os <a href="/termos" data-link>termos de uso</a> e a <a href="/privacidade" data-link>política de privacidade</a>.</p>' +
          '</div>' +
          '<div class="painel sticky"><h2 class="display">Seu pedido</h2>' +
            (r ? '<div class="mini-itens">' + r.itens.map(function (i) { var local = estado.carrinho.find(function (c) { return c.sku === i.sku; }) || {}; return '<div class="mini-item">' + ((i.imagem || local.imagem) ? '<img src="' + h(foto(i.imagem || local.imagem)) + '" alt="">' : '<div></div>') + '<span>' + i.qty + 'x ' + h(i.nome) + '</span><strong>' + h(fmt(i.total)) + '</strong></div>'; }).join('') + '</div>' + seletorFreteHtml(r) + resumoHtml(r) + nota1aHtml(resumo, true) : '<p class="endereco-resolvido"><span class="spinner"></span> Calculando o pedido…</p>') +
          '</div>' +
        '</form></div>';
      if (foco) {
        var de = document.getElementById(foco.id);
        if (de) { de.focus(); try { if (foco.pos != null) de.setSelectionRange(foco.pos, foco.pos); } catch (e) {} }
      }
    }
    var ultimaCotacao = null;
    var g = geracao;
    // Dados que o servidor usa pra conferir a 1ª compra (só vão com CPF válido).
    function clienteDesconto() { return cpfValido(f.cpf) ? { cpf: f.cpf, email: (f.email || '').trim(), telefone: f.telefone || '' } : null; }
    var conferido = '';
    function chave1a() { var c = clienteDesconto(); return c ? digitos(c.cpf) + '|' + c.email.toLowerCase() + '|' + digitos(c.telefone) : ''; }
    function recotar() {
      conferido = chave1a();
      render(ultimaCotacao, '', false);
      return cotar(f.cep, clienteDesconto()).then(function (d) { if (g !== geracao) return; ultimaCotacao = d; render(d, '', false); }).catch(function (e) { if (g === geracao) render(null, e.message, false); });
    }
    // Logado: preenche o que estiver vazio com os dados do último pedido e mostra os cartões salvos.
    if (logado) carregarConta().then(function (d) {
      if (g !== geracao) return;
      var pf = d.perfil || {}, mudouCep = false;
      var mudouCpf = false;
      [['nome', pf.nome], ['cpf', pf.cpf && mascara('cpf', pf.cpf)], ['email', pf.email], ['telefone', pf.telefone && mascara('tel', pf.telefone)], ['cep', pf.cep && mascara('cep', pf.cep)], ['numero', pf.numero], ['complemento', pf.complemento]].forEach(function (x) {
        if (!f[x[0]] && x[1]) { f[x[0]] = x[1]; if (x[0] === 'cep') mudouCep = true; if (x[0] === 'cpf') mudouCpf = true; }
      });
      if (!f.metodo || f.metodo === 'PIX') { var c0 = (d.cartoes || []).find(cepDoCartao); if (c0 && !estado.formTocado) f.metodo = 'SALVO:' + c0.id; }
      gravar('sa_checkout', f, sessionStorage);
      if (mudouCep) { estado.cep = f.cep; gravar('sa_cep', estado.cep); }
      // CEP ou CPF novos mudam frete/1ª compra: recota; senão só redesenha.
      if (mudouCep || (mudouCpf && oferta1aAtiva())) recotar(); else render(ultimaCotacao, '', false);
    }).catch(function () { /* conta fora do ar: segue como visitante */ });
    recotar().then(function () {
      if (ultimaCotacao) track('begin_checkout', { value: ultimaCotacao.resumo.total, items: ultimaCotacao.resumo.itens.map(function (i) { return { item_id: i.sku, item_name: i.nome, price: i.preco, quantity: i.qty }; }) });
    });

    // guarda o formulário enquanto digita (sobrevive a recarregar a página)
    app.oninput = function (e) {
      var el = e.target;
      if (!el.name || el.type === 'checkbox' || el.type === 'radio') return;
      if (el.dataset.mascara) { var pos = el.value.length; el.value = mascara(el.dataset.mascara, el.value); }
      f[el.name] = el.value;
      gravar('sa_checkout', f, sessionStorage);
      if (el.name === 'cep' && digitos(el.value).length === 8 && el.value !== estado.cep) { estado.cep = el.value; gravar('sa_cep', estado.cep); recotar(); }
      // CPF completo e válido: confere a 1ª compra na hora
      else if (el.name === 'cpf' && oferta1aAtiva() && cpfValido(el.value) && chave1a() !== conferido) recotar();
    };
    // Logado: cada campo preenchido já vai pro perfil da conta (próxima compra vem pronta).
    // O servidor só grava o que for válido; o CPF fica criptografado lá.
    var CAMPOS_PERFIL = ['nome', 'cpf', 'email', 'telefone', 'cep', 'numero', 'complemento'];
    var perfilTimer = null, perfilEnviado = '';
    function salvarPerfilConta() {
      if (!logado) return;
      clearTimeout(perfilTimer);
      perfilTimer = setTimeout(function () {
        var dados = {};
        CAMPOS_PERFIL.forEach(function (k) { if (f[k] != null && String(f[k]).trim() !== '') dados[k] = String(f[k]); });
        if ('complemento' in f) dados.complemento = String(f.complemento || '');
        var chave = JSON.stringify(dados);
        if (chave === perfilEnviado) return;
        perfilEnviado = chave;
        apiConta('POST', { acao: 'perfil', dados: dados }).then(function () {
          if (estado.conta && estado.conta.perfil) CAMPOS_PERFIL.forEach(function (k) { if (dados[k] != null) estado.conta.perfil[k] = dados[k]; });
        }).catch(function () { perfilEnviado = ''; });
      }, 700);
    }
    estado.aoSairDoCampo = function (el) { if (g === geracao && CAMPOS_PERFIL.indexOf(el.name) >= 0) salvarPerfilConta(); };
    app.onchange = function (e) {
      var el = e.target;
      if (el.name === 'metodo') { f.metodo = el.value; estado.formTocado = true; gravar('sa_checkout', f, sessionStorage); render(ultimaCotacao, '', false); }
      if (el.name === 'salvar_cartao') { f.salvar_cartao = el.checked; gravar('sa_checkout', f, sessionStorage); }
      if (el.name === 'parcelas') { f.parcelas = Number(el.value); gravar('sa_checkout', f, sessionStorage); }
      // e-mail/telefone também contam pra 1ª compra: confere de novo ao sair do campo
      // (depois de o foco chegar no próximo campo: redesenhar no meio da troca de foco
      // apagava o campo novo e o que a pessoa começava a digitar nele)
      if ((el.name === 'email' || el.name === 'telefone') && oferta1aAtiva() && chave1a() && chave1a() !== conferido) setTimeout(function () { if (g === geracao) recotar(); }, 0);
    };
    app.onsubmit = function (e) {
      if (!e.target.matches('[data-action="checkout"]')) return;
      e.preventDefault();
      erros = validarForm(f);
      if (Object.keys(erros).length) { render(ultimaCotacao, 'Confere os campos destacados.', false); var primeiro = document.querySelector('.campo.invalido input'); if (primeiro) primeiro.focus(); return; }
      render(ultimaCotacao, '', true);
      track('add_payment_info', { value: ultimaCotacao ? ultimaCotacao.resumo.total : 0, payment_type: /^SALVO:/.test(f.metodo) ? 'cartao_salvo' : f.metodo === 'CREDIT_CARD' ? 'cartao' : 'pix', items: ultimaCotacao ? ultimaCotacao.resumo.itens.map(function (i) { return { item_id: i.sku, item_name: i.nome, price: i.preco, quantity: i.qty }; }) : [] });
      var salvo = cartaoEscolhido();
      if (/^SALVO:/.test(f.metodo) && (!salvo || !cepDoCartao(salvo))) { f.metodo = 'CREDIT_CARD'; render(ultimaCotacao, 'Escolha outra forma de pagamento pra este endereço.', false); return; }
      var metodoEnvio = salvo ? 'CREDIT_CARD' : f.metodo;
      var body = {
        itens: itensPedido(),
        cliente: { nome: f.nome.trim(), cpf: f.cpf, email: f.email.trim(), telefone: f.telefone, cep: f.cep, numero: String(f.numero).trim(), complemento: f.complemento || '' },
        metodo: metodoEnvio, parcelas: metodoEnvio === 'CREDIT_CARD' ? (Number(f.parcelas) || 1) : 1,
        cartao_salvo: salvo ? salvo.id : undefined,
        salvar_cartao: logado && f.metodo === 'CREDIT_CARD' && f.salvar_cartao !== false,
        frete: estado.freteOpcao,
        tracking: { ga_client_id: gaClientId(), ga_session_id: gaSessionId(), ads: cliqueAds(), fbp: cookie('_fbp'), fbc: cookie('_fbc'), source_url: location.href }
      };
      // Checkout passa pela função da própria loja (anti-robô BotID), que repassa pro backend.
      (logado ? tokenConta().catch(function () { return null; }) : Promise.resolve(null))
        .then(function (token) {
          var headers = { 'Content-Type': 'application/json' };
          if (token) headers.Authorization = 'Bearer ' + token;
          return fetch('/api/checkout', { method: 'POST', headers: headers, body: JSON.stringify(body) });
        })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, dados: d }; }); })
        .then(function (res) {
          if (g !== geracao) return;
          var d = res.dados || {};
          if (!res.ok) throw new Error(d.erro || 'Não foi possível iniciar o pagamento.');
          // Cartão salvo: cobrado aqui mesmo; a confirmação acompanha a aprovação.
          if (d.cartao_salvo) {
            gravar('sa_pedido_pendente', { id: d.pedido_id, total: d.resumo && d.resumo.total, metodo: 'CREDIT_CARD', prazo: d.resumo && d.resumo.frete_prazo }, sessionStorage);
            estado.conta = null;
            navegar('/confirmacao?pedido=' + encodeURIComponent(d.pedido_id)); return;
          }
          // Só sai do site pra página de pagamento do Asaas, nunca pra outro endereço.
          if (d.metodo === 'CREDIT_CARD' && d.checkout_url && /^https:\/\/([a-z0-9-]+\.)*asaas\.com\//i.test(d.checkout_url)) {
            gravar('sa_pedido_pendente', { id: d.pedido_id, total: d.resumo && d.resumo.total, metodo: 'CREDIT_CARD', prazo: d.resumo && d.resumo.frete_prazo }, sessionStorage);
            location.href = d.checkout_url; return;
          }
          estado.pix = { pedidoId: d.pedido_id, qr: d.pix.qrcode_base64, copia: d.pix.copia_e_cola, total: d.resumo.total, prazo: d.resumo.frete_prazo, expiraEm: Date.now() + CONFIG.pixJanelaSeg * 1000 };
          gravar('sa_pix', estado.pix, sessionStorage);
          navegar('/pix');
        })
        .catch(function (e) {
          if (g !== geracao) return;
          var msg = e && e.message && e.message !== 'Failed to fetch' && !/[A-Z]{4,}/.test(e.message) ? e.message : (f.metodo === 'CREDIT_CARD' ? 'Não foi possível abrir o pagamento no cartão agora. Tente de novo em instantes.' : 'Não foi possível gerar o Pix agora. Tente de novo em instantes.');
          render(ultimaCotacao, msg, false);
        });
    };
  }

  function viewPix() {
    titulo('Pague no Pix');
    var px = estado.pix;
    if (!px || !px.pedidoId || Date.now() > px.expiraEm) {
      app.innerHTML = '<div class="container confirmacao"><h1 class="display">Esse Pix expirou.</h1><p>Sem problema: o carrinho continua salvo. É só gerar outro.</p><a class="btn btn-laranja" href="/checkout" data-link>Gerar novo Pix</a></div>';
      return;
    }
    app.innerHTML = '<div class="container pix">' +
      '<h1 class="display" style="font-size:clamp(30px,6vw,48px)">Pague no Pix</h1>' +
      '<p>Pedido <strong>' + h(px.pedidoId) + '</strong> · total <strong>' + h(fmt(px.total)) + '</strong></p>' +
      '<div class="qr"><img src="data:image/png;base64,' + h(px.qr) + '" alt="QR Code do Pix"></div>' +
      '<div class="contador" id="contador">15:00</div>' +
      '<div class="copia"><input id="copia" readonly value="' + h(px.copia) + '" aria-label="Código Pix copia e cola"><button class="btn btn-verde" type="button" data-action="copiar">Copiar</button></div>' +
      '<div id="pix-aviso"></div>' +
      '<button class="btn btn-contorno" type="button" data-action="ja-paguei">Já paguei</button>' +
      '<ol><li>Abra o app do seu banco e escolha pagar com Pix.</li><li>Escaneie o QR Code ou cole o código copia-e-cola.</li><li>Confirme o valor de ' + h(fmt(px.total)) + '. A confirmação aqui é automática.</li></ol>' +
      '<p class="endereco-resolvido">Não feche esta página até confirmar. Se fechar, é só voltar ao carrinho e gerar outro Pix.</p>' +
    '</div>';
    var contador = document.getElementById('contador');
    var tick = setInterval(function () {
      var resta = Math.max(0, Math.round((px.expiraEm - Date.now()) / 1000));
      contador.textContent = String(Math.floor(resta / 60)).padStart(2, '0') + ':' + String(resta % 60).padStart(2, '0');
      if (resta <= 0) { limparTimers(); track('pix_expired', {}); viewPix(); }
    }, 1000);
    var poll = setInterval(function () { conferirPagamento(px.pedidoId, false); }, CONFIG.pollingMs);
    estado.timers.push(tick, poll);
  }
  function conferirPagamento(pedidoId, manual) {
    var aviso = document.getElementById('pix-aviso');
    return fetch(CONFIG.api + '/api/pedido/' + encodeURIComponent(pedidoId)).then(function (r) { return r.json(); }).then(function (d) {
      if (d.pago || d.status === 'PAGO' || d.status === 'PAGO_AGUARDANDO_CONFIRMACAO') {
        limparTimers();
        navegar('/confirmacao?pedido=' + encodeURIComponent(pedidoId), true);
        return true;
      }
      if (manual && aviso) aviso.innerHTML = '<div class="aviso info">Ainda não identificamos o pagamento. Se você acabou de pagar, o Pix pode levar alguns segundos — a confirmação chega sozinha.</div>';
      return false;
    }).catch(function () { if (manual && aviso) aviso.innerHTML = '<div class="aviso info">Não deu pra conferir agora. A confirmação continua chegando sozinha.</div>'; return false; });
  }

  // Conversão "Compra" do Google Ads, disparada na tela de pedido confirmado (a venda
  // acontece no site). transaction_id = número do pedido: o Google descarta repetição,
  // e a loja ainda marca o pedido no navegador pra não reenviar ao recarregar.
  // E-mail/telefone vão em user_data (conversões otimizadas): o gtag faz o hash antes de enviar.
  // Preencha o rótulo da ação de conversão; vazio = desligado.
  var ADS_CONVERSAO_COMPRA = 'AW-18408434452/O6qKCLyHp7AdEJTW6clE';   // ação "Compra (site)"
  function conversaoAdsCompra(pedidoId, total) {
    if (!ADS_CONVERSAO_COMPRA || !window.gtag || !pedidoId) return;
    var enviados = ler('sa_ads_conv', []);
    if (enviados.indexOf(pedidoId) >= 0) return;
    try {
      var f = estado.form || {}, tel = digitos(f.telefone);
      var dados = {};
      if (f.email) dados.email = String(f.email).trim().toLowerCase();
      if (tel.length >= 10) dados.phone_number = '+55' + tel;
      if (dados.email || dados.phone_number) window.gtag('set', 'user_data', dados);
      window.gtag('event', 'conversion', { send_to: ADS_CONVERSAO_COMPRA, value: Number(total) || 0, currency: 'BRL', transaction_id: pedidoId });
      gravar('sa_ads_conv', enviados.concat(pedidoId).slice(-20));
    } catch (e) { /* rastreio nunca derruba a loja */ }
  }

  function viewConfirmacao() {
    titulo('Pedido confirmado');
    var q = query();
    var pedidoId = q.pedido || (estado.pix && estado.pix.pedidoId) || '';
    if (!pedidoId) { navegar('/carrinho', true); return; }
    var pendente = ler('sa_pedido_pendente', null, sessionStorage) || estado.pix || {};
    function render(status) {
      var pago = status === 'PAGO' || status === 'PAGO_AGUARDANDO_CONFIRMACAO';
      var erro = status === 'ERRO';
      app.innerHTML = '<div class="container confirmacao">' +
        (pago ? '<div class="selo-ok">✓</div><h1 class="display">Pedido confirmado!</h1>' +
          '<p>Pedido <strong>' + h(pedidoId) + '</strong>' + (pendente.total ? ' · ' + h(fmt(pendente.total)) : '') + '</p>' +
          '<p>Nota fiscal e código de rastreio chegam no seu e-mail. Prazo de entrega: <strong>' + h(pendente.prazo || 'até 5 dias úteis') + '</strong> a partir de agora.</p>' +
          '<p class="endereco-resolvido">Dúvida? Escreva pra ' + h(CONFIG.email) + ' com o número do pedido.</p>' +
          '<a class="btn btn-laranja" href="/modelos" data-link>Continuar comprando</a>'
        : erro ? '<h1 class="display">Não achamos esse pedido.</h1><p>Confere o número ou fale com a gente: ' + h(CONFIG.email) + '.</p><a class="btn btn-contorno" href="/carrinho" data-link>Voltar ao carrinho</a>'
        : '<div class="carregando"><span class="spinner"></span><span>Confirmando o pagamento do pedido <strong>' + h(pedidoId) + '</strong>…</span></div><p class="endereco-resolvido">No cartão, a operadora pode levar alguns instantes. Esta página atualiza sozinha.</p>') +
        '</div>';
      if (pago) {
        conversaoAdsCompra(pedidoId, pendente.total);   // antes de limpar o formulário (e-mail/telefone)
        gravar('sa_ja_comprou', true); fecharPopup1a();
        estado.carrinho = []; salvarCarrinho();
        apagar('sa_pix', sessionStorage); apagar('sa_pedido_pendente', sessionStorage); apagar('sa_checkout', sessionStorage);
        estado.pix = null; estado.form = {};
      }
    }
    render('AGUARDANDO');
    var tentativas = 0;
    function checar() {
      tentativas++;
      fetch(CONFIG.api + '/api/pedido/' + encodeURIComponent(pedidoId)).then(function (r) { if (r.status === 404 || r.status === 400) throw new Error('404'); return r.json(); }).then(function (d) {
        if (d.pago || d.status === 'PAGO' || d.status === 'PAGO_AGUARDANDO_CONFIRMACAO') { limparTimers(); render('PAGO'); }
        else if (tentativas > 150) { limparTimers(); render('AGUARDANDO'); }
      }).catch(function (e) { if (String(e.message) === '404') { limparTimers(); render('ERRO'); } });
    }
    checar();
    estado.timers.push(setInterval(checar, CONFIG.pollingMs));
  }

  // ---------------------------------------------------------------------------
  // Conta do cliente. Login é do Supabase Auth (Google e e-mail/senha); a biblioteca
  // só é baixada quando precisa (entrar, área do cliente, checkout logado). O backend
  // (/api/conta) confere o token a cada chamada — aqui nada é decidido sobre acesso.
  // ---------------------------------------------------------------------------
  var AUTH = { url: 'https://ilziprrnkabilgewxvqq.supabase.co', chave: CONFIG.supabaseChave, lib: '/vendor/supabase-2.117.3.js' };
  var CHAVE_SESSAO = 'sb-ilziprrnkabilgewxvqq-auth-token';
  function sessaoLocal() {
    try { var s = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); return s && s.user ? s : null; } catch (e) { return null; }
  }
  function primeiroNomeConta(u) {
    var m = (u && u.user_metadata) || {};
    var n = String(m.full_name || m.name || m.nome || '').trim().split(/\s+/)[0];
    return n || String((u && u.email) || '').split('@')[0];
  }
  function atualizarCabecalhoConta() {
    // Sem a chave pública configurada, a loja segue sem login (nada de botão quebrado).
    document.documentElement.classList.toggle('sem-login', !AUTH.chave);
    var a = document.getElementById('nav-conta');
    var s = sessaoLocal();
    // GA4 User-ID (e Clarity): só o id interno da conta, nunca e-mail. Saiu → limpa.
    var uid = s && s.user && /^[0-9a-f-]{36}$/.test(s.user.id) ? s.user.id : null;
    if (uid !== (window.__saUserId || null) && window.gtag) {
      window.__saUserId = uid;
      window.gtag('set', { user_id: uid });
      window.gtag('set', 'user_properties', { tem_conta: uid ? 'sim' : null });
      if (uid && window.clarity) window.clarity('identify', uid);
    }
    if (!a) return;
    a.innerHTML = s ? '<span class="ola">Olá, </span>' + h(primeiroNomeConta(s.user).slice(0, 14)) : 'Entrar';
  }
  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      var el = document.createElement('script');
      el.src = src; el.async = true; el.onload = ok; el.onerror = function () { falha(new Error('Não foi possível carregar o login. Confira sua conexão.')); };
      document.head.appendChild(el);
    });
  }
  function auth() {
    if (!AUTH.chave) return Promise.reject(new Error('Login indisponível no momento.'));
    if (!estado.auth) {
      estado.auth = carregarScript(AUTH.lib).then(function () {
        // detectSessionInUrl desligado: o boot.js tira o código da URL antes dos
        // rastreadores verem, e o código é trocado aqui (trocarCodigoDaUrl).
        var c = window.supabase.createClient(AUTH.url, AUTH.chave, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: CHAVE_SESSAO } });
        c.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') estado.conta = null; setTimeout(atualizarCabecalhoConta, 0); });
        return c;
      });
      estado.auth.catch(function () { estado.auth = null; });
    }
    return estado.auth;
  }
  // Código que voltou do Google (?code=) ou do e-mail (?token_hash=&type=), guardado pelo boot.js.
  function trocarCodigoDaUrl(c) {
    var d = ler('sa_auth_url', null, sessionStorage);
    if (!d) return Promise.resolve(null);
    apagar('sa_auth_url', sessionStorage);
    if (d.error_description) return Promise.reject(new Error(traduzirErroAuth(d.error_description)));
    if (d.code) return c.auth.exchangeCodeForSession(d.code).then(function (r) { if (r.error) throw r.error; return { tipo: 'oauth' }; });
    if (d.token_hash) {
      var tipo = d.type === 'recovery' ? 'recovery' : 'email';
      return c.auth.verifyOtp({ token_hash: d.token_hash, type: tipo }).then(function (r) { if (r.error) throw r.error; return { tipo: tipo }; });
    }
    return Promise.resolve(null);
  }
  function tokenConta() {
    if (!sessaoLocal()) return Promise.resolve(null);
    return auth().then(function (c) { return c.auth.getSession(); }).then(function (r) { return r.data && r.data.session ? r.data.session.access_token : null; });
  }
  function apiConta(metodo, corpo) {
    return tokenConta().then(function (t) {
      if (!t) { var e0 = new Error('Entre na sua conta.'); e0.status = 401; throw e0; }
      return fetch(CONFIG.api + '/api/conta', { method: metodo, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.erro || 'Não foi possível carregar sua conta.'); e.status = r.status; throw e; } return d; }); });
    });
  }
  function carregarConta(forcar) {
    if (estado.conta && !forcar) return Promise.resolve(estado.conta);
    return apiConta('GET').then(function (d) { estado.conta = d; return d; });
  }
  function traduzirErroAuth(m) {
    m = String((m && m.message) || m || '');
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos (veja também a caixa de spam).';
    if (/already registered|already been registered/i.test(m)) return 'Já existe uma conta com esse e-mail. Entre ou recupere a senha.';
    if (/rate limit|too many|seconds/i.test(m)) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
    if (/password/i.test(m) && /(least|short|weak|characters|pwned|leaked)/i.test(m)) return 'Senha fraca: use pelo menos 8 caracteres, com letras e números.';
    if (/same.*password|different from the old/i.test(m)) return 'A nova senha precisa ser diferente da anterior.';
    if (/expired|invalid.*(token|otp|code|flow)|not found|code verifier/i.test(m)) return 'Este link expirou ou já foi usado. Peça outro.';
    return m && m.length < 140 && !/[{}<>]/.test(m) ? m : 'Não foi possível concluir agora. Tente de novo.';
  }
  // Só volta pra páginas do próprio site (nada de ?voltar=https://golpe.com).
  function destinoSeguro(v) { v = String(v || ''); return /^\/(?!\/)[\w\-/.?=&%]*$/.test(v) && !/^\/(entrar|conta\/confirmar)/.test(v) ? v : ''; }
  function sairDaConta() {
    var feito = function () {
      try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
      estado.conta = null; atualizarCabecalhoConta(); toast('Você saiu da sua conta.'); navegar('/');
    };
    auth().then(function (c) { return c.auth.signOut({ scope: 'local' }); }).then(feito, feito);
  }

  // ---- /entrar: Google, e-mail e senha, criar conta, esqueci a senha ----
  var G_ICONE = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  function viewEntrar() {
    titulo('Entrar');
    var q = query();
    var voltar = destinoSeguro(q.voltar);
    if (sessaoLocal()) { navegar(voltar || '/conta', true); return; }
    var modo = q.modo === 'criar' ? 'criar' : 'entrar';
    var dados = { email: '', nome: '' };
    function render(msg, tipoMsg, enviando) {
      var campo = function (nome, rotulo, attrs, ajuda) { return '<div class="campo"><label for="c-' + nome + '">' + h(rotulo) + '</label><input id="c-' + nome + '" name="' + nome + '" value="' + h(nome === 'senha' ? '' : (dados[nome] || '')) + '" ' + attrs + '>' + (ajuda ? '<span class="ajuda">' + h(ajuda) + '</span>' : '') + '</div>'; };
      var titulos = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha' };
      app.innerHTML = '<div class="container conta-entrar"><div class="painel entrar-caixa">' +
        '<h1 class="display">' + titulos[modo] + '</h1>' +
        (modo === 'esqueci' ? '<p class="entrar-sub">Digite o e-mail da conta. Se ele estiver cadastrado, enviamos um link pra criar uma senha nova.</p>'
          : '<p class="entrar-sub">Acompanhe seus pedidos, salve favoritos e compre mais rápido. Comprar sem conta continua valendo.</p>' +
            '<div class="g-botao" id="g-botao"></div>' +
            '<button type="button" class="btn btn-google btn-bloco" data-action="entrar-google" id="g-reserva" hidden>' + G_ICONE + '<span>Continuar com o Google</span></button>' +
            '<div class="entrar-ou"><span>ou com e-mail</span></div>') +
        '<form class="form-grid" data-action="form-conta" method="post" action="/entrar" novalidate>' +
          (modo === 'criar' ? campo('nome', 'Nome', 'autocomplete="name" required maxlength="80"') : '') +
          campo('email', 'E-mail', 'type="email" inputmode="email" autocomplete="username" required maxlength="120"') +
          (modo === 'entrar' ? campo('senha', 'Senha', 'type="password" autocomplete="current-password" required') : '') +
          (modo === 'criar' ? campo('senha', 'Senha', 'type="password" autocomplete="new-password" required minlength="8"', 'Mínimo de 8 caracteres, com letras e números.') : '') +
          (msg ? '<div class="aviso ' + (tipoMsg || 'erro') + '" role="alert">' + msg + '</div>' : '') +
          '<button class="btn btn-laranja btn-bloco" type="submit"' + (enviando ? ' disabled' : '') + '>' + (enviando ? 'Aguarde…' : ({ entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Enviar link' })[modo]) + '</button>' +
        '</form>' +
        '<div class="entrar-links">' +
          (modo === 'entrar' ? '<button type="button" class="link" data-action="modo-conta" data-modo="esqueci">Esqueci minha senha</button><span>Não tem conta? <button type="button" class="link" data-action="modo-conta" data-modo="criar">Criar conta</button></span>' : '') +
          (modo === 'criar' ? '<span>Já tem conta? <button type="button" class="link" data-action="modo-conta" data-modo="entrar">Entrar</button></span>' : '') +
          (modo === 'esqueci' ? '<button type="button" class="link" data-action="modo-conta" data-modo="entrar">Voltar pra entrar</button>' : '') +
        '</div>' +
        (modo === 'criar' ? '<p class="entrar-lgpd">Ao criar a conta, você concorda com os <a href="/termos" data-link>termos de uso</a> e a <a href="/privacidade" data-link>política de privacidade</a>.</p>' : '') +
      '</div></div>';
    }
    render();
    botaoGoogle(voltar);
    estado.entrarModo = function (novo) { modo = novo; render(); if (novo !== 'esqueci') botaoGoogle(voltar); var el = document.getElementById(modo === 'criar' ? 'c-nome' : 'c-email'); if (el) el.focus(); };
    app.oninput = function (e) { if (e.target.name && e.target.name !== 'senha') dados[e.target.name] = e.target.value; };
    app.onsubmit = function (e) {
      if (!e.target.matches('[data-action="form-conta"]')) return;
      e.preventDefault();
      var f = e.target;
      var email = String(f.email.value || '').trim().toLowerCase();
      var senha = f.senha ? f.senha.value : '';
      dados.email = email;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { render('Digite um e-mail válido.'); return; }
      if (modo === 'criar') {
        dados.nome = String(f.nome.value || '').trim();
        if (dados.nome.length < 2) { render('Digite seu nome.'); return; }
        if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) { render('Senha fraca: use pelo menos 8 caracteres, com letras e números.'); return; }
      }
      if (modo === 'entrar' && !senha) { render('Digite sua senha.'); return; }
      render('', '', true);
      if (voltar) gravar('sa_voltar', voltar, sessionStorage);
      auth().then(function (c) {
        if (modo === 'entrar') return c.auth.signInWithPassword({ email: email, password: senha }).then(function (r) {
          if (r.error) throw r.error;
          track('login', { method: 'email' }); estado.conta = null; atualizarCabecalhoConta();
          apagar('sa_voltar', sessionStorage);
          navegar(voltar || '/conta', true);
        });
        if (modo === 'criar') return c.auth.signUp({ email: email, password: senha, options: { data: { full_name: dados.nome }, emailRedirectTo: CONFIG.site + '/conta/confirmar' } }).then(function (r) {
          if (r.error) throw r.error;
          track('sign_up', { method: 'email' });
          // Mesma resposta exista ou não a conta (não revela quem é cliente).
          render('Pronto! Enviamos um link de confirmação para <strong>' + h(email) + '</strong>. Abra o e-mail e toque no link pra ativar a conta (veja também o spam).', 'ok');
        });
        return c.auth.resetPasswordForEmail(email, { redirectTo: CONFIG.site + '/conta/confirmar' }).then(function (r) {
          if (r.error) throw r.error;
          render('Se existir uma conta com <strong>' + h(email) + '</strong>, o link pra criar uma senha nova chega em instantes. Ele vale por 1 hora.', 'ok');
        });
      }).catch(function (err) { render(h(traduzirErroAuth(err))); });
    };
  }
  // Botão oficial do Google: devolve um token assinado pelo Google (com o nosso nonce),
  // que o Supabase confere e troca pela sessão. Se o script do Google não carregar
  // (bloqueador, rede), aparece o botão de reserva, que vai pelo redirecionamento.
  function hexAleatorio() { var a = new Uint8Array(32); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sha256Hex(txt) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)).then(function (buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }); }
  function botaoGoogle(voltar) {
    var alvo = document.getElementById('g-botao');
    if (!alvo) return;
    var g0 = geracao;
    var reserva = function () { if (g0 !== geracao) return; var b = document.getElementById('g-reserva'); if (b) b.hidden = false; var a = document.getElementById('g-botao'); if (a) a.hidden = true; };
    if (!CONFIG.googleClientId || !window.crypto || !crypto.subtle) { reserva(); return; }
    var nonce = hexAleatorio();
    var gsi = window.google && window.google.accounts ? Promise.resolve() : (estado.gsi || (estado.gsi = carregarScript('https://accounts.google.com/gsi/client')));
    var prazo = setTimeout(reserva, 5000);
    Promise.all([gsi, sha256Hex(nonce)]).then(function (r) {
      clearTimeout(prazo);
      var a = document.getElementById('g-botao');
      if (!a || g0 !== geracao || !(window.google && google.accounts && google.accounts.id)) { reserva(); return; }
      google.accounts.id.initialize({
        client_id: CONFIG.googleClientId, nonce: r[1], ux_mode: 'popup', context: 'signin', itp_support: true, use_fedcm_for_button: true,
        callback: function (resp) {
          if (!resp || !resp.credential) return;
          app.querySelectorAll('.aviso').forEach(function (x) { x.remove(); });
          auth().then(function (c) { return c.auth.signInWithIdToken({ provider: 'google', token: resp.credential, nonce: nonce }); }).then(function (res) {
            if (res.error) throw res.error;
            track('login', { method: 'google' }); estado.conta = null; atualizarCabecalhoConta();
            navegar(voltar || '/conta', true);
          }).catch(function (e) { toast(h(traduzirErroAuth(e)), 5000); botaoGoogle(voltar); });
        }
      });
      a.innerHTML = ''; a.hidden = false;
      var rb = document.getElementById('g-reserva'); if (rb) rb.hidden = true;   // chegou depois do prazo: volta o oficial
      google.accounts.id.renderButton(a, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'center', locale: 'pt-BR', width: Math.min(400, Math.max(240, a.clientWidth || 320)) });
    }).catch(function () { clearTimeout(prazo); reserva(); });
  }
  function entrarComGoogle() {
    var voltar = destinoSeguro(query().voltar);
    if (voltar) gravar('sa_voltar', voltar, sessionStorage);
    track('login_inicio', { method: 'google' });
    auth().then(function (c) {
      return c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: CONFIG.site + '/conta', queryParams: { prompt: 'select_account' } } });
    }).then(function (r) { if (r && r.error) throw r.error; }).catch(function (e) { toast(h(traduzirErroAuth(e))); });
  }

  // ---- /conta/confirmar: link do e-mail (confirmar cadastro ou nova senha) ----
  function viewConfirmarConta() {
    titulo('Sua conta');
    app.innerHTML = '<div class="carregando"><span class="spinner"></span> Conferindo o link…</div>';
    var g = geracao;
    auth().then(function (c) {
      return trocarCodigoDaUrl(c).then(function (r) {
        if (g !== geracao) return;
        if (!r) { navegar('/conta', true); return; }
        atualizarCabecalhoConta();
        if (r.tipo !== 'recovery') { toast('E-mail confirmado. Bem-vindo(a)!'); var v = ler('sa_voltar', '', sessionStorage); apagar('sa_voltar', sessionStorage); navegar(destinoSeguro(v) || '/conta', true); return; }
        novaSenha(c);
      });
    }).catch(function (e) {
      if (g !== geracao) return;
      app.innerHTML = '<div class="container conta-entrar"><div class="painel entrar-caixa"><h1 class="display">Link inválido</h1><p>' + h(traduzirErroAuth(e)) + '</p><a class="btn btn-laranja btn-bloco" href="/entrar" data-link>Ir para entrar</a></div></div>';
    });
  }
  function novaSenha(c) {
    var s = sessaoLocal();
    function render(msg, enviando) {
      app.innerHTML = '<div class="container conta-entrar"><div class="painel entrar-caixa"><h1 class="display">Nova senha</h1>' +
        '<form class="form-grid" data-action="nova-senha" method="post" action="/conta" novalidate>' +
          '<input type="email" name="usuario" autocomplete="username" value="' + h(s && s.user ? s.user.email : '') + '" hidden readonly>' +
          '<div class="campo"><label for="c-senha">Nova senha</label><input id="c-senha" name="senha" type="password" autocomplete="new-password" required minlength="8"><span class="ajuda">Mínimo de 8 caracteres, com letras e números.</span></div>' +
          (msg ? '<div class="aviso erro" role="alert">' + h(msg) + '</div>' : '') +
          '<button class="btn btn-laranja btn-bloco" type="submit"' + (enviando ? ' disabled' : '') + '>' + (enviando ? 'Salvando…' : 'Salvar senha') + '</button>' +
        '</form></div></div>';
    }
    render();
    app.onsubmit = function (e) {
      if (!e.target.matches('[data-action="nova-senha"]')) return;
      e.preventDefault();
      var senha = e.target.senha.value;
      if (senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) { render('Senha fraca: use pelo menos 8 caracteres, com letras e números.'); return; }
      render('', true);
      c.auth.updateUser({ password: senha }).then(function (r) {
        if (r.error) throw r.error;
        toast('Senha nova salva. Você já está na sua conta.');
        navegar('/conta', true);
      }).catch(function (err) { render(traduzirErroAuth(err)); });
    };
  }

  // ---- /conta: área do cliente ----
  var MENU_CONTA = [
    ['', 'Minha conta', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
    ['compras', 'Minhas compras', 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 8H6M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
    ['favoritos', 'Favoritos', 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z'],
    ['avaliacoes', 'Minhas avaliações', 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'],
    ['pagamentos', 'Métodos de pagamento', 'M3 6h18v12H3zM3 10h18M7 15h4'],
    ['atendimentos', 'Atendimentos', 'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM8 9h8M8 13h5']
  ];
  function iconeConta(d) { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  function dataBr(iso, longa) { if (!iso) return ''; var d = new Date(iso); return longa ? d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: '2-digit' }).replace(/ de /g, ' ').replace('.', '') : d.toLocaleDateString('pt-BR'); }
  function pilulaStatus(p) { return '<span class="pilula' + (p.pago ? ' ok' : (p.etapa == null ? ' ruim' : '')) + '">' + h(p.rotulo) + '</span>'; }
  function produtoDoItem(i) {
    var a = estado.porSku[String(i.sku).toUpperCase()];
    return a ? a : (i.codigo_pai && estado.porCodigo[String(i.codigo_pai).toUpperCase()] ? { produto: estado.porCodigo[String(i.codigo_pai).toUpperCase()], variacao: null } : null);
  }
  function barraStatusHtml(p) {
    if (p.etapa == null) return '';
    var nomes = ['Pedido feito', p.etapa === 1 ? 'Aguardando pagamento' : 'Pagamento', 'Separação', 'A caminho', 'Entregue'];
    var datas = [p.criado_em, p.pago_em];
    return '<div class="status-barra" role="img" aria-label="Status: ' + h(p.rotulo) + '"><div class="status-trilho">' + nomes.map(function (_, i) {
      return '<span class="status-seg' + (i <= p.etapa ? ' cheio' : '') + (i === p.etapa && p.etapa < 4 ? ' atual' : '') + '"><i></i></span>';
    }).join('') + '</div><div class="status-nomes">' + nomes.map(function (n, i) {
      return '<span class="' + (i <= p.etapa ? 'feito' : '') + '"><strong>' + h(n) + '</strong>' + (i <= p.etapa && datas[i] ? '<small>' + h(dataBr(datas[i])) + '</small>' : '') + '</span>';
    }).join('') + '</div></div>';
  }
  function itemPedidoHtml(p, i, comAcoes) {
    var a = produtoDoItem(i);
    var url = a ? (a.variacao && a.variacao.url) || a.produto.url : '';
    var img = i.imagem || (a && ((a.variacao && a.variacao.imagem) || a.produto.imagem));
    return '<div class="conta-item">' +
      (img ? '<img src="' + h(foto(img)) + '" alt="" loading="lazy">' : '<div class="conta-item-vazio"></div>') +
      '<div><div class="conta-item-topo">' + (url ? '<a href="' + h(url) + '" data-link>' + h(i.nome) + '</a>' : '<span>' + h(i.nome) + '</span>') + '<strong>' + h(fmt(i.total)) + '</strong></div>' +
      '<small>Quantidade: ' + h(i.qty) + '</small>' +
      (comAcoes && p.pago ? '<div class="conta-acoes">' + (i.avaliado ? '<span class="pilula ok">Avaliado ✓</span>' : '<button class="btn btn-verde btn-mini" data-action="avaliar-item" data-pedido="' + h(p.id) + '" data-sku="' + h(i.sku) + '">Escrever avaliação</button>') + '</div>' : '') +
      '</div></div>';
  }
  function viewConta(m) {
    var aba = m[1] || '', id = m[2] || '';
    titulo('Minha conta');
    if (!sessaoLocal() && !ler('sa_auth_url', null, sessionStorage)) { navegar('/entrar?voltar=' + encodeURIComponent(location.pathname), true); return; }
    app.innerHTML = '<div class="carregando"><span class="spinner"></span> Abrindo sua conta…</div>';
    var g = geracao;
    auth().then(function (c) { return trocarCodigoDaUrl(c); }).then(function (r) {
      if (r && r.tipo === 'oauth') {
        track('login', { method: 'google' }); estado.conta = null; atualizarCabecalhoConta();
        var v = destinoSeguro(ler('sa_voltar', '', sessionStorage)); apagar('sa_voltar', sessionStorage);
        if (v && v !== location.pathname) { navegar(v, true); return null; }
      }
      return carregarConta(true);
    }).then(function (d) {
      if (!d || g !== geracao) return;
      renderConta(aba, id, d);
    }).catch(function (e) {
      if (g !== geracao) return;
      if (e && e.status === 401) { try { localStorage.removeItem(CHAVE_SESSAO); } catch (x) {} atualizarCabecalhoConta(); navegar('/entrar?voltar=' + encodeURIComponent(location.pathname), true); return; }
      app.innerHTML = '<div class="container institucional"><h1 class="display">Não deu pra abrir sua conta.</h1><p>' + h(e.status === 403 ? e.message : traduzirErroAuth(e)) + '</p><p><button class="link" data-action="recarregar-conta">Tentar de novo</button></p></div>';
    });
  }
  // Fim da página do pedido: atendimento em andamento (se houver) e o botão de pedir ajuda.
  function ajudaPedidoHtml(p, ats) {
    var abertos = ats.filter(function (t) { return t.pedido === p.id && t.status !== 'resolvido'; });
    return '<div class="painel conta-bloco atend-pedido">' +
      (abertos.length ? '<strong>Atendimento sobre este pedido</strong>' + abertos.map(function (t) {
          return '<a class="conta-linha atend-link" href="/conta/atendimentos/' + encodeURIComponent(String(t.numero)) + '" data-link><span>Atendimento #' + h(t.numero) + ' · ' + h(t.status_rotulo || t.status) + '</span><span aria-hidden="true">→</span></a>';
        }).join('') +
        '<div><button type="button" class="btn btn-contorno btn-mini" data-action="atend-mostrar" data-alvo="atend-novo" aria-expanded="false" aria-controls="atend-novo">Abrir outro atendimento</button></div>'
        : '<div><button type="button" class="btn btn-verde btn-mini" data-action="atend-mostrar" data-alvo="atend-novo" aria-expanded="false" aria-controls="atend-novo">Preciso de ajuda com este pedido</button></div>') +
      '<div id="atend-novo" hidden>' + formAtendContaHtml(p.id) + '</div>' +
      '</div>' +
      '<p class="conta-ajuda">Troca grátis em até 7 dias úteis após o recebimento.</p>';
  }
  function renderConta(aba, id, d) {
    var menu = '<aside class="conta-menu"><nav aria-label="Minha conta">' + MENU_CONTA.map(function (x) {
      return '<a href="/conta' + (x[0] ? '/' + x[0] : '') + '" data-link class="' + (x[0] === aba ? 'ativo' : '') + '">' + iconeConta(x[2]) + '<span>' + h(x[1]) + '</span></a>';
    }).join('') + '<button type="button" data-action="sair">' + iconeConta('M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H4') + '<span>Sair</span></button></nav></aside>';
    var corpo = '';
    var pedidos = d.pedidos || [];
    if (aba === '') {
      var ult = pedidos[0];
      var nome = (d.perfil.nome || '').split(' ')[0];
      var favs = (d.favoritos || []).length;
      corpo = '<h1 class="conta-titulo">Olá' + (nome ? ', ' + h(nome) : '') + '!</h1><p class="conta-sub">Seus pedidos, favoritos e cartões num lugar só.</p>' +
        '<div class="conta-destaques">' +
          '<div class="conta-cartao ultima">' +
            '<div class="conta-cartao-topo"><span>' + iconeConta('M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z') + '<strong>Última compra</strong></span>' + (ult ? '<small>Pedido ' + h(ult.id) + '</small>' : '') + '</div>' +
            (ult ? '<div class="conta-cartao-corpo">' + itemPedidoHtml(ult, ult.itens[0], false) +
                (ult.itens.length > 1 ? '<p class="conta-mais">+ ' + (ult.itens.length - 1) + ' ' + (ult.itens.length > 2 ? 'itens' : 'item') + ' · total ' + h(fmt(ult.total)) + '</p>' : '') +
                '<div class="conta-linha">' + pilulaStatus(ult) + '<span>' + h(dataBr(ult.criado_em, true)) + '</span></div>' +
                '<div class="conta-acoes">' + (ult.pago && ult.itens.some(function (i) { return !i.avaliado; }) ? '<button class="btn btn-verde btn-mini" data-action="avaliar-item" data-pedido="' + h(ult.id) + '" data-sku="' + h((ult.itens.find(function (i) { return !i.avaliado; }) || {}).sku) + '">Escrever avaliação</button>' : '') +
                '<button class="btn btn-contorno btn-mini" data-action="comprar-novamente" data-pedido="' + h(ult.id) + '">Comprar novamente</button></div></div>' +
                '<a class="conta-cartao-rodape" href="/conta/compras/' + h(ult.id) + '" data-link>Ver detalhes do pedido</a>'
              : '<div class="conta-cartao-corpo"><p>Você ainda não tem compras com <strong>' + h(d.perfil.email) + '</strong>.</p><a class="btn btn-laranja btn-mini" href="/modelos" data-link>Ver modelos</a></div>') +
          '</div>' +
          '<a class="conta-cartao favs" href="/conta/favoritos" data-link><span class="conta-cartao-topo"><span>' + iconeConta(MENU_CONTA[2][2]) + '<strong>Meus favoritos</strong></span></span>' +
            '<span class="favs-num">' + favs + '</span><span class="favs-rotulo">' + (favs === 1 ? 'modelo salvo' : 'modelos salvos') + '</span><span class="favs-ir">Ver favoritos →</span></a>' +
        '</div>' +
        '<h2 class="conta-h2">Acesso rápido</h2><div class="conta-rapido">' +
          MENU_CONTA.slice(1).map(function (x) { return '<a href="/conta/' + x[0] + '" data-link>' + iconeConta(x[2]) + '<span>' + h(x[1]) + '</span></a>'; }).join('') +
          '<a href="/contato" data-link>' + iconeConta('M12 21a9 9 0 1 0-8-4.9L3 21l4.9-1A9 9 0 0 0 12 21zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 16.5v.01') + '<span>Ajuda</span></a>' +
        '</div>';
    } else if (aba === 'compras' && id) {
      var p = pedidos.find(function (x) { return x.id === id; });
      if (!p) corpo = '<h1 class="conta-titulo">Pedido não encontrado</h1><p>Ele não está nesta conta. <a href="/conta/compras" data-link>Ver minhas compras</a></p>';
      else {
        var linha = function (r, v, cls) { return '<div class="resumo-linha' + (cls ? ' ' + cls : '') + '"><span>' + r + '</span><span>' + v + '</span></div>'; };
        corpo = '<a class="link conta-voltar" href="/conta/compras" data-link>← Minhas compras</a>' +
          '<h1 class="conta-titulo">Pedido ' + h(p.id) + '</h1><p class="conta-sub">Realizado em ' + h(new Date(p.criado_em).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })) + ' · ' + h(fmt(p.total)) + '</p>' +
          '<div class="painel conta-bloco"><div class="conta-linha"><strong>Status do pedido</strong>' + pilulaStatus(p) + '</div>' + barraStatusHtml(p) + '</div>' +
          '<div class="painel conta-bloco"><strong>Itens</strong>' + p.itens.map(function (i) { return itemPedidoHtml(p, i, true); }).join('') +
            '<div class="conta-totais">' + linha('Subtotal', h(fmt(p.subtotal))) +
              (p.desconto > 0 ? linha('2ª armação -' + h(p.desconto_pct) + '%', '-' + h(fmt(p.desconto)), 'verde') : '') +
              (p.desconto_primeira > 0 ? linha('1ª compra -' + h(p.desconto_primeira_pct) + '%', '-' + h(fmt(p.desconto_primeira)), 'verde') : '') +
              linha('Frete' + (p.frete_prazo ? ' <small>(' + h(p.frete_prazo) + ')</small>' : ''), p.frete ? h(fmt(p.frete)) : 'grátis') +
              linha('<strong>Total</strong>', '<strong>' + h(fmt(p.total)) + '</strong>') + '</div>' +
            '<button class="btn btn-contorno btn-mini" data-action="comprar-novamente" data-pedido="' + h(p.id) + '">Comprar novamente</button></div>' +
          '<div class="conta-duas">' +
            '<div class="painel conta-bloco"><strong>Pagamento</strong><span>' + h(p.pagamento) + '</span></div>' +
            (p.entrega ? '<div class="painel conta-bloco"><strong>Entrega</strong><span>' + h(p.entrega) + '</span></div>' : '') +
          '</div>' +
          ajudaPedidoHtml(p, atendimentosDaConta(d));
      }
    } else if (aba === 'compras') {
      corpo = '<h1 class="conta-titulo">Minhas compras</h1>' + (pedidos.length ? '<div class="conta-lista">' + pedidos.map(function (p) {
        return '<a class="conta-pedido" href="/conta/compras/' + h(p.id) + '" data-link>' +
          '<div class="conta-pedido-fotos">' + p.itens.slice(0, 3).map(function (i) { var a = produtoDoItem(i); var img = i.imagem || (a && (a.variacao || a.produto).imagem); return img ? '<img src="' + h(foto(img)) + '" alt="" loading="lazy">' : ''; }).join('') + '</div>' +
          '<div class="conta-pedido-info"><strong>Pedido ' + h(p.id) + '</strong><small>' + h(dataBr(p.criado_em, true)) + ' · ' + p.itens.reduce(function (s, i) { return s + i.qty; }, 0) + ' ' + (p.itens.reduce(function (s, i) { return s + i.qty; }, 0) > 1 ? 'itens' : 'item') + ' · ' + h(fmt(p.total)) + '</small></div>' +
          pilulaStatus(p) + '</a>';
      }).join('') + '</div>' : '<div class="painel"><p>Nenhuma compra com <strong>' + h(d.perfil.email) + '</strong> ainda. Pedidos feitos sem conta com esse e-mail aparecem aqui sozinhos.</p><a class="btn btn-laranja btn-mini" href="/modelos" data-link>Ver modelos</a></div>');
    } else if (aba === 'favoritos') {
      var lista = (d.favoritos || []).map(function (c) { return estado.porCodigo[String(c).toUpperCase()]; }).filter(Boolean);
      corpo = '<h1 class="conta-titulo">Favoritos</h1>' + (lista.length ? '<div class="grade conta-favs">' + lista.map(function (p) {
        return '<div class="conta-fav">' + cardProduto(p) + '<button class="link" data-action="favoritar" data-codigo="' + h(p.codigo) + '" data-ligado="1">Remover dos favoritos</button></div>';
      }).join('') + '</div>' : '<div class="painel"><p>Toque em <strong>♡ Favoritar</strong> na página de um modelo pra guardar aqui.</p><a class="btn btn-laranja btn-mini" href="/modelos" data-link>Ver modelos</a></div>');
    } else if (aba === 'avaliacoes') {
      var pendentes = [];
      pedidos.forEach(function (p) { if (p.pago) p.itens.forEach(function (i) { if (!i.avaliado && !pendentes.some(function (x) { return x.i.sku === i.sku; })) pendentes.push({ p: p, i: i }); }); });
      corpo = '<h1 class="conta-titulo">Minhas avaliações</h1>' +
        (pendentes.length ? '<h2 class="conta-h2">Pra avaliar</h2><div class="painel conta-bloco">' + pendentes.map(function (x) { return itemPedidoHtml(x.p, x.i, true); }).join('') + '</div>' : '') +
        '<h2 class="conta-h2">Enviadas</h2>' + ((d.avaliacoes || []).length ? '<div class="conta-lista">' + d.avaliacoes.map(function (a) {
          var prod = estado.porCodigo[String(a.modelo).toUpperCase()];
          return '<div class="painel conta-aval"><div class="conta-linha"><strong>' + h(prod ? prod.nome : a.modelo) + (a.cor ? ' · ' + h(a.cor) : '') + '</strong><span class="pilula' + (a.status === 'Publicada' ? ' ok' : '') + '">' + h(a.status) + '</span></div>' +
            '<span class="estrelas" aria-label="Nota ' + a.nota + ' de 5">' + estrelas(a.nota) + '</span><p>' + h(a.texto) + '</p><small>' + h(dataBr(a.data, true)) + '</small></div>';
        }).join('') + '</div>' : '<p class="conta-sub">Você ainda não avaliou nenhuma compra.</p>') +
        '<p class="conta-ajuda">Toda avaliação passa por uma conferência rápida antes de aparecer na loja. Publicamos as boas e as ruins.</p>';
    } else if (aba === 'atendimentos' && id) {
      var t = atendimentosDaConta(d).find(function (x) { return String(x.numero) === id; });
      corpo = '<a class="link conta-voltar" href="/conta/atendimentos" data-link>← Atendimentos</a>' +
        (!t ? '<h1 class="conta-titulo">Atendimento não encontrado</h1><p>Ele não está nesta conta. <a href="/conta/atendimentos" data-link>Ver meus atendimentos</a></p>'
          : cabecalhoAtendHtml(t) + (t.pedido ? '<p class="conta-ajuda"><a href="/conta/compras/' + h(t.pedido) + '" data-link>Ver pedido ' + h(t.pedido) + ' →</a></p>' : '') +
            threadAtendHtml(t) + respostaAtendHtml(t));
    } else if (aba === 'atendimentos') {
      var ats = atendimentosDaConta(d);
      corpo = '<h1 class="conta-titulo">Atendimentos</h1><p class="conta-sub">Suas conversas com a nossa equipe. Respondemos em até 1 dia útil.</p>' +
        '<div><button type="button" class="btn btn-verde btn-mini" data-action="atend-mostrar" data-alvo="atend-novo" aria-expanded="false" aria-controls="atend-novo">Novo atendimento</button></div>' +
        '<div class="painel conta-bloco" id="atend-novo" hidden><strong>Novo atendimento</strong>' + formAtendContaHtml('', pedidos) + '</div>' +
        (ats.length ? '<div class="conta-lista">' + ats.map(function (t) {
          return '<a class="conta-pedido atend-item" href="/conta/atendimentos/' + encodeURIComponent(String(t.numero)) + '" data-link>' +
            '<span class="atend-num">#' + h(t.numero) + '</span>' +
            '<div class="conta-pedido-info"><strong>' + h(t.assunto) + '</strong><small>' + h(t.categoria_rotulo || t.categoria) + (t.pedido ? ' · Pedido ' + h(t.pedido) : '') + ' · atualizado em ' + h(dataBr(t.atualizado_em || t.criado_em, true)) + '</small></div>' +
            pilulaAtend(t) + '</a>';
        }).join('') + '</div>' : '<div class="painel"><p>Você ainda não abriu nenhum atendimento. Dúvida, troca ou problema com um pedido? Toque em <strong>Novo atendimento</strong>.</p></div>');
    } else if (aba === 'pagamentos') {
      corpo = '<h1 class="conta-titulo">Métodos de pagamento</h1>' +
        ((d.cartoes || []).length ? '<div class="conta-lista">' + d.cartoes.map(function (c) {
          return '<div class="painel conta-cartao-salvo"><div class="cc-icone">' + iconeConta(MENU_CONTA[4][2]) + '</div><div><strong>' + h(c.bandeira ? c.bandeira.charAt(0) + c.bandeira.slice(1).toLowerCase() : 'Cartão') + ' •••• ' + h(c.final || '') + '</strong>' +
            '<small>Salvo em ' + h(dataBr(c.criado_em)) + (c.ceps && c.ceps.length ? ' · entrega em ' + h(c.ceps.join(', ')) : '') + '</small></div>' +
            '<button class="link" data-action="remover-cartao" data-id="' + h(c.id) + '">Remover</button></div>';
        }).join('') + '</div>' : '<div class="painel"><p>Nenhum cartão salvo.</p></div>') +
        '<div class="painel conta-bloco conta-explica"><strong>Como salvar um cartão</strong><span>Na próxima compra no cartão de crédito, deixe marcado <em>“Salvar este cartão”</em>. Depois disso, é só escolher o cartão no checkout e pagar sem digitar nada.</span>' +
        '<strong>É seguro?</strong><span>O número do cartão fica guardado com o Asaas, a instituição de pagamento, e nunca passa pelo nosso site. A gente só vê a bandeira e os 4 últimos números. Por segurança, o pagamento com 1 clique vale para os endereços onde você já recebeu com esse cartão; endereço novo pede o cartão na página segura.</span>' +
        '<strong>Pix</strong><span>Continua disponível em todo pedido, com aprovação na hora.</span></div>';
    }
    app.innerHTML = '<div class="container conta">' + menu + '<section class="conta-conteudo">' + corpo + '</section></div>';
  }
  function comprarNovamente(pedidoId) {
    var p = estado.conta && (estado.conta.pedidos || []).find(function (x) { return x.id === pedidoId; });
    if (!p) return;
    var faltou = 0, entrou = 0;
    p.itens.forEach(function (i) {
      var a = estado.porSku[String(i.sku).toUpperCase()];
      if (!a || !(a.variacao.estoque > 0) || !(a.variacao.preco > 0)) { faltou++; return; }
      var atual = estado.carrinho.find(function (x) { return x.sku === a.variacao.sku; });
      var qtd = Math.min(i.qty, a.variacao.estoque - (atual ? atual.qty : 0));
      if (qtd <= 0) return;
      if (atual) atual.qty += qtd;
      else estado.carrinho.push({ sku: a.variacao.sku, qty: qtd, codigo: a.produto.codigo, nome: a.produto.nome, cor: a.variacao.cor, preco: a.variacao.preco, imagem: a.variacao.imagem || a.produto.imagem });
      entrou++;
    });
    salvarCarrinho();
    track('compra_novamente', { pedido: pedidoId, itens: entrou });
    if (!entrou) { toast(faltou ? 'Os modelos deste pedido estão esgotados no momento.' : 'Esses itens já estão no carrinho.'); return; }
    if (faltou) toast(faltou + ' ' + (faltou > 1 ? 'itens esgotaram' : 'item esgotou') + ' e não entrou no carrinho.', 4000);
    navegar('/carrinho');
  }
  function avaliarItem(el) {
    el.disabled = true;
    apiConta('POST', { acao: 'avaliar', pedido: el.dataset.pedido, sku: el.dataset.sku })
      .then(function (d) { navegar('/avaliar/' + d.token); })
      .catch(function (e) { el.disabled = false; toast(h(e.message)); });
  }
  function favoritar(el) {
    if (!sessaoLocal()) { toast('Entre na sua conta pra salvar favoritos.'); navegar('/entrar?voltar=' + encodeURIComponent(location.pathname + location.search)); return; }
    var codigo = el.dataset.codigo;
    var ligar = el.dataset.ligado !== '1';
    el.disabled = true;
    apiConta('POST', { acao: 'favorito', codigo: codigo, ligar: ligar }).then(function () {
      if (estado.conta) {
        var lista = estado.conta.favoritos = (estado.conta.favoritos || []).filter(function (c) { return String(c).toUpperCase() !== String(codigo).toUpperCase(); });
        if (ligar) lista.unshift(String(codigo).toUpperCase());
      }
      track(ligar ? 'add_to_wishlist' : 'remove_from_wishlist', { item_id: codigo });
      if (/^\/conta\/favoritos/.test(location.pathname)) { renderConta('favoritos', '', estado.conta); return; }
      marcarFavorito(el, ligar);
      toast(ligar ? 'Salvo nos favoritos. <a href="/conta/favoritos" data-link>Ver favoritos →</a>' : 'Removido dos favoritos.', 3000);
    }).catch(function (e) { toast(h(e.message)); }).then(function () { el.disabled = false; });
  }
  function marcarFavorito(el, ligado) {
    el.dataset.ligado = ligado ? '1' : '';
    el.setAttribute('aria-pressed', ligado ? 'true' : 'false');
    var t = el.querySelector('span'); if (t) t.textContent = ligado ? 'Nos favoritos' : 'Favoritar';
  }
  // Página do produto: acende o coração se o modelo já está nos favoritos.
  function conferirFavorito(codigo) {
    if (!sessaoLocal()) return;
    var g = geracao;
    carregarConta().then(function (d) {
      if (g !== geracao) return;
      var el = document.querySelector('[data-action="favoritar"][data-codigo="' + String(codigo).replace(/"/g, '') + '"]');
      if (el) marcarFavorito(el, (d.favoritos || []).some(function (c) { return String(c).toUpperCase() === String(codigo).toUpperCase(); }));
    }).catch(function () {});
  }

  // ---------------------------------------------------------------------------
  // Atendimentos (tickets): na conta (/conta/atendimentos, via /api/conta) e pra quem
  // não tem conta (/contato abre; /atendimento/:token acompanha, link que vai por e-mail).
  // ---------------------------------------------------------------------------
  var CATEGORIAS_ATEND = [
    ['duvida', 'Dúvida'], ['troca', 'Troca'], ['devolucao', 'Devolução / reembolso'], ['atraso', 'Atraso na entrega'],
    ['defeito', 'Produto com defeito'], ['pagamento', 'Pagamento'], ['nota_fiscal', 'Nota fiscal'], ['outro', 'Outro']
  ];
  var ATEND_MIN = 10, ATEND_MAX = 2000;
  var RE_PEDIDO = /^SA-[A-Z0-9]+-[A-Z0-9]{4}$/;
  function dataHoraBr(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function pilulaAtend(t) {
    var cls = t.status === 'resolvido' ? ' ok' : t.status === 'aguardando_cliente' ? ' atencao' : '';
    return '<span class="pilula' + cls + '">' + h(t.status_rotulo || t.status) + '</span>';
  }
  function campoMensagemAtend(rotulo) {
    return '<div class="campo"><label for="at-mensagem">' + h(rotulo) + '</label>' +
      '<textarea id="at-mensagem" name="mensagem" rows="5" minlength="' + ATEND_MIN + '" maxlength="' + ATEND_MAX + '" required data-contador="at-contador" aria-describedby="at-contador"></textarea>' +
      '<span class="ajuda" id="at-contador">0 / ' + ATEND_MAX + ' (mínimo ' + ATEND_MIN + ')</span></div>';
  }
  function campoCategoriaAtend() {
    return '<div class="campo"><label for="at-categoria">Assunto</label><select id="at-categoria" name="categoria" required>' +
      '<option value="">Escolha o assunto</option>' +
      CATEGORIAS_ATEND.map(function (c) { return '<option value="' + c[0] + '">' + h(c[1]) + '</option>'; }).join('') + '</select></div>';
  }
  // Formulário de abrir atendimento na conta. `pedido`: fixo (página do pedido);
  // senão, `pedidos` vira um select opcional.
  function formAtendContaHtml(pedido, pedidos) {
    return '<form class="form-grid" data-action="atend-abrir" novalidate>' +
      (pedido ? '<input type="hidden" name="pedido" value="' + h(pedido) + '">'
        : '<div class="campo"><label for="at-pedido">Pedido (opcional)</label><select id="at-pedido" name="pedido"><option value="">Não é sobre um pedido específico</option>' +
          (pedidos || []).map(function (p) { return '<option value="' + h(p.id) + '">' + h(p.id) + ' · ' + h(dataBr(p.criado_em, true)) + '</option>'; }).join('') + '</select></div>') +
      campoCategoriaAtend() +
      campoMensagemAtend('Conte o que aconteceu') +
      '<div class="atend-aviso" role="alert"></div>' +
      '<button class="btn btn-verde btn-mini" type="submit">Enviar</button>' +
    '</form>';
  }
  function threadAtendHtml(t) {
    return '<ol class="atend-thread">' + (t.mensagens || []).map(function (m) {
      var equipe = m.de === 'equipe';
      return '<li class="atend-msg ' + (equipe ? 'equipe' : 'cliente') + '"><div class="atend-msg-topo"><strong>' + h(m.nome || (equipe ? 'Só Armação' : 'Você')) + '</strong><small>' + h(dataHoraBr(m.em)) + '</small></div>' +
        '<p>' + h(m.texto) + '</p></li>';
    }).join('') + '</ol>';
  }
  // Responder: na conta vai pelo número; pra visitante, pelo token do link.
  function respostaAtendHtml(t, token) {
    return '<div class="painel conta-bloco"><strong>Responder</strong>' +
      (t.status === 'resolvido' ? '<div class="aviso info">Este atendimento foi resolvido. Respondendo, ele é reaberto.</div>' : '') +
      '<form class="form-grid" data-action="atend-responder" ' + (token ? 'data-token="' + h(token) + '"' : 'data-numero="' + h(t.numero) + '"') + ' novalidate>' +
        campoMensagemAtend('Sua mensagem') +
        '<div class="atend-aviso" role="alert"></div>' +
        '<button class="btn btn-verde btn-mini" type="submit">Enviar resposta</button>' +
      '</form></div>';
  }
  function cabecalhoAtendHtml(t) {
    return '<h1 class="conta-titulo">Atendimento #' + h(t.numero) + ' · ' + h(t.assunto) + '</h1>' +
      '<div class="conta-linha atend-meta">' + pilulaAtend(t) + '<span>' + h(t.categoria_rotulo || t.categoria) +
        (t.pedido ? ' · Pedido ' + h(t.pedido) : '') + ' · aberto em ' + h(dataBr(t.criado_em, true)) + '</span></div>';
  }
  function atendimentosDaConta(d) { return (d && Array.isArray(d.atendimentos)) ? d.atendimentos : []; }
  function guardarAtendNaConta(t) {
    if (!estado.conta || !t) return;
    estado.conta.atendimentos = [t].concat(atendimentosDaConta(estado.conta).filter(function (x) { return String(x.numero) !== String(t.numero); }));
  }
  function avisoAtend(form, txt) {
    var el = form.querySelector('.atend-aviso');
    if (el) el.innerHTML = txt ? '<div class="aviso erro">' + h(txt) + '</div>' : '';
    else if (txt) toast(h(txt));
  }
  function travarAtend(form, sim) {
    var b = form.querySelector('button[type="submit"]');
    if (!b) return;
    if (sim) { b.dataset.rotulo = b.textContent; b.textContent = 'Enviando…'; }
    else if (b.dataset.rotulo) b.textContent = b.dataset.rotulo;
    b.disabled = !!sim;
  }
  function campoForm(form, nome) { var el = form.elements.namedItem(nome); return el ? String(el.value || '').trim() : ''; }
  function validarMensagemAtend(form) {
    var msg = campoForm(form, 'mensagem');
    if (msg.length < ATEND_MIN) return 'Escreva um pouco mais (mínimo de ' + ATEND_MIN + ' caracteres).';
    if (msg.length > ATEND_MAX) return 'A mensagem passou de ' + ATEND_MAX + ' caracteres.';
    return '';
  }
  // Chamada pública (sem conta): /api/atendimento
  function apiAtendimento(metodo, corpo, qs, token) {
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(CONFIG.api + '/api/atendimento' + (qs || ''), { method: metodo, headers: headers, body: corpo ? JSON.stringify(corpo) : undefined })
      .catch(function () { throw new Error('Sem conexão agora. Tente de novo em instantes.'); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.erro || 'Não foi possível concluir agora. Tente de novo.'); e.status = r.status; throw e; } return d; }); });
  }
  function abrirAtendConta(form) {
    var corpo = { acao: 'ticket-abrir', pedido: campoForm(form, 'pedido'), categoria: campoForm(form, 'categoria'), mensagem: campoForm(form, 'mensagem') };
    var erro = !corpo.categoria ? 'Escolha o assunto.' : validarMensagemAtend(form);
    if (erro) { avisoAtend(form, erro); return; }
    avisoAtend(form, '');
    travarAtend(form, true);
    apiConta('POST', corpo).then(function (d) {
      var t = d && d.atendimento;
      guardarAtendNaConta(t);
      track('atendimento_aberto', { categoria: corpo.categoria, origem: 'conta' });
      toast(t ? 'Atendimento #' + h(t.numero) + ' aberto. Respondemos em até 1 dia útil.' : 'Atendimento aberto.', 4000);
      navegar(t ? '/conta/atendimentos/' + encodeURIComponent(String(t.numero)) : '/conta/atendimentos');
    }).catch(function (e) { travarAtend(form, false); avisoAtend(form, e.message); });
  }
  function responderAtend(form) {
    var erro = validarMensagemAtend(form);
    if (erro) { avisoAtend(form, erro); return; }
    avisoAtend(form, '');
    travarAtend(form, true);
    var mensagem = campoForm(form, 'mensagem');
    var token = form.dataset.token;
    var envio = token
      ? apiAtendimento('POST', { acao: 'responder', token: token, mensagem: mensagem })
      : apiConta('POST', { acao: 'ticket-responder', numero: Number(form.dataset.numero), mensagem: mensagem }).then(function (d) { return d.atendimento; });
    var g = geracao;
    envio.then(function (t) {
      track('atendimento_resposta', { origem: token ? 'link' : 'conta' });
      if (g !== geracao) return;
      toast('Resposta enviada.');
      if (token) { renderAtendPublico(t, token); return; }
      guardarAtendNaConta(t);
      renderConta('atendimentos', String(t ? t.numero : form.dataset.numero), estado.conta);
    }).catch(function (e) { travarAtend(form, false); avisoAtend(form, e.message); });
  }
  // /contato: formulário de abrir atendimento (com ou sem conta).
  function formContatoHtml(pf) {
    var campo = function (nome, rotulo, valor, attrs, ajuda) {
      return '<div class="campo"><label for="ct-' + nome + '">' + h(rotulo) + '</label><input id="ct-' + nome + '" name="' + nome + '" value="' + h(valor || '') + '" ' + attrs + '>' + (ajuda ? '<span class="ajuda">' + h(ajuda) + '</span>' : '') + '</div>';
    };
    return '<section class="painel atend-contato" id="atend-contato" aria-labelledby="atend-contato-titulo">' +
      '<h2 id="atend-contato-titulo">Abrir um atendimento</h2>' +
      '<p class="conta-ajuda">Respondemos em até 1 dia útil. Você recebe um link por e-mail pra acompanhar e responder.</p>' +
      '<form class="form-grid" data-action="atend-contato" novalidate>' +
        '<div class="dupla">' + campo('nome', 'Nome', pf.nome, 'autocomplete="name" required maxlength="80"') +
          campo('email', 'E-mail', pf.email, 'type="email" inputmode="email" autocomplete="email" required maxlength="120"') + '</div>' +
        '<div class="dupla">' + campo('telefone', 'WhatsApp (opcional)', pf.telefone ? mascara('tel', pf.telefone) : '', 'type="tel" inputmode="tel" autocomplete="tel" maxlength="16" data-mascara="tel"') +
          campo('pedido', 'Número do pedido (opcional)', '', 'placeholder="SA-XXXX-XXXX" autocapitalize="characters" autocomplete="off" maxlength="20"') + '</div>' +
        campoCategoriaAtend() +
        campoMensagemAtend('Mensagem') +
        '<div class="isca" aria-hidden="true"><label>Site <input name="site" tabindex="-1" autocomplete="off"></label></div>' +
        '<div class="atend-aviso" role="alert"></div>' +
        '<button class="btn btn-laranja" type="submit">Enviar</button>' +
      '</form></section>';
  }
  function perfilContato() {
    var pf = (estado.conta && estado.conta.perfil) || {};
    var s = sessaoLocal();
    var u = (s && s.user) || {}, meta = u.user_metadata || {};
    return { nome: pf.nome || meta.full_name || meta.name || '', email: pf.email || u.email || '', telefone: pf.telefone || '' };
  }
  // Logado: o perfil completo (WhatsApp) vem da conta; preenche só o que ainda está vazio.
  function preencherContatoDaConta() {
    if (!sessaoLocal()) return;
    var g = geracao;
    carregarConta().then(function () {
      var form = g === geracao && document.querySelector('form[data-action="atend-contato"]');
      if (!form) return;
      var pf = perfilContato();
      ['nome', 'email', 'telefone'].forEach(function (k) {
        var el = form.elements.namedItem(k);
        if (el && !el.value && pf[k]) el.value = k === 'telefone' ? mascara('tel', pf[k]) : pf[k];
      });
    }).catch(function () {});
  }
  function abrirAtendContato(form) {
    var corpo = {
      acao: 'abrir', nome: campoForm(form, 'nome'), email: campoForm(form, 'email').toLowerCase(), telefone: campoForm(form, 'telefone'),
      pedido: campoForm(form, 'pedido').toUpperCase(), categoria: campoForm(form, 'categoria'), mensagem: campoForm(form, 'mensagem'),
      site: String((form.elements.namedItem('site') || {}).value || '')
    };
    var tel = digitos(corpo.telefone);
    var erro = corpo.nome.length < 2 ? 'Digite seu nome.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(corpo.email) ? 'Digite um e-mail válido.'
      : tel && (tel.length < 10 || tel.length > 11) ? 'Confira o WhatsApp com DDD (ou deixe em branco).'
      : corpo.pedido && !RE_PEDIDO.test(corpo.pedido) ? 'Confira o número do pedido (ex.: SA-K3J9-2201) ou deixe em branco.'
      : !corpo.categoria ? 'Escolha o assunto.'
      : validarMensagemAtend(form);
    if (erro) { avisoAtend(form, erro); return; }
    avisoAtend(form, '');
    travarAtend(form, true);
    var g = geracao;
    // Logado: manda o token junto, pro backend ligar o atendimento à conta.
    tokenConta().catch(function () { return null; }).then(function (t) {
      return apiAtendimento('POST', corpo, '', t).then(function (d) { return { d: d, logado: !!t }; });
    }).then(function (res) {
      track('atendimento_aberto', { categoria: corpo.categoria, origem: res.logado ? 'contato_conta' : 'contato' });
      if (g !== geracao) return;
      var box = document.getElementById('atend-contato');
      if (!box) return;
      var num = res.d.numero;
      box.innerHTML = '<h2>Recebemos!</h2><div class="aviso ok" role="status">Seu atendimento é o #' + h(num) + '. ' +
        (res.logado ? 'Acompanhe e responda em <a href="/conta/atendimentos/' + encodeURIComponent(String(num)) + '" data-link>Minha conta › Atendimentos</a>.'
          : res.d.email_enviado === false ? 'Não conseguimos enviar o e-mail com o link agora, mas a nossa resposta chega em ' + h(corpo.email) + '.'
          : 'Enviamos o link para acompanhar em ' + h(corpo.email) + '.') + '</div>' +
        '<p class="conta-ajuda">Respondemos em até 1 dia útil. Não achou o e-mail? Veja a caixa de spam.</p>';
      if (res.logado) estado.conta = null; // a lista da conta vem de novo do servidor
      box.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }).catch(function (e) { travarAtend(form, false); avisoAtend(form, e.message); });
  }
  // /atendimento/:token — quem abriu sem conta acompanha pelo link do e-mail.
  function viewAtendimento(m) {
    titulo('Atendimento');
    naoIndexar(true);
    var token = m[1];
    var g = geracao;
    app.innerHTML = '<div class="container"><div class="carregando"><span class="spinner"></span> Carregando…</div></div>';
    apiAtendimento('GET', null, '?token=' + encodeURIComponent(token)).then(function (t) {
      if (g !== geracao) return;
      renderAtendPublico(t, token);
    }).catch(function (e) {
      if (g !== geracao) return;
      var naoAchou = e.status === 404 || e.status === 400 || e.status === 410;
      app.innerHTML = '<div class="container confirmacao"><h1 class="display">' + (naoAchou ? 'Atendimento não encontrado.' : 'Ops.') + '</h1>' +
        '<p>' + (naoAchou ? 'O link pode estar incompleto ou ter expirado.' : h(e.message)) + ' Se precisar, abra um novo atendimento que a gente responde rapidinho.</p>' +
        '<a class="btn btn-laranja" href="/contato" data-link>Falar com a gente</a></div>';
    });
  }
  function renderAtendPublico(t, token) {
    if (!t || !t.numero) { app.innerHTML = '<div class="container confirmacao"><h1 class="display">Ops.</h1><p>Não conseguimos abrir este atendimento.</p><a class="btn btn-laranja" href="/contato" data-link>Falar com a gente</a></div>'; return; }
    titulo('Atendimento #' + t.numero);
    app.innerHTML = '<div class="container conta-conteudo atend-publico">' + cabecalhoAtendHtml(t) +
      threadAtendHtml(t) + respostaAtendHtml(t, token) +
      '<p class="conta-ajuda">Tem conta na loja com este e-mail? Seus atendimentos também ficam em <a href="/conta/atendimentos" data-link>Minha conta</a>.</p></div>';
  }

  // ---------------------------------------------------------------------------
  // Institucional
  // ---------------------------------------------------------------------------
  var PAGINAS = {
    'quem-somos': { t: 'Quem somos', d: 'A Só Armação é uma loja 100% online de armações de óculos de grau, de São Bernardo do Campo/SP.', b: [
      ['', 'A Só Armação nasceu de uma conta que não fechava: a armação que custa pouco pra fabricar chega na ótica custando dez vezes mais. A gente tirou o que encarece — loja física, atravessador, marca de grife — e deixou o que importa: armação de qualidade, preço justo e entrega rápida.'],
      ['', 'Somos 100% online. Vendemos só a armação — você coloca as lentes do seu grau na ótica ou no laboratório da sua confiança. Preço baixo todo dia, sem promoção de mentira. Nota fiscal em todo pedido e troca grátis em até 7 dias úteis, com troca e devolução seguindo o Código de Defesa do Consumidor.'],
      ['', 'Ninguém faz melhor por menos.']] },
    'como-comprar': { t: 'Como comprar', d: 'Passo a passo pra comprar sua armação na Só Armação.', b: [
      ['1 — Escolha a armação', 'Navegue pelos modelos e use os filtros de formato e cor. Todas as medidas (lente, ponte, haste e largura frontal) estão na página de cada modelo — compare com um óculos que já serve bem em você.'],
      ['2 — Adicione ao carrinho', 'Levando 2 armações no mesmo pedido, a 2ª (a de menor valor) sai com 30% de desconto, que aparece sozinho no carrinho. O frete é um só pro pedido inteiro e é calculado pelo seu CEP.'],
      ['3 — Informe seus dados', 'Nome, CPF, e-mail, WhatsApp, CEP e número. O endereço é preenchido sozinho a partir do CEP.'],
      ['4 — Pague no Pix ou no cartão', 'No Pix, escaneie o QR Code ou copie o código: a confirmação é automática, em segundos. No cartão de crédito, o pagamento abre numa página segura da operadora e você pode parcelar.'],
      ['5 — Receba em casa', 'Até 3 dias úteis na Grande São Paulo e até 5 dias úteis pro resto do Brasil, contados da confirmação do pagamento. O rastreio chega no seu e-mail.']] },
    entrega: { t: 'Entrega e frete', d: 'Prazos, valor do frete e rastreio dos pedidos da Só Armação.', b: [
      ['Prazo', 'Até 3 dias úteis na Grande São Paulo e até 5 dias úteis pra todo o Brasil, contados a partir da confirmação do pagamento.'],
      ['Valor', 'Calculado pelo seu CEP, direto no carrinho, antes de você pagar. Levando 2 ou mais armações, o frete é um só pro pedido inteiro.'],
      ['Rastreio', 'O código de rastreio chega no seu e-mail assim que o pedido é postado.'],
      ['Endereço errado?', 'Avise a gente por e-mail (' + CONFIG.email + ') antes da postagem que a gente corrige sem custo.']] },
    pagamento: { t: 'Pagamento', d: 'Pix com confirmação automática ou cartão de crédito parcelado.', b: [
      ['Pix', 'O pedido é liberado na hora e o preço é o da tela. Você recebe um QR Code e um código copia-e-cola válidos por 15 minutos; pagou, o pedido confirma sozinho em segundos.'],
      ['Cartão de crédito', 'O pagamento abre numa página segura da operadora e volta pro site com a resposta. Dá pra parcelar em até 6x; o valor das parcelas é confirmado na página da operadora. O pedido é liberado depois da aprovação.'],
      ['É seguro?', 'O Pix é do Banco Central e o código gerado vale só pro seu pedido, com o valor exato. Os dados do cartão são digitados na página da operadora — nunca passam pelo nosso site.'],
      ['Reembolso', 'Cancelamento e devolução são reembolsados na mesma forma de pagamento do pedido.']] },
    'trocas-e-devolucoes': { t: 'Trocas e devoluções', d: 'Troca grátis em até 7 dias úteis (direito de arrependimento) e, depois, troca só por defeito de fabricação, conforme o Código de Defesa do Consumidor.', b: [
      ['Troca grátis em até 7 dias úteis', 'Compra online tem direito de arrependimento (Código de Defesa do Consumidor, art. 49). Não serviu, não gostou ou mudou de ideia? Em até 7 dias úteis depois de receber, você pode trocar por outro modelo ou devolver e receber o dinheiro de volta, com reembolso integral, incluindo o frete pago. A armação precisa estar sem uso, sem lentes de grau instaladas e com a embalagem e os acessórios que vieram com ela.'],
      ['Depois de 7 dias úteis: só defeito de fabricação', 'Passado o prazo de arrependimento, a troca é só por defeito de fabricação — solda, pintura, dobradiça — dentro da garantia legal do Código de Defesa do Consumidor: 90 dias a partir do recebimento (art. 26). Não oferecemos garantia além do que a lei determina. Queda, uso indevido ou lentes instaladas de forma errada não são defeito de fabricação.'],
      ['Como pedir', 'Mande um e-mail pra ' + CONFIG.email + ' com o número do pedido, o motivo e, se for defeito, uma foto. Respondemos em até 1 dia útil com a etiqueta de postagem — você não paga o frete da devolução.'],
      ['Reembolso', 'Feito na mesma forma de pagamento assim que a armação chegar e for conferida: no Pix, em até 2 dias úteis; no cartão, o estorno aparece na fatura conforme o prazo da operadora.']] },
    privacidade: { t: 'Política de privacidade', d: 'Como a Só Armação coleta, usa e protege seus dados (LGPD).', b: [
      ['O que coletamos', 'Nome, CPF, e-mail, WhatsApp e endereço — o necessário pra processar o pedido, emitir a nota fiscal e entregar. Também usamos cookies e ferramentas de medição (Google Analytics, Google Ads, Meta e Microsoft Clarity) pra entender como a loja é usada e mostrar nossos anúncios pra quem já visitou o site. O Clarity registra cliques, rolagem e movimentos na página pra gente melhorar o site; o que você digita nos campos fica mascarado e não é gravado.'],
      ['Como usamos', 'Pra entregar seu pedido, emitir nota, calcular frete, confirmar o pagamento, conferir se é a sua primeira compra (pro desconto de 1ª compra, pelo CPF, e-mail e WhatsApp dos pedidos anteriores) e, se você autorizar, avisar sobre novidades. O CPF é guardado só de forma protegida (hash) no nosso banco.'],
      ['Conta e login', 'Criar conta é opcional. Se você criar, guardamos seu nome, e-mail e senha (protegida, sem que ninguém da loja consiga ler) ou, no login com Google, o nome e o e-mail que o Google informa. Na conta ficam seus pedidos, favoritos, os dados de entrega e contato que você preenche no checkout (pra próxima compra vir pronta; o CPF fica guardado criptografado) e, se você pedir, o cartão salvo: o número do cartão fica com a instituição de pagamento (Asaas) e a gente só vê a bandeira e os 4 últimos números. Quando você está logado, as ferramentas de medição recebem um código interno da sua conta (nunca seu e-mail ou CPF), pra entendermos como o site é usado em diferentes aparelhos. Pra excluir a conta, escreva pra ' + CONFIG.email + '.'],
      ['Atendimento e assistente virtual', 'Quando você fala com a gente pelo WhatsApp ou pelo formulário de contato, guardamos a conversa pra dar continuidade ao atendimento. No WhatsApp, uma assistente virtual com inteligência artificial (o Claude, da empresa Anthropic) pode responder primeiro: ela recebe as mensagens da conversa e, pra informar status e rastreio, os dados do pedido ligado ao seu telefone ou ao número e e-mail que você informar (número, itens, valor, status e transporte). Ela não recebe seu CPF, endereço nem dados de pagamento. A primeira resposta dela vem identificada como assistente virtual, e você pode pedir pra falar com uma pessoa da equipe a qualquer momento.'],
      ['Com quem compartilhamos', 'Só com quem precisa pra operação: a instituição de pagamento (Pix e cartão), a transportadora, o sistema emissor de nota fiscal e, no atendimento pelo WhatsApp, a Anthropic, que fornece a assistente virtual. Não vendemos seus dados.'],
      ['Seus direitos (LGPD)', 'Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail ' + CONFIG.email + '.']] },
    termos: { t: 'Termos de uso', d: 'Condições de compra na Só Armação.', b: [
      ['', 'Ao comprar na Só Armação você concorda com estes termos. Eles existem pra deixar tudo claro, sem letra miúda.'],
      ['Preços e pagamento', 'O preço exibido é o preço final à vista no Pix. No cartão de crédito dá pra parcelar. O pedido é confirmado só depois do pagamento aprovado. Preço, desconto e frete são calculados no nosso servidor no momento do pagamento.'],
      ['Estoque', 'Quantidade limitada por modelo e cor. Se um item acabar entre o carrinho e o pagamento, o pedido não é concluído e nada é cobrado — e se houver cobrança, devolvemos 100% do valor.'],
      ['Produto', 'Vendemos a armação sem lentes de grau. As lentes são colocadas na ótica ou no laboratório da sua escolha.'],
      ['Cancelamento', 'Pedido pago pode ser cancelado até a postagem, com devolução integral na mesma forma de pagamento.'],
      ['Trocas e devoluções', 'Troca grátis em até 7 dias úteis depois do recebimento, pelo direito de arrependimento. Depois disso, troca só por defeito de fabricação, conforme o Código de Defesa do Consumidor. Os detalhes estão na página Trocas e devoluções.'],
      ['Empresa', 'So Armacao Comercio de Armacoes Ltda — Avenida Armando Italo Setti, 520, sala 81, Baeta Neves, São Bernardo do Campo/SP, CEP 09760-280.']] },
    contato: { t: 'Fale conosco', d: 'Atendimento da Só Armação por e-mail.', b: [
      ['E-mail', CONFIG.email + ' — respondemos em até 1 dia útil. Coloque o número do pedido no assunto que fica mais rápido.'],
      ['Endereço', 'Avenida Armando Italo Setti, 520, sala 81 — Baeta Neves, São Bernardo do Campo/SP, CEP 09760-280. Atendimento só online: não temos loja física, e é isso que mantém o preço baixo.'],
      ['Desconfiou de golpe?', 'A Só Armação nunca pede senha, código de segurança ou Pix fora do checkout do site soarmacao.com.br.']] }
  };
  function viewAjuda() {
    titulo('Ajuda', 'Central de ajuda da Só Armação: como comprar, entrega, pagamento, trocas e devoluções.');
    app.innerHTML = '<div class="container institucional"><h1 class="display">Ajuda</h1><p>Tudo o que você precisa saber antes e depois de comprar.</p><div class="ajuda-links">' +
      Object.keys(PAGINAS).map(function (k) { return '<a href="/' + k + '" data-link>' + h(PAGINAS[k].t) + '</a>'; }).join('') + '</div><h2>Perguntas frequentes</h2><div class="faq">' + faq() + '</div></div>';
  }
  function viewInstitucional(m) {
    var pg = PAGINAS[m[1]];
    titulo(pg.t, pg.d);
    app.innerHTML = '<div class="container institucional"><nav class="migalhas"><a href="/" data-link>Início</a> › <a href="/ajuda" data-link>Ajuda</a> › <span>' + h(pg.t) + '</span></nav><h1 class="display">' + h(pg.t) + '</h1>' +
      pg.b.map(function (b) { return (b[0] ? '<h2>' + h(b[0]) + '</h2>' : '') + '<p>' + h(b[1]) + '</p>'; }).join('') +
      (m[1] === 'contato' ? formContatoHtml(perfilContato()) : '<p style="margin-top:24px"><a class="btn btn-laranja" href="/modelos" data-link>Ver modelos</a></p>') + '</div>';
    if (m[1] === 'contato') preencherContatoDaConta();
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    // Aviso de 1ª compra: fecha no X, no botão ou clicando fora da caixa
    if (e.target.id === 'popup-1a' || e.target.closest('[data-action="fechar-1a"]')) { fecharPopup1a(); return; }
    var link = e.target.closest('a[data-link]');
    if (link && !e.metaKey && !e.ctrlKey && !e.shiftKey && link.origin === location.origin) {
      e.preventDefault();
      navegar(link.getAttribute('href'));
      return;
    }
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var acao = el.getAttribute('data-action');
    if (acao === 'filtro' && el.tagName === 'BUTTON') { var o = {}; o[el.dataset.chave] = el.dataset.valor; setQuery(o); atualizarGrade(); track('filter_use', { filtro: el.dataset.chave, valor: el.dataset.valor }); }
    else if (acao === 'pagina') {
      setQuery({ pagina: Number(el.dataset.pagina) > 1 ? el.dataset.pagina : '' }, true);
      atualizarGrade();
      // Volta pro começo da vitrine (descontando o cabeçalho fixo).
      var topo = document.getElementById('contagem') || document.getElementById('grade');
      if (topo) window.scrollTo({ top: topo.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
      track('vitrine_pagina', { pagina: Number(el.dataset.pagina) });
    }
    else if (acao === 'limpar-filtros') { history.replaceState({}, '', location.pathname); atualizarGrade(); }
    else if (acao === 'recarregar') { apagar('sa_catalogo'); estado.catalogo = null; rotear(); }
    else if (acao === 'foto') { galeriaIr(Number(el.dataset.i)); }
    else if (acao === 'galeria') { galeriaIr(galeriaIndice() + Number(el.dataset.dir)); }
    else if (acao === 'lupa') { lupaAbrir(galeriaIndice()); }
    else if (acao === 'lupa-fechar') { lupaFechar(); }
    else if (acao === 'lupa-ir') { lupaMostrar(lupa.i + Number(el.dataset.dir)); }
    else if (acao === 'adicionar' || acao === 'comprar') {
      var a = estado.porSku[String(el.dataset.sku).toUpperCase()];
      if (a) adicionarAoCarrinho(a.produto, a.variacao, acao === 'adicionar');
    }
    else if (acao === 'qtd') { alterarQtd(el.dataset.sku, Number(el.dataset.delta)); geracao++; viewCarrinho(); }
    else if (acao === 'remover') { removerDoCarrinho(el.dataset.sku); geracao++; viewCarrinho(); }
    else if (acao === 'frete') {
      // Troca Econômico/Expresso: guarda a escolha e recota a tela atual
      // (o preço vem do servidor; nada de preço é decidido aqui).
      if (el.dataset.frete === estado.freteOpcao) return;
      estado.freteOpcao = el.dataset.frete;
      gravar('sa_frete', estado.freteOpcao);
      track('select_shipping_option', { shipping_tier: estado.freteOpcao });
      geracao++;
      if (/\/checkout\/?$/.test(location.pathname)) viewCheckout(); else viewCarrinho();
    }
    else if (acao === 'copiar') {
      var inp = document.getElementById('copia');
      var feito = function () { toast('Código Pix copiado. Cole no app do seu banco.'); track('pix_copy', {}); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(feito, function () { inp.select(); document.execCommand('copy'); feito(); });
      else { inp.select(); document.execCommand('copy'); feito(); }
    }
    else if (acao === 'ja-paguei') { if (estado.pix) conferirPagamento(estado.pix.pedidoId, true); }
    else if (acao === 'entrar-google') { entrarComGoogle(); }
    else if (acao === 'modo-conta') { if (estado.entrarModo) estado.entrarModo(el.dataset.modo); }
    else if (acao === 'sair') { sairDaConta(); }
    else if (acao === 'favoritar') { favoritar(el); }
    else if (acao === 'avaliar-item') { avaliarItem(el); }
    else if (acao === 'comprar-novamente') { comprarNovamente(el.dataset.pedido); }
    else if (acao === 'recarregar-conta') { rotear(); }
    else if (acao === 'atend-mostrar') {
      var alvo = document.getElementById(el.dataset.alvo);
      if (alvo) { alvo.hidden = false; el.setAttribute('aria-expanded', 'true'); el.hidden = true; var foco = alvo.querySelector('select, textarea'); if (foco) foco.focus(); }
    }
    else if (acao === 'remover-cartao') {
      if (!confirm('Remover este cartão da sua conta?')) return;
      el.disabled = true;
      apiConta('POST', { acao: 'remover-cartao', id: Number(el.dataset.id) }).then(function () { return carregarConta(true); }).then(function (d) { renderConta('pagamentos', '', d); toast('Cartão removido.'); }).catch(function (e) { el.disabled = false; toast(h(e.message)); });
    }
  });
  // Toque/clique na foto do carrossel abre em tela cheia (um arrasto não conta como clique).
  var toqueFoto = null;
  document.addEventListener('pointerdown', function (e) { var img = e.target.closest('.galeria-slide img'); toqueFoto = img ? { x: e.clientX, y: e.clientY, t: Date.now() } : null; });
  document.addEventListener('pointerup', function (e) {
    if (!toqueFoto || !e.target.closest('.galeria-slide img')) { toqueFoto = null; return; }
    var parado = Math.abs(e.clientX - toqueFoto.x) < 8 && Math.abs(e.clientY - toqueFoto.y) < 8 && Date.now() - toqueFoto.t < 600;
    toqueFoto = null;
    if (parado) lupaAbrir(galeriaIndice());
  });
  document.addEventListener('mousemove', lupaHover);
  document.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest('.galeria-slide') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.galeria-slide'))) lupaHoverSair(e); });
  (function () {
    var palco = document.getElementById('lupa-palco');
    if (!palco) return;
    palco.addEventListener('pointerdown', lupaPointerDown);
    palco.addEventListener('pointermove', lupaPointerMove);
    palco.addEventListener('pointerup', lupaPointerUp);
    palco.addEventListener('pointercancel', lupaPointerUp);
    palco.addEventListener('wheel', lupaWheel, { passive: false });
    palco.addEventListener('dblclick', function (e) { e.preventDefault(); });
    document.getElementById('lupa').addEventListener('click', function (e) { if (e.target === e.currentTarget) lupaFechar(); });
  })();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('popup-1a')) { fecharPopup1a(); return; }
    if (!lupa.aberta) return;
    if (e.key === 'Escape') lupaFechar();
    else if (e.key === 'ArrowRight') lupaMostrar(lupa.i + 1);
    else if (e.key === 'ArrowLeft') lupaMostrar(lupa.i - 1);
    else if (e.key === '+' || e.key === '=') lupaZoomEm(lupa.s * 1.3, innerWidth / 2, innerHeight / 2, true);
    else if (e.key === '-') lupaZoomEm(lupa.s / 1.3, innerWidth / 2, innerHeight / 2, true);
  });
  // Rolagem por toque no carrossel: marca a miniatura da foto visível.
  document.addEventListener('scroll', function (e) {
    if (!(e.target instanceof Element) || e.target.id !== 'galeria-trilho') return;
    if (estado.galeriaRaf) return;
    estado.galeriaRaf = requestAnimationFrame(function () { estado.galeriaRaf = 0; galeriaMarcar(galeriaIndice()); });
  }, true);
  // Erro de carregamento de imagem (fase de captura, porque 'error' não borbulha).
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    // Foto do card que não carregou: mostra o fundo listrado (antes era um onerror inline, barrado pela CSP)
    if (img.parentNode && img.parentNode.classList && img.parentNode.classList.contains('card-foto')) { img.parentNode.classList.add('sem-foto'); img.remove(); return; }
    if (img.dataset.opcional && (img.closest('.galeria-slide') || img.closest('.galeria-thumbs'))) galeriaRemover(img.getAttribute('src'));
  }, true);
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches('select[data-action="filtro"]')) { var o = {}; o[el.dataset.chave] = el.value; setQuery(o); atualizarGrade(); track('filter_use', { filtro: el.dataset.chave, valor: el.value }); }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.matches('[data-action="atend-abrir"]')) { e.preventDefault(); abrirAtendConta(form); return; }
    if (form.matches('[data-action="atend-responder"]')) { e.preventDefault(); responderAtend(form); return; }
    if (form.matches('[data-action="atend-contato"]')) { e.preventDefault(); abrirAtendContato(form); return; }
    if (form.matches('[data-action="cep"]')) {
      e.preventDefault();
      var cep = mascara('cep', form.cep.value);
      if (digitos(cep).length !== 8) { toast('Digite o CEP completo, com 8 números.'); return; }
      estado.cep = cep; gravar('sa_cep', cep);
      geracao++; viewCarrinho();
    }
  });
  // Saiu de um campo (o checkout logado usa pra salvar o perfil da conta).
  document.addEventListener('focusout', function (e) { if (estado.aoSairDoCampo && e.target && e.target.name) estado.aoSairDoCampo(e.target); });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.matches('#cep')) el.value = mascara('cep', el.value);
    else if (el.matches('input[data-mascara="tel"]')) el.value = mascara('tel', el.value);
    else if (el.matches('textarea[data-contador]')) {
      var cont = document.getElementById(el.dataset.contador), n = el.value.trim().length;
      if (cont) cont.textContent = n + ' / ' + ATEND_MAX + (n < ATEND_MIN ? ' (mínimo ' + ATEND_MIN + ')' : '');
    }
  });
  window.addEventListener('popstate', rotear);
  window.addEventListener('beforeunload', function () {
    if (estado.carrinho.length && !/^\/(confirmacao|pix)/.test(location.pathname)) track('cart_abandon', { reason: 'saida_site', items: unidadesCarrinho() });
  });

  // ---------------------------------------------------------------------------
  // Início
  // ---------------------------------------------------------------------------
  var ano = document.getElementById('ano');
  if (ano) ano.textContent = String(new Date().getFullYear());
  atualizarBadge();
  atualizarCabecalhoConta();
  // Outra aba entrou/saiu: o cabeçalho acompanha.
  window.addEventListener('storage', function (e) { if (e.key === CHAVE_SESSAO) { estado.conta = null; atualizarCabecalhoConta(); } });
  rotear();
})();
