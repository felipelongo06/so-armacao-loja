/**
 * GET /, /modelos, /ajuda, /p/:codigo, páginas institucionais e /llms.txt
 * (rewrites no vercel.json apontam pra cá).
 *
 * A loja é uma SPA: sem isto, quem não roda JavaScript (GPTBot, ClaudeBot,
 * PerplexityBot e o primeiro passe do Google) recebe só "Carregando…".
 * Aqui o servidor monta o mesmo app.html (a casca da SPA) já com título, description,
 * canonical, og:*, dados estruturados (JSON-LD) e o conteúdo da página dentro
 * do <main id="app" data-ssr>. No navegador o app.js assume a página como
 * sempre (sem mostrar o "Carregando" por cima desse conteúdo).
 *
 * Modelo que não está no catálogo (desativado ou endereço inventado) responde
 * 404 com noindex. Se o catálogo estiver fora do ar, devolve o app.html puro
 * com 200: a loja abre como antes e nada quebra.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '../conteudo.js';

const SITE = 'https://soarmacao.com.br';
const CATALOGO = process.env.CATALOGO_URL || 'https://api.soarmacao.com.br/api/catalogo';
const CACHE_MS = 2 * 60 * 1000;
const FOTOS_VERSAO = '2'; // igual ao app.js
const RE_FOTO_CDN = /^(.*\/so-armacao-fotos@[^/]+\/[^/]+?)\.(jpe?g|png|webp)$/i;
const TIPOS = { grau: 'De grau', sol: 'De sol', 'grau-e-sol': 'Grau ou sol' };
const C = globalThis.SA_CONTEUDO;

// Troca e envio em dados estruturados: as mesmas regras das páginas Trocas e
// devoluções e Entrega (7 dias de arrependimento, devolução grátis, reembolso
// integral; até 3 dias úteis na Grande SP e até 5 no resto do Brasil).
// O valor do frete depende do CEP (Melhor Envio), por isso não vai aqui.
const POLITICA_TROCA = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'BR',
  returnPolicyCountry: 'BR',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 7,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/FreeReturn',
  refundType: 'https://schema.org/FullRefund',
  merchantReturnLink: `${SITE}/trocas-e-devolucoes`,
};
const ENVIO = {
  '@type': 'OfferShippingDetails',
  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'BR' },
  deliveryTime: {
    '@type': 'ShippingDeliveryTime',
    handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
    transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 4, unitCode: 'DAY' },
  },
};
const ldLista = (produtos) => ({
  '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: produtos.length,
  itemListElement: produtos.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + urlProduto(p), name: p.nome })),
});
const ldPerguntas = (pares) => ({ '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: pares.map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: C.semLinks(r) } })) });
const ldFaq = (l2) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: C.faq(l2).map(([q, r]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: r } })),
});

let BASE = null;
function base() {
  if (!BASE) BASE = readFileSync(join(process.cwd(), 'app.html'), 'utf8');
  return BASE;
}

let cache = { ts: 0, dados: null };
async function catalogo() {
  if (cache.dados && Date.now() - cache.ts < CACHE_MS) return cache.dados;
  try {
    const r = await fetch(CATALOGO, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`catalogo ${r.status}`);
    cache = { ts: Date.now(), dados: await r.json() };
  } catch (e) {
    if (!cache.dados) throw e;
    console.error('[pagina] catálogo falhou, usando o guardado:', e.message);
  }
  return cache.dados;
}

// --- utilidades (mesmas regras do app.js) ---------------------------------
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const fmt = (v) => brl.format(Number(v) || 0).replace(/ /g, ' ');
const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const foto = (url) => (url && RE_FOTO_CDN.test(url) && !url.includes('?') ? `${url}?v=${FOTOS_VERSAO}` : url);
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function textoPuro(html) {
  return String(html || '')
    .replace(/<\s*(br|\/p|\/li|\/div)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n ? String.fromCodePoint(n) : m; }
      return ENTIDADES[e.toLowerCase()] || m;
    });
}
function limparDescricao(texto) {
  return textoPuro(texto)
    .replace(/compre com nota fiscal,?\s*garantia de 1 ano( contra defeito de fabricação)?\s*e\s*troca em até 30 dias\.?/gi, 'Compre com nota fiscal e troca grátis em até 7 dias úteis.')
    .replace(/,?\s*garantia de 1 ano( contra defeito de fabricação)?/gi, '')
    .replace(/,?\s*(e\s*)?troca (grátis )?em até 30 dias/gi, '')
    .replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();
}
const resumo = (t, n = 155) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
const urlProduto = (p) => String(p.url || `/p/${encodeURIComponent(p.codigo)}/`).split('?')[0];
const variacoesOrdenadas = (p) => (p.variacoes || []).slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
const vende = (v) => v.estoque > 0 && v.preco > 0;
function precoMinimo(cat) {
  let min = null;
  for (const p of cat.produtos || []) for (const v of p.variacoes || []) if (vende(v) && (min == null || v.preco < min)) min = v.preco;
  return min ?? 49;
}

// Mesma busca do app.js (produtoPorRota): código, slug, endereço de SEO, SKU de uma cor
// ou, se o nome mudou depois que o link circulou, o código no fim do endereço.
function acharProduto(cat, codigo) {
  const c = String(codigo || '').toUpperCase().replace(/\/+$/, '');
  const s = slug(c).toUpperCase();
  const lista = cat.produtos || [];
  for (const p of lista) {
    const seg = String(p.url || '').split('/')[2];
    if ([String(p.codigo).toUpperCase(), String(p.slug || '').toUpperCase(), String(seg || '').toUpperCase()].some((k) => k && (k === c || k === s))) return { produto: p, variacao: null };
  }
  for (const p of lista) for (const v of p.variacoes || []) if (String(v.sku).toUpperCase() === c) return { produto: p, variacao: v };
  for (const p of lista) {
    const cod = slug(p.codigo).toUpperCase();
    if (cod && s.slice(-(cod.length + 1)) === '-' + cod) return { produto: p, variacao: null };
  }
  return null;
}

function migalhas(itens) {
  return '<nav class="migalhas" aria-label="Você está em">' +
    itens.map(([nome, url]) => (url ? `<a href="${h(url)}" data-link>${h(nome)}</a>` : `<span>${h(nome)}</span>`)).join(' › ') + '</nav>';
}
function ldMigalhas(itens) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: itens.map(([nome, url], i) => ({ '@type': 'ListItem', position: i + 1, name: nome, ...(url ? { item: SITE + url } : {}) })),
  };
}
function listaModelos(produtos) {
  return '<ul class="ssr-lista">' + produtos.map((p) => {
    const vs = variacoesOrdenadas(p);
    const v = vs.find(vende) || vs[0] || {};
    const partes = [p.formato, TIPOS[p.tipo], p.material, p.genero].filter(Boolean).join(' · ');
    return `<li><a href="${h(urlProduto(p))}" data-link>${h(p.nome)}</a> <span>${h(partes)} · ${p.estoque_total > 0 ? h(fmt(v.preco || p.preco)) + ' no Pix' : 'esgotado'}</span></li>`;
  }).join('') + '</ul>';
}
function faqHtml(l2) {
  return '<div class="faq">' + C.faq(l2).map(([p, r]) => `<details><summary>${h(p)}</summary><p>${h(r)}</p></details>`).join('') + '</div>';
}

// --- páginas -------------------------------------------------------------
function paginaProduto(cat, codigo, cor) {
  const achado = acharProduto(cat, codigo);
  if (!achado) {
    return {
      status: 404, titulo: 'Modelo não encontrado — Só Armação', descricao: 'Esse modelo não está mais disponível na Só Armação.', caminho: `/p/${codigo}/`, noindex: true,
      corpo: '<div class="container institucional"><h1 class="display">Não achamos esse modelo.</h1><p>Ele pode ter saído de linha. <a href="/modelos" data-link>Ver todos os modelos →</a></p></div>',
    };
  }
  const p = achado.produto;
  const l2 = cat.regras?.leve2_pct ?? 40;
  const vs = variacoesOrdenadas(p);
  const v = achado.variacao || vs.find((x) => cor && (x.cor_slug || slug(x.cor)) === cor) || vs.find((x) => x.estoque > 0) || vs[0] || {};
  const url = urlProduto(p);
  const desc = limparDescricao(p.descricao);
  const med = p.medidas || {};
  const sol = v.tipo === 'sol';
  const imagens = [...new Set([v.imagem, ...(v.imagens || []), p.imagem].filter(Boolean))].slice(0, 5).map(foto);
  const trilha = [['Início', '/'], ['Modelos', '/modelos'], ...(p.formato ? [[p.formato, `/modelos?formato=${slug(p.formato)}`]] : []), [p.nome, null]];
  const linhasMedidas = [
    med.lente && ['Largura da lente', `${med.lente} mm`],
    med.ponte && ['Ponte', `${med.ponte} mm`],
    med.haste && ['Haste', `${med.haste} mm`],
    med.frontal && ['Largura frontal', `${med.frontal} mm`],
    p.peso_gramas && ['Peso', `${p.peso_gramas} g`],
    ['Tipo', sol ? 'Óculos de sol' : 'Armação para óculos de grau (vem sem lentes)'],
    p.material && ['Material', p.material],
    p.genero && ['Gênero', p.genero],
    p.formato && ['Formato', p.formato],
  ].filter(Boolean);
  const avisoLentes = sol
    ? 'Vem com lentes de sol, sem grau. Precisa de grau? Leve à ótica da sua preferência com a sua receita e peça para colocarem as lentes do seu grau.'
    : 'Vendemos só a armação: ela vem sem lentes de grau. Quando chegar, leve à ótica da sua preferência com a sua receita (ou faça lá o exame de vista) e peça para colocarem as lentes de grau.';
  const relacionados = (cat.produtos || []).filter((x) => x.codigo !== p.codigo && x.formato === p.formato && x.estoque_total > 0).slice(0, 4);
  const ficha = C.fichaModelo(p, v);
  const nota = p.avaliacao && p.avaliacao.total > 0 && p.avaliacao.media ? p.avaliacao : null;

  const corpo = '<div class="container">' + migalhas(trilha) +
    '<div class="produto">' +
      (imagens.length ? `<figure class="ssr-foto"><img src="${h(imagens[0])}" alt="${h(p.nome + (v.cor ? ' ' + v.cor : ''))}" width="800" height="800"></figure>` : '') +
      '<div class="produto-info">' +
        `<div><span class="card-linha">${h([p.formato || 'Armação', TIPOS[v.tipo || p.tipo], p.marca].filter(Boolean).join(' · '))}</span><h1 class="display">${h(p.nome)}</h1></div>` +
        (nota ? `<p class="aval-resumo">Nota ${h(String(Number(nota.media).toFixed(1)).replace('.', ','))} de 5, em ${nota.total} avaliaç${nota.total === 1 ? 'ão' : 'ões'} de compra verificada</p>` : '') +
        `<div class="preco-bloco">${v.preco_de > v.preco ? `<s>${h(fmt(v.preco_de))}</s> ` : ''}<span class="valor">${h(fmt(v.preco))} <small>no Pix</small></span>` +
          `<span class="segunda">Levando 2, a 2ª sai por ${h(fmt(v.preco * (1 - l2 / 100)))}</span><span class="parcelas">ou no cartão em até 6x</span></div>` +
        (vs.length ? `<div class="cores"><span class="rotulo">${vs.length > 1 ? `${vs.length} cores` : 'Cor'}:</span><ul>` +
          vs.map((x) => `<li><a href="${h(x.url || url)}" data-link>${h(x.cor)}</a>${x.tipo === 'sol' ? ' (sol)' : ''}${x.estoque > 0 ? '' : ' — esgotada'}</li>`).join('') + '</ul></div>' : '') +
        `<p class="aviso-lentes" role="note">${h(avisoLentes)} <a href="/como-comprar" data-link>Como funciona</a></p>` +
        '<ul class="garantias"><li>Nota fiscal em todo pedido</li><li>Troca grátis em até 7 dias úteis (arrependimento)</li><li>Depois, troca só por defeito de fabricação, conforme o Código de Defesa do Consumidor</li><li>Pix aprovado na hora · cartão em até 6x</li></ul>' +
        '<div><h2 class="bloco-titulo">Medidas</h2><table class="medidas"><tbody>' +
          linhasMedidas.map(([k, val]) => `<tr><th>${h(k)}</th><td>${h(val)}</td></tr>`).join('') +
          `<tr><th>Código</th><td>${h(v.sku)}</td></tr></tbody></table></div>` +
        (desc ? `<div><h2 class="bloco-titulo">Sobre o modelo</h2><p class="descricao">${h(desc)}</p></div>` : '') +
        C.fichaHtml(ficha) +
      '</div>' +
    '</div>' +
    C.faqModeloHtml(ficha) +
    (relacionados.length ? '<section class="secao"><h2 class="display">Combina com</h2>' + listaModelos(relacionados) + '</section>' : '') +
    '</div>';

  const propriedades = linhasMedidas.filter(([k]) => /lente|ponte|haste|frontal/i.test(k))
    .map(([k, val]) => ({ '@type': 'PropertyValue', name: k, value: parseFloat(val), unitCode: 'MMT' }));
  const variante = (x) => ({
    '@type': 'Product',
    name: `${p.nome}${x.cor ? ' ' + x.cor : ''}`,
    sku: x.sku,
    color: x.cor,
    description: desc,
    image: [...new Set([x.imagem, ...(x.imagens || [])].filter(Boolean))].slice(0, 5).map(foto),
    offers: {
      '@type': 'Offer',
      url: SITE + (x.url || url),
      priceCurrency: 'BRL',
      price: Number(x.preco).toFixed(2),
      availability: x.estoque > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Só Armação' },
      shippingDetails: ENVIO,
      hasMerchantReturnPolicy: POLITICA_TROCA,
    },
  });
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'ProductGroup',
      name: p.nome,
      productGroupID: p.codigo,
      url: SITE + url,
      description: desc,
      brand: { '@type': 'Brand', name: p.marca || 'Só Armação' },
      image: imagens,
      ...(p.material ? { material: p.material } : {}),
      ...(p.peso_gramas ? { weight: { '@type': 'QuantitativeValue', value: p.peso_gramas, unitCode: 'GRM' } } : {}),
      ...(propriedades.length ? { additionalProperty: propriedades } : {}),
      ...(nota ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(nota.media).toFixed(1), reviewCount: nota.total, bestRating: 5, worstRating: 1 } } : {}),
      variesBy: 'https://schema.org/color',
      hasVariant: vs.map(variante),
    },
    { '@context': 'https://schema.org', ...ldMigalhas(trilha) },
    ldPerguntas(ficha.faq),
  ];
  return {
    status: 200,
    titulo: `${p.nome}${v.cor && achado.variacao ? ' ' + v.cor : ''} — ${fmt(v.preco)} | Só Armação`,
    descricao: resumo(desc || `${p.nome}: armação ${p.formato || ''} da Só Armação, ${fmt(v.preco)} no Pix.`),
    caminho: url, imagem: imagens[0], ogType: 'product', ld, corpo,
  };
}

function paginaHome(cat) {
  const l2 = cat.regras?.leve2_pct ?? 40;
  const min = precoMinimo(cat);
  const produtos = (cat.produtos || []).filter((p) => p.estoque_total > 0);
  const corpo = '<section class="secao"><div class="container">' +
    `<h1 class="display">Armações de óculos de grau a partir de ${h(fmt(min))}</h1>` +
    `<p>A Só Armação é uma loja 100% online de armações para óculos de grau e óculos de sol, de São Bernardo do Campo/SP. Vendemos só a armação, sem lentes de grau: você leva à ótica da sua preferência com a sua receita. Preço baixo todo dia, Pix aprovado na hora, nota fiscal em todo pedido e troca grátis em até 7 dias úteis. Levando 2, a 2ª armação sai com ${l2}% de desconto.</p>` +
    `<h2 class="display">Todos os modelos (${produtos.length})</h2>` + listaModelos(produtos) +
    '<h2 class="display">Como funciona</h2><ol>' +
      '<li><strong>Escolha a armação.</strong> Filtre por formato e cor. Todas as medidas estão na página do modelo.</li>' +
      `<li><strong>Adicione ao carrinho.</strong> Levando 2, a 2ª sai com -${l2}%. O frete é calculado pelo seu CEP.</li>` +
      '<li><strong>Pague no Pix ou cartão.</strong> No Pix a confirmação é automática, em segundos. No cartão, dá pra parcelar.</li>' +
      '<li><strong>Receba e leve à ótica.</strong> Chega com rastreio e nota fiscal. Aí é só levar à sua ótica, com a receita, para colocar as lentes de grau.</li>' +
    '</ol><h2 class="display">Perguntas frequentes</h2>' + faqHtml(l2) +
    '</div></section>';
  return {
    status: 200,
    titulo: `Só Armação — armações de grau a partir de ${fmt(min)}`,
    descricao: 'Armações para óculos de grau (vendidas sem lentes) com preço baixo todo dia, nota fiscal e troca grátis em até 7 dias úteis. Pix aprovado na hora ou cartão. Ninguém faz melhor por menos.',
    caminho: '/', ld: [ldLista(produtos), ldFaq(l2)], corpo,
  };
}

function paginaModelos(cat, tipo) {
  const t = tipo === 'sol' ? 'Óculos de sol' : tipo === 'grau' ? 'Óculos de grau' : 'Todos os modelos';
  const produtos = (cat.produtos || []).filter((p) => !tipo || (p.tipos || [p.tipo]).includes(tipo) || p.tipo === 'grau-e-sol');
  const trilha = [['Início', '/'], [t, null]];
  const corpo = '<section class="secao"><div class="container">' + migalhas(trilha) +
    `<h1 class="display">${h(t)}</h1><p>${produtos.length} modelos. Preço baixo todo dia, nota fiscal e troca grátis em até 7 dias úteis.</p>` +
    listaModelos(produtos) + '</div></section>';
  return {
    status: 200, titulo: `${t} — Só Armação`,
    descricao: (tipo === 'sol' ? 'Óculos de sol da Só Armação' : tipo === 'grau' ? 'Armações de óculos de grau da Só Armação' : 'Todas as armações da Só Armação') + ': gatinho, redondo, retangular, quadrado e hexagonal. Preço baixo todo dia e troca grátis em até 7 dias úteis.',
    caminho: '/modelos', ld: [{ '@context': 'https://schema.org', ...ldMigalhas([['Início', '/'], [t, '/modelos']]) }, ldLista(produtos)], corpo,
  };
}

function paginaAjuda(cat) {
  const l2 = cat?.regras?.leve2_pct ?? 40;
  const corpo = '<div class="container institucional">' + migalhas([['Início', '/'], ['Ajuda', null]]) +
    '<h1 class="display">Ajuda</h1><p>Tudo o que você precisa saber antes e depois de comprar.</p><ul class="ajuda-links">' +
    Object.entries(C.paginas).map(([k, pg]) => `<li><a href="/${k}" data-link>${h(pg.t)}</a></li>`).join('') +
    '</ul><h2>Perguntas frequentes</h2>' + faqHtml(l2) + '</div>';
  return { status: 200, titulo: 'Ajuda — Só Armação', descricao: 'Central de ajuda da Só Armação: como comprar, entrega, pagamento, trocas e devoluções.', caminho: '/ajuda', ld: [ldFaq(l2)], corpo };
}

function paginaInstitucional(chave) {
  const pg = C.paginas[chave];
  const trilha = [['Início', '/'], ['Ajuda', '/ajuda'], [pg.t, null]];
  const corpo = '<div class="container institucional">' + migalhas(trilha) + `<h1 class="display">${h(pg.t)}</h1>` +
    pg.b.map(([tit, txt]) => (tit ? `<h2>${h(tit)}</h2>` : '') + `<p>${h(txt)}</p>`).join('') + '</div>';
  return { status: 200, titulo: `${pg.t} — Só Armação`, descricao: pg.d, caminho: `/${chave}`, ld: [{ '@context': 'https://schema.org', ...ldMigalhas(trilha) }], corpo };
}

function paginaCategoria(cat, chave) {
  const c = C.categorias[chave];
  if (!c) return null;
  const produtos = (cat.produtos || []).filter((p) => C.naCategoria(c, p));
  const min = produtos.reduce((a, p) => (a == null || p.preco < a ? p.preco : a), null);
  const trilha = [['Início', '/'], ['Modelos', '/modelos'], [c.t, null]];
  const corpo = '<div class="container"><div class="institucional categoria">' + migalhas(trilha) + `<h1 class="display">${h(c.t)}</h1>` +
    C.categoriaTopoHtml(c, produtos.length, min, fmt) + '</div>' + listaModelos(produtos) +
    '<p class="categoria-outras">Veja também: ' + Object.keys(C.categorias).filter((k) => k !== chave)
      .map((k) => `<a href="/armacoes/${k}" data-link>${h(C.categorias[k].t.replace('Armação de óculos ', ''))}</a>`).join(' · ') + '</p></div>';
  return {
    status: 200, titulo: `${c.t}${min && !c.filtro.precoMax ? ' a partir de ' + fmt(min) : ''} | Só Armação`, descricao: c.d, caminho: `/armacoes/${chave}`, corpo,
    ld: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: c.t, description: c.d, url: `${SITE}/armacoes/${chave}` },
      { '@context': 'https://schema.org', ...ldMigalhas([['Início', '/'], ['Modelos', '/modelos'], [c.t, `/armacoes/${chave}`]]) }, ldLista(produtos)],
  };
}
function paginaGuias() {
  return {
    status: 200, titulo: 'Guias para escolher a armação de óculos | Só Armação', caminho: '/guia', corpo: C.guiasIndiceHtml(),
    descricao: 'Guias da Só Armação para escolher a armação certa: tamanho, formato de rosto, material e quanto custa o óculos de grau.',
    ld: [{ '@context': 'https://schema.org', ...ldMigalhas([['Início', '/'], ['Guias', '/guia']]) },
      { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: Object.keys(C.guias).map((k, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/guia/${k}`, name: C.guias[k].t })) }],
  };
}
function paginaGuia(cat, chave) {
  const g = C.guias[chave];
  if (!g) return null;
  const caminho = `/guia/${chave}`;
  return {
    status: 200, titulo: `${g.t} | Só Armação`, descricao: g.d, caminho, ogType: 'article',
    corpo: C.guiaHtml(chave, g, fmt(precoMinimo(cat))),
    ld: [{
      '@context': 'https://schema.org', '@type': 'Article', headline: g.t, description: g.d, inLanguage: 'pt-BR',
      mainEntityOfPage: SITE + caminho, image: `${SITE}/og.jpg`, datePublished: GUIAS_DATA, dateModified: GUIAS_DATA,
      author: { '@type': 'Organization', name: 'Só Armação', url: SITE + '/' }, publisher: { '@type': 'Organization', name: 'Só Armação', logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` } },
    }, { '@context': 'https://schema.org', ...ldMigalhas([['Início', '/'], ['Guias', '/guia'], [g.t, caminho]]) }],
  };
}
const GUIAS_DATA = '2026-11-27';
const naoAchou = (caminho, voltar) => ({
  status: 404, titulo: 'Página não encontrada — Só Armação', descricao: 'Essa página não existe na Só Armação.', caminho, noindex: true,
  corpo: `<div class="container institucional"><h1 class="display">Essa página não existe.</h1><p><a href="${voltar}" data-link>Voltar →</a></p></div>`,
});

// /llms.txt: resumo da loja em Markdown pra assistentes de IA (llmstxt.org).
function llmsTxt(cat) {
  const l2 = cat.regras?.leve2_pct ?? 40;
  const produtos = (cat.produtos || []).filter((p) => p.estoque_total > 0);
  const linha = (p) => {
    const v = variacoesOrdenadas(p).find(vende) || {};
    const med = p.medidas || {};
    const medidas = med.lente ? `, lente ${med.lente} mm, ponte ${med.ponte} mm, haste ${med.haste} mm` : '';
    return `- [${p.nome}](${SITE}${urlProduto(p)}): ${[p.formato, TIPOS[p.tipo], p.material, p.genero].filter(Boolean).join(', ')}${medidas}; ${fmt(v.preco || p.preco)} no Pix`;
  };
  return [
    '# Só Armação',
    '',
    `> Loja 100% online de armações para óculos de grau (vendidas sem lentes de grau) e óculos de sol, com sede em São Bernardo do Campo/SP e entrega para todo o Brasil. Preços a partir de ${fmt(precoMinimo(cat))}, nota fiscal em todo pedido, Pix aprovado na hora ou cartão em até 6x, e troca grátis em até 7 dias úteis.`,
    '',
    `- As armações de grau chegam sem lentes: o cliente leva à ótica da preferência dele, com a receita, para colocar as lentes. A loja não faz exame de vista nem vende lentes de grau.`,
    `- Levando 2 armações no mesmo pedido, a 2ª (a de menor valor) sai com ${l2}% de desconto.`,
    '- Entrega em até 3 dias úteis na Grande São Paulo e até 5 dias úteis no resto do Brasil, contados da confirmação do pagamento.',
    '- Cada página de modelo traz as medidas (largura da lente, ponte, haste, largura frontal), o peso, o material e as cores.',
    `- Contato: ${C.email}. Empresa: So Armacao Comercio de Armacoes Ltda, Avenida Armando Italo Setti, 520, sala 81, São Bernardo do Campo/SP.`,
    '',
    '## Catálogo',
    '',
    `- [Todos os modelos](${SITE}/modelos)`,
    `- [Óculos de grau](${SITE}/modelos?tipo=grau)`,
    `- [Óculos de sol](${SITE}/modelos?tipo=sol)`,
    '',
    '## Guias',
    '',
    ...Object.entries(C.guias).map(([k, g]) => `- [${g.t}](${SITE}/guia/${k}): ${g.d}`),
    '',
    '## Armações por categoria',
    '',
    ...Object.entries(C.categorias).map(([k, c]) => `- [${c.t}](${SITE}/armacoes/${k}): ${c.d}`),
    '',
    '## Como comprar e políticas',
    '',
    ...Object.entries(C.paginas).filter(([k]) => k !== 'privacidade').map(([k, pg]) => `- [${pg.t}](${SITE}/${k}): ${pg.d}`),
    '',
    `## Modelos disponíveis (${produtos.length})`,
    '',
    ...produtos.map(linha),
    '',
    '## Opcional',
    '',
    `- [Política de privacidade](${SITE}/privacidade)`,
    `- [Sitemap](${SITE}/sitemap.xml)`,
    '',
  ].join('\n');
}

// --- montagem do HTML ------------------------------------------------------
const attr = (s) => h(s).replace(/\$/g, '$$$$');
function montar(pg) {
  const url = SITE + pg.caminho;
  let html = base()
    .replace(/<title>[^<]*<\/title>/, `<title>${attr(pg.titulo)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${attr(pg.descricao)}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${attr(url)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${attr(pg.titulo)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${attr(pg.descricao)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${attr(url)}`);
  if (pg.ogType) html = html.replace(/(<meta property="og:type" content=")[^"]*/, `$1${pg.ogType}`);
  if (pg.imagem) {
    html = html.replace(/(<meta property="og:image" content=")[^"]*/, `$1${attr(pg.imagem)}`)
      .replace(/\s*<meta property="og:image:width"[^>]*>\s*<meta property="og:image:height"[^>]*>/, '');
  }
  let extra = '';
  if (pg.noindex) extra += '\n  <meta name="robots" content="noindex">';
  if (pg.ld?.length) {
    const json = JSON.stringify(pg.ld.length === 1 ? pg.ld[0] : pg.ld).replace(/</g, '\\u003c');
    extra += `\n  <script type="application/ld+json" id="ld-servidor" data-caminho="${attr(pg.caminho)}">${json.replace(/\$/g, '$$$$')}</script>`;
  }
  if (extra) html = html.replace('</head>', `${extra}\n</head>`);
  return html.replace(/<main id="app"[^>]*>[\s\S]*?<\/main>/, `<main id="app" aria-live="polite" data-ssr>${pg.corpo.replace(/\$/g, '$$$$')}</main>`);
}

function resposta(corpo, status, tipo = 'text/html; charset=utf-8') {
  return new Response(corpo, {
    status,
    headers: {
      'Content-Type': tipo,
      // navegador sempre confere; a CDN da Vercel guarda 5 min e serve a versão velha enquanto renova
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}

const ROBOS = /GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|Google-Extended|Googlebot|bingbot|Applebot|Bytespider|CCBot|meta-externalagent|DuckAssistBot|Amazonbot/i;

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const r = q.get('r') || 'home';
  const robo = (request.headers.get('user-agent') || '').match(ROBOS);
  if (robo) console.log(`[robo] ${robo[0]} ${r} ${q.get('codigo') || q.get('slug') || q.get('pagina') || ''}`.trim());
  try {
    if (r === 'institucional') {
      const chave = q.get('pagina');
      if (!C.paginas[chave]) return resposta(base(), 200);
      return resposta(montar(paginaInstitucional(chave)), 200);
    }
    if (r === 'ajuda') {
      let cat = null;
      try { cat = await catalogo(); } catch { /* a ajuda não depende do catálogo */ }
      return resposta(montar(paginaAjuda(cat)), 200);
    }
    const cat = await catalogo();
    if (r === 'llms') return resposta(llmsTxt(cat), 200, 'text/plain; charset=utf-8');
    const chave = String(q.get('slug') || '').replace(/\/+$/, '');
    const pg = r === 'categoria' ? (paginaCategoria(cat, chave) || naoAchou(`/armacoes/${chave}`, '/modelos'))
      : r === 'guias' ? paginaGuias()
      : r === 'guia' ? (paginaGuia(cat, chave) || naoAchou(`/guia/${chave}`, '/guia'))
      : r === 'produto' ? paginaProduto(cat, q.get('codigo'), q.get('cor'))
      : r === 'modelos' ? paginaModelos(cat, ['sol', 'grau'].includes(q.get('tipo')) ? q.get('tipo') : null)
      : paginaHome(cat);
    return resposta(montar(pg), pg.status);
  } catch (e) {
    console.error('[pagina] erro, devolvendo a SPA pura:', r, e.message);
    if (r === 'llms') return new Response('Indisponível no momento.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' } });
    return new Response(base(), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}
