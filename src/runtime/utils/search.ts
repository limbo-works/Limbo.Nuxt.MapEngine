// Danish ae/oe/aa are distinct base letters (not decomposable accents), so
// they need explicit substitution before NFD-stripping catches the rest
// (accented e, u, etc). Shared by searchPoints and the exact-match check in
// search UIs so the two can never disagree.
const substitutions = new Map<string, string>([
	['æ', 'ae'],
	['ø', 'o'],
	['å', 'a'],
]);

const danishLetters = /[æøå]/g;
const combiningDiacritics = /[\u0300-\u036f]/g;

export function normalizeSearchText(text: string): string {
	return text
		.toLowerCase()
		.replace(danishLetters, (char) => substitutions.get(char) ?? char)
		.normalize('NFD')
		.replace(combiningDiacritics, '')
		.trim();
}
