/* Anti-robô (Vercel BotID) no checkout. O cliente roda um desafio invisível e
 * anexa um token às chamadas POST /api/checkout; a função api/checkout.js da
 * loja confere esse token antes de repassar o pedido pro backend. */
import { initBotId } from '/vendor/botid-client-core.js';

// O pacote espera um empacotador trocando process.env.NODE_ENV; aqui não tem.
globalThis.process = globalThis.process || { env: { NODE_ENV: 'production' } };
if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  initBotId({ protect: [{ path: '/api/checkout', method: 'POST' }] });
}
