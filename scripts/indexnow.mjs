/**
 * Avisa o Bing (e quem participa do IndexNow: Yandex, Seznam, Naver) que páginas
 * do site mudaram. O Bing alimenta o Copilot e a busca do ChatGPT, então isso
 * acelera a loja aparecer nas IAs depois de cada publicação.
 *
 * Uso: node scripts/indexnow.mjs            → manda todas as URLs do sitemap
 *      node scripts/indexnow.mjs /guia /p/x → manda só esses caminhos
 *
 * A chave é pública por desenho: o arquivo <chave>.txt na raiz do site prova
 * que o domínio é nosso. Não é segredo.
 */
const SITE = 'https://soarmacao.com.br';
const CHAVE = '70080defbe342fa14498fcefd19a3a45';

let urls = process.argv.slice(2).map((c) => SITE + (c.startsWith('/') ? c : '/' + c));
if (!urls.length) {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text();
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((u) => u.startsWith(SITE));
}
const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'soarmacao.com.br', key: CHAVE, keyLocation: `${SITE}/${CHAVE}.txt`, urlList: urls }),
});
console.log(`IndexNow: ${urls.length} URLs → HTTP ${r.status} ${r.status === 200 || r.status === 202 ? '(aceito)' : await r.text()}`);
