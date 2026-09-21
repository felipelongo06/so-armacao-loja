#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Injeta um <head> de verdade nos arquivos exportados do Claude Design.

O export autônomo entrega só a casca do bundler: <title>Bundled Page</title>,
sem description, sem Open Graph, sem canonical, sem lang. E o runtime ainda
limpa o title depois de montar — por isso o GA4 registra a página como
"(not set)" e link compartilhado no WhatsApp sai sem preview.

Rode DEPOIS de cada export, ANTES de publicar:

    cd ~/so-armacao-loja
    python3 preparar-head.py
    npx vercel@latest --prod

É idempotente: rodar duas vezes não duplica nada.
"""

import pathlib, re, sys

ARQUIVOS  = ["desktop.html", "loja.html"]
TITULO    = "Só Armação — armações a partir de R$ 89,90"
# Duas descrições de propósito diferente:
#  - SEO vai no <meta name="description">. O Google corta por volta de 155
#    caracteres, e o que sobra é a tagline — justamente o que não pode sumir.
#  - SOCIAL vai no Open Graph. WhatsApp e redes mostram bem mais, então aqui
#    cabe o texto completo.
DESCRICAO_SEO = ("Armações de grau a partir de R$ 89,90, com troca grátis em 30 dias "
                 "e pagamento no cartão ou Pix. Ninguém faz melhor por menos.")
DESCRICAO_SOCIAL = ("Armações de óculos de grau a partir de R$ 89,90, com troca grátis "
                    "em 30 dias e pagamento facilitado no cartão de crédito ou Pix. "
                    "Ninguém faz melhor por menos.")
CANONICO  = "https://soarmacao.com.br/"
OG_IMAGEM = "https://soarmacao.com.br/og.jpg"   # 1200x630, coloque o arquivo na pasta
COR_TEMA  = "#0B6B3A"

ABRE  = "<!-- head-soarmacao:inicio -->"
FECHA = "<!-- head-soarmacao:fim -->"


def bloco():
    # O title estático serve pro buscador, que não executa JavaScript.
    # O observer serve pro GA4 e pro Meta, que leem document.title depois
    # que o runtime do bundler montou — e o runtime apaga o title.
    return f"""{ABRE}
  <title>{TITULO}</title>
  <meta name="description" content="{DESCRICAO_SEO}">
  <link rel="canonical" href="{CANONICO}">
  <meta name="theme-color" content="{COR_TEMA}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Só Armação">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:title" content="{TITULO}">
  <meta property="og:description" content="{DESCRICAO_SOCIAL}">
  <meta property="og:url" content="{CANONICO}">
  <meta property="og:image" content="{OG_IMAGEM}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{TITULO}">
  <meta name="twitter:description" content="{DESCRICAO_SOCIAL}">
  <meta name="twitter:image" content="{OG_IMAGEM}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <script>
  (function(){{
    var t = {TITULO!r};
    function fixar(){{ if (document.title !== t) document.title = t; }}
    fixar();
    if (window.MutationObserver) {{
      new MutationObserver(fixar).observe(document.head, {{childList:true, subtree:true, characterData:true}});
    }}
    document.addEventListener('DOMContentLoaded', fixar);
    window.addEventListener('load', fixar);
  }})();
  </script>
{FECHA}"""


def tratar(caminho: pathlib.Path) -> str:
    html = caminho.read_text(encoding="utf-8")

    # idempotencia: tira um bloco anterior, se houver
    if ABRE in html and FECHA in html:
        html = re.sub(re.escape(ABRE) + r".*?" + re.escape(FECHA), "", html, flags=re.S)

    # idioma do documento
    html = re.sub(r"<html(?![^>]*\blang=)", '<html lang="pt-BR"', html, count=1)

    # troca o title do bundler pelo bloco; se nao achar, injeta apos <head>
    if "<title>Bundled Page</title>" in html:
        html = html.replace("<title>Bundled Page</title>", bloco(), 1)
    elif re.search(r"<title>.*?</title>", html, flags=re.S):
        html = re.sub(r"<title>.*?</title>", bloco(), html, count=1, flags=re.S)
    elif "<head>" in html:
        html = html.replace("<head>", "<head>\n  " + bloco(), 1)
    else:
        return "SEM <head> — arquivo inesperado, nada feito"

    caminho.write_text(html, encoding="utf-8")
    return "ok"


def main():
    base = pathlib.Path(__file__).resolve().parent
    faltando, houve_erro = [], False
    for nome in ARQUIVOS:
        alvo = base / nome
        if not alvo.exists():
            faltando.append(nome)
            continue
        r = tratar(alvo)
        print(f"  {nome:14} {r}")
        if r != "ok":
            houve_erro = True

    for nome in faltando:
        print(f"  {nome:14} nao encontrado")

    if not (base / "og.jpg").exists():
        print("\n  AVISO: og.jpg nao esta na pasta. Sem ele, link compartilhado")
        print("  no WhatsApp sai sem imagem. Coloque um JPG de 1200x630 ali.")

    for ic in ("favicon.ico", "icon-512.png", "apple-touch-icon.png"):
        if not (base / ic).exists():
            print(f"  AVISO: {ic} nao esta na pasta.")

    print("\n  Publique com:  npx vercel@latest --prod\n")
    sys.exit(1 if (houve_erro or faltando) else 0)


if __name__ == "__main__":
    main()
