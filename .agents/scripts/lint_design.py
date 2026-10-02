#!/usr/bin/env python3
"""
lint_design.py · Verifica se uma tela HTML segue o design system AgileWork.

Uso:
    python scripts/lint_design.py caminho/tela.html [outra.html ...]

Saída: lista de ERRO (deve corrigir) e AVISO (revisar). Código de saída 1 se houver ERRO.
Sem dependências externas.
"""
import re
import sys
from pathlib import Path

REQUIRED_TOKENS = ["--bg", "--surface", "--surface-2", "--border", "--text", "--text-2", "--text-3",
                   "--accent", "--red", "--amber", "--green", "--mono"]


def strip_comments(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"<!--.*?-->", "", src, flags=re.S)
    return src


def js_blocks(src: str):
    return re.findall(r"<script[^>]*>(.*?)</script>", src, flags=re.S | re.I)


def css_blocks(src: str):
    return re.findall(r"<style[^>]*>(.*?)</style>", src, flags=re.S | re.I)


def lint(path: Path):
    raw = path.read_text(encoding="utf-8", errors="replace")
    src = strip_comments(raw)
    css = "\n".join(css_blocks(src))
    js = "\n".join(js_blocks(src))
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", src, flags=re.S | re.I)
    errs, warns = [], []

    # ---------- Tokens e fontes ----------
    for t in REQUIRED_TOKENS:
        if t + ":" not in css.replace(" ", ""):
            errs.append(f"Token {t} não definido (copie resources/tokens.css).")
    if '[data-theme="light"]' not in css and "[data-theme='light']" not in css:
        errs.append("Tema claro ([data-theme=\"light\"]) ausente.")
    if "Inter" not in raw or "JetBrains Mono" not in raw:
        warns.append("Fontes Inter/JetBrains Mono não referenciadas.")

    # ---------- Visual proibido ----------
    for m in re.finditer(r"(linear|radial|conic)-gradient\(", css):
        ctx = css[max(0, m.start() - 80):m.start()]
        if "data:image" in ctx or "radial-gradient(circle,var(--c)" in css[m.start():m.start() + 40]:
            continue
        errs.append("Gradiente decorativo encontrado (linear/radial/conic-gradient).")
        break
    if re.search(r"backdrop-filter", css):
        errs.append("backdrop-filter (efeito vidro) não faz parte do design.")
    if re.search(r"box-shadow:(?!0003px)[^;]*rgba\((?!0,0,0)[^)]*\)", css.replace(" ", "")):
        warns.append("Sombra colorida — use só sombra neutra rgba(0,0,0,…) em overlays.")
    for m in re.finditer(r"border-radius:\s*(\d+)px", css):
        if int(m.group(1)) > 8 and int(m.group(1)) not in (10, 12, 14):  # 10–14 só em pílulas pequenas (toggle/contador)
            warns.append(f"border-radius {m.group(1)}px — containers devem usar 6–8px.")
            break
    if re.search(r"text-transform:\s*uppercase", css):
        warns.append("text-transform:uppercase — evite rótulos em caixa alta (exceção: grupo de tabela de relatório).")
    hexes = set(h.lower() for h in re.findall(r"#[0-9a-fA-F]{6}\b", css))
    allowed = {"#0e1013", "#14171b", "#191c21", "#1d2127", "#23272e", "#2e333b", "#e6e8eb", "#9aa1ab", "#6b727c",
               "#4c8dff", "#8fb6ff", "#e5484d", "#e2a336", "#3fb68b", "#9b87d6", "#3a414b", "#262b32",
               "#f6f7f9", "#ffffff", "#fafbfc", "#f1f3f5", "#e4e7eb", "#d3d8de", "#14171b", "#5b636e", "#8a929c",
               "#2563eb", "#93b4f5", "#cfd5dc", "#2a3038", "#c9ced6", "#dfe3e8", "#3b424b", "#2a1215", "#ffd7d9",
               "#1d4ed8", "#f4f5f7", "#d7dbe0", "#b9bfc7", "#111111", "#333333", "#666666", "#444444", "#e3e6ea",
               "#c7cdd4", "#6b727c"}
    extra = sorted(h for h in hexes if h not in allowed)
    if extra:
        warns.append("Cores fora da paleta: " + ", ".join(extra[:8]) + (" …" if len(extra) > 8 else "") +
                     " — prefira var(--token).")

    # ---------- Conteúdo ----------
    emoji = re.findall(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", html)
    if emoji:
        errs.append(f"Emoji na interface ({''.join(sorted(set(emoji)))[:10]}). Só é permitido no texto copiado para WhatsApp.")
    for bad in ["Bem-vindo!", "Registre-se", "Pódio", "Clique aqui", "Ops!"]:
        if bad.lower() in html.lower():
            warns.append(f"Texto a revisar: \"{bad}\" (ver resources/copy.md).")

    # ---------- Robustez JS ----------
    if js:
        if "errBanner" not in js:
            errs.append("Listener de erro (errBanner) ausente — a tela pode ficar em branco sem aviso.")
        direct_ls = re.findall(r"(?<![\w.])localStorage\.(getItem|setItem|removeItem)", js)
        wrapped = re.findall(r"window\.localStorage\.(getItem|setItem|removeItem)", js)
        if len(direct_ls) > 0:
            errs.append("localStorage acessado diretamente — use o wrapper store.get/set (try/catch).")
        if not wrapped and "store" not in js and "localStorage" in js:
            errs.append("localStorage sem wrapper seguro.")
        if re.search(r"[\w\)\]]\?\.[\w\[(]", js):
            errs.append("Optional chaining (?.) — quebra em visualizadores antigos; use (x||{}).prop.")
        if re.search(r"\?\?=|\|\|=|&&=", js):
            errs.append("Operador de atribuição lógica (??= ||= &&=) — incompatível com visualizadores antigos.")
        if re.search(r"catch\s*\{", js):
            errs.append("catch sem parâmetro (catch{) — use catch(e){}.")
        if "navigator.clipboard" in js and "execCommand" not in js:
            warns.append("Clipboard sem fallback (textarea + execCommand).")
        if re.search(r"innerHTML\s*=.*\$\{(?!esc\()", js) and "esc(" not in js:
            warns.append("Interpolação em innerHTML sem esc() — escape textos vindos de dados.")
        tail = js.strip()[-900:]
        if "try{" not in tail.replace(" ", "") or "ErrorEvent" not in tail:
            warns.append("Inicialização no fim do script não está em try/catch disparando o errBanner.")

    # ---------- Estrutura ----------
    if 'lang="pt-BR"' not in raw:
        warns.append('Falta lang="pt-BR" no <html>.')
    if "themeBtn" not in raw:
        warns.append("Sem botão de alternar tema (themeBtn).")
    return errs, warns


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    total_err = 0
    for p in sys.argv[1:]:
        path = Path(p)
        errs, warns = lint(path)
        total_err += len(errs)
        print(f"\n{path.name}: {len(errs)} erro(s), {len(warns)} aviso(s)")
        for e in errs:
            print(f"  ERRO   {e}")
        for w in warns:
            print(f"  AVISO  {w}")
        if not errs and not warns:
            print("  OK")
    sys.exit(1 if total_err else 0)


if __name__ == "__main__":
    main()
