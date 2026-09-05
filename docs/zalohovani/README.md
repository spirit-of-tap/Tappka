# Zálohování Tappky

Podklad pro zářijové jednání s IT PEF.

- `zalohovani-tappka.tex` / `.pdf` — **hlavní dokument**, 4 strany:
  titulní list → způsob I → způsob II → způsob III
- `archiv/podrobna-technicka-verze.tex` / `.pdf` — podrobná verze (21 stran):
  konfigurace Dockeru, zálohovací skript, kalkulace kapacity, postup obnovy

## Sazba

```sh
latexmk -pdf zalohovani-tappka.tex   # nebo: pdflatex zalohovani-tappka.tex (3×)
latexmk -C                            # úklid pomocných souborů
```

Vyžaduje TeX Live s balíčky `babel-czech`, `roboto`, `montserrat`, `tcolorbox`,
`titlesec`, `tabularx`, `tikz`, `xurl`. Písma podle `DESIGN.md`: Montserrat je
nejbližší dostupná náhrada za Poppins (v TeX Live není), Roboto sedí přesně.

## Poznámky k sazbě

- **Logo** je kresleno vektorově v TikZ (`\tappkalogo`) podle `public/icon.svg` —
  zaoblený čtverec s písmenem T. Důvod: dostupné PNG nemá alfa kanál a v tisku
  by kolem značky vznikl bílý čtverec.
- **Zlomy stránek jsou řízené ručně** přes `\clearpage`; každý způsob zálohy má
  vlastní stranu. Strana způsobu II používá `\enlargethispage`, aby se
  kapacitní tabulka vešla. Po delších úpravách textu je proto potřeba
  překontrolovat, že dokument má stále 4 strany.
