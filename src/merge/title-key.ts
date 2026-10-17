const romanNumerals: Record<string, string> = {
	ii: "2",
	iii: "3",
	iv: "4",
	v: "5",
	vi: "6",
	vii: "7",
	viii: "8",
	ix: "9",
	x: "10",
};

// A key for comparing titles across sources, ignoring case, accents, punctuation, "the", Roman numerals and the
// spelling of long Japanese vowels, e.g. "Takahashi Meijin no Bōken Jima II", "Takahashi Meijin no Bouken Jima 2" and
// "Takahashi Meijin no Boken Jima II" are the same.
export function titleKey(title: string): string {
	return title
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[̀-ͯ]/g, "")
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(" ")
		.map((word) => romanNumerals[word] ?? word)
		.filter((word) => word !== "the")
		.join("")
		.replace(/ou/g, "o")
		.replace(/uu/g, "u");
}
