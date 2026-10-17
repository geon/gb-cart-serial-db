// Language tags (BCP 47) of titles, from what each source says about them.
//
// The sources mostly give the language of the game's text, not of the title, e.g. the Japanese release of
// "Bakuretsu Senshi Warrior" is in English. So titles in Japanese or Korean script are tagged by their script, and
// No-Intro entries released only in Japan, China, Taiwan or Korea by their country.
//
// Titles in Japanese, Chinese or Korean written in Latin letters are tagged with the script, e.g. "ja-Latn" for
// "Pocket Monsters - Aka" but "ja" for "ポケットモンスター 赤". Translations made by a source, not official titles, get
// the private use tag "x-translated", e.g. "ja-x-translated" for sprintinglegs' "Pocket camera" for "ポケットカメラ".

export const nonLatinScript =
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

// The language of a title in Japanese (kana) or Korean (Hangul) script, else the given language. Adds "-Latn" to
// Japanese, Chinese and Korean when the title is written in Latin letters.
export function titleLanguage(
	title: string,
	language: string | undefined,
): string | undefined {
	const byScript = /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(title)
		? "ja"
		: /\p{Script=Hangul}/u.test(title)
			? "ko"
			: language;
	return byScript !== undefined &&
		["ja", "zh", "ko"].includes(byScript) &&
		!nonLatinScript.test(title)
		? `${byScript}-Latn`
		: byScript;
}

const countryLanguages: Record<string, string> = {
	Japan: "ja",
	China: "zh",
	Taiwan: "zh",
	"Hong Kong": "zh",
	Korea: "ko",
};

// From No-Intro's regions and language codes, e.g. "En", "Ja", "Zh-Hant".
export function noIntroLanguage(
	regions: readonly string[],
	languages: readonly string[],
): string | undefined {
	const [region] = regions;
	if (regions.length === 1 && region && countryLanguages[region]) {
		return countryLanguages[region];
	}
	// Only entries with a single language say which language the title is in.
	const [language] = languages;
	const [, code, script] =
		language?.match(/^([A-Za-z]{2})(?:-([A-Za-z]{4}))?$/) ?? [];
	return languages.length === 1 && code
		? [
				code.toLowerCase(),
				...(script
					? [script.charAt(0).toUpperCase() + script.slice(1).toLowerCase()]
					: []),
			].join("-")
		: undefined;
}

// sprintinglegs' language names. Others, e.g. "Choice", "-", "English/French", say nothing about the title.
const sprintinglegsLanguages: Record<string, string> = {
	English: "en",
	Japanese: "ja",
	German: "de",
	French: "fr",
	Spanish: "es",
	Italian: "it",
	Dutch: "nl",
	Swedish: "sv",
	Danish: "da",
	Korean: "ko",
	Chinese: "zh",
};

export function sprintinglegsLanguage(language: string): string | undefined {
	return sprintinglegsLanguages[language];
}

// Regions of label serials and game-boy-database.com pages that have a single language.
const regionLanguages: Record<string, string> = {
	USA: "en",
	CAN: "en",
	UKV: "en",
	AUS: "en",
	NOE: "de",
	FRG: "de",
	NNOE: "de",
	FRA: "fr",
	NFRA: "fr",
	ITA: "it",
	NITA: "it",
	ESP: "es",
	NESP: "es",
	HOL: "nl",
	NHOL: "nl",
	JPN: "ja",
};

export function regionLanguage(region: string | undefined): string | undefined {
	return region === undefined ? undefined : regionLanguages[region];
}

// dmgpage.com's country abbreviations.
const dmgpageLanguages: Record<string, string> = {
	UK: "en",
	US: "en",
	GER: "de",
	FR: "fr",
	ESP: "es",
	IT: "it",
	NED: "nl",
};

export function dmgpageLanguage(
	regions: readonly string[],
): string | undefined {
	const languages = [
		...new Set(regions.map((region) => dmgpageLanguages[region])),
	];
	return languages.length === 1 ? languages[0] : undefined;
}
