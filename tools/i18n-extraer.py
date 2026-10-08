#!/usr/bin/env python3
"""Extrae los textos traducibles de la app y actualiza los catálogos.

    python3 tools/i18n-extraer.py                      # HTML + llamadas T()/I18n.t()
    python3 tools/i18n-extraer.py --textos textos.json # + lo que anotó i18n-recorrer.js

Qué hace:
  1. Lee los textos fijos de index.html (y sus aria-label, placeholder, title,
     alt y data-toast) y cada T('…') / I18n.t('…') de los .js.
  2. Si se pasa --textos, suma lo que se vio en pantalla. Los montos,
     porcentajes y números se vuelven marcadores: "Ahorraste $ 84,00" →
     "Ahorraste {monto}". Así una sola entrada sirve para todos los valores.
  3. Escribe locales/messages.pot (plantilla) y actualiza cada .po listado en
     locales/languages.json: conserva las traducciones, agrega lo nuevo con
     msgstr vacío y deja al final, comentado (#~), lo que ya no aparece.
No necesita dependencias (solo Python 3).
"""
import argparse, json, os, re, sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOC = os.path.join(ROOT, 'locales')
HTML_FILES = ['index.html']
JS_FILES = ['assets/asistente.js', 'assets/buscador.js', 'assets/destacados.js', 'assets/producto.js', 'assets/i18n.js', 'app.js']
ATTRS = ('aria-label', 'placeholder', 'title', 'alt', 'data-toast')
LETTERS = re.compile(r'[A-Za-zÁÉÍÓÚáéíóúÑñ]{2}')

# Nombres propios, marcas y datos de ejemplo: no se traducen.
NO = set('''Pichibank|Pichibank app|PICHI|BANK|VISA|Visa Débito|Mastercard Black|Diners Club|Uber|Eats|Uber Eats|Spotify|Netflix|
YouTube Premium|Disney+ Premium|iCloud|iCloud+|Gympass|Smart Fit|Uku|FM|PB|BC|CS|CA|DR|LP|MJ|SG|N|B|D+|Francisco Maldonado|
Supermaxi|Kywi|De Prati|Cinemark|Primax|Claro|Movistar|CNT|EPMAPS|Mercado Libre|Ticketshow|Sweet & Coffee|La Petite|
Carlos|Diego|Luis|María|Sofía|Banco Costa|Cooperativa Sierra|Visa Pichibank|PRINCIPAL|AHORROS|Sueldo|algo raro|hola'''.replace('\n', '').split('|'))
SKIP_IDS = {'fx-test-card'}  # panel de prueba de sonidos (herramienta interna)


def norm(s):
    return re.sub(r'\s+', ' ', s).strip()


class Html(HTMLParser):
    VOID = {'br', 'img', 'input', 'meta', 'link', 'source', 'hr', 'path', 'circle', 'rect', 'use', 'line', 'polyline', 'ellipse', 'stop'}

    def __init__(self):
        super().__init__()
        self.stack, self.out = [], {}

    def add(self, s, where):
        s = norm(s)
        if s and LETTERS.search(s) and s not in NO:
            self.out.setdefault(s, set()).add(where)

    def skipping(self):
        return any(t in ('script', 'style', 'svg', 'noscript') or no or i in SKIP_IDS or 'material-symbols' in c for t, i, c, no in self.stack)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        frame = (tag, a.get('id'), a.get('class') or '', a.get('translate') == 'no')
        if tag not in self.VOID:
            self.stack.append(frame)
        if not self.skipping():
            for k in ATTRS:
                if a.get(k):
                    self.add(a[k], 'index.html')
        if tag in self.VOID and False:
            pass

    def handle_endtag(self, tag):
        while self.stack and self.stack[-1][0] != tag:
            self.stack.pop()
        if self.stack:
            self.stack.pop()

    def handle_data(self, d):
        if not self.skipping():
            self.add(d, 'index.html')


def js_calls(path):
    """msgids de T('…'), I18n.t('…') y t('…') con comillas simples."""
    src = open(os.path.join(ROOT, path), encoding='utf-8').read()
    src = re.sub(r'(?m)^\s*//.*$', '', src)  # sin comentarios de línea
    out = {}
    for m in re.finditer(r"\b(?:T|I18n\.t|t)\(\s*'((?:[^'\\]|\\.)*)'", src):
        s = m.group(1).replace("\\'", "'").replace('\\\\', '\\')
        if LETTERS.search(s):
            out.setdefault(norm(s), set()).add(path)
    return out


MONEY = re.compile(r'-?\$\s?\d[\d.]*(?:,\d+)?')
PCT = re.compile(r'\d+(?:,\d+)?%')
NUM = re.compile(r'(?<![\w{])\d+(?:,\d+)?(?![\w}])')
DATE = re.compile(r'^(Hoy|Ayer|\d{1,2} (ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic))\b.*|^\d{1,2} \w+ \d{4}$|^Nro\.|\*{3}|·••|··\d|@')


def generalize(s):
    n = {'monto': 0, 'pct': 0, 'n': 0}

    def sub(kind):
        def f(m):
            n[kind] += 1
            return '{%s%s}' % (kind, '' if n[kind] == 1 else n[kind])
        return f
    s = MONEY.sub(sub('monto'), s)
    s = PCT.sub(sub('pct'), s)
    s = NUM.sub(sub('n'), s)
    return s


def from_textos(path, templates, terms=()):
    d = json.load(open(path, encoding='utf-8'))
    # Igual que en assets/i18n.js: un marcador sólo cubre datos con números o
    # nombres propios; "Ver {cat}" no explica "Ver ofertas" (eso es otra frase).
    FREE = re.compile(r'^(nombre|banco|lugar|servicio|producto|lista|cats)\d*$')
    TERMS = '|'.join(re.escape(x) for x in sorted(terms, key=len, reverse=True)) or 'x^'
    def body(t):
        return re.sub(r'\\\{(\w+)\\\}', lambda m: '.+?' if FREE.match(m.group(1)) else '(?:(?:-?\\$ )?[^ ]*\\d[^ ]*|' + TERMS + ')', re.escape(t))
    alt = '(?:' + '|'.join(body(t) for t in sorted(templates, key=len, reverse=True)) + ')'
    # un texto armado con una o varias plantillas seguidas (p. ej. dos T() unidos)
    whole = re.compile('^' + alt + '(?: ' + alt + ')*$')
    out = {}
    for s in d:
        s = norm(s)
        if not LETTERS.search(s) or s in NO or DATE.search(s):
            continue
        if s[0] in ',:;.)' or s.startswith('«'):
            continue  # pedazos de frases armadas con T() (ya están como plantilla)
        if s in templates or whole.match(s):
            continue
        # pedazo de una plantilla: partido por <b>, o una oración suelta de
        # una respuesta que el chat muestra en varias burbujas
        if any(s != t and s in t and ('<b>' in t or s[-1] in '.?!:') for t in templates):
            continue
        g = generalize(s)
        out.setdefault(g, set()).add('pantalla')
    return out


def esc(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')


def unesc(s):
    return re.sub(r'\\(n|t|"|\\)', lambda m: {'n': '\n', 't': '\t'}.get(m.group(1), m.group(1)), s)


def read_po(path):
    entries, cur, field = [], None, None
    if not os.path.exists(path):
        return entries

    def flush():
        nonlocal cur
        if cur and 'msgid' in cur:
            entries.append(cur)
        cur = None
    for raw in open(path, encoding='utf-8'):
        line = raw.strip()
        if not line:
            flush(); continue
        if line.startswith('#~'):
            continue
        if line.startswith('#'):
            if cur and 'msgstr' in cur:
                flush()
            cur = cur or {'comments': []}
            cur['comments'].append(line)
            continue
        m = re.match(r'^(msgctxt|msgid|msgstr)\s+"(.*)"$', line)
        if m:
            if m.group(1) in ('msgid', 'msgctxt') and cur and 'msgstr' in cur:
                flush()
            cur = cur or {'comments': []}
            field = m.group(1); cur[field] = unesc(m.group(2)); continue
        m = re.match(r'^"(.*)"$', line)
        if m and cur and field:
            cur[field] += unesc(m.group(1))
    flush()
    return entries


def write_po(path, header, items, obsolete=()):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(header.rstrip() + '\n\n')
        for it in items:
            for c in it.get('comments', []):
                f.write(c + '\n')
            f.write('msgid "%s"\nmsgstr "%s"\n\n' % (esc(it['msgid']), esc(it.get('msgstr', ''))))
        if obsolete:
            f.write('# ---- Ya no aparecen en la app (se conservan por si vuelven) ----\n\n')
            for it in obsolete:
                f.write('#~ msgid "%s"\n#~ msgstr "%s"\n\n' % (esc(it['msgid']), esc(it.get('msgstr', ''))))


POT_HEADER = '''# Plantilla de textos de Pichibank app (idioma fuente: español de Ecuador).
# Generada por tools/i18n-extraer.py — no se edita a mano: se regenera.
# Para un idioma nuevo, cópiala como locales/<código>.po y llena cada msgstr.
msgid ""
msgstr ""
"Content-Type: text/plain; charset=UTF-8\\n"
"Language: es-EC\\n"
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--textos', help='JSON de tools/i18n-recorrer.js')
    a = ap.parse_args()

    found = {}
    for f in HTML_FILES:
        h = Html(); h.feed(open(os.path.join(ROOT, f), encoding='utf-8').read())
        for k, v in h.out.items(): found.setdefault(k, set()).update(v)
    for f in JS_FILES:
        if os.path.exists(os.path.join(ROOT, f)):
            for k, v in js_calls(f).items(): found.setdefault(k, set()).update(v)
    tf = os.path.join(LOC, 'terminos.txt')
    terms = [norm(x) for x in open(tf, encoding='utf-8') if x.strip() and not x.startswith('#')] if os.path.exists(tf) else []
    for k in terms:
        found.setdefault(k, set()).add('terminos.txt')
    if a.textos:
        for k, v in from_textos(a.textos, set(found), set(terms)).items(): found.setdefault(k, set()).update(v)
    # lo que ya estaba en la plantilla (agregado a mano) se conserva
    for e in read_po(os.path.join(LOC, 'messages.pot')):
        if e['msgid']:
            found.setdefault(e['msgid'], set()).add('anterior')

    ids = sorted(found, key=lambda s: s.lower())
    pot = [{'msgid': i, 'comments': ['#: ' + ' '.join(sorted(found[i]))]} for i in ids]
    write_po(os.path.join(LOC, 'messages.pot'), POT_HEADER, pot)
    print('messages.pot:', len(ids), 'textos')

    langs = json.load(open(os.path.join(LOC, 'languages.json'), encoding='utf-8'))
    for l in langs:
        if not l.get('file'):
            continue
        path = os.path.join(LOC, l['file'])
        old = read_po(path)
        head = next((e for e in old if e['msgid'] == ''), None)
        have = {e['msgid']: e for e in old if e['msgid']}
        items, done = [], 0
        for i in ids:
            e = have.get(i, {'msgid': i, 'msgstr': ''})
            keep = [c for c in e.get('comments', []) if not c.startswith('#:')]
            e['comments'] = ['#: ' + ' '.join(sorted(found[i]))] + keep
            items.append(e); done += bool(e.get('msgstr'))
        obsolete = [e for k, e in have.items() if k not in found and e.get('msgstr')]
        header = 'msgid ""\nmsgstr ""\n' + ''.join('"%s"\n' % esc(x + '\n') for x in (head['msgstr'].strip().split('\n') if head else ['Content-Type: text/plain; charset=UTF-8', 'Language: ' + l['code']]))
        lead = ''.join(c + '\n' for c in (head.get('comments', []) if head else []))
        write_po(path, lead + header, items, obsolete)
        print('%s: %d/%d traducidos (%d%%)' % (l['file'], done, len(ids), round(100 * done / max(1, len(ids)))))


if __name__ == '__main__':
    main()
