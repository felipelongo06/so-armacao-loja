/* Só Armação — textos compartilhados
 * Usado pela loja no navegador (app.js lê window.SA_CONTEUDO) e pelo servidor
 * (api/pagina.js monta o HTML que os robôs de busca e de IA leem sem rodar JavaScript).
 * Mudou um texto aqui, muda nos dois lugares.
 */
(function (raiz) {
  "use strict";
  var EMAIL = "contato@soarmacao.com.br";
  var PAGINAS = {
    'quem-somos': { t: 'Quem somos', d: 'A Só Armação é uma loja 100% online de armações de óculos de grau, de São Bernardo do Campo/SP.', b: [
      ['', 'A Só Armação nasceu de uma conta que não fechava: a armação que custa pouco pra fabricar chega na ótica custando dez vezes mais. A gente tirou o que encarece — loja física, atravessador, marca de grife — e deixou o que importa: armação de qualidade, preço justo e entrega rápida.'],
      ['', 'Somos 100% online. Vendemos só a armação — você coloca as lentes do seu grau na ótica ou no laboratório da sua confiança. Preço baixo todo dia, sem promoção de mentira. Nota fiscal em todo pedido e troca grátis em até 7 dias úteis, com troca e devolução seguindo o Código de Defesa do Consumidor.'],
      ['', 'Ninguém faz melhor por menos.']] },
    'como-comprar': { t: 'Como comprar', d: 'Passo a passo pra comprar sua armação na Só Armação.', b: [
      ['Antes de tudo: vendemos só a armação', 'Nenhum dos nossos produtos vem com lentes de grau. Você compra a armação aqui e uma ótica da sua escolha coloca as lentes do seu grau. Os óculos de sol vêm com lentes solares, sem grau.'],
      ['1 — Escolha a armação', 'Navegue pelos modelos e use os filtros de formato e cor. Todas as medidas (lente, ponte, haste e largura frontal) estão na página de cada modelo — compare com um óculos que já serve bem em você.'],
      ['2 — Adicione ao carrinho', 'Levando 2 armações no mesmo pedido, a 2ª (a de menor valor) sai com 40% de desconto — é o único desconto da loja. O frete é um só pro pedido inteiro e é calculado pelo seu CEP.'],
      ['3 — Informe seus dados', 'Nome, CPF, e-mail, WhatsApp, CEP e número. O endereço é preenchido sozinho a partir do CEP.'],
      ['4 — Pague no Pix ou no cartão', 'No Pix, escaneie o QR Code ou copie o código: a confirmação é automática, em segundos. No cartão de crédito, o pagamento abre numa página segura da operadora e você pode parcelar.'],
      ['5 — Receba em casa', 'Até 3 dias úteis na Grande São Paulo e até 5 dias úteis pro resto do Brasil, contados da confirmação do pagamento. O rastreio chega no seu e-mail.'],
      ['6 — Leve à sua ótica', 'A armação chega sem lentes de grau. Leve à ótica da sua preferência com a sua receita (ou faça o exame de vista) e peça para colocarem as lentes do seu grau. Se quiser trocar ou devolver no prazo de 7 dias úteis, faça isso antes de colocar as lentes.']] },
    entrega: { t: 'Entrega e frete', d: 'Prazos, valor do frete e rastreio dos pedidos da Só Armação.', b: [
      ['Prazo', 'Até 3 dias úteis na Grande São Paulo e até 5 dias úteis pra todo o Brasil, contados a partir da confirmação do pagamento.'],
      ['Entrega Full', 'Pra quem mora a até 20 km de São Miguel Paulista, aparece no carrinho a Entrega Full: a gente leva até a sua casa por R$ 13,90. Pagou até as 19h, recebe no mesmo dia; depois das 19h, recebe no dia seguinte, inclusive fim de semana e feriado.'],
      ['Valor', 'Calculado pelo seu CEP, direto no carrinho, antes de você pagar. Levando 2 ou mais armações, o frete é um só pro pedido inteiro.'],
      ['Rastreio', 'O código de rastreio chega no seu e-mail assim que o pedido é postado.'],
      ['Endereço errado?', 'Avise a gente por e-mail (' + EMAIL + ') antes da postagem que a gente corrige sem custo.']] },
    pagamento: { t: 'Pagamento', d: 'Pix com confirmação automática ou cartão de crédito parcelado.', b: [
      ['Pix', 'O pedido é liberado na hora e o preço é o da tela. Você recebe um QR Code e um código copia-e-cola válidos por 15 minutos; pagou, o pedido confirma sozinho em segundos.'],
      ['Cartão de crédito', 'O pagamento abre numa página segura da operadora e volta pro site com a resposta. Dá pra parcelar em até 6x; o valor das parcelas é confirmado na página da operadora. O pedido é liberado depois da aprovação.'],
      ['É seguro?', 'O Pix é do Banco Central e o código gerado vale só pro seu pedido, com o valor exato. Os dados do cartão são digitados na página da operadora — nunca passam pelo nosso site.'],
      ['Reembolso', 'Cancelamento e devolução são reembolsados na mesma forma de pagamento do pedido.']] },
    'trocas-e-devolucoes': { t: 'Trocas e devoluções', d: 'Troca grátis em até 7 dias úteis (direito de arrependimento) e, depois, troca só por defeito de fabricação, conforme o Código de Defesa do Consumidor.', b: [
      ['Troca grátis em até 7 dias úteis', 'Compra online tem direito de arrependimento (Código de Defesa do Consumidor, art. 49). Não serviu, não gostou ou mudou de ideia? Em até 7 dias úteis depois de receber, você pode trocar por outro modelo ou devolver e receber o dinheiro de volta, com reembolso integral, incluindo o frete pago. A armação precisa estar sem uso, sem lentes de grau instaladas e com a embalagem e os acessórios que vieram com ela.'],
      ['Depois de 7 dias úteis: só defeito de fabricação', 'Passado o prazo de arrependimento, a troca é só por defeito de fabricação — solda, pintura, dobradiça — dentro da garantia legal do Código de Defesa do Consumidor: 90 dias a partir do recebimento (art. 26). Não oferecemos garantia além do que a lei determina. Queda, uso indevido ou lentes instaladas de forma errada não são defeito de fabricação.'],
      ['Como pedir', 'Mande um e-mail pra ' + EMAIL + ' com o número do pedido, o motivo e, se for defeito, uma foto. Respondemos em até 1 dia útil com a etiqueta de postagem — você não paga o frete da devolução.'],
      ['Reembolso', 'Feito na mesma forma de pagamento assim que a armação chegar e for conferida: no Pix, em até 2 dias úteis; no cartão, o estorno aparece na fatura conforme o prazo da operadora.']] },
    privacidade: { t: 'Política de privacidade', d: 'Como a Só Armação coleta, usa e protege seus dados (LGPD).', b: [
      ['O que coletamos', 'Nome, CPF, e-mail, WhatsApp e endereço — o necessário pra processar o pedido, emitir a nota fiscal e entregar. Também usamos cookies e ferramentas de medição (Google Analytics, Google Ads, Meta e Microsoft Clarity) pra entender como a loja é usada e mostrar nossos anúncios pra quem já visitou o site. O Clarity registra cliques, rolagem e movimentos na página pra gente melhorar o site; o que você digita nos campos fica mascarado e não é gravado.'],
      ['Como usamos', 'Pra entregar seu pedido, emitir nota, calcular frete, confirmar o pagamento, conferir se é a sua primeira compra (pro desconto de 1ª compra, pelo CPF, e-mail e WhatsApp dos pedidos anteriores) e, se você autorizar, avisar sobre novidades. O CPF é guardado só de forma protegida (hash) no nosso banco.'],
      ['Conta e login', 'Criar conta é opcional. Se você criar, guardamos seu nome, e-mail e senha (protegida, sem que ninguém da loja consiga ler) ou, no login com Google, o nome e o e-mail que o Google informa. Na conta ficam seus pedidos, favoritos, os dados de entrega e contato que você preenche no checkout (pra próxima compra vir pronta; o CPF fica guardado criptografado) e, se você pedir, o cartão salvo: o número do cartão fica com a instituição de pagamento (Asaas) e a gente só vê a bandeira e os 4 últimos números. Quando você está logado, as ferramentas de medição recebem um código interno da sua conta (nunca seu e-mail ou CPF), pra entendermos como o site é usado em diferentes aparelhos. Pra excluir a conta, escreva pra ' + EMAIL + '.'],
      ['Com quem compartilhamos', 'Só com quem precisa pra operação: a instituição de pagamento (Pix e cartão), a transportadora e o sistema emissor de nota fiscal. Não vendemos seus dados.'],
      ['Seus direitos (LGPD)', 'Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail ' + EMAIL + '.']] },
    termos: { t: 'Termos de uso', d: 'Condições de compra na Só Armação.', b: [
      ['', 'Ao comprar na Só Armação você concorda com estes termos. Eles existem pra deixar tudo claro, sem letra miúda.'],
      ['Preços e pagamento', 'O preço exibido é o preço final à vista no Pix. No cartão de crédito dá pra parcelar. O pedido é confirmado só depois do pagamento aprovado. Preço, desconto e frete são calculados no nosso servidor no momento do pagamento.'],
      ['Estoque', 'Quantidade limitada por modelo e cor. Se um item acabar entre o carrinho e o pagamento, o pedido não é concluído e nada é cobrado — e se houver cobrança, devolvemos 100% do valor.'],
      ['Produto', 'Vendemos a armação sem lentes de grau. As lentes são colocadas na ótica ou no laboratório da sua escolha.'],
      ['Cancelamento', 'Pedido pago pode ser cancelado até a postagem, com devolução integral na mesma forma de pagamento.'],
      ['Trocas e devoluções', 'Troca grátis em até 7 dias úteis depois do recebimento, pelo direito de arrependimento. Depois disso, troca só por defeito de fabricação, conforme o Código de Defesa do Consumidor. Os detalhes estão na página Trocas e devoluções.'],
      ['Empresa', 'So Armacao Comercio de Armacoes Ltda — Avenida Armando Italo Setti, 520, sala 81, Baeta Neves, São Bernardo do Campo/SP, CEP 09760-280.']] },
    contato: { t: 'Fale conosco', d: 'Atendimento da Só Armação por e-mail.', b: [
      ['E-mail', EMAIL + ' — respondemos em até 1 dia útil. Coloque o número do pedido no assunto que fica mais rápido.'],
      ['Endereço', 'Avenida Armando Italo Setti, 520, sala 81 — Baeta Neves, São Bernardo do Campo/SP, CEP 09760-280. Atendimento só online: não temos loja física, e é isso que mantém o preço baixo.'],
      ['Desconfiou de golpe?', 'A Só Armação nunca pede senha, código de segurança ou Pix fora do checkout do site soarmacao.com.br.']] }
  };
  // Perguntas frequentes. l2 = % de desconto da 2ª armação (vem das regras do catálogo).
  function faq(l2) {
    return [
      ['A armação vem com lentes de grau?', 'Não. Nenhum dos nossos produtos vem com lentes de grau: vendemos só a armação (os óculos de sol vêm com lentes solares, sem grau). Quando a armação chegar, leve à ótica da sua preferência com a sua receita, ou faça o exame de vista, e peça para colocarem as lentes do seu grau.'],
      ['Vocês fazem exame de vista ou montam os óculos?', 'Não. A gente não faz exame de vista, não vende lentes de grau e não monta óculos. Quem coloca as lentes é a ótica que você escolher. Dica: confira as medidas da armação na página do modelo e compare com um óculos que já serve bem em você.'],
      ['Como funciona a troca grátis?', 'Compra online tem direito de arrependimento: em até 7 dias úteis depois de receber, se não serviu, não gostou ou mudou de ideia, a gente troca por outro modelo ou devolve o dinheiro — sem custo, você não paga o frete da devolução. Depois desse prazo, a troca é só por defeito de fabricação.'],
      ['Quanto tempo demora pra chegar?', 'Até 3 dias úteis na Grande São Paulo e até 5 dias úteis pro resto do Brasil, contados da confirmação do pagamento. O código de rastreio chega no seu e-mail.'],
      ['Como funciona o desconto da 2ª armação?', 'Levando 2 armações no mesmo pedido, a 2ª (a de menor valor) sai com ' + l2 + '% de desconto. É o único desconto da loja e aparece sozinho no carrinho. A cada 2 armações, uma sai com ' + l2 + '% off.'],
      ['Tem nota fiscal?', 'Sempre. Todo pedido sai com NF-e no seu nome, enviada por e-mail.'],
      ['E se a armação vier com defeito?', 'Passados os 7 dias úteis de arrependimento, a troca é só por defeito de fabricação, como manda o Código de Defesa do Consumidor: até 90 dias depois do recebimento. É só mandar um e-mail com o número do pedido e uma foto. Não oferecemos garantia além do que a lei determina.'],
      ['Quais as formas de pagamento?', 'Pix, com confirmação automática em segundos, ou cartão de crédito, parcelado. O cartão é processado numa página segura da operadora — seus dados não passam pelo nosso site.']
    ];
  }

  // ---------------------------------------------------------------------------
  // Fase 3 (GEO): ficha do modelo, páginas de categoria e guias.
  // Tudo aqui vira HTML igual no navegador (app.js) e no servidor (api/pagina.js).
  // ---------------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // Texto com [link](/caminho) interno: escapa e transforma só links do próprio site.
  function txt(s) {
    return esc(s).replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, function (m, t, u) { return '<a href="' + u + '" data-link>' + t + '</a>'; });
  }
  function semLinks(s) { return String(s || '').replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '$1'); }

  // Tamanho pela largura frontal (a frente inteira da armação), na régua da loja.
  var TAMANHOS = [
    { max: 120, sigla: 'P', nome: 'pequena', faixa: 'até 120 mm' },
    { max: 128, sigla: 'M', nome: 'média', faixa: '121 a 128 mm' },
    { max: 1e9, sigla: 'G', nome: 'grande', faixa: '129 mm ou mais' }
  ];
  function tamanhoDe(med) {
    med = med || {};
    var frontal = med.frontal || (med.lente && med.ponte ? 2 * med.lente + med.ponte : null);
    if (!frontal) return null;
    for (var i = 0; i < TAMANHOS.length; i++) if (frontal <= TAMANHOS[i].max) return { sigla: TAMANHOS[i].sigla, nome: TAMANHOS[i].nome, frontal: frontal, estimado: !med.frontal };
    return null;
  }
  // Formato da armação → rostos com que costuma combinar (regra do contraste).
  var ROSTOS = {
    Gatinho: ['redondo', 'oval', 'quadrado'],
    Redondo: ['quadrado', 'retangular', 'oval'],
    Quadrado: ['redondo', 'oval', 'coração'],
    Retangular: ['redondo', 'oval'],
    Hexagonal: ['redondo', 'oval', 'coração'],
    Oval: ['quadrado', 'coração', 'oval']
  };
  function lista(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]; }

  // Ficha rápida + perguntas do modelo. p = produto do catálogo, v = cor escolhida.
  function fichaModelo(p, v) {
    var med = p.medidas || {};
    var tam = tamanhoDe(med);
    var rostos = ROSTOS[p.formato] || [];
    var sol = (v && v.tipo) === 'sol';
    var nome = p.nome;
    var art = /^arma/i.test(nome) ? 'a' : 'o'; // os nomes do catálogo começam com "Óculos"
    var de = art === 'a' ? 'da' : 'do', indicado = art === 'a' ? 'indicada' : 'indicado';
    var fatos = [];
    if (tam) fatos.push(['Tamanho', tam.sigla + ' (' + tam.nome + '), ' + tam.frontal + ' mm de frente' + (tam.estimado ? ' (estimado)' : '')]);
    if (rostos.length) fatos.push(['Combina com rosto', lista(rostos)]);
    fatos.push(['Vem com', sol ? 'Lentes de sol, sem grau' : 'Só a armação, sem lentes de grau']);
    var medidasTxt = med.lente ? 'lente de ' + med.lente + ' mm, ponte de ' + med.ponte + ' mm e haste de ' + med.haste + ' mm' + (med.frontal ? ', com ' + med.frontal + ' mm de largura frontal' : '') : '';
    var faq = [
      [nome + ' vem com lente de grau?', sol
        ? 'Não. É um óculos de sol: vem com lentes solares, sem grau. Se quiser usar com grau, consulte uma ótica sobre colocar lentes de grau solares nessa armação.'
        : 'Não. É vendida só a armação, sem lentes de grau. Quando chegar, leve à ótica da sua preferência com a sua receita e peça para colocarem as lentes do seu grau.'],
      ['Qual o tamanho ' + de + ' ' + nome + '?', medidasTxt
        ? 'Tem ' + medidasTxt + '. Na nossa régua é tamanho ' + (tam ? tam.sigla + ' (' + tam.nome + ')' : '') + '. Para conferir, compare com os números gravados na haste do óculos que você já usa: diferença de até uns 3 mm costuma não fazer diferença no rosto.'
        : 'As medidas desse modelo ainda não estão cadastradas. Escreva para ' + EMAIL + ' que a gente mede e responde.'],
    ];
    if (rostos.length) faq.push(['Para qual formato de rosto ' + art + ' ' + nome + ' é ' + indicado + '?', 'Por ser ' + String(p.formato).toLowerCase() + ', costuma combinar com rosto ' + lista(rostos) + '. A regra geral é o contraste entre o formato da armação e o do rosto. [Veja o guia de armação por formato de rosto](/guia/armacao-para-cada-tipo-de-rosto).']);
    faq.push(['Posso trocar se não servir?', 'Sim. Você tem até 7 dias úteis depois de receber para trocar por outro modelo ou devolver o dinheiro, sem custo, desde que a armação esteja sem uso e sem lentes instaladas.']);
    return { fatos: fatos, faq: faq };
  }
  function fichaHtml(f) {
    return '<div><h2 class="bloco-titulo">Ficha rápida</h2><table class="medidas"><tbody>' +
      f.fatos.map(function (x) { return '<tr><th>' + esc(x[0]) + '</th><td>' + esc(x[1]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function faqModeloHtml(f) {
    return '<section class="secao faq faq-modelo"><h2 class="display">Perguntas sobre este modelo</h2>' +
      f.faq.map(function (x) { return '<details><summary>' + esc(x[0]) + '</summary><p>' + txt(x[1]) + '</p></details>'; }).join('') + '</section>';
  }

  // Páginas de categoria (/armacoes/<slug>): só armações de grau (ou grau e sol).
  var CATEGORIAS = {
    'armacao-gatinho': { t: 'Armação de óculos gatinho', filtro: { formato: 'Gatinho' },
      d: 'Armações de óculos de grau formato gatinho, com nota fiscal e troca grátis em até 7 dias úteis.',
      texto: ['A armação gatinho tem os cantos externos levantados, puxando o desenho para cima. O efeito é levantar o olhar e dar um ar retrô e marcante, por isso é o formato mais procurado entre as armações femininas.',
        'Costuma combinar com rosto redondo, oval e quadrado: as linhas inclinadas quebram as curvas do rosto redondo e suavizam o maxilar do rosto quadrado. Em rosto pequeno, prefira as de tamanho P ou M; em rosto mais largo, as de tamanho G.',
        'Todas vêm sem lentes de grau: você compra a armação aqui e coloca as lentes na ótica da sua preferência. [Veja como funciona](/guia/comprar-armacao-online-e-colocar-lente-na-otica).'] },
    'armacao-redonda': { t: 'Armação de óculos redonda', filtro: { formato: 'Redondo' },
      d: 'Armações de óculos de grau redondas, femininas, masculinas e unissex, com troca grátis em até 7 dias úteis.',
      texto: ['A armação redonda tem as lentes em círculo ou quase círculo. É um clássico de inspiração vintage, que funciona tanto em visual discreto quanto em visual mais artístico, e aparece em modelos femininos, masculinos e unissex.',
        'Costuma combinar com rosto quadrado, retangular e oval: as curvas suavizam ângulos marcados e diminuem a impressão de rosto comprido. Em rosto redondo, prefira formatos com linhas retas, como a [quadrada](/armacoes/armacao-quadrada) ou a [retangular](/armacoes/armacao-retangular).',
        'As medidas de cada modelo estão na página dele. [Aprenda a ler as medidas](/guia/numeros-na-haste-do-oculos).'] },
    'armacao-quadrada': { t: 'Armação de óculos quadrada', filtro: { formato: 'Quadrado' },
      d: 'Armações de óculos de grau quadradas, com nota fiscal, Pix na hora e troca grátis em até 7 dias úteis.',
      texto: ['A armação quadrada tem a altura da lente parecida com a largura e cantos mais retos. Ela dá presença ao rosto e um ar mais sério ou mais fashion, conforme a espessura do aro.',
        'Costuma combinar com rosto redondo, oval e coração: as linhas retas equilibram as curvas e dão mais definição. Em rosto quadrado, a [redonda](/armacoes/armacao-redonda) e a [gatinho](/armacoes/armacao-gatinho) costumam ficar mais harmônicas.',
        'A lente mais alta da armação quadrada também deixa mais área para a ótica trabalhar.'] },
    'armacao-retangular': { t: 'Armação de óculos retangular', filtro: { formato: 'Retangular' },
      d: 'Armações de óculos de grau retangulares, masculinas e femininas, com troca grátis em até 7 dias úteis.',
      texto: ['A armação retangular é mais larga do que alta, com linhas retas. É o formato mais tradicional para o dia a dia e para o trabalho, e o mais comum entre as armações masculinas.',
        'Costuma combinar com rosto redondo e oval: alonga visualmente o rosto redondo e mantém o equilíbrio do oval. Em rosto comprido ou retangular, prefira modelos de lente mais alta, como a [quadrada](/armacoes/armacao-quadrada) ou a [redonda](/armacoes/armacao-redonda).',
        'Confira a largura frontal na página de cada modelo e compare com o óculos que você já usa.'] },
    'armacao-feminina': { t: 'Armação de óculos feminina', filtro: { genero: ['Feminino', 'Unissex'] },
      d: 'Armações de óculos de grau femininas: gatinho, redonda, quadrada e mais, com troca grátis em até 7 dias úteis.',
      texto: ['As armações femininas da Só Armação vão do gatinho clássico às redondas e quadradas, em metal, acetato colorido e materiais ultraleves. Os modelos unissex também aparecem aqui.',
        'Para escolher, comece pelo formato do rosto ([veja o guia](/guia/armacao-para-cada-tipo-de-rosto)) e depois pelo tamanho: rosto mais fino pede armação P ou M, rosto mais largo pede G. Cada modelo mostra a largura frontal em milímetros.',
        'Levando 2 armações no mesmo pedido, a 2ª sai com desconto, o que ajuda a ter uma para o trabalho e outra para o fim de semana.'] },
    'armacao-masculina': { t: 'Armação de óculos masculina', filtro: { genero: ['Masculino', 'Unissex'] },
      d: 'Armações de óculos de grau masculinas, retangulares, quadradas e redondas, com troca grátis em até 7 dias úteis.',
      texto: ['As armações masculinas da Só Armação têm desenho mais reto e discreto, em metal e acetato, nos formatos retangular, quadrado e redondo. Os modelos unissex também aparecem aqui.',
        'Rosto redondo costuma ficar melhor com a retangular ou a quadrada; rosto quadrado, com a redonda. Para acertar o tamanho, compare a largura frontal do modelo com a do óculos que você já usa ([veja como medir](/guia/como-saber-o-tamanho-da-armacao)).',
        'Todas vêm sem lentes de grau, com nota fiscal, e você coloca as lentes na ótica da sua preferência.'] },
    'armacao-de-metal': { t: 'Armação de óculos de metal', filtro: { material: 'Metal' },
      d: 'Armações de óculos de grau de metal, finas e leves, com troca grátis em até 7 dias úteis.',
      texto: ['A armação de metal tem aro fino e visual discreto. Costuma ser leve e, na maioria dos modelos, tem plaquetas no nariz que a ótica consegue ajustar para o óculos ficar firme no rosto.',
        'É uma boa escolha para quem quer um óculos que apareça pouco ou para quem acha o acetato pesado. Quem tem alergia a algum metal deve observar o material indicado em cada modelo. [Compare metal, acetato e ultraleve](/guia/armacao-de-metal-acetato-ou-ultraleve).',
        'Os acabamentos vão do dourado ao prateado e ao preto, combinando com qualquer estilo.'] },
    'armacao-ate-100-reais': { t: 'Armação de óculos até R$ 100', filtro: { precoMax: 100 },
      d: 'Armações de óculos de grau até R$ 100 no Pix, com nota fiscal e troca grátis em até 7 dias úteis.',
      texto: ['Aqui estão as armações de grau que custam até R$ 100 no Pix. São os mesmos modelos do resto da loja, com nota fiscal, troca grátis em até 7 dias úteis e o mesmo padrão de acabamento.',
        'A Só Armação vende só a armação e a vende online, sem loja física e sem marca de grife no preço. Por isso consegue cobrar menos. A lente de grau você coloca na ótica que preferir e paga só por ela e pela montagem. [Veja quanto custa fazer óculos de grau](/guia/quanto-custa-fazer-oculos-de-grau).',
        'Levando 2, a 2ª armação ainda sai com desconto.'] }
  };
  function naCategoria(cat, p) {
    var f = cat.filtro;
    if (p.tipo === 'sol') return false;
    if (!(p.estoque_total > 0)) return false;
    if (f.formato && p.formato !== f.formato) return false;
    if (f.genero && f.genero.indexOf(p.genero) < 0) return false;
    if (f.material && p.material !== f.material) return false;
    if (f.precoMax && !(p.preco <= f.precoMax)) return false;
    return true;
  }
  function categoriaTopoHtml(cat, n, min, fmt) {
    return '<p class="cat-resumo"><strong>' + n + ' modelo' + (n === 1 ? '' : 's') + (min ? ', a partir de ' + esc(fmt(min)) + ' no Pix' : '') + '.</strong> Nota fiscal em todo pedido e troca grátis em até 7 dias úteis.</p>' +
      cat.texto.map(function (t) { return '<p>' + txt(t) + '</p>'; }).join('');
  }

  // Guias (/guia/<slug>). {preco_min} vira o menor preço atual da loja.
  var GUIAS = {
    'como-saber-o-tamanho-da-armacao': {
      t: 'Como saber o tamanho ideal da armação de óculos',
      d: 'Descubra o tamanho da sua armação pelas medidas do óculos que você já usa: largura da lente, ponte, haste e largura frontal.',
      resumo: 'O jeito mais seguro é copiar as medidas de um óculos que já fica bem em você: elas vêm gravadas na parte de dentro da haste, em milímetros. Compare principalmente a largura frontal e a largura da lente com as da armação nova; diferença de até uns 3 mm costuma não aparecer no rosto.',
      secoes: [
        { h: 'Onde estão as medidas do seu óculos', p: ['Abra o óculos e olhe a parte de dentro da haste. Você vai ver três números, como 52□18 140 ou 52-18-140: largura da lente, largura da ponte e comprimento da haste, todos em milímetros. [Entenda cada número](/guia/numeros-na-haste-do-oculos).'] },
        { h: 'Quais medidas comparar', lista: ['Largura frontal: a frente inteira da armação, de uma ponta à outra. É a medida que mais decide se a armação fica larga ou apertada no rosto.', 'Largura da lente: define o tamanho de cada lado. Com a ponte, dá uma boa estimativa da largura frontal (2 × lente + ponte).', 'Ponte: o espaço do nariz. Ponte apertada marca o nariz; ponte larga faz o óculos escorregar.', 'Haste: o comprimento até a orelha. A maioria fica entre 135 e 145 mm.'] },
        { h: 'Sem óculos para comparar', p: ['Fique de frente para o espelho com uma régua na horizontal, na altura dos olhos, e meça a distância entre as duas têmporas (o lado da cabeça, logo atrás do canto dos olhos). A largura frontal da armação deve ficar perto dessa medida, sem passar muito dela.'] },
        { h: 'Tamanhos na Só Armação', tabela: { cab: ['Tamanho', 'Largura frontal', 'Costuma servir em'], linhas: [['P', 'até 120 mm', 'rosto fino ou pequeno'], ['M', '121 a 128 mm', 'a maioria dos rostos adultos'], ['G', '129 mm ou mais', 'rosto largo']] },
          p: ['Cada página de modelo mostra o tamanho e todas as medidas. Se mesmo assim não servir, você troca grátis em até 7 dias úteis, antes de colocar as lentes.'] }
      ] },
    'numeros-na-haste-do-oculos': {
      t: 'O que significam os números na haste do óculos',
      d: 'Entenda os números gravados na haste do óculos, como 52□18 140: largura da lente, ponte e comprimento da haste.',
      resumo: 'Os três números gravados na haste, como 52□18 140, são as medidas da armação em milímetros: largura de cada lente, largura da ponte (o espaço do nariz) e comprimento da haste. Muitas vezes aparecem também o código do modelo e o código da cor.',
      secoes: [
        { h: 'Cada número, um por um', tabela: { cab: ['No exemplo', 'O que mede', 'Faixa comum em adultos'], linhas: [['52', 'Largura de cada lente, na horizontal', '46 a 58 mm'], ['18', 'Ponte: distância entre as duas lentes, onde fica o nariz', '14 a 22 mm'], ['140', 'Haste: comprimento da dobradiça até a ponta', '135 a 150 mm']] } },
        { h: 'O quadradinho entre os números', p: ['O símbolo □ indica que a lente foi medida pelo sistema de caixa (boxing): a largura é a de um retângulo que envolve a lente. Quando aparece um traço no lugar, a leitura é a mesma.'] },
        { h: 'E a largura frontal?', p: ['A largura frontal, a frente inteira da armação, normalmente não vem gravada. Dá para estimar somando 2 × lente + ponte: no exemplo, 2 × 52 + 18 = 122 mm. Na Só Armação, a largura frontal aparece na página de cada modelo. [Veja como escolher o tamanho](/guia/como-saber-o-tamanho-da-armacao).'] },
        { h: 'Os outros códigos', p: ['Letras e números antes das medidas costumam ser o código do modelo e da cor. Eles ajudam a achar o mesmo óculos de novo, mas não dizem nada sobre o tamanho.'] }
      ] },
    'armacao-para-cada-tipo-de-rosto': {
      t: 'Qual armação de óculos combina com cada tipo de rosto',
      d: 'Guia de armação de óculos por formato de rosto: redondo, oval, quadrado, retangular e coração.',
      resumo: 'A regra geral é o contraste: rosto arredondado fica bem com armação de linhas retas (quadrada e retangular), e rosto anguloso fica bem com formas curvas (redonda e gatinho). Rosto oval combina com quase todos os formatos.',
      secoes: [
        { h: 'Formato de rosto e armação', tabela: { cab: ['Rosto', 'Como reconhecer', 'Costuma combinar com'], linhas: [
          ['Redondo', 'Largura e altura parecidas, bochechas cheias, queixo arredondado', '[Quadrada](/armacoes/armacao-quadrada), [retangular](/armacoes/armacao-retangular) e [gatinho](/armacoes/armacao-gatinho)'],
          ['Oval', 'Mais comprido que largo, maxilar suave', 'Quase todos; [redonda](/armacoes/armacao-redonda) e [gatinho](/armacoes/armacao-gatinho) valorizam'],
          ['Quadrado', 'Testa e maxilar largos, queixo reto', '[Redonda](/armacoes/armacao-redonda) e [gatinho](/armacoes/armacao-gatinho)'],
          ['Retangular ou alongado', 'Bem mais comprido que largo, laterais retas', '[Redonda](/armacoes/armacao-redonda) e [quadrada](/armacoes/armacao-quadrada), de lente mais alta'],
          ['Coração', 'Testa larga e queixo fino', '[Redonda](/armacoes/armacao-redonda) e [quadrada](/armacoes/armacao-quadrada) de aro fino']] } },
        { h: 'Como descobrir o formato do seu rosto', p: ['Prenda o cabelo, fique de frente para o espelho e contorne o rosto com o dedo ou com batom no vidro. Depois compare: a parte mais larga é a testa, as maçãs ou o maxilar? O rosto é bem mais comprido que largo? As respostas levam à linha da tabela.'] },
        { h: 'O tamanho pesa tanto quanto o formato', p: ['Uma armação no formato certo e no tamanho errado não fica bem. A frente da armação deve acompanhar a largura do rosto, e as lentes não devem passar muito da linha das sobrancelhas. [Veja como acertar o tamanho](/guia/como-saber-o-tamanho-da-armacao).'] }
      ] },
    'comprar-armacao-online-e-colocar-lente-na-otica': {
      t: 'Comprar armação online e colocar a lente na ótica: como funciona',
      d: 'Passo a passo para comprar só a armação pela internet e colocar as lentes de grau na ótica da sua preferência.',
      resumo: 'Dá certo, sim: as óticas colocam lentes de grau em armação comprada em outro lugar, desde que ela esteja inteira e no tamanho certo. Você compra a armação online, leva à ótica com a receita e paga lá só as lentes e a montagem.',
      secoes: [
        { h: 'Passo a passo', ol: ['Escolha a armação pelo formato e pelo tamanho, comparando as medidas com o óculos que você já usa.', 'Receba em casa. Na Só Armação, até 3 dias úteis na Grande São Paulo e até 5 no resto do Brasil, com nota fiscal.', 'Confira se serviu. Se não, troque grátis em até 7 dias úteis, antes de colocar as lentes.', 'Leve à ótica com a sua receita (ou faça o exame de vista) e peça o orçamento das lentes para essa armação.', 'A ótica corta as lentes no formato da armação e monta o óculos.'] },
        { h: 'Por que sai mais barato', p: ['Na ótica, a armação costuma ser a parte do óculos com maior margem. Comprando a armação direto, online e sem marca de grife, você paga menos por ela e negocia na ótica só as lentes. [Veja o que pesa no preço](/guia/quanto-custa-fazer-oculos-de-grau).'] },
        { h: 'Cuidados antes de levar à ótica', lista: ['Pergunte se a ótica cobra a montagem à parte em armação trazida pelo cliente.', 'Para lente multifocal, a ótica precisa conferir se a lente da armação tem altura suficiente. Leve a armação antes de fechar o pedido das lentes.', 'Troca ou devolução da armação só antes de colocar as lentes: depois de cortadas, elas não servem em outra armação.'] }
      ] },
    'armacao-de-metal-acetato-ou-ultraleve': {
      t: 'Armação de metal, acetato ou ultraleve: qual escolher',
      d: 'Diferenças entre armação de óculos de metal, acetato e ultraleve: peso, ajuste, resistência e estilo.',
      resumo: 'Metal é fino, discreto e tem plaquetas ajustáveis no nariz; acetato é mais encorpado, tem mais cores e dura bem; ultraleve é flexível e quase não pesa. A escolha depende de quanto você quer que o óculos apareça e de quanto peso aguenta no nariz.',
      secoes: [
        { h: 'Comparação rápida', tabela: { cab: ['Material', 'Peso', 'Ajuste no rosto', 'Bom para'], linhas: [
          ['Metal', 'Leve', 'Plaquetas no nariz ajustáveis pela ótica', 'Visual discreto, rosto fino, quem não gosta de óculos aparente'],
          ['Acetato', 'Médio', 'Apoio fixo no nariz; a ótica ajusta as hastes com calor', 'Cores, transparências e visual marcante'],
          ['Ultraleve', 'Muito leve', 'Flexível, se adapta ao rosto', 'Uso o dia todo, quem sente peso no nariz, esporte']] } },
        { h: 'Metal', p: ['Aro fino e acabamentos como dourado, prateado e preto. As plaquetas de silicone deixam o óculos firme e confortável. Quem tem alergia a algum metal deve observar o material de cada modelo. [Ver armações de metal](/armacoes/armacao-de-metal).'] },
        { h: 'Acetato', p: ['O acetato é um plástico de origem vegetal, cortado de placas. Permite cores fortes, tartaruga e transparências, e é o material típico das armações gatinho e quadradas mais marcantes.'] },
        { h: 'Ultraleve', p: ['São polímeros flexíveis, que dobram sem quebrar e pesam pouco. Boa escolha para quem usa óculos o dia inteiro.'] }
      ] },
    'quanto-custa-fazer-oculos-de-grau': {
      t: 'Quanto custa fazer óculos de grau',
      d: 'Entenda o que forma o preço do óculos de grau (armação, lentes e montagem) e como pagar menos.',
      resumo: 'O preço do óculos de grau é a soma de três partes: armação, lentes e montagem. A armação é a parte que mais varia de lugar para lugar; comprando só a armação online (na Só Armação, a partir de {preco_min}) e levando à ótica, você paga lá apenas as lentes e a montagem.',
      secoes: [
        { h: 'As três partes do preço', tabela: { cab: ['Parte', 'O que faz o preço variar'], linhas: [
          ['Armação', 'Marca, material e onde você compra. Na ótica, costuma ter a maior margem do óculos.'],
          ['Lentes', 'Tipo (visão simples ou multifocal), espessura (índice de refração) e tratamentos, como antirreflexo, filtro de luz azul e lente que escurece no sol.'],
          ['Montagem', 'Corte das lentes no formato da armação. Algumas óticas incluem no preço das lentes; outras cobram à parte para armação trazida pelo cliente.']] } },
        { h: 'O que mais encarece as lentes', lista: ['Multifocal custa bem mais que visão simples.', 'Grau alto pede lente mais fina (índice maior), que é mais cara.', 'Cada tratamento extra soma no preço. Antirreflexo costuma valer a pena; os outros dependem do seu uso.'] },
        { h: 'Como pagar menos', ol: ['Compre a armação à parte. [Veja armações até R$ 100](/armacoes/armacao-ate-100-reais).', 'Peça orçamento das lentes em duas ou três óticas, com a mesma receita e os mesmos tratamentos.', 'Pergunte se a montagem está incluída.', 'Precisa de dois óculos? Na Só Armação, levando 2 armações, a 2ª sai com desconto.'] }
      ] }
  };
  function guiaHtml(slug, g, precoMin) {
    var r = function (s) { return String(s).replace('{preco_min}', precoMin); };
    var bloco = function (sx) {
      var out = '<h2>' + esc(sx.h) + '</h2>';
      if (sx.tabela) out += '<div class="tabela-rolagem"><table class="medidas guia-tabela"><thead><tr>' + sx.tabela.cab.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        sx.tabela.linhas.map(function (l) { return '<tr>' + l.map(function (c) { return '<td>' + txt(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      (sx.p || []).forEach(function (t) { out += '<p>' + txt(r(t)) + '</p>'; });
      if (sx.lista) out += '<ul>' + sx.lista.map(function (t) { return '<li>' + txt(t) + '</li>'; }).join('') + '</ul>';
      if (sx.ol) out += '<ol>' + sx.ol.map(function (t) { return '<li>' + txt(t) + '</li>'; }).join('') + '</ol>';
      return out;
    };
    var outros = Object.keys(GUIAS).filter(function (k) { return k !== slug; });
    return '<div class="container institucional guia"><nav class="migalhas" aria-label="Você está em"><a href="/" data-link>Início</a> › <a href="/guia" data-link>Guias</a> › <span>' + esc(g.t) + '</span></nav>' +
      '<h1 class="display">' + esc(g.t) + '</h1><p class="guia-resumo"><strong>' + txt(r(g.resumo)) + '</strong></p>' +
      g.secoes.map(bloco).join('') +
      '<h2>Outros guias</h2><ul>' + outros.map(function (k) { return '<li><a href="/guia/' + k + '" data-link>' + esc(GUIAS[k].t) + '</a></li>'; }).join('') + '</ul>' +
      '<p style="margin-top:24px"><a class="btn btn-laranja" href="/modelos" data-link>Ver armações</a></p></div>';
  }
  function guiasIndiceHtml() {
    return '<div class="container institucional"><nav class="migalhas" aria-label="Você está em"><a href="/" data-link>Início</a> › <span>Guias</span></nav>' +
      '<h1 class="display">Guias</h1><p>Tudo o que ajuda a escolher a armação certa e a gastar menos com o óculos de grau.</p><ul class="guias-lista">' +
      Object.keys(GUIAS).map(function (k) { return '<li><a href="/guia/' + k + '" data-link><strong>' + esc(GUIAS[k].t) + '</strong></a><br>' + esc(GUIAS[k].d) + '</li>'; }).join('') + '</ul>' +
      '<h2>Armações por categoria</h2><ul>' + Object.keys(CATEGORIAS).map(function (k) { return '<li><a href="/armacoes/' + k + '" data-link>' + esc(CATEGORIAS[k].t) + '</a></li>'; }).join('') + '</ul></div>';
  }
  raiz.SA_CONTEUDO = {
    email: EMAIL, paginas: PAGINAS, faq: faq,
    esc: esc, txt: txt, semLinks: semLinks, tamanhoDe: tamanhoDe, fichaModelo: fichaModelo, fichaHtml: fichaHtml, faqModeloHtml: faqModeloHtml,
    categorias: CATEGORIAS, naCategoria: naCategoria, categoriaTopoHtml: categoriaTopoHtml,
    guias: GUIAS, guiaHtml: guiaHtml, guiasIndiceHtml: guiasIndiceHtml
  };
})(typeof window !== "undefined" ? window : globalThis);
