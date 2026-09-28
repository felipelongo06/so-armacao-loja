/* Só Armação — loja
 * Uma página só (SPA). O catálogo vem do backend (/api/catalogo, alimentado pelo Bling);
 * preço, desconto Leve 2/3 e frete são sempre os que o servidor devolve (/api/cotar);
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
    cacheCatalogoMs: 5 * 60 * 1000,
    pixJanelaSeg: 15 * 60,
    pollingMs: 4000
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
    regras: { leve2_pct: 30, leve3_pct: 50, max_unidades: 20 },
    precoMinimo: null,
    carrinho: ler('sa_cart_v2', []),
    cep: ler('sa_cep', ''),
    cotacao: null,         // último resumo do /api/cotar
    cotacaoErro: '',
    form: ler('sa_checkout', {}, sessionStorage),
    pix: ler('sa_pix', null, sessionStorage),
    timers: []
  };

  function limparTimers() {
    estado.timers.forEach(function (t) { clearInterval(t); clearTimeout(t); });
    estado.timers = [];
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
      (p.variacoes || []).forEach(function (v) {
        estado.porSku[String(v.sku).toUpperCase()] = { produto: p, variacao: v };
        if (v.estoque > 0 && v.preco > 0 && (min == null || v.preco < min)) min = v.preco;
      });
    });
    estado.precoMinimo = min;
  }
  function carregarCatalogo(forcar) {
    var cache = ler('sa_catalogo', null, sessionStorage);
    if (!forcar && cache && cache.ts && Date.now() - cache.ts < CONFIG.cacheCatalogoMs && cache.dados) {
      indexar(cache.dados);
      return Promise.resolve(estado.catalogo);
    }
    return fetch(CONFIG.api + '/api/catalogo', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('catalogo ' + r.status); return r.json(); })
      .then(function (dados) {
        indexar(dados);
        gravar('sa_catalogo', { ts: Date.now(), dados: dados }, sessionStorage);
        return dados;
      });
  }
  function produtoPorRota(codigo) {
    var c = String(codigo || '').toUpperCase().replace(/\/+$/, '');
    if (estado.porCodigo[c]) return { produto: estado.porCodigo[c], variacao: null };
    if (estado.porSku[c]) return estado.porSku[c];
    var s = slug(c).toUpperCase();
    if (estado.porCodigo[s]) return { produto: estado.porCodigo[s], variacao: null };
    return null;
  }
  function precoSegunda(preco) { return preco * (1 - (estado.regras.leve2_pct || 0) / 100); }
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

  function cotar(cep) {
    var body = { itens: itensPedido() };
    var cepLimpo = digitos(cep);
    if (cepLimpo.length === 8) body.cep = cepLimpo;
    return fetch(CONFIG.api + '/api/cotar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, dados: d }; }); })
      .catch(function (e) { if (e && /fetch|network|json/i.test(String(e.message))) throw new Error('Não foi possível calcular o pedido agora. Confira sua conexão e tente de novo.'); throw e; })
      .then(function (res) {
        if (!res.ok) throw new Error(res.dados && res.dados.erro ? res.dados.erro : 'Não foi possível calcular o pedido agora.');
        estado.cotacao = res.dados;
        estado.cotacaoErro = '';
        if (res.dados.regras) estado.regras = Object.assign(estado.regras, res.dados.regras);
        return res.dados;
      });
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
  function setQuery(obj) {
    var u = new URL(location.href);
    Object.keys(obj).forEach(function (k) { if (obj[k]) u.searchParams.set(k, obj[k]); else u.searchParams.delete(k); });
    history.replaceState({}, '', u.pathname + (u.search || ''));
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
    { re: /^\/(quem-somos|como-comprar|entrega|pagamento|trocas-e-devolucoes|garantia|privacidade|termos|contato)\/?$/, view: viewInstitucional, nav: 'ajuda' }
  ];
  var geracao = 0; // muda a cada rota: resposta atrasada de uma tela antiga não sobrescreve a atual
  function rotear() {
    limparTimers();
    geracao++;
    app.oninput = app.onchange = app.onsubmit = null;
    var caminho = location.pathname.replace(/\/{2,}/g, '/');
    if (caminho.length > 1 && /\/$/.test(caminho) && !/^\/p\//.test(caminho)) caminho = caminho.replace(/\/$/, '');
    var rota = null, m = null;
    for (var i = 0; i < rotas.length; i++) { m = caminho.match(rotas[i].re); if (m) { rota = rotas[i]; break; } }
    document.querySelectorAll('.nav a[data-nav]').forEach(function (a) { a.classList.toggle('ativo', !!rota && a.getAttribute('data-nav') === rota.nav); });
    jsonLd(null);
    window.scrollTo(0, 0);
    if (!rota) { titulo('Página não encontrada'); app.innerHTML = '<div class="container institucional"><h1 class="display">Essa página não existe.</h1><p>O endereço pode ter mudado. <a href="/modelos" data-link>Ver todos os modelos →</a></p></div>'; track('page_view', { page: '404' }); return; }
    var precisaCatalogo = rota.nav !== 'ajuda' || !estado.catalogo;
    if (precisaCatalogo && !estado.catalogo) {
      app.innerHTML = '<div class="carregando"><span class="spinner"></span> Carregando o catálogo…</div>';
      carregarCatalogo().then(function () { rota.view(m); track('page_view', { page: rota.nav }); }).catch(function (e) {
        console.error(e);
        app.innerHTML = '<div class="container institucional"><h1 class="display">Catálogo indisponível</h1><p>Não conseguimos carregar os modelos agora. <button class="link" data-action="recarregar">Tentar de novo</button></p></div>';
      });
      return;
    }
    rota.view(m);
    track('page_view', { page: rota.nav });
    // renova o catálogo em silêncio se estiver velho
    var cache = ler('sa_catalogo', null, sessionStorage);
    if (cache && Date.now() - cache.ts > CONFIG.cacheCatalogoMs) carregarCatalogo(true).catch(function () {});
  }

  // ---------------------------------------------------------------------------
  // Componentes
  // ---------------------------------------------------------------------------
  function cardProduto(p) {
    var v0 = (p.variacoes || []).find(function (v) { return v.estoque > 0; }) || (p.variacoes || [])[0] || {};
    var esgotado = !(p.estoque_total > 0);
    var baixo = !esgotado && p.estoque_total <= 5;
    var img = p.imagem || v0.imagem;
    var cores = (p.cores || []).length;
    return '<a class="card" href="' + h(p.url || '/p/' + p.codigo + '/') + '" data-link data-codigo="' + h(p.codigo) + '">' +
      (esgotado ? '<span class="badge esgotado">Esgotado</span>' : baixo ? '<span class="badge">' + rotuloEstoque(p.estoque_total) + '</span>' : '') +
      '<div class="card-foto' + (img ? '' : ' sem-foto') + '">' + (img ? '<img src="' + h(img) + '" alt="' + h(p.nome) + '" loading="lazy" width="400" height="400" onerror="this.parentNode.classList.add(\'sem-foto\');this.remove()">' : 'foto em breve') + '</div>' +
      '<div class="card-info">' +
        '<span class="card-linha">' + h(p.formato || 'Armação') + '</span>' +
        '<span class="card-nome">' + h(p.nome) + '</span>' +
        (cores > 1 ? '<span class="card-cores">' + cores + ' cores</span>' : '') +
        '<span class="card-preco"><span class="valor">' + h(fmt(p.preco)) + '</span><span class="no-pix">no Pix</span></span>' +
        '<span class="card-segunda">a 2ª sai por ' + h(fmt(precoSegunda(p.preco))) + '</span>' +
      '</div></a>';
  }

  var ORDENACOES = { destaque: 'Destaques', 'menor-preco': 'Menor preço', 'maior-preco': 'Maior preço', 'a-z': 'Nome (A–Z)', novidades: 'Novidades' };
  var ATRIBUTOS = [
    { chave: 'formato', rotulo: 'Formato' }, { chave: 'cor', rotulo: 'Cor' }, { chave: 'genero', rotulo: 'Gênero' },
    { chave: 'material', rotulo: 'Material' }, { chave: 'ocasiao', rotulo: 'Ocasião' }, { chave: 'tom_pele', rotulo: 'Tom de pele' }
  ];
  function filtrar(produtos, q) {
    var lista = produtos.slice();
    ATRIBUTOS.forEach(function (a) {
      var val = q[a.chave];
      if (!val) return;
      lista = lista.filter(function (p) {
        if (a.chave === 'cor') return (p.variacoes || []).some(function (v) { return (v.cor_slug || slug(v.cor)) === val; });
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
  function blocoFiltros(q, total) {
    var f = estado.catalogo.facetas || {};
    var chips = '<div class="chips" role="tablist">' +
      '<button class="chip' + (!q.formato ? ' ativo' : '') + '" data-action="filtro" data-chave="formato" data-valor="">Todas</button>' +
      (f.formato || []).map(function (o) {
        return '<button class="chip' + (q.formato === o.slug ? ' ativo' : '') + '" data-action="filtro" data-chave="formato" data-valor="' + h(o.slug) + '">' + h(o.valor) + '</button>';
      }).join('') + '</div>';
    var selects = ATRIBUTOS.filter(function (a) { return a.chave !== 'formato' && (f[a.chave] || []).length; }).map(function (a) {
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
    var lista = filtrar(estado.catalogo.produtos || [], q);
    return { html: '<div class="grade">' + (lista.length ? lista.map(cardProduto).join('') : '<p class="vazio">Nenhum modelo com esses filtros. <button class="link" data-action="limpar-filtros">Limpar filtros</button></p>') + '</div>', total: lista.length };
  }

  // ---------------------------------------------------------------------------
  // Páginas
  // ---------------------------------------------------------------------------
  function viewHome() {
    titulo('');
    var q = query();
    var grade = gradeProdutos(q);
    var l2 = estado.regras.leve2_pct, l3 = estado.regras.leve3_pct;
    app.innerHTML =
      '<section class="hero"><div class="container">' +
        '<div class="hero-texto">' +
          '<h1 class="display"><span>Chega de</span><span>pagar caro.</span></h1>' +
          '<div class="etiqueta"><small>A partir de</small><strong>' + h(fmt(estado.precoMinimo || 49)).replace(',', '<sup>,') + '</sup></strong></div>' +
          '<ul><li>Pix aprovado na hora</li><li>Troca grátis em 30 dias</li><li>A 2ª sai com -' + l2 + '%</li></ul>' +
          '<a class="btn btn-laranja" href="/modelos" data-link>Só vem →</a>' +
          '<p class="tagline">Ninguém faz melhor por menos.</p>' +
        '</div>' +
        '<div class="hero-selo">Só<br>vem.</div>' +
        '<div class="hero-foto"><img src="/hero.webp" alt="" width="640" height="1136" fetchpriority="high"></div>' +
      '</div></section>' +
      '<div class="fita"></div>' +
      '<section class="beneficios"><div class="container">' +
        beneficio('qualidade', 'A melhor qualidade') + beneficio('preco', 'O menor preço') + beneficio('online', '100% online, 0% vitrine') + beneficio('troca', 'Troca grátis em 30 dias') +
      '</div></section>' +
      '<section class="secao" id="modelos"><div class="container">' +
        '<div class="secao-titulo"><h2 class="display">Todos os modelos</h2><span class="contagem" id="contagem">' + grade.total + ' modelo' + (grade.total === 1 ? '' : 's') + '</span></div>' +
        blocoFiltros(q, grade.total) + '<div id="grade">' + grade.html + '</div>' +
      '</div></section>' +
      '<section class="leve2"><div class="container">' +
        '<h2 class="display">A 2ª armação sai com <em>-' + l2 + '%.</em></h2>' +
        '<p>Levando 2 no mesmo pedido, a 2ª sai com ' + l2 + '% de desconto e a 3ª com ' + l3 + '%. O frete é um só pro pedido inteiro. Uma pro trampo, uma pro rolê.</p>' +
        '<a class="btn btn-laranja" href="/modelos" data-link style="justify-self:start">Escolher modelos</a>' +
        '<div class="passos"><div class="passo"><strong>1ª</strong><span>preço cheio</span></div><div class="passo"><strong>-' + l2 + '%</strong><span>na 2ª armação</span></div><div class="passo"><strong>-' + l3 + '%</strong><span>na 3ª em diante</span></div></div>' +
      '</div></section>' +
      '<section class="secao"><div class="container">' +
        '<div class="secao-titulo"><h2 class="display">Como funciona</h2></div>' +
        '<div class="passos-compra">' +
          passo(1, 'Escolha a armação', 'Filtre por formato e cor. Todas as medidas estão na página do modelo.') +
          passo(2, 'Adicione ao carrinho', 'Levando 2, a 2ª sai com -' + l2 + '%. O frete é calculado pelo seu CEP.') +
          passo(3, 'Pague no Pix ou cartão', 'No Pix a confirmação é automática, em segundos. No cartão, dá pra parcelar.') +
          passo(4, 'Receba em casa', 'Postagem com rastreio e nota fiscal. Não serviu? Troca grátis em 30 dias.') +
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
      ['Como funciona a troca grátis?', 'Não serviu, não gostou, mudou de ideia? Em até 30 dias depois de receber, a gente troca por outro modelo ou devolve o dinheiro. Você não paga o frete da devolução.'],
      ['Quanto tempo demora pra chegar?', 'Até 3 dias úteis na Grande São Paulo e até 5 dias úteis pro resto do Brasil, contados da confirmação do pagamento. O código de rastreio chega no seu e-mail.'],
      ['Como funciona o Leve 2?', 'Levando 2 armações no mesmo pedido, a 2ª sai com ' + l2 + '% de desconto. Levando 3, a 3ª sai com ' + estado.regras.leve3_pct + '%. O desconto aparece sozinho no carrinho.'],
      ['Tem nota fiscal?', 'Sempre. Todo pedido sai com NF-e no seu nome, enviada por e-mail.'],
      ['Quais as formas de pagamento?', 'Pix, com confirmação automática em segundos, ou cartão de crédito, parcelado. O cartão é processado numa página segura da operadora — seus dados não passam pelo nosso site.']
    ];
    return itens.map(function (i) { return '<details><summary>' + h(i[0]) + '</summary><p>' + h(i[1]) + '</p></details>'; }).join('');
  }

  function viewModelos() {
    titulo('Todos os modelos', 'Todas as armações da Só Armação: gatinho, redondo, retangular, quadrado e hexagonal. Preço baixo todo dia e troca grátis em 30 dias.');
    var q = query();
    var grade = gradeProdutos(q);
    app.innerHTML = '<section class="secao"><div class="container">' +
      '<div class="secao-titulo"><h1 class="display" style="font-size:clamp(30px,6vw,48px)">Todos os modelos</h1><span class="contagem" id="contagem">' + grade.total + ' modelo' + (grade.total === 1 ? '' : 's') + '</span></div>' +
      blocoFiltros(q, grade.total) + '<div id="grade">' + grade.html + '</div></div></section>';
  }
  function atualizarGrade() {
    var q = query();
    var grade = gradeProdutos(q);
    var g = document.getElementById('grade');
    var c = document.getElementById('contagem');
    var f = document.querySelector('.filtros');
    if (g) g.innerHTML = grade.html;
    if (c) c.textContent = grade.total + ' modelo' + (grade.total === 1 ? '' : 's');
    if (f) f.outerHTML = blocoFiltros(q, grade.total);
  }

  function viewProduto(m) {
    var achado = produtoPorRota(decodeURIComponent(m[1]));
    if (!achado) { titulo('Modelo não encontrado'); app.innerHTML = '<div class="container institucional"><h1 class="display">Não achamos esse modelo.</h1><p>Ele pode ter saído de linha. <a href="/modelos" data-link>Ver todos os modelos →</a></p></div>'; return; }
    var p = achado.produto;
    var q = query();
    var variacoes = (p.variacoes || []).slice().sort(function (a, b) { return (a.ordem || 0) - (b.ordem || 0); });
    var v = achado.variacao || variacoes.find(function (x) { return q.cor && (x.cor_slug || slug(x.cor)) === q.cor; }) || variacoes.find(function (x) { return x.estoque > 0; }) || variacoes[0];
    if (!v) { app.innerHTML = '<div class="container institucional"><h1 class="display">Modelo sem variações.</h1></div>'; return; }
    var imagens = (v.imagens && v.imagens.length ? v.imagens : [v.imagem || p.imagem]).filter(Boolean);
    var esgotado = !(v.estoque > 0);
    var desc = p.descricao || '';
    titulo(p.nome + (v.cor ? ' ' + v.cor : ''), desc.slice(0, 155));
    jsonLd({ '@context': 'https://schema.org', '@type': 'Product', name: p.nome, sku: v.sku, brand: { '@type': 'Brand', name: p.marca || 'Só Armação' }, description: desc, image: imagens, color: v.cor,
      offers: { '@type': 'Offer', url: CONFIG.site + (v.url || p.url), priceCurrency: 'BRL', price: v.preco, availability: esgotado ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition' } });
    var med = p.medidas || {};
    var relacionados = (estado.catalogo.produtos || []).filter(function (x) { return x.codigo !== p.codigo && x.formato === p.formato && x.estoque_total > 0; }).slice(0, 4);
    app.innerHTML = '<div class="container">' +
      '<nav class="migalhas" aria-label="Você está em"><a href="/" data-link>Início</a> › <a href="/modelos" data-link>Modelos</a> › ' + (p.formato ? '<a href="/modelos?formato=' + h(slug(p.formato)) + '" data-link>' + h(p.formato) + '</a> › ' : '') + '<span>' + h(p.nome) + '</span></nav>' +
      '<div class="produto">' +
        '<div class="galeria">' +
          '<div class="galeria-principal">' + (esgotado ? '<span class="badge esgotado">Esgotado</span>' : (v.estoque <= 5 ? '<span class="badge">' + rotuloEstoque(v.estoque) + '</span>' : '')) +
            (imagens[0] ? '<img id="foto-principal" src="' + h(imagens[0]) + '" alt="' + h(p.nome + ' ' + (v.cor || '')) + '" width="800" height="800">' : '<span>foto em breve</span>') + '</div>' +
          (imagens.length > 1 ? '<div class="galeria-thumbs">' + imagens.map(function (src, i) { return '<button class="' + (i === 0 ? 'ativo' : '') + '" data-action="foto" data-src="' + h(src) + '" aria-label="Foto ' + (i + 1) + '"><img src="' + h(src) + '" alt="" loading="lazy"></button>'; }).join('') + '</div>' : '') +
        '</div>' +
        '<div class="produto-info">' +
          '<div><span class="card-linha">' + h(p.formato || 'Armação') + (p.marca ? ' · ' + h(p.marca) : '') + '</span><h1 class="display">' + h(p.nome) + '</h1></div>' +
          '<div class="preco-bloco"><span class="valor">' + h(fmt(v.preco)) + '<small>no Pix</small></span>' +
            '<span class="segunda">Leve 2: a 2ª sai por ' + h(fmt(precoSegunda(v.preco))) + '</span>' +
            '<span class="parcelas">ou no cartão em até 6x</span></div>' +
          (variacoes.length > 1 ? '<div class="cores"><span class="rotulo">Cor: ' + h(v.cor) + '</span><div class="opcoes">' + variacoes.map(function (x) {
              return '<a class="cor-opcao' + (x.sku === v.sku ? ' ativo' : '') + (x.estoque > 0 ? '' : ' esgotado') + '" href="' + h(x.url) + '" data-link title="' + h(x.cor) + '">' + (x.imagem ? '<img src="' + h(x.imagem) + '" alt="">' : '') + '<span>' + h(x.cor) + '</span></a>';
            }).join('') + '</div></div>' : (v.cor ? '<div class="cores"><span class="rotulo">Cor: ' + h(v.cor) + '</span></div>' : '')) +
          (esgotado ? '<p class="estoque-aviso zero">Essa cor está esgotada no momento.</p>' : (v.estoque <= 5 ? '<p class="estoque-aviso">' + rotuloEstoque(v.estoque) + ' em estoque.</p>' : '')) +
          '<div class="acoes">' +
            '<button class="btn btn-laranja btn-bloco" data-action="comprar" data-sku="' + h(v.sku) + '"' + (esgotado ? ' disabled' : '') + '>Comprar agora</button>' +
            '<button class="btn btn-contorno btn-bloco" data-action="adicionar" data-sku="' + h(v.sku) + '"' + (esgotado ? ' disabled' : '') + '>Adicionar ao carrinho</button>' +
          '</div>' +
          '<ul class="garantias"><li>Nota fiscal em todo pedido</li><li>Garantia de 1 ano contra defeito de fabricação</li><li>Troca grátis em 30 dias</li><li>Pix aprovado na hora · cartão em até 6x</li></ul>' +
          '<div><div class="bloco-titulo">Medidas</div><table class="medidas"><tbody>' +
            (med.lente ? '<tr><th>Largura da lente</th><td>' + med.lente + ' mm</td></tr>' : '') +
            (med.ponte ? '<tr><th>Ponte</th><td>' + med.ponte + ' mm</td></tr>' : '') +
            (med.haste ? '<tr><th>Haste</th><td>' + med.haste + ' mm</td></tr>' : '') +
            (med.frontal ? '<tr><th>Largura frontal</th><td>' + med.frontal + ' mm</td></tr>' : '') +
            (p.peso_gramas ? '<tr><th>Peso</th><td>' + p.peso_gramas + ' g</td></tr>' : '') +
            (p.material ? '<tr><th>Material</th><td>' + h(p.material) + '</td></tr>' : '') +
            (p.genero ? '<tr><th>Gênero</th><td>' + h(p.genero) + '</td></tr>' : '') +
            '<tr><th>Código</th><td>' + h(v.sku) + '</td></tr>' +
          '</tbody></table></div>' +
          (desc ? '<div><div class="bloco-titulo">Sobre o modelo</div><p class="descricao">' + h(desc) + '</p></div>' : '') +
        '</div>' +
      '</div>' +
      (relacionados.length ? '<section class="secao"><div class="secao-titulo"><h2 class="display">Combina com</h2></div><div class="grade">' + relacionados.map(cardProduto).join('') + '</div></section>' : '') +
      '</div>' +
      (esgotado ? '' : '<div class="barra-comprar"><div class="container"><button class="btn btn-laranja btn-bloco" data-action="comprar" data-sku="' + h(v.sku) + '">Comprar agora · ' + h(fmt(v.preco)) + '</button></div></div>');
    track('view_item', { value: v.preco, items: [itemGA(p, v, 1)] });
  }

  function progressoLeve(unidades) {
    var l2 = estado.regras.leve2_pct, l3 = estado.regras.leve3_pct, msg, pct;
    if (unidades <= 1) { msg = 'Falta 1 pro Leve 2 — a 2ª sai com -' + l2 + '%'; pct = 33; }
    else if (unidades === 2) { msg = 'Leve 2 ativado! Falta 1 pro Leve 3 (-' + l3 + '% na 3ª)'; pct = 66; }
    else { msg = 'Leve 3 ativado — desconto máximo no pedido'; pct = 100; }
    return '<div class="progresso"><span class="msg">' + h(msg) + '</span><div class="barra"><i style="width:' + pct + '%"></i></div></div>';
  }
  function resumoHtml(r, comCta) {
    if (!r) return '';
    return '<div class="resumo-linha"><span>Subtotal (' + r.unidades + ' ' + (r.unidades === 1 ? 'armação' : 'armações') + ')</span><span>' + h(fmt(r.subtotal)) + '</span></div>' +
      (r.desconto > 0 ? '<div class="resumo-linha desconto"><span>Leve 2/3 (-' + (r.desconto_pct || '') + '%)</span><span>-' + h(fmt(r.desconto)) + '</span></div>' : '') +
      '<div class="resumo-linha"><span>Frete' + (r.frete_prazo ? ' <small>(' + h(r.frete_prazo) + ')</small>' : '') + '</span><span>' + (r.frete == null ? 'informe o CEP' : (r.frete === 0 ? 'grátis' : h(fmt(r.frete)))) + '</span></div>' +
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
            var img = it.imagem || local.imagem;
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
          (carregando ? '<p class="endereco-resolvido"><span class="spinner"></span> Calculando…</p>' : resumoHtml(resumo ? Object.assign({}, resumo.resumo, { endereco: undefined }) : null)) +
          '<a class="btn btn-laranja btn-bloco" href="/checkout" data-link' + (erro ? ' aria-disabled="true" style="pointer-events:none;opacity:.55"' : '') + '>Fechar pedido →</a>' +
          '<p class="endereco-resolvido">Pix aprovado na hora · cartão em até 6x · nota fiscal · troca grátis em 30 dias</p>' +
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
    function campo(nome, rotulo, attrs, ajuda) {
      return '<div class="campo' + (erros[nome] ? ' invalido' : '') + '"><label for="f-' + nome + '">' + h(rotulo) + '</label><input id="f-' + nome + '" name="' + nome + '" value="' + h(f[nome] || '') + '" ' + attrs + '>' + (erros[nome] ? '<span class="erro-campo">' + h(erros[nome]) + '</span>' : (ajuda ? '<span class="ajuda">' + h(ajuda) + '</span>' : '')) + '</div>';
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
            campo('nome', 'Nome completo', 'autocomplete="name" required') +
            '<div class="dupla">' + campo('cpf', 'CPF', 'inputmode="numeric" autocomplete="off" data-mascara="cpf" placeholder="000.000.000-00" required', 'Vai na nota fiscal.') + campo('telefone', 'WhatsApp', 'inputmode="tel" autocomplete="tel" data-mascara="tel" placeholder="(11) 90000-0000" required') + '</div>' +
            campo('email', 'E-mail', 'type="email" inputmode="email" autocomplete="email" required', 'Nota fiscal e rastreio chegam aqui.') +
            '<h2 class="display" style="margin-top:8px">Entrega</h2>' +
            '<div class="dupla">' + campo('cep', 'CEP', 'inputmode="numeric" autocomplete="postal-code" data-mascara="cep" placeholder="00000-000" required') + campo('numero', 'Número', 'autocomplete="address-line2" inputmode="numeric" required') + '</div>' +
            (end && end.logradouro ? '<p class="endereco-resolvido">' + h([end.logradouro, end.bairro, end.cidade ? end.cidade + '/' + end.uf : ''].filter(Boolean).join(', ')) + '</p>' : (digitos(f.cep).length === 8 ? '<p class="endereco-resolvido"><span class="spinner"></span> Buscando o endereço…</p>' : '')) +
            campo('complemento', 'Complemento (opcional)', 'autocomplete="address-line3" placeholder="apto, bloco, referência"') +
            '<h2 class="display" style="margin-top:8px">Pagamento</h2>' +
            '<div class="pagamento-opcoes">' +
              '<label class="pag-opcao' + (f.metodo === 'PIX' ? ' ativo' : '') + '"><input type="radio" name="metodo" value="PIX"' + (f.metodo === 'PIX' ? ' checked' : '') + '><div><strong>Pix <span class="recomendado">Na hora</span></strong><span>QR Code ou copia-e-cola. O pedido confirma sozinho em segundos.</span></div></label>' +
              '<label class="pag-opcao' + (f.metodo === 'CREDIT_CARD' ? ' ativo' : '') + '"><input type="radio" name="metodo" value="CREDIT_CARD"' + (f.metodo === 'CREDIT_CARD' ? ' checked' : '') + '><div><strong>Cartão de crédito</strong><span>Pagamento numa página segura da operadora. Parcele em até 6x.</span>' +
                '<div class="campo" style="margin-top:8px' + (f.metodo === 'CREDIT_CARD' ? '' : ';display:none') + '" id="bloco-parcelas"><label for="f-parcelas">Parcelas</label><select id="f-parcelas" name="parcelas">' + [1, 2, 3, 4, 5, 6].map(function (n) { return '<option value="' + n + '"' + (Number(f.parcelas) === n ? ' selected' : '') + '>' + n + 'x' + (r ? ' de ' + fmt(r.total / n) : '') + '</option>'; }).join('') + '</select><span class="ajuda">Valor final das parcelas confirmado na página da operadora.</span></div>' +
              '</div></label>' +
            '</div>' +
            (aviso ? '<div class="aviso erro">' + h(aviso) + '</div>' : '') +
            '<button class="btn btn-laranja btn-bloco" type="submit"' + (enviando || !r ? ' disabled' : '') + '>' + (enviando ? 'Gerando pagamento…' : (f.metodo === 'CREDIT_CARD' ? 'Pagar no cartão' : 'Pagar no Pix')) + (r ? ' · ' + h(fmt(r.total)) : '') + '</button>' +
            '<p class="ajuda" style="font-size:12px;color:var(--texto-suave)">Ao pagar, você concorda com os <a href="/termos" data-link>termos de uso</a> e a <a href="/privacidade" data-link>política de privacidade</a>.</p>' +
          '</div>' +
          '<div class="painel sticky"><h2 class="display">Seu pedido</h2>' +
            (r ? '<div class="mini-itens">' + r.itens.map(function (i) { var local = estado.carrinho.find(function (c) { return c.sku === i.sku; }) || {}; return '<div class="mini-item">' + ((i.imagem || local.imagem) ? '<img src="' + h(i.imagem || local.imagem) + '" alt="">' : '<div></div>') + '<span>' + i.qty + 'x ' + h(i.nome) + '</span><strong>' + h(fmt(i.total)) + '</strong></div>'; }).join('') + '</div>' + resumoHtml(r) : '<p class="endereco-resolvido"><span class="spinner"></span> Calculando o pedido…</p>') +
          '</div>' +
        '</form></div>';
      if (foco) {
        var de = document.getElementById(foco.id);
        if (de) { de.focus(); try { if (foco.pos != null) de.setSelectionRange(foco.pos, foco.pos); } catch (e) {} }
      }
    }
    var ultimaCotacao = null;
    var g = geracao;
    function recotar() {
      render(ultimaCotacao, '', false);
      return cotar(f.cep).then(function (d) { if (g !== geracao) return; ultimaCotacao = d; render(d, '', false); }).catch(function (e) { if (g === geracao) render(null, e.message, false); });
    }
    recotar().then(function () {
      if (ultimaCotacao) track('begin_checkout', { value: ultimaCotacao.resumo.total, items: ultimaCotacao.resumo.itens.map(function (i) { return { item_id: i.sku, item_name: i.nome, price: i.preco, quantity: i.qty }; }) });
    });

    // guarda o formulário enquanto digita (sobrevive a recarregar a página)
    app.oninput = function (e) {
      var el = e.target;
      if (!el.name) return;
      if (el.dataset.mascara) { var pos = el.value.length; el.value = mascara(el.dataset.mascara, el.value); }
      f[el.name] = el.value;
      gravar('sa_checkout', f, sessionStorage);
      if (el.name === 'cep' && digitos(el.value).length === 8 && el.value !== estado.cep) { estado.cep = el.value; gravar('sa_cep', estado.cep); recotar(); }
    };
    app.onchange = function (e) {
      var el = e.target;
      if (el.name === 'metodo') { f.metodo = el.value; gravar('sa_checkout', f, sessionStorage); render(ultimaCotacao, '', false); }
      if (el.name === 'parcelas') { f.parcelas = Number(el.value); gravar('sa_checkout', f, sessionStorage); }
    };
    app.onsubmit = function (e) {
      if (!e.target.matches('[data-action="checkout"]')) return;
      e.preventDefault();
      erros = validarForm(f);
      if (Object.keys(erros).length) { render(ultimaCotacao, 'Confere os campos destacados.', false); var primeiro = document.querySelector('.campo.invalido input'); if (primeiro) primeiro.focus(); return; }
      render(ultimaCotacao, '', true);
      track('add_payment_info', { value: ultimaCotacao ? ultimaCotacao.resumo.total : 0, payment_type: f.metodo === 'CREDIT_CARD' ? 'cartao' : 'pix', items: ultimaCotacao ? ultimaCotacao.resumo.itens.map(function (i) { return { item_id: i.sku, item_name: i.nome, price: i.preco, quantity: i.qty }; }) : [] });
      var body = {
        itens: itensPedido(),
        cliente: { nome: f.nome.trim(), cpf: f.cpf, email: f.email.trim(), telefone: f.telefone, cep: f.cep, numero: String(f.numero).trim(), complemento: f.complemento || '' },
        metodo: f.metodo, parcelas: f.metodo === 'CREDIT_CARD' ? (Number(f.parcelas) || 1) : 1,
        tracking: { ga_client_id: gaClientId(), fbp: cookie('_fbp'), fbc: cookie('_fbc'), source_url: location.href }
      };
      fetch(CONFIG.api + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, dados: d }; }); })
        .then(function (res) {
          if (g !== geracao) return;
          var d = res.dados || {};
          if (!res.ok) throw new Error(d.erro || 'Não foi possível iniciar o pagamento.');
          if (d.metodo === 'CREDIT_CARD' && d.checkout_url) {
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
  // Institucional
  // ---------------------------------------------------------------------------
  var PAGINAS = {
    'quem-somos': { t: 'Quem somos', d: 'A Só Armação é uma loja 100% online de armações de óculos de grau, de São Bernardo do Campo/SP.', b: [
      ['', 'A Só Armação nasceu de uma conta que não fechava: a armação que custa pouco pra fabricar chega na ótica custando dez vezes mais. A gente tirou o que encarece — loja física, atravessador, marca de grife — e deixou o que importa: armação de qualidade, preço justo e entrega rápida.'],
      ['', 'Somos 100% online. Vendemos só a armação — você coloca as lentes do seu grau na ótica ou no laboratório da sua confiança. Preço baixo todo dia, sem promoção de mentira. Nota fiscal em todo pedido, garantia de 1 ano contra defeito de fabricação e troca grátis em 30 dias.'],
      ['', 'Ninguém faz melhor por menos.']] },
    'como-comprar': { t: 'Como comprar', d: 'Passo a passo pra comprar sua armação na Só Armação.', b: [
      ['1 — Escolha a armação', 'Navegue pelos modelos e use os filtros de formato e cor. Todas as medidas (lente, ponte, haste e largura frontal) estão na página de cada modelo — compare com um óculos que já serve bem em você.'],
      ['2 — Adicione ao carrinho', 'Levando 2 armações no mesmo pedido, a 2ª sai com desconto; levando 3, a 3ª sai com desconto maior. O frete é um só pro pedido inteiro e é calculado pelo seu CEP.'],
      ['3 — Informe seus dados', 'Nome, CPF, e-mail, WhatsApp, CEP e número. O endereço é preenchido sozinho a partir do CEP.'],
      ['4 — Pague no Pix ou no cartão', 'No Pix, escaneie o QR Code ou copie o código: a confirmação é automática, em segundos. No cartão de crédito, o pagamento abre numa página segura da operadora e você pode parcelar.'],
      ['5 — Receba em casa', 'Até 3 dias úteis na Grande São Paulo e até 5 dias úteis pro resto do Brasil, contados da confirmação do pagamento. O rastreio chega no seu e-mail.']] },
    entrega: { t: 'Entrega e frete', d: 'Prazos, valor do frete e rastreio dos pedidos da Só Armação.', b: [
      ['Prazo', 'Até 3 dias úteis na Grande São Paulo e até 5 dias úteis pra todo o Brasil, contados a partir da confirmação do pagamento.'],
      ['Valor', 'Calculado pelo seu CEP, direto no carrinho, antes de você pagar. Levando 2 ou 3 armações, o frete é um só pro pedido inteiro.'],
      ['Rastreio', 'O código de rastreio chega no seu e-mail assim que o pedido é postado.'],
      ['Endereço errado?', 'Avise a gente por e-mail (' + CONFIG.email + ') antes da postagem que a gente corrige sem custo.']] },
    pagamento: { t: 'Pagamento', d: 'Pix com confirmação automática ou cartão de crédito parcelado.', b: [
      ['Pix', 'O pedido é liberado na hora e o preço é o da tela. Você recebe um QR Code e um código copia-e-cola válidos por 15 minutos; pagou, o pedido confirma sozinho em segundos.'],
      ['Cartão de crédito', 'O pagamento abre numa página segura da operadora e volta pro site com a resposta. Dá pra parcelar em até 6x; o valor das parcelas é confirmado na página da operadora. O pedido é liberado depois da aprovação.'],
      ['É seguro?', 'O Pix é do Banco Central e o código gerado vale só pro seu pedido, com o valor exato. Os dados do cartão são digitados na página da operadora — nunca passam pelo nosso site.'],
      ['Reembolso', 'Cancelamento e devolução são reembolsados na mesma forma de pagamento do pedido.']] },
    'trocas-e-devolucoes': { t: 'Trocas e devoluções', d: 'Troca grátis em 30 dias e devolução com reembolso integral na Só Armação.', b: [
      ['Troca grátis em 30 dias', 'Não serviu, não gostou ou mudou de ideia? Em até 30 dias corridos depois de receber, você pode trocar por outro modelo ou devolver e receber o dinheiro de volta. A armação precisa estar sem uso, sem lentes de grau instaladas e com a embalagem e os acessórios que vieram com ela.'],
      ['Direito de arrependimento', 'Como manda o Código de Defesa do Consumidor (art. 49), você pode desistir da compra em até 7 dias corridos depois de receber o produto, com reembolso integral, incluindo o frete pago.'],
      ['Defeito de fabricação', 'Todas as armações têm garantia de 1 ano contra defeito de fabricação (solda, pintura, dobradiça). Veja a página de garantia.'],
      ['Como pedir', 'Mande um e-mail pra ' + CONFIG.email + ' com o número do pedido, o motivo e, se for defeito, uma foto. Respondemos em até 1 dia útil com a etiqueta de postagem — você não paga o frete da devolução.'],
      ['Reembolso', 'Feito na mesma forma de pagamento assim que a armação chegar e for conferida: no Pix, em até 2 dias úteis; no cartão, o estorno aparece na fatura conforme o prazo da operadora.']] },
    garantia: { t: 'Garantia', d: 'Garantia de 1 ano contra defeito de fabricação nas armações da Só Armação.', b: [
      ['1 ano contra defeito de fabricação', 'Solda, pintura, dobradiça e plaquetas. Apresentou defeito no uso normal dentro do prazo? A gente troca por uma nova ou devolve o dinheiro.'],
      ['O que a garantia não cobre', 'Mau uso: sentar ou pisar em cima, quedas, riscos de uso, contato com produto químico e lentes instaladas fora das medidas da armação.'],
      ['Como acionar', 'Mande o número do pedido e uma foto do problema pra ' + CONFIG.email + '. Resposta em até 1 dia útil.']] },
    privacidade: { t: 'Política de privacidade', d: 'Como a Só Armação coleta, usa e protege seus dados (LGPD).', b: [
      ['O que coletamos', 'Nome, CPF, e-mail, WhatsApp e endereço — o necessário pra processar o pedido, emitir a nota fiscal e entregar. Também usamos cookies de medição (Google Analytics e Meta) pra entender como a loja é usada.'],
      ['Como usamos', 'Pra entregar seu pedido, emitir nota, calcular frete, confirmar o pagamento e, se você autorizar, avisar sobre novidades. O CPF é guardado só de forma protegida (hash) no nosso banco.'],
      ['Com quem compartilhamos', 'Só com quem precisa pra operação: a instituição de pagamento (Pix e cartão), a transportadora e o sistema emissor de nota fiscal. Não vendemos seus dados.'],
      ['Seus direitos (LGPD)', 'Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail ' + CONFIG.email + '.']] },
    termos: { t: 'Termos de uso', d: 'Condições de compra na Só Armação.', b: [
      ['', 'Ao comprar na Só Armação você concorda com estes termos. Eles existem pra deixar tudo claro, sem letra miúda.'],
      ['Preços e pagamento', 'O preço exibido é o preço final à vista no Pix. No cartão de crédito dá pra parcelar. O pedido é confirmado só depois do pagamento aprovado. Preço, desconto e frete são calculados no nosso servidor no momento do pagamento.'],
      ['Estoque', 'Quantidade limitada por modelo e cor. Se um item acabar entre o carrinho e o pagamento, o pedido não é concluído e nada é cobrado — e se houver cobrança, devolvemos 100% do valor.'],
      ['Produto', 'Vendemos a armação sem lentes de grau. As lentes são colocadas na ótica ou no laboratório da sua escolha.'],
      ['Cancelamento', 'Pedido pago pode ser cancelado até a postagem, com devolução integral na mesma forma de pagamento.'],
      ['Empresa', 'So Armacao Comercio de Armacoes Ltda — Avenida Armando Italo Setti, 520, sala 81, Baeta Neves, São Bernardo do Campo/SP, CEP 09760-280.']] },
    contato: { t: 'Fale conosco', d: 'Atendimento da Só Armação por e-mail.', b: [
      ['E-mail', CONFIG.email + ' — respondemos em até 1 dia útil. Coloque o número do pedido no assunto que fica mais rápido.'],
      ['Endereço', 'Avenida Armando Italo Setti, 520, sala 81 — Baeta Neves, São Bernardo do Campo/SP, CEP 09760-280. Atendimento só online: não temos loja física, e é isso que mantém o preço baixo.'],
      ['Desconfiou de golpe?', 'A Só Armação nunca pede senha, código de segurança ou Pix fora do checkout do site soarmacao.com.br.']] }
  };
  function viewAjuda() {
    titulo('Ajuda', 'Central de ajuda da Só Armação: como comprar, entrega, pagamento, trocas e garantia.');
    app.innerHTML = '<div class="container institucional"><h1 class="display">Ajuda</h1><p>Tudo o que você precisa saber antes e depois de comprar.</p><div class="ajuda-links">' +
      Object.keys(PAGINAS).map(function (k) { return '<a href="/' + k + '" data-link>' + h(PAGINAS[k].t) + '</a>'; }).join('') + '</div><h2>Perguntas frequentes</h2><div class="faq">' + faq() + '</div></div>';
  }
  function viewInstitucional(m) {
    var pg = PAGINAS[m[1]];
    titulo(pg.t, pg.d);
    app.innerHTML = '<div class="container institucional"><nav class="migalhas"><a href="/" data-link>Início</a> › <a href="/ajuda" data-link>Ajuda</a> › <span>' + h(pg.t) + '</span></nav><h1 class="display">' + h(pg.t) + '</h1>' +
      pg.b.map(function (b) { return (b[0] ? '<h2>' + h(b[0]) + '</h2>' : '') + '<p>' + h(b[1]) + '</p>'; }).join('') +
      '<p style="margin-top:24px"><a class="btn btn-laranja" href="/modelos" data-link>Ver modelos</a></p></div>';
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  document.addEventListener('click', function (e) {
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
    else if (acao === 'limpar-filtros') { history.replaceState({}, '', location.pathname); atualizarGrade(); }
    else if (acao === 'recarregar') { apagar('sa_catalogo', sessionStorage); estado.catalogo = null; rotear(); }
    else if (acao === 'foto') { var img = document.getElementById('foto-principal'); if (img) img.src = el.dataset.src; document.querySelectorAll('.galeria-thumbs button').forEach(function (b) { b.classList.toggle('ativo', b === el); }); }
    else if (acao === 'adicionar' || acao === 'comprar') {
      var a = estado.porSku[String(el.dataset.sku).toUpperCase()];
      if (a) adicionarAoCarrinho(a.produto, a.variacao, acao === 'adicionar');
    }
    else if (acao === 'qtd') { alterarQtd(el.dataset.sku, Number(el.dataset.delta)); geracao++; viewCarrinho(); }
    else if (acao === 'remover') { removerDoCarrinho(el.dataset.sku); geracao++; viewCarrinho(); }
    else if (acao === 'copiar') {
      var inp = document.getElementById('copia');
      var feito = function () { toast('Código Pix copiado. Cole no app do seu banco.'); track('pix_copy', {}); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(feito, function () { inp.select(); document.execCommand('copy'); feito(); });
      else { inp.select(); document.execCommand('copy'); feito(); }
    }
    else if (acao === 'ja-paguei') { if (estado.pix) conferirPagamento(estado.pix.pedidoId, true); }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches('select[data-action="filtro"]')) { var o = {}; o[el.dataset.chave] = el.value; setQuery(o); atualizarGrade(); track('filter_use', { filtro: el.dataset.chave, valor: el.value }); }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.matches('[data-action="cep"]')) {
      e.preventDefault();
      var cep = mascara('cep', form.cep.value);
      if (digitos(cep).length !== 8) { toast('Digite o CEP completo, com 8 números.'); return; }
      estado.cep = cep; gravar('sa_cep', cep);
      geracao++; viewCarrinho();
    }
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (el.matches('#cep')) el.value = mascara('cep', el.value);
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
  rotear();
})();
