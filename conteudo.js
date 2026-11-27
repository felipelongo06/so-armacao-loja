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
  raiz.SA_CONTEUDO = { email: EMAIL, paginas: PAGINAS, faq: faq };
})(typeof window !== "undefined" ? window : globalThis);
