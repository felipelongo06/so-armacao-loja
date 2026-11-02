/**
 * GET /sitemap.xml (rewrite pra /api/sitemap no vercel.json)
 *
 * Lista oficial de páginas pro Google, montada do catálogo em tempo real: home,
 * modelos, páginas institucionais e cada produto com as fotos (image sitemap).
 * Ajuda o Google a indexar a loja primeiro e a associar textos e fotos a este
 * domínio — o que conta quando alguém copia o conteúdo pra outro site.
 */
const SITE = 'https://soarmacao.com.br';
const CATALOGO = process.env.CATALOGO_URL || 'https://api.soarmacao.com.br/api/catalogo';
const FIXAS = ['/', '/modelos', '/ajuda', '/quem-somos', '/como-comprar', '/entrega', '/pagamento', '/trocas-e-devolucoes', '/privacidade', '/termos', '/contato'];

const xml = (s) => String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const data = (s) => (s ? String(s).slice(0, 10) : null);

export async function GET() {
  let produtos = [];
  try {
    const r = await fetch(CATALOGO);
    if (!r.ok) throw new Error(`catalogo ${r.status}`);
    produtos = (await r.json()).produtos || [];
  } catch (e) {
    console.error('[sitemap] catálogo indisponível, só páginas fixas:', e.message);
  }

  const urls = FIXAS.map((p) => `<url><loc>${SITE}${p}</loc></url>`);
  for (const p of produtos) {
    const caminho = p.url || `/p/${encodeURIComponent(p.codigo)}/`;
    const fotos = [...new Set((p.variacoes || []).flatMap((v) => [v.imagem, ...(v.imagens || [])]).filter(Boolean))].slice(0, 10);
    urls.push(`<url><loc>${xml(SITE + caminho)}</loc>${data(p.atualizado_em) ? `<lastmod>${data(p.atualizado_em)}</lastmod>` : ''}` +
      fotos.map((f) => `<image:image><image:loc>${xml(f)}</image:loc><image:title>${xml(p.nome)}</image:title></image:image>`).join('') +
      '</url>');
  }

  const corpo = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
    urls.join('\n') + '\n</urlset>\n';
  return new Response(corpo, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // 1 h na borda; se o catálogo cair, segue servindo o anterior por 1 dia
      'Cache-Control': produtos.length ? 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' : 'no-store',
    },
  });
}
