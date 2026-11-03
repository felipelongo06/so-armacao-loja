/**
 * POST /api/checkout (na loja, mesmo endereço da página)
 *
 * Porteiro anti-robô do checkout: confere o Vercel BotID e repassa o pedido
 * pro backend (api.soarmacao.com.br/api/checkout) com o segredo
 * LOJA_PROXY_SECRET e o IP real do cliente. O BotID só funciona quando página
 * e rota protegida estão no mesmo endereço — por isso esta rota existe aqui e
 * não no backend. Todo o resto (preço, CPF, Asaas) continua no backend.
 *
 * BOTID_MODO=bloquear recusa quem o BotID classificar como robô. Sem isso,
 * só registra (modo observação), pra conferir que cliente real passa antes de
 * ligar o bloqueio. O veredito vai no header x-botid da resposta.
 */
import { checkBotId } from 'botid/server';

const BACKEND = process.env.CHECKOUT_BACKEND_URL || 'https://api.soarmacao.com.br/api/checkout';

function json(corpo, status, extra = {}) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

export async function POST(request) {
  let veredito = 'erro';
  try {
    const v = await checkBotId();
    veredito = v.isBot ? 'robo' : (v.isVerifiedBot ? 'robo-verificado' : 'humano');
  } catch (e) {
    // Falha do serviço (OIDC desligado, Vercel fora): não trava venda por isso.
    console.error('[botid] falha ao verificar, seguindo sem:', e.message);
  }
  // Bloqueio SUSPENSO (01/11/2026): com BOTID_MODO=bloquear, um navegador real foi
  // classificado como robô. Até entender, só registra — nenhum cliente é barrado.
  const bloquear = false;
  console.log('[botid]', JSON.stringify({ veredito, modo: process.env.BOTID_MODO || 'observar', ua: (request.headers.get('user-agent') || '').slice(0, 120) }));
  if (bloquear && veredito === 'robo') {
    return json({ erro: 'Não conseguimos confirmar que é você. Recarregue a página e tente de novo.' }, 403, { 'x-botid': veredito });
  }

  const corpo = await request.text();
  if (corpo.length > 20_000) return json({ erro: 'Pedido grande demais.' }, 413, { 'x-botid': veredito });

  const ip = String(request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || '';
  try {
    const r = await fetch(BACKEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-loja-proxy': process.env.LOJA_PROXY_SECRET || '',
        'x-cliente-ip': ip,
        'x-botid-veredito': veredito,
        // Cliente logado: o backend confere o token no Supabase (conta e cartão salvo).
        ...(/^Bearer [\w.-]{20,4096}$/.test(request.headers.get('authorization') || '') ? { authorization: request.headers.get('authorization') } : {}),
        'user-agent': request.headers.get('user-agent') || '',
      },
      body: corpo,
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'x-botid': veredito },
    });
  } catch (e) {
    console.error('[checkout] backend inacessível:', e.message);
    return json({ erro: 'Não foi possível iniciar o pagamento agora. Tente de novo em instantes.' }, 502, { 'x-botid': veredito });
  }
}
