// The database's schema: database/releases.json is a list of `Release`, and database/roms.json a list of `Rom`, which
// the releases refer to by id.
//
// Every value is consolidated from the sources in raw-data-sources/ (see the READMEs there). Titles and serials list
// the sources giving them, since the sources often disagree; the other values' sources are in their descriptions.
// Source entries in no release are in database/unmatched.json, as parsed.

// A release: a cartridge as a collector tells them apart, one per product code on the label, e.g. "DMG-TRA" (Japan)
// and "DMG-TR" (the rest of the world) for Tetris. Its country and reprint serials, e.g. DMG-TR-USA and DMG-TR-NOE-1,
// are variants of it.
export type Release = {
	/** The product code on the label, e.g. "DMG-TR", or else in the ROM header, e.g. "AGB-BKCJ", or on the ROM chip, e.g. "CGB-BFIB". Else, e.g. for unlicensed releases and Game Boy releases known only from their ROM, the ROM's No-Intro number, e.g. "dmg-1383", which can change when the merge rules change. */
	id: string;
	/** Releases of the same game, in other regions and languages, have the same gameId: the game's most common product code, e.g. "DMG-TR". */
	gameId: string;
	/** Releases of related games, e.g. reskins like Mickey Mouse and Bugs Bunny Crazy Castle, have the same familyId: the smallest gameId of the family. From No-Intro's parent/clone groups. */
	familyId: string;

	/** The title as printed or released, in the release's language, e.g. "マリオカートアドバンス" for AGB-AMKJ and "Pokemon - Versione Blu" for the Italian DMG-APEI. For a release sold in several languages, preferably the English title. From No-Intro's printed titles, Wikipedia, sprintinglegs' titles in Japanese, Chinese or Korean script and dmgpage.com, else catalogue forms like No-Intro's. */
	title: Title;
	/** When `title` isn't in Latin letters: the best title in Latin letters, romanized or English, e.g. "Zelda no Densetsu - Yume o Miru Shima" or "Mario Kart Advance". */
	titleLatin?: Title;
	/** A source's English translation of the title, when it differs from the others, e.g. "The Legend of Zelda: A Dreaming Island". */
	titleTranslated?: Title;
	/** For a release sold in several languages whose titles differ between them: the title in each language, e.g. "Pokémon: Version Vert Feuille" in "fr". */
	localizedTitles?: Title[];

	/** The cartridge's system, as in Nintendo's serials: "dmg" fits all Game Boys, "cgb" only the Game Boy Color and Advance, "agb" only the Advance. From No-Intro, or else the serials, or else the sprintinglegs list. */
	system?: GameSystem;
	/** From No-Intro: "unlicensed", e.g. Sachen, or "pirate", e.g. bootlegs. Omitted for licensed releases, and for releases not in No-Intro, which the other sources list as official. */
	licensing?: "unlicensed" | "pirate";
	/** A Game Boy cartridge with Game Boy Color enhancements, e.g. the black cartridges. From No-Intro. */
	gameBoyColorEnhanced?: true;
	/** From No-Intro. */
	superGameBoyEnhanced?: true;
	/** Hardware in the cartridge, or support for other hardware, from No-Intro's "Rumble Version" ROMs and Wikipedia's "Cartridge feature" column. */
	cartridgeFeatures: CartridgeFeature[];
	/** Languages of the game's text, from No-Intro, e.g. ["en"], ["ja"], ["en", "fr", "de"]. */
	languages: string[];

	/** From Wikipedia's lists of games: the game's release dates in the release's regions, earliest first. All of the game's dates for a release of unknown region. */
	releaseDates: ReleaseDate[];
	/** From Wikipedia's lists of games, credited in the release's regions. */
	developers: string[];
	publishers: string[];

	/** Serials printed on cartridge labels, e.g. "DMG-TR-USA-1", corrected (raw-data-sources/corrections/) and normalized. */
	cartridgeSerials: SourcedSerial[];
	/** Codes printed on ROM chips, e.g. "DMG-TRA-1", corrected. */
	romChipSerials: SourcedSerial[];
	/** The ids of the release's ROMs in database/roms.json. A ROM sold under several product codes, e.g. Tetris Rev 1 under DMG-TR and DMG-TRA, is in each of their releases. */
	roms: string[];

	/** Best first: photos of documented cartridges (gbhwdb.gekkio.fi), box scans (game-boy-database.com), then box art, title screens and gameplay screenshots of the ROMs (libretro-thumbnails; the box art may be made by fans). */
	images: Image[];
	/** The game's article, from Wikipedia's lists of games. Usually one. */
	wikipediaArticles: string[];
};

// A dump of a cartridge's ROM, as catalogued by No-Intro, with what GBxDumper's list says about its files.
export type Rom = {
	/** No-Intro's DAT and archive number, e.g. "dmg-1383". */
	id: string;
	/** The No-Intro name, e.g. "Tetris (World) (Rev 1)". Widely used by other lists to identify a ROM. */
	name: string;
	/** The ROM's page on DAT-o-MATIC. */
	url: string;
	/** No-Intro's regions, e.g. ["USA", "Europe"], ["World"]. */
	regions: string[];
	/** Languages of the game's text, e.g. ["en", "fr", "de"]. */
	languages: string[];
	/** e.g. ["Rev 1"], ["v1.1"]. */
	versions: string[];
	/** e.g. "Rumble Version", "Limited Run Games", "Kiosk". */
	edition?: string;
	/** No-Intro's special tags other than Super Game Boy and Game Boy Color support, which are in the release, e.g. ["NP"] for Nintendo Power cartridges. */
	tags: string[];
	/** Game codes in the ROM header, e.g. ["AXPE"]. Only Game Boy Color and Advance ROMs have one. */
	headerCodes: string[];
	/** Good dumps of the ROM. Usually exactly one. */
	files: RomFile[];
	/** GBxDumper's dumps whose CRC32 No-Intro doesn't have, but whose header code only this ROM has (or, among ROMs with the code, its size): another revision, a bad dump, or a dump of the wrong size, since GBxDumper looks up the size of a game rather than reading it. */
	otherDumps?: RomFile[];
};

export type RomFile = {
	crc32: string;
	/** In bytes. */
	size: number;
	/** From GBxDumper: the title in the ROM header, e.g. "MARIO&LUIGIJ". */
	internalName?: string;
	/** From GBxDumper: the save type and the version of Nintendo's save library, e.g. "EEPROM_V124", "SRAM_V113", "FLASH1M_V103". */
	saveType?: string;
	/** From GBxDumper, in bytes. */
	saveSize?: number;
};

export type Title = {
	title: string;
	/** A language tag (BCP 47), e.g. "en", "ja", "ja-Latn" for Japanese in Latin letters. Omitted when nothing tells, e.g. for most titles in Latin letters of Japanese releases, which are as often English as romanized Japanese. See src/merge/languages.ts. */
	language?: string;
	/** The sources giving the title. Titles differing only in case, accents, punctuation, spacing or the place of the article are the same title, e.g. "Legend of Zelda, The - Link's Awakening" and "The Legend of Zelda: Link's Awakening". */
	sources: string[];
};

export type SourcedSerial = {
	serial: string;
	sources: string[];
	/** The sources' pages about the serial: game-boy-database.com's page of a label serial, sprintinglegs' page of a ROM chip. */
	pages?: string[];
	/** For a serial misprinted on real labels, the serial it should have been, e.g. "DMG-DT-USA" for DuckTales' "DMT-DT-USA". From raw-data-sources/corrections/misprinted-serials.json. */
	misprintOf?: string;
};

export type ReleaseDate = {
	/** Omitted for the few dates Wikipedia gives no region. */
	region?: Region;
	/** As exact as Wikipedia: "1989-06-14", "1989-08" or "1989". */
	date: string;
};

// Wikipedia's "PAL" and "EU" are Europe and Australia.
export type Region =
	"Japan" | "North America" | "Europe" | "Australia" | "Korea";

export type CartridgeFeature =
	| "rumble"
	| "realTimeClock"
	| "tiltSensor"
	| "infrared"
	/** Extras when played on a Game Boy Advance. */
	| "gameBoyAdvanceFeatures"
	/** Connects to Jaguar's JN-100 and JN-2000 sewing machines. */
	| "sewingMachine";

export type Image = {
	kind: ImageKind;
	url: string;
	source: string;
	/** For gbhwdb.gekkio.fi's photos: the page of the documented cartridge, with its manufacturing dates and chips. */
	page?: string;
};

export type ImageKind =
	"cartridgePhoto" | "box" | "boxArt" | "titleScreen" | "gameplay";

export type GameSystem = "dmg" | "cgb" | "agb";
