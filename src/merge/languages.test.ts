import { describe, expect, test } from "vitest";
import { languageTags, noIntroLanguage, titleLanguage } from "./languages.ts";

describe("languageTags", () => {
	test("converts No-Intro's language codes", () => {
		expect(languageTags("En")).toEqual(["en"]);
		expect(languageTags("Zh-Hant")).toEqual(["zh-Hant"]);
		expect(languageTags("En-US")).toEqual(["en-US"]);
		expect(languageTags("De+En")).toEqual(["de", "en"]);
		expect(languageTags("En+En")).toEqual(["en"]);
		expect(() => languageTags("nolang")).toThrow();
	});
});

describe("noIntroLanguage", () => {
	test("takes the country's language for single country Asian releases", () => {
		expect(noIntroLanguage(["Japan"], ["En"])).toBe("ja");
		expect(noIntroLanguage(["Taiwan"], ["Zh"])).toBe("zh");
	});

	test("takes the language of single language entries only", () => {
		expect(noIntroLanguage(["Germany"], ["De"])).toBe("de");
		expect(noIntroLanguage(["Europe"], ["En", "Fr"])).toBeUndefined();
		expect(noIntroLanguage(["Europe"], ["De+En"])).toBeUndefined();
	});
});

describe("titleLanguage", () => {
	test("tags by script first", () => {
		expect(titleLanguage("ポケットカメラ", "en")).toBe("ja");
		expect(titleLanguage("Pocket Monsters - Aka", "ja")).toBe("ja-Latn");
		expect(titleLanguage("役満", "ja")).toBe("ja");
		expect(titleLanguage("Tetris", "en")).toBe("en");
		expect(titleLanguage("Tetris", undefined)).toBeUndefined();
	});
});
