"""Biblioteca mínima para gerar monografia em .docx no padrão ABNT (NBR 14724/10520/6023)."""
import copy
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING, WD_TAB_ALIGNMENT, WD_TAB_LEADER
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

FONT = "Arial"
M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"


def _set_font(style, size=12, bold=None, italic=None, caps=None):
    style.font.name = FONT
    style.font.size = Pt(size)
    style.font.color.rgb = RGBColor(0, 0, 0)
    rpr = style.element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts"); rpr.append(rfonts)
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(a), FONT)
    if bold is not None:
        style.font.bold = bold
    if italic is not None:
        style.font.italic = italic
    if caps is not None:
        style.font.all_caps = caps


class Monografia:
    def __init__(self):
        self.d = Document()
        d = self.d
        s = d.sections[0]
        s.page_width, s.page_height = Cm(21), Cm(29.7)
        s.top_margin, s.left_margin, s.bottom_margin, s.right_margin = Cm(3), Cm(3), Cm(2), Cm(2)
        s.header_distance = Cm(2); s.footer_distance = Cm(1.25)
        st = d.styles
        normal = st["Normal"]
        _set_font(normal)
        pf = normal.paragraph_format
        pf.line_spacing = 1.5; pf.space_before = Pt(0); pf.space_after = Pt(0)
        # corpo do texto
        body = st.add_style("Texto", 1); body.base_style = normal
        body.paragraph_format.first_line_indent = Cm(1.25)
        body.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        for name, size, caps, italic, before in (("Heading 1", 12, True, False, 0),
                                                 ("Heading 2", 12, False, False, 12),
                                                 ("Heading 3", 12, False, True, 12)):
            h = st[name]
            _set_font(h, size, bold=True, italic=italic, caps=caps)
            h.paragraph_format.space_before = Pt(before); h.paragraph_format.space_after = Pt(12)
            h.paragraph_format.line_spacing = 1.5
            h.paragraph_format.keep_with_next = True
            h.paragraph_format.first_line_indent = Cm(0)
            h.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        st["Heading 1"].paragraph_format.space_after = Pt(18)
        # título sem numeração (resumo, listas, referências): centralizado, não entra no sumário numerado
        tn = st.add_style("Titulo sem numero", 1); tn.base_style = normal
        _set_font(tn, 12, bold=True, caps=True)
        tn.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        tn.paragraph_format.space_after = Pt(18)
        li = st.add_style("Lista item", 1); li.base_style = normal
        li.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        li.paragraph_format.tab_stops.add_tab_stop(Cm(15.9), alignment=WD_TAB_ALIGNMENT.RIGHT, leader=WD_TAB_LEADER.DOTS)
        cap = st.add_style("Legenda ABNT", 1); cap.base_style = normal
        _set_font(cap, 10)
        cap.paragraph_format.line_spacing = 1.0
        cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.keep_with_next = True
        cap.paragraph_format.space_before = Pt(6)
        src = st.add_style("Fonte ABNT", 1); src.base_style = normal
        _set_font(src, 10)
        src.paragraph_format.line_spacing = 1.0
        src.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        src.paragraph_format.space_after = Pt(12)
        cell = st.add_style("Celula", 1); cell.base_style = normal
        _set_font(cell, 10)
        cell.paragraph_format.line_spacing = 1.0
        quote = st.add_style("Citacao longa", 1); quote.base_style = normal
        _set_font(quote, 10)
        quote.paragraph_format.left_indent = Cm(4); quote.paragraph_format.line_spacing = 1.0
        quote.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        quote.paragraph_format.space_before = Pt(12); quote.paragraph_format.space_after = Pt(12)
        ref = st.add_style("Referencia", 1); ref.base_style = normal
        ref.paragraph_format.line_spacing = 1.0; ref.paragraph_format.space_after = Pt(12)
        ref.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        code = st.add_style("Codigo", 1); code.base_style = normal
        code.font.name = "Courier New"; code.font.size = Pt(9)
        code.paragraph_format.line_spacing = 1.0
        code.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
        for n in ("TOC 1", "TOC 2", "TOC 3"):
            try:
                t = st[n]
            except KeyError:
                t = st.add_style(n, 1)
            t.base_style = normal
            _set_font(t, 12, bold=(n == "TOC 1"), caps=(n == "TOC 1"))
            t.paragraph_format.tab_stops.add_tab_stop(Cm(15.9), alignment=WD_TAB_ALIGNMENT.RIGHT, leader=WD_TAB_LEADER.DOTS)
            t.paragraph_format.left_indent = Cm({"TOC 1": 0, "TOC 2": 0, "TOC 3": 0}[n])
        self.n_fig = 0; self.n_quadro = 0; self.n_tab = 0; self.n_eq = 0
        self.headings = []  # (level, text) para o conteúdo em cache do sumário
        self.captions = {"Figura": [], "Quadro": [], "Tabela": []}
        self._settings_update_fields()

    # ---------------------------------------------------------------- básicos
    def _settings_update_fields(self):
        settings = self.d.settings.element
        uf = OxmlElement("w:updateFields"); uf.set(qn("w:val"), "true")
        settings.append(uf)

    def page_break(self):
        p = self.d.add_paragraph()
        p.add_run().add_break(WD_BREAK.PAGE)
        return p

    def para(self, text="", style="Texto", align=None, bold=False, size=None, space_after=None, indent=True):
        p = self.d.add_paragraph(style=style)
        if text:
            self._runs(p, text, bold=bold, size=size)
        if align is not None:
            p.alignment = align
        if not indent:
            p.paragraph_format.first_line_indent = Cm(0)
        if space_after is not None:
            p.paragraph_format.space_after = Pt(space_after)
        return p

    def _runs(self, p, text, bold=False, size=None):
        """Marcação simples: **negrito**, *itálico*, `código`."""
        import re
        tokens = re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)", text)
        for tok in tokens:
            if not tok:
                continue
            if tok.startswith("**"):
                r = p.add_run(tok[2:-2]); r.bold = True
            elif tok.startswith("*") and len(tok) > 1:
                r = p.add_run(tok[1:-1]); r.italic = True
            elif tok.startswith("`"):
                r = p.add_run(tok[1:-1]); r.font.name = "Courier New"; r.font.size = Pt(10 if not size else size - 1)
            else:
                r = p.add_run(tok)
            if bold:
                r.bold = True
            if size:
                r.font.size = Pt(size)
        return p

    def h1(self, text, new_page=True):
        p = self.d.add_paragraph(text, style="Heading 1")
        p.paragraph_format.page_break_before = new_page
        self.headings.append((1, text))
        return p

    def h2(self, text):
        self.headings.append((2, text))
        return self.d.add_paragraph(text, style="Heading 2")

    def h3(self, text):
        self.headings.append((3, text))
        return self.d.add_paragraph(text, style="Heading 3")

    def unnumbered_title(self, text, toc=False):
        p = self.d.add_paragraph(text, style="Heading 1" if toc else "Titulo sem numero")
        if toc:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            self.headings.append((1, text))
        return p

    def bullets(self, items, marker="letters"):
        for i, it in enumerate(items):
            pre = f"{chr(97 + i)}) " if marker == "letters" else "– "
            p = self.d.add_paragraph(style="Texto")
            p.paragraph_format.first_line_indent = Cm(0)
            p.paragraph_format.left_indent = Cm(1.25)
            self._runs(p, pre + it)

    def long_quote(self, text, cite):
        p = self.d.add_paragraph(style="Citacao longa")
        self._runs(p, f"{text} ({cite})")

    # ------------------------------------------------------------- campos
    def _field(self, p, instr, cached=""):
        r = p.add_run(); fc = OxmlElement("w:fldChar"); fc.set(qn("w:fldCharType"), "begin"); r._r.append(fc)
        r = p.add_run(); it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = f" {instr} "; r._r.append(it)
        r = p.add_run(); fc = OxmlElement("w:fldChar"); fc.set(qn("w:fldCharType"), "separate"); r._r.append(fc)
        r = p.add_run(cached)
        r2 = p.add_run(); fc = OxmlElement("w:fldChar"); fc.set(qn("w:fldCharType"), "end"); r2._r.append(fc)
        return r

    def caption(self, kind, title):
        """Legenda acima do elemento (ABNT): 'Figura N – Título'."""
        if kind == "Figura":
            self.n_fig += 1; n = self.n_fig
        elif kind == "Quadro":
            self.n_quadro += 1; n = self.n_quadro
        else:
            self.n_tab += 1; n = self.n_tab
        p = self.d.add_paragraph(style="Legenda ABNT")
        p.add_run(f"{kind} ")
        self._field(p, f"SEQ {kind} \\* ARABIC", str(n))
        p.add_run(f" – {title}")
        self.captions[kind].append((n, title))
        return n

    def source(self, text):
        return self.d.add_paragraph(f"Fonte: {text}", style="Fonte ABNT")

    def figure(self, path, title, src, width_cm=15.5):
        n = self.caption("Figura", title)
        p = self.d.add_paragraph(style="Legenda ABNT")
        p.paragraph_format.keep_with_next = True
        from PIL import Image
        w, h = Image.open(path).size
        max_h = 14.0
        if width_cm * h / w > max_h:
            width_cm = max_h * w / h
        p.add_run().add_picture(path, width=Cm(width_cm))
        self.source(src)
        return n

    def table(self, kind, title, header, rows, src, widths=None, bold_last_row=False, align_center_from=1):
        n = self.caption(kind, title)
        t = self.d.add_table(rows=1 + len(rows), cols=len(header))
        t.style = "Table Grid"
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, row in enumerate([header] + rows):
            for j, val in enumerate(row):
                c = t.cell(i, j)
                c.text = ""
                p = c.paragraphs[0]; p.style = self.d.styles["Celula"]
                self._runs(p, str(val), bold=(i == 0) or (bold_last_row and i == len(rows)))
                if j >= align_center_from and i > 0:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                if i == 0:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    tcPr = c._tc.get_or_add_tcPr(); shd = OxmlElement("w:shd")
                    shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), "E7E6E6"); tcPr.append(shd)
        # tabela (IBGE): sem bordas laterais; quadro: grade completa
        if kind == "Tabela":
            self._ibge_borders(t)
        if widths:
            for row in t.rows:
                for j, w in enumerate(widths):
                    row.cells[j].width = Cm(w)
        # repetir cabeçalho
        trPr = t.rows[0]._tr.get_or_add_trPr(); h = OxmlElement("w:tblHeader"); h.set(qn("w:val"), "true"); trPr.append(h)
        self.source(src)
        return n

    def _ibge_borders(self, t):
        tblPr = t._tbl.tblPr
        b = OxmlElement("w:tblBorders")
        for edge, val in (("top", "single"), ("bottom", "single"), ("left", "nil"), ("right", "nil"),
                          ("insideH", "single"), ("insideV", "nil")):
            e = OxmlElement(f"w:{edge}"); e.set(qn("w:val"), val); e.set(qn("w:sz"), "6"); e.set(qn("w:color"), "000000")
            b.append(e)
        old = tblPr.find(qn("w:tblBorders"))
        if old is not None:
            tblPr.remove(old)
        tblPr.append(b)

    # ------------------------------------------------------------ equações
    def _m(self, tag):
        return OxmlElement(f"m:{tag}")

    def _mrun(self, text):
        r = self._m("r")
        rpr = OxmlElement("w:rPr"); f = OxmlElement("w:rFonts"); f.set(qn("w:ascii"), "Cambria Math"); f.set(qn("w:hAnsi"), "Cambria Math"); rpr.append(f)
        r.append(rpr)
        t = self._m("t"); t.text = text; t.set(qn("xml:space"), "preserve"); r.append(t)
        return r

    def _mbuild(self, parts, parent):
        for part in parts:
            if isinstance(part, str):
                parent.append(self._mrun(part))
            elif part[0] == "frac":
                f = self._m("f"); num = self._m("num"); den = self._m("den")
                self._mbuild(part[1], num); self._mbuild(part[2], den)
                f.append(num); f.append(den); parent.append(f)
            elif part[0] == "sub":
                s = self._m("sSub"); e = self._m("e"); sb = self._m("sub")
                self._mbuild([part[1]], e); self._mbuild([part[2]], sb)
                s.append(e); s.append(sb); parent.append(s)
            elif part[0] == "sup":
                s = self._m("sSup"); e = self._m("e"); sp = self._m("sup")
                self._mbuild([part[1]], e); self._mbuild([part[2]], sp)
                s.append(e); s.append(sp); parent.append(s)
            elif part[0] == "sum":
                n = self._m("nary"); pr = self._m("naryPr"); ch = self._m("chr"); ch.set(qn("m:val"), "∑"); pr.append(ch)
                n.append(pr)
                sub = self._m("sub"); self._mbuild(part[1], sub); n.append(sub)
                sup = self._m("sup"); self._mbuild(part[2], sup); n.append(sup)
                e = self._m("e"); self._mbuild(part[3], e); n.append(e)
                parent.append(n)

    def equation(self, parts):
        """Equação OMML centralizada com numeração (n) à direita."""
        self.n_eq += 1
        p = self.d.add_paragraph(style="Normal")
        pf = p.paragraph_format
        pf.tab_stops.add_tab_stop(Cm(8), alignment=WD_TAB_ALIGNMENT.CENTER)   # centro
        pf.tab_stops.add_tab_stop(Cm(16), alignment=WD_TAB_ALIGNMENT.RIGHT)  # direita
        pf.space_before = Pt(6); pf.space_after = Pt(6)
        p.add_run("\t")
        omath = self._m("oMath")
        self._mbuild(parts, omath)
        p._p.append(omath)
        r = OxmlElement("w:r"); t = OxmlElement("w:t"); t.text = f"\t({self.n_eq})"; t.set(qn("xml:space"), "preserve"); r.append(t)
        p._p.append(r)
        return self.n_eq

    # ------------------------------------------------------------ sumário e listas
    def _field_multi(self, instr, entries, style_for):
        """Campo que abrange vários parágrafos; `entries` é o conteúdo provisório (cache)."""
        def fc(p, kind):
            r = p.add_run(); f = OxmlElement("w:fldChar"); f.set(qn("w:fldCharType"), kind); r._r.append(f)
        if not entries:
            entries = [(1, "Clique com o botão direito e escolha Atualizar campo.")]
        first = None; last = None
        for i, (lvl, text) in enumerate(entries):
            q = self.d.add_paragraph(style=style_for(lvl))
            if i == 0:
                fc(q, "begin")
                r = q.add_run(); it = OxmlElement("w:instrText"); it.set(qn("xml:space"), "preserve"); it.text = f" {instr} "; r._r.append(it)
                fc(q, "separate"); first = q
            q.add_run(text)
            last = q
        fc(last, "end")
        return first

    def toc(self, cached_entries):
        return self._field_multi('TOC \\o "1-3" \\h \\z \\u', cached_entries, lambda l: f"TOC {l}")

    def caption_list(self, kind, entries):
        return self._field_multi(f'TOC \\h \\z \\c "{kind}"', [(1, f"{kind} {n} – {t}") for n, t in entries],
                                 lambda l: "Lista item")

    # ------------------------------------------------------------ seções e cabeçalho
    def new_section_after_cover(self):
        """Encerra a capa: a próxima seção (folha de rosto) recomeça a contagem em 1, sem número visível."""
        sec = self.d.add_section(WD_SECTION.NEW_PAGE)
        pg = OxmlElement("w:pgNumType"); pg.set(qn("w:start"), "1"); sec._sectPr.append(pg)
        return sec

    def new_section_numbered(self):
        """Inicia nova seção (página nova) cujo cabeçalho mostra o número à direita."""
        sec = self.d.add_section(WD_SECTION.NEW_PAGE)
        # a seção nova é clonada da anterior: remove o reinício da numeração (continua a contagem)
        for pg in sec._sectPr.findall(qn("w:pgNumType")):
            sec._sectPr.remove(pg)
        sec.header.is_linked_to_previous = False
        hp = sec.header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = hp.add_run(); r.font.size = Pt(10)
        self._field(hp, "PAGE", "")
        # primeira seção: cabeçalho vazio
        first = self.d.sections[0]
        first.header.is_linked_to_previous = False
        return sec

    def save(self, path):
        self.d.save(path)
