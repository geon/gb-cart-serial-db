// Parsing of serials printed on cartridge labels, e.g. "DMG-TR-USA-1", "DMG-TRA", "DMG-APAE-USA", "DMG-104 CHN".
//
// A Nintendo label serial is <platform>-<code>[-<region>][-<reprint>]:
// - platform: DMG (Game Boy, also used by "black" Game Boy Color compatible cartridges), CGB, AGB, AGP, GBD (Pocket Camera etc.).
// - code: the product code. Codes of 3 or more characters end with a region/language letter, e.g. "TRA", "APAE", "APAD":
//   J Japan, E USA, P Europe, D Germany, F France, I Italy, S Spain, H Netherlands, K Korea, U Australia,
//   X/Y European multi-language editions, A international. The oldest codes have 2 characters and no region letter, e.g. "TR".
// - region: where it was distributed, e.g. "USA", "NOE", "NEU6". Missing on early Japanese cartridges, e.g. "DMG-TRA".
// - reprint: a number for later print runs, e.g. "-1".
// Chinese releases (distributed by Mani) have a numeric code and are written "DMG-104 CHN".

export type LabelSerial =
	| {
			kind: "nintendo";
			/** Normalized, e.g. "DMG-TR-USA-1". */
			serial: string;
			/** Platform and product code, without region and reprint number, e.g. "DMG-TR" for "DMG-TR-USA-1", "DMG-TRA", "DMG-APAE" for "DMG-APAE-USA". */
			code: string;
			/** The code without its region/language letter, e.g. "DMG-TR" for "DMG-TRA", "DMG-APA" for "DMG-APAE" and "DMG-APAD". The same as the code for 2 character codes. */
			stem: string;
			region?: string;
			reprint?: number;
			/** What was changed to normalize the serial, if anything. */
			fixes: string[];
	  }
	| {
			/** Another publisher's own code, e.g. Sachen "4B-002", Limited Run Games "LRG-AP-USA". Kept as written. */
			kind: "other";
			serial: string;
	  }
	| {
			kind: "rejected";
			reason: string;
	  };

const platforms = ["DMG", "CGB", "AGB", "AGP", "GBD"];

const nintendoPattern =
	/^(DMG|CGB|AGB|AGP|GBD)-([A-Z0-9]{2,5})(?:-([A-Z]{3}[A-Z0-9]?))?(?:-(\d+))?$/;
const chinesePattern = /^DMG-(\d{3}) CHN$/;

// Codes of other publishers, in their own formats.
const otherPatterns = [
	/^\d+B-\d{3}$/, // Sachen, e.g. "4B-002", "8B-001".
	/^MGB-\d{3}$/, // Sachen, e.g. "MGB-006".
	/^LRG-[A-Z0-9-]+$/, // Limited Run Games, e.g. "LRG-AP-USA", "LRG-USA-02".
	/^DMG-MMSA-JPN$/, // GB Memory Cartridge, the Japanese "Nintendo Power" flash cartridge games were written to at kiosks. Not a game's serial.
	/ROM[- ]?PACK|RomPack|SLR DATA COPY/i, // Minolta camera programs, e.g. "2085 ROM PACK, (7981-5001-78), No. 137".
];

// Typos and formatting variants, each with a description of what it fixes. Applied in order.
const fixes: readonly { fix: string; apply: (serial: string) => string }[] = [
	{
		// dmgpage.com, e.g. "G-DMG-LO-NOE", "G/DMG-YK-NOE-1"; probably the Super Game Boy manual's code.
		fix: 'Removed "G-" prefix',
		apply: (serial) => serial.replace(/^G[-/](?=DMG-)/, ""),
	},
	{
		// gbhwdb, e.g. "DIS-CGB-ADME-USA"; display cartridges for in-store kiosks.
		fix: 'Removed "DIS-" prefix',
		apply: (serial) => serial.replace(/^DIS-(?=CGB-|DMG-)/, ""),
	},
	{
		// dmgpage.com, e.g. "DMG-P-ACGP-NOE".
		fix: 'Removed "P-" infix',
		apply: (serial) => serial.replace(/^DMG-P-/, "DMG-"),
	},
	{
		// e.g. gbhwdb "AGP-BPPP-EUR", where the photographed label says "AGB-BPPP-EUR". Probably mixed up with box codes like "AGB-P-AJRE".
		fix: 'Corrected "AGP" to "AGB"',
		apply: (serial) => serial.replace(/^AGP-(?=[A-Z0-9]{4}-)/, "AGB-"),
	},
	{
		fix: 'Corrected "DNG" to "DMG"',
		apply: (serial) => serial.replace(/^DNG-/, "DMG-"),
	},
	{
		// e.g. "DMG-AAUE USA".
		fix: "Replaced space with hyphen",
		apply: (serial) =>
			serial.replace(/^([A-Z]{3}-[A-Z0-9]{2,5}) (?!CHN$)([A-Z]{3})$/, "$1-$2"),
	},
	{
		// e.g. "DMG-YTJ(JPN)".
		fix: 'Removed "(JPN)"',
		apply: (serial) =>
			serial.replace(/^([A-Z]{3}-[A-Z0-9]{2,5})\(JPN\)$/, "$1"),
	},
	{
		// e.g. "DMG-101CHN".
		fix: "Added space before CHN",
		apply: (serial) => serial.replace(/^DMG-(\d{3})CHN$/, "DMG-$1 CHN"),
	},
	{
		// e.g. "DMG-l7-EUR", "DMG-AW2P-EUr".
		fix: "Uppercased",
		apply: (serial) =>
			/^[A-Za-z]{3}-[A-Za-z0-9]{2,5}(-[A-Za-z]{3,4})?(-\d+)?$/.test(serial)
				? serial.toUpperCase()
				: serial,
	},
	{
		// e.g. "MG-ZG-UKV".
		fix: 'Corrected "MG" to "DMG"',
		apply: (serial) => serial.replace(/^MG-(?=[A-Z0-9]{2,5}-[A-Z]{3})/, "DMG-"),
	},
	{
		fix: 'Corrected "JAP" to "JPN"',
		apply: (serial) => serial.replace(/-JAP(?=-\d+$|$)/, "-JPN"),
	},
];

// Some values hold several serials, e.g. "CGB-BESP-EUR; CGB-BESE-USA", "AGB-AXVE-USA, DMG-AXV".
export function parseLabelSerials(raw: string): LabelSerial[] {
	return otherPatterns.some((pattern) => pattern.test(raw.trim()))
		? [parseLabelSerial(raw)]
		: raw.split(/\s*[;,]\s*/).map(parseLabelSerial);
}

export function parseLabelSerial(raw: string): LabelSerial {
	const value = raw.trim();
	// "MODEL NO. AGB-002" is printed on the back of every Game Boy Advance cartridge; AGB-014 is the e-Reader.
	if (/^AGB-\d{3}$/.test(value)) {
		return { kind: "rejected", reason: `Model number, not a serial: ${raw}` };
	}
	if (otherPatterns.some((pattern) => pattern.test(value))) {
		return { kind: "other", serial: value };
	}

	const { serial, applied } = fixes.reduce(
		({ serial, applied }, { fix, apply }) => {
			const fixed = apply(serial);
			return fixed === serial
				? { serial, applied }
				: { serial: fixed, applied: [...applied, fix] };
		},
		{ serial: value, applied: [] as string[] },
	);

	const chinese = serial.match(chinesePattern);
	if (chinese) {
		return {
			kind: "nintendo",
			serial,
			code: serial,
			stem: serial,
			fixes: applied,
		};
	}

	const [, platform, code, region, reprint] =
		serial.match(nintendoPattern) ?? [];
	if (!(platform && code && platforms.includes(platform))) {
		return { kind: "rejected", reason: `Not a label serial: ${raw}` };
	}
	return {
		kind: "nintendo",
		serial,
		code: `${platform}-${code}`,
		stem: `${platform}-${codeStem(code)}`,
		...(region ? { region } : {}),
		...(reprint ? { reprint: Number(reprint) } : {}),
		fixes: applied,
	};
}

// The product code without its region letter, e.g. "TR" for "TR" and "TRA", "APA" for "APAE".
export function codeStem(code: string): string {
	return code.length >= 3 ? code.slice(0, -1) : code;
}
