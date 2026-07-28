/**
 * Czech grammatical number for count nouns, backed by Intl.PluralRules('cs')
 * (CLDR): "one" is exactly 1, "few" is the integer 2-4, everything else
 * (0, 5+, including 22-24 which is NOT "few" in Czech) takes the third form.
 */
export function pluralizeCz(
  count: number,
  forms: [one: string, few: string, many: string],
): string {
  const [one, few, many] = forms
  const rule = new Intl.PluralRules("cs").select(count)
  if (rule === "one") return one
  if (rule === "few") return few
  return many
}
