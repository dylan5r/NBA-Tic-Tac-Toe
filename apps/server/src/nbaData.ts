import fs from "fs";
import path from "path";
import readline from "readline";
import { buildPromptCatalog, type NbaPrompt, type PromptDifficulty, type PromptValidation } from "./nbaPrompts.js";

interface PlayerSeasonTotals {
  games: number;
  points: number;
  assists: number;
  rebounds: number;
  threePm: number;
  threePa: number;
}

interface PlayerFacts {
  key: string;
  name: string;
  personId: string | null;
  teams: Set<string>;
  teamNames: Set<string>;
  years: Set<number>;
  gameTypes: Set<string>;
  teammates: Set<string>;
  teamYears: Set<string>;
  seasons: Map<number, PlayerSeasonTotals>;
  maxPointsGame: number;
  draftYear?: number;
  draftRound?: number;
  draftNumber?: number;
  draftedBy?: string;
  flags: {
    champion?: boolean;
    mvp?: boolean;
    roty?: boolean;
    allStar?: boolean;
    finalsMvp?: boolean;
    dpoy?: boolean;
    sixthMan?: boolean;
    mip?: boolean;
    allNba?: boolean;
    olympicGold?: boolean;
    hof?: boolean;
    scoringChampion?: boolean;
    assistLeader?: boolean;
    reboundLeader?: boolean;
    championships?: number;
  };
}

interface NbaCachePayload {
  version: number;
  fingerprint: string;
  players: Array<{
    key: string;
    name: string;
    personId?: string | null;
    teams: string[];
    teamNames: string[];
    years: number[];
    gameTypes: string[];
    teammates: string[];
    teamYears: string[];
    seasons: Array<[number, PlayerSeasonTotals]>;
    maxPointsGame: number;
    draftYear?: number;
    draftRound?: number;
    draftNumber?: number;
    draftedBy?: string;
    flags: PlayerFacts["flags"];
  }>;
}

const CACHE_VERSION = 4;

export interface GeneratedPrompt {
  id: string;
  type: NbaPrompt["type"];
  category: NbaPrompt["category"];
  difficulty: PromptDifficulty;
  weight: number;
  text: string;
  validation: PromptValidation;
}

export interface PlayerSearchResult {
  key: string;
  name: string;
}

interface AnswerVerdict {
  ok: boolean;
  reason?: string;
  key?: string;
  canonical?: string;
  headshotUrl?: string | null;
}

const nbaHeadshotUrl = (personId: string | null | undefined): string | null => {
  const id = (personId ?? "").trim();
  if (!id) return null;
  if (!/^\d+$/.test(id)) return null;
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
};

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const normalizePersonKey = (value: string | undefined): string => {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return String(Math.trunc(numeric));
  return raw;
};

const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        cur += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
};


const teamNameToCode: Record<string, string> = {
  lakers: "LAL",
  celtics: "BOS",
  bulls: "CHI",
  warriors: "GSW",
  heat: "MIA",
  spurs: "SAS",
  mavericks: "DAL",
  suns: "PHX",
  knicks: "NYK",
  raptors: "TOR",
  nets: "BKN",
  nuggets: "DEN",
  thunder: "OKC",
  clippers: "LAC",
  rockets: "HOU",
  kings: "SAC",
  pistons: "DET",
  pacers: "IND",
  hawks: "ATL",
  magic: "ORL",
  timberwolves: "MIN",
  trailblazers: "POR",
  jazz: "UTA",
  hornets: "CHA",
  pelicans: "NOP",
  wizards: "WAS",
  grizzlies: "MEM",
  cavaliers: "CLE",
  "76ers": "PHI",
  bucks: "MIL",
  sixers: "PHI"
};

const mapCsvRow = (headers: string[], cols: string[]): Record<string, string> => {
  const row: Record<string, string> = {};
  for (let i = 0; i < headers.length; i += 1) {
    const raw = (headers[i] ?? "").trim();
    const value = cols[i] ?? "";
    const lower = raw.toLowerCase();
    const snake = lower.replace(/[\s-]+/g, "_");
    const camel = snake.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
    const compact = lower.replace(/[^a-z0-9]/g, "");
    for (const key of [raw, lower, snake, camel, compact]) {
      if (key && row[key] === undefined) row[key] = value;
    }
  }
  return row;
};

const legacyTeamCodeToModern: Record<string, string> = {
  NJN: "BKN",
  SEA: "OKC",
  NOH: "NOP",
  NOK: "NOP",
  CHH: "CHA",
  WSB: "WAS",
  VAN: "MEM"
};

const normalizeTeamCode = (value: string | undefined): string => {
  const raw = (value ?? "").trim().toUpperCase();
  if (!raw) return "";
  return legacyTeamCodeToModern[raw] ?? raw;
};

const curatedFlags: Record<string, PlayerFacts["flags"]> = {
  lebronjames: { champion: true, mvp: true, allStar: true, finalsMvp: true, allNba: true, olympicGold: true, scoringChampion: true, championships: 4 },
  michaeljordan: { champion: true, mvp: true, allStar: true, finalsMvp: true, dpoy: true, allNba: true, olympicGold: true, scoringChampion: true, championships: 6 },
  kobebryant: { champion: true, mvp: true, allStar: true, finalsMvp: true, allNba: true, olympicGold: true, scoringChampion: true, championships: 5 },
  timduncan: { champion: true, mvp: true, allStar: true, finalsMvp: true, allNba: true, championships: 5 },
  stephencurry: { champion: true, mvp: true, allStar: true, allNba: true, olympicGold: true, scoringChampion: true, championships: 4 },
  shaquilleoneal: { champion: true, mvp: true, allStar: true, finalsMvp: true, allNba: true, scoringChampion: true, championships: 4 },
  kevindurant: { champion: true, mvp: true, allStar: true, finalsMvp: true, allNba: true, scoringChampion: true, championships: 2 },
  dwyanewade: { champion: true, finalsMvp: true, allStar: true, allNba: true, championships: 3 },
  giannisantetokounmpo: { champion: true, mvp: true, dpoy: true, allStar: true, finalsMvp: true, allNba: true, championships: 1 },
  nikolajokic: { champion: true, mvp: true, allStar: true, finalsMvp: true, allNba: true, championships: 1 },
  magicjohnson: { champion: true, mvp: true, finalsMvp: true, allStar: true, allNba: true, championships: 5 },
  larrybird: { champion: true, mvp: true, finalsMvp: true, allStar: true, allNba: true, championships: 3 },
  karimabduljabbar: { champion: true, mvp: true, finalsMvp: true, allStar: true, allNba: true, scoringChampion: true, championships: 6 },
  dirknowitzki: { champion: true, mvp: true, allStar: true, finalsMvp: true, allNba: true, championships: 1 },
  kawhileonard: { champion: true, finalsMvp: true, dpoy: true, allStar: true, allNba: true, championships: 2 },
  alleniverson: { mvp: true, allStar: true, allNba: true, scoringChampion: true },
  russellwestbrook: { mvp: true, allStar: true, allNba: true, assistLeader: true },
  chrispaul: { allStar: true, allNba: true, assistLeader: true },
  jamesharden: { mvp: true, allStar: true, allNba: true, scoringChampion: true, assistLeader: true },
  dwighthoward: { champion: true, allStar: true, dpoy: true, allNba: true, reboundLeader: true, championships: 1 },
  dennisrodman: { champion: true, allStar: true, dpoy: true, reboundLeader: true, championships: 5 },
  manuginobili: { champion: true, allStar: true, sixthMan: true, championships: 4 },
  jamesworthy: { champion: true, finalsMvp: true, allStar: true, hof: true, championships: 3 }
};

const dataDirCandidates = (cwd: string) => [
  path.resolve(cwd, "../../nbadata"),
  path.resolve(cwd, "../nbadata"),
  path.resolve(cwd, "nbadata"),
  path.resolve(cwd, "../../nba_data"),
  path.resolve(cwd, "../nba_data"),
  path.resolve(cwd, "nba_data"),
  path.resolve(cwd, "../../nba_data/csv"),
  path.resolve(cwd, "../nba_data/csv"),
  path.resolve(cwd, "nba_data/csv"),
  path.resolve(cwd, "../../nba data"),
  path.resolve(cwd, "../nba data"),
  path.resolve(cwd, "nba data")
];

class NbaDataService {
  private static readonly MIN_CANDIDATES_PER_PROMPT = 5;
  private static readonly MIN_INTERSECTION_PER_CELL = 5;

  private players = new Map<string, PlayerFacts>();
  private byName = new Map<string, PlayerFacts>();
  private prompts: GeneratedPrompt[] = [];
  private promptById = new Map<string, GeneratedPrompt>();
  private candidatesByPrompt = new Map<string, Set<string>>();
  private recentCandidatesByPrompt = new Map<string, Set<string>>();
  private ready = false;
  private recentBoards: string[][] = [];
  private recentPromptIds: string[] = [];

  async init() {
    const cwd = process.cwd();
    const dataDir = dataDirCandidates(cwd).find((p) => fs.existsSync(p));
    if (!dataDir) {
      this.seedFallbackPlayers();
      this.buildPromptEngine();
      this.ready = true;
      return;
    }

    const rootDir = path.basename(dataDir).toLowerCase() === "csv" ? path.dirname(dataDir) : dataDir;

    const bbrefPerGamePath = this.firstExistingPath(rootDir, ["Player Per Game.csv"]);
    const bbrefSeasonInfoPath = this.firstExistingPath(rootDir, ["Player Season Info.csv"]);
    const bbrefCareerInfoPath = this.firstExistingPath(rootDir, ["Player Career Info.csv"]);
    const bbrefAllStarPath = this.firstExistingPath(rootDir, ["All-Star Selections.csv"]);
    const bbrefDraftPath = this.firstExistingPath(rootDir, ["Draft Pick History.csv"]);
    const bbrefAwardSharesPath = this.firstExistingPath(rootDir, ["Player Award Shares.csv"]);
    const bbrefAllNbaPath = this.firstExistingPath(rootDir, ["End of Season Teams.csv"]);
    const commonInfoForBbref = this.firstExistingPath(path.join(rootDir, "csv"), ["common_player_info.csv"]);

    if (bbrefPerGamePath && bbrefSeasonInfoPath && bbrefCareerInfoPath) {
      const sourceFiles = [
        bbrefPerGamePath,
        bbrefSeasonInfoPath,
        bbrefCareerInfoPath,
        bbrefAllStarPath,
        bbrefDraftPath,
        bbrefAwardSharesPath,
        bbrefAllNbaPath
      ].filter((x): x is string => Boolean(x));
      const cachePath = path.join(rootDir, ".nba-player-cache.bbref.v1.json");
      const fingerprint = this.computeFingerprint(sourceFiles);
      const restored = this.restoreFromCache(cachePath, fingerprint);
      if (restored) {
        if (commonInfoForBbref) {
          await this.augmentPersonIdsFromCommonInfo(commonInfoForBbref);
        }
        this.buildPromptEngine();
        this.ready = true;
        return;
      }

      await this.loadBbrefCareerInfo(bbrefCareerInfoPath);
      await this.loadBbrefSeasonInfo(bbrefSeasonInfoPath);
      await this.loadBbrefPerGame(bbrefPerGamePath);
      this.augmentMaxPointsFromLegacyCache(path.join(rootDir, "csv", ".nba-player-cache.v1.json"));
      if (bbrefDraftPath) await this.loadBbrefDraftHistory(bbrefDraftPath);
      if (bbrefAllStarPath) await this.loadBbrefAllStar(bbrefAllStarPath);
      if (bbrefAwardSharesPath) await this.loadBbrefAwardShares(bbrefAwardSharesPath);
      if (bbrefAllNbaPath) await this.loadBbrefEndSeasonTeams(bbrefAllNbaPath);
      if (commonInfoForBbref) await this.augmentPersonIdsFromCommonInfo(commonInfoForBbref);

      this.linkTeammatesFromTeamYears();
      this.attachCuratedFlags();
      this.writeCache(cachePath, fingerprint);
      this.buildPromptEngine();
      this.ready = true;
      return;
    }

    const playersPath = this.firstExistingPath(dataDir, ["Players.csv"]);
    const statsPath = this.firstExistingPath(dataDir, ["PlayerStatistics.csv", "PlayerStatisticsScoring.csv"]);
    const altPlayersPath = this.firstExistingPath(dataDir, ["player.csv"]);
    const commonInfoPath = this.firstExistingPath(dataDir, ["common_player_info.csv"]);
    const draftHistoryPath = this.firstExistingPath(dataDir, ["draft_history.csv"]);
    const gamePath = this.firstExistingPath(dataDir, ["game.csv"]);
    const playByPlayPath = this.firstExistingPath(dataDir, ["play_by_play.csv"]);

    if (playersPath && statsPath) {
      await this.loadPlayers(playersPath);
      await this.loadStats(statsPath);
      if (draftHistoryPath) {
        await this.loadDraftHistory(draftHistoryPath);
      }
      this.attachCuratedFlags();
      this.buildPromptEngine();
      this.ready = true;
      return;
    }

    if (altPlayersPath || commonInfoPath) {
      const sourceFiles = [altPlayersPath, commonInfoPath, draftHistoryPath, gamePath, playByPlayPath].filter(
        (x): x is string => Boolean(x)
      );
      const cachePath = path.join(dataDir, ".nba-player-cache.v1.json");
      const fingerprint = this.computeFingerprint(sourceFiles);
      const restored = this.restoreFromCache(cachePath, fingerprint);
      if (restored) {
        this.buildPromptEngine();
        this.ready = true;
        return;
      }

      if (altPlayersPath) {
        await this.loadSimplePlayers(altPlayersPath);
      }
      if (commonInfoPath) {
        await this.loadCommonPlayerInfo(commonInfoPath);
      }
      if (draftHistoryPath) {
        await this.loadDraftHistory(draftHistoryPath);
      }
      if (playByPlayPath) {
        const gameMetaById = gamePath ? await this.loadGameMeta(gamePath) : new Map<string, { seasonType: string; year?: number }>();
        await this.loadPlayByPlay(playByPlayPath, gameMetaById);
      }
      this.linkTeammatesFromTeamYears();
      this.attachCuratedFlags();
      this.writeCache(cachePath, fingerprint);
      this.buildPromptEngine();
      this.ready = true;
      return;
    }

    if (!playersPath || !statsPath) {
      this.seedFallbackPlayers();
      this.buildPromptEngine();
      this.ready = true;
      return;
    }

    await this.loadPlayers(playersPath);
    await this.loadStats(statsPath);
    this.attachCuratedFlags();
    this.buildPromptEngine();
    this.ready = true;
  }

  private firstExistingPath(baseDir: string, fileNames: string[]): string | null {
    for (const name of fileNames) {
      const full = path.join(baseDir, name);
      if (fs.existsSync(full)) return full;
    }
    return null;
  }

  private computeFingerprint(files: string[]): string {
    return files
      .map((file) => {
        try {
          const stat = fs.statSync(file);
          return `${file}|${stat.size}|${stat.mtimeMs}`;
        } catch {
          return `${file}|missing`;
        }
      })
      .join("||");
  }

  private restoreFromCache(cachePath: string, fingerprint: string): boolean {
    try {
      if (!fs.existsSync(cachePath)) return false;
      const raw = fs.readFileSync(cachePath, "utf8");
      const parsed = JSON.parse(raw) as NbaCachePayload;
      if (parsed.version !== CACHE_VERSION || parsed.fingerprint !== fingerprint || !Array.isArray(parsed.players)) return false;

      this.players.clear();
      this.byName.clear();

      for (const entry of parsed.players) {
        const p: PlayerFacts = {
          key: entry.key,
          name: entry.name,
          personId: entry.personId ?? null,
          teams: new Set(entry.teams),
          teamNames: new Set(entry.teamNames),
          years: new Set(entry.years),
          gameTypes: new Set(entry.gameTypes),
          teammates: new Set(entry.teammates),
          teamYears: new Set(entry.teamYears),
          seasons: new Map(entry.seasons),
          maxPointsGame: entry.maxPointsGame,
          draftYear: entry.draftYear,
          draftRound: entry.draftRound,
          draftNumber: entry.draftNumber,
          draftedBy: entry.draftedBy,
          flags: entry.flags ?? {}
        };
        this.players.set(p.key, p);
        this.byName.set(normalize(p.name), p);
      }
      return true;
    } catch {
      return false;
    }
  }

  private writeCache(cachePath: string, fingerprint: string) {
    try {
      const payload: NbaCachePayload = {
        version: CACHE_VERSION,
        fingerprint,
        players: [...this.players.values()].map((p) => ({
          key: p.key,
          name: p.name,
          personId: p.personId,
          teams: [...p.teams],
          teamNames: [...p.teamNames],
          years: [...p.years],
          gameTypes: [...p.gameTypes],
          teammates: [...p.teammates],
          teamYears: [...p.teamYears],
          seasons: [...p.seasons.entries()],
          maxPointsGame: p.maxPointsGame,
          draftYear: p.draftYear,
          draftRound: p.draftRound,
          draftNumber: p.draftNumber,
          draftedBy: p.draftedBy,
          flags: p.flags
        }))
      };
      fs.writeFileSync(cachePath, JSON.stringify(payload));
    } catch {
      // Cache is an optimization only; ignore write failures.
    }
  }

  private getOrCreatePlayer(key: string, fallbackName = ""): PlayerFacts {
    const existing = this.players.get(key);
    if (existing) {
      if (fallbackName && !existing.name) existing.name = fallbackName;
      return existing;
    }
    const created: PlayerFacts = {
      key,
      name: fallbackName,
      personId: null,
      teams: new Set<string>(),
      teamNames: new Set<string>(),
      years: new Set<number>(),
      gameTypes: new Set<string>(),
      teammates: new Set<string>(),
      teamYears: new Set<string>(),
      seasons: new Map<number, PlayerSeasonTotals>(),
      maxPointsGame: 0,
      flags: {}
    };
    this.players.set(key, created);
    if (fallbackName) this.byName.set(normalize(fallbackName), created);
    return created;
  }

  isReady() {
    return this.ready;
  }

  challengesForBoard(params: { cellCount: number; ranked: boolean }): GeneratedPrompt[] {
    const board = this.generateBalancedBoard(params.cellCount);
    this.trackBoard(board.map((p) => p.id));
    return board;
  }

  challengesForGrid(params: { size: 3 | 4; ranked: boolean }): { rows: GeneratedPrompt[]; cols: GeneratedPrompt[] } {
    const count = params.size;
    const { rows, cols } = this.generateBalancedGrid(count, NbaDataService.MIN_INTERSECTION_PER_CELL);
    const shuffledRows = this.shuffle(rows);
    const shuffledCols = this.shuffle(cols);
    this.trackBoard([...shuffledRows, ...shuffledCols].map((p) => p.id));
    return { rows: shuffledRows, cols: shuffledCols };
  }

  validateAnswer(answer: string, challenge: GeneratedPrompt, used: Set<string>): AnswerVerdict {
    if (!answer?.trim()) return { ok: false, reason: "Enter a player name." };
    const direct = this.byName.get(normalize(answer));
    if (!direct) return { ok: false, reason: "Player not found in NBA dataset." };
    if (used.has(direct.key)) return { ok: false, reason: "Player already used this match." };
    if (!this.matchesValidation(direct, challenge.validation)) {
      return { ok: false, reason: `Answer does not satisfy: ${challenge.text}` };
    }
    return { ok: true, key: direct.key, canonical: direct.name, headshotUrl: nbaHeadshotUrl(direct.personId ?? direct.key) };
  }

  validateAnswerAgainstMany(
    answer: string,
    challenges: GeneratedPrompt[],
    used: Set<string>
  ): AnswerVerdict {
    if (!answer?.trim()) return { ok: false, reason: "Enter a player name." };
    const direct = this.byName.get(normalize(answer));
    if (!direct) return { ok: false, reason: "Player not found in NBA dataset." };
    if (used.has(direct.key)) return { ok: false, reason: "Player already used this match." };
    for (const challenge of challenges) {
      if (!this.matchesValidation(direct, challenge.validation)) {
        return { ok: false, reason: `Answer does not satisfy: ${challenge.text}` };
      }
    }
    return { ok: true, key: direct.key, canonical: direct.name, headshotUrl: nbaHeadshotUrl(direct.personId ?? direct.key) };
  }

  validateAnswerByChallengeId(answer: string, challengeId: string, usedKeys: string[]) {
    const challenge = this.promptById.get(challengeId);
    if (!challenge) return { ok: false as const, reason: "Unknown challenge." };
    return this.validateAnswer(answer, challenge, new Set(usedKeys));
  }

  validateAnswerByChallengeIds(answer: string, challengeIds: string[], usedKeys: string[]) {
    const challenges = challengeIds
      .map((id) => this.promptById.get(id))
      .filter((x): x is GeneratedPrompt => Boolean(x));
    if (!challenges.length) return { ok: false as const, reason: "Unknown challenge." };
    return this.validateAnswerAgainstMany(answer, challenges, new Set(usedKeys));
  }

  sampleAnswerForChallenge(challengeId: string, usedKeys: string[]) {
    const set = this.candidatesByPrompt.get(challengeId);
    if (!set) return null;
    const available = [...set].filter((k) => !usedKeys.includes(k));
    if (!available.length) return null;
    const key = available[Math.floor(Math.random() * available.length)]!;
    const p = this.players.get(key);
    if (!p) return null;
    return { key, name: p.name, headshotUrl: nbaHeadshotUrl(p.personId ?? p.key) };
  }

  sampleAnswerForChallengeIds(challengeIds: string[], usedKeys: string[]) {
    const sets = challengeIds
      .map((id) => this.candidatesByPrompt.get(id))
      .filter((x): x is Set<string> => Boolean(x));
    if (!sets.length) return null;
    let intersection = new Set<string>(sets[0]);
    for (let i = 1; i < sets.length; i += 1) {
      intersection = new Set([...intersection].filter((k) => sets[i]!.has(k)));
      if (!intersection.size) break;
    }
    const available = [...intersection].filter((k) => !usedKeys.includes(k));
    if (!available.length) return null;
    const key = available[Math.floor(Math.random() * available.length)]!;
    const p = this.players.get(key);
    if (!p) return null;
    return { key, name: p.name, headshotUrl: nbaHeadshotUrl(p.personId ?? p.key) };
  }

  possibleAnswersForChallengeIds(challengeIds: string[], usedKeys: string[], limit = 200) {
    const sets = challengeIds
      .map((id) => this.candidatesByPrompt.get(id))
      .filter((x): x is Set<string> => Boolean(x));
    if (!sets.length) return [];
    let intersection = new Set<string>(sets[0]);
    for (let i = 1; i < sets.length; i += 1) {
      intersection = new Set([...intersection].filter((k) => sets[i]!.has(k)));
      if (!intersection.size) break;
    }

    const available = [...intersection]
      .filter((k) => !usedKeys.includes(k))
      .map((k) => this.players.get(k))
      .filter((x): x is PlayerFacts => Boolean(x))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, Math.max(1, limit));

    return available.map((p) => ({ key: p.key, name: p.name, headshotUrl: nbaHeadshotUrl(p.personId ?? p.key) }));
  }

  searchPlayers(query: string, limit = 8): PlayerSearchResult[] {
    const q = normalize(query);
    if (!q) return [];
    const scored = [...this.players.values()]
      .map((p) => {
        const n = normalize(p.name);
        let score = 0;
        if (n.startsWith(q)) score += 3;
        if (n.includes(q)) score += 1;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
      .slice(0, limit)
      .map((x) => ({ key: x.p.key, name: x.p.name }));
    return scored;
  }

  private generateBalancedBoard(cellCount: number): GeneratedPrompt[] {
    const pool = this.prompts.filter((p) => (this.candidatesByPrompt.get(p.id)?.size ?? 0) > 0);
    const recent = new Set(this.recentPromptIds);
    const avoidLastBoards = new Set(this.recentBoards.flat());
    const filtered = pool.filter((p) => !recent.has(p.id) && !avoidLastBoards.has(p.id));
    const source = filtered.length >= cellCount ? filtered : pool;

    for (let attempt = 0; attempt < 500; attempt += 1) {
      const selected: GeneratedPrompt[] = [];
      while (selected.length < cellCount) {
        const candidate = this.weightedPick(source);
        if (!candidate) break;
        if (selected.some((s) => s.id === candidate.id)) continue;
        if (!this.validCategoryBalance(candidate, selected, cellCount)) continue;
        if (!this.noConflict(candidate, selected, cellCount)) continue;
        if ((this.candidatesByPrompt.get(candidate.id)?.size ?? 0) === 0) continue;
        if (!this.intersectionHasPlayers(candidate, selected, cellCount)) continue;
        selected.push(candidate);
      }
      if (selected.length === cellCount && this.finalBoardChecks(selected, cellCount)) {
        return selected;
      }
    }

    return source
      .slice()
      .sort((a, b) => (this.candidatesByPrompt.get(b.id)?.size ?? 0) - (this.candidatesByPrompt.get(a.id)?.size ?? 0))
      .slice(0, cellCount);
  }

  private generateBalancedGrid(side: 3 | 4, minIntersection: number): { rows: GeneratedPrompt[]; cols: GeneratedPrompt[] } {
    const target = side * 2;
    const pool = this.prompts.filter((p) => (this.recentCandidatesByPrompt.get(p.id)?.size ?? 0) >= minIntersection);
    const recent = new Set(this.recentPromptIds);
    const avoidLastBoards = new Set(this.recentBoards.flat());
    const withoutRecent = pool.filter((p) => !recent.has(p.id) && !avoidLastBoards.has(p.id));
    const withoutLastBoards = pool.filter((p) => !avoidLastBoards.has(p.id));
    const source = withoutRecent.length >= target ? withoutRecent : withoutLastBoards.length >= target ? withoutLastBoards : pool;

    const deterministic = this.findCompatibleGrid(source, side, minIntersection);
    if (deterministic) return deterministic;

    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const selected: GeneratedPrompt[] = [];
      while (selected.length < target) {
        const candidate = this.weightedPick(source);
        if (!candidate) break;
        if (selected.some((s) => s.id === candidate.id)) continue;
        const usedKinds = new Set(selected.map((p) => this.promptArchetype(p)));
        if (!this.allowsDuplicateArchetype(candidate) && usedKinds.has(this.promptArchetype(candidate))) continue;
        selected.push(candidate);
      }
      if (selected.length !== target) continue;
      const rows = selected.slice(0, side);
      const cols = selected.slice(side, target);
      if (this.gridMeetsMinimumIntersections(rows, cols, minIntersection) && this.gridHasUniquePromptArchetypes(rows, cols)) return { rows, cols };
    }

    const byPopulation = source
      .slice()
      .sort((a, b) => (this.recentCandidatesByPrompt.get(b.id)?.size ?? 0) - (this.recentCandidatesByPrompt.get(a.id)?.size ?? 0));

    for (let attempt = 0; attempt < 300; attempt += 1) {
      const rows = this.shuffle(byPopulation).slice(0, side);
      if (rows.length !== side) continue;
      if (!this.lineHasUniqueRequiredArchetypes(rows)) continue;
      const cols: GeneratedPrompt[] = [];
      const usedKinds = new Set(
        rows.filter((p) => !this.allowsDuplicateArchetype(p)).map((p) => this.promptArchetype(p))
      );
      for (const candidate of byPopulation) {
        if (rows.some((r) => r.id === candidate.id) || cols.some((c) => c.id === candidate.id)) continue;
        const kind = this.promptArchetype(candidate);
        if (!this.allowsDuplicateArchetype(candidate) && usedKinds.has(kind)) continue;
        if (!rows.every((r) => this.intersectionRecentSize(r.id, candidate.id) >= minIntersection)) continue;
        cols.push(candidate);
        if (!this.allowsDuplicateArchetype(candidate)) usedKinds.add(kind);
        if (cols.length === side) break;
      }
      if (cols.length === side && this.gridMeetsMinimumIntersections(rows, cols, minIntersection) && this.gridHasUniquePromptArchetypes(rows, cols)) {
        return { rows, cols };
      }
    }

    const strict = this.generateStrictGridFromTop(side, byPopulation, minIntersection);
    if (strict) return strict;

    for (let retry = 0; retry < 500; retry += 1) {
      const shuffled = this.shuffle(byPopulation);
      const rows = shuffled.slice(0, side);
      if (rows.length !== side) continue;
      if (!this.lineHasUniqueRequiredArchetypes(rows)) continue;
      const cols: GeneratedPrompt[] = [];
      const usedKinds = new Set(
        rows.filter((p) => !this.allowsDuplicateArchetype(p)).map((p) => this.promptArchetype(p))
      );
      for (const candidate of shuffled) {
        if (rows.some((r) => r.id === candidate.id) || cols.some((c) => c.id === candidate.id)) continue;
        const kind = this.promptArchetype(candidate);
        if (!this.allowsDuplicateArchetype(candidate) && usedKinds.has(kind)) continue;
        if (!rows.every((r) => this.intersectionRecentSize(r.id, candidate.id) >= minIntersection)) continue;
        cols.push(candidate);
        if (!this.allowsDuplicateArchetype(candidate)) usedKinds.add(kind);
        if (cols.length === side) break;
      }
      if (cols.length === side && this.gridMeetsMinimumIntersections(rows, cols, minIntersection) && this.gridHasUniquePromptArchetypes(rows, cols)) {
        return { rows, cols };
      }
    }

    throw new Error("Unable to generate a valid challenge grid with required intersections.");
  }

  private findCompatibleGrid(
    source: GeneratedPrompt[],
    side: 3 | 4,
    minIntersection: number
  ): { rows: GeneratedPrompt[]; cols: GeneratedPrompt[] } | null {
    if (source.length < side * 2) return null;
    const ids = source.map((p) => p.id);
    const byId = new Map(source.map((p) => [p.id, p]));
    const pop = (id: string) => this.recentCandidatesByPrompt.get(id)?.size ?? 0;

    const compatibility = new Map<string, Set<string>>();
    for (const a of ids) {
      const set = new Set<string>();
      for (const b of ids) {
        if (a === b) continue;
        if (this.intersectionRecentSize(a, b) >= minIntersection) set.add(b);
      }
      compatibility.set(a, set);
    }

    // Keep strong prompts preferred, but inject jitter so boards vary across games.
    const rowPriority = new Map<string, number>(
      ids.map((id) => [id, pop(id) + Math.random() * 6])
    );
    const ordered = ids.slice().sort((a, b) => (rowPriority.get(b) ?? 0) - (rowPriority.get(a) ?? 0));

    const solutions: Array<{ rows: GeneratedPrompt[]; cols: GeneratedPrompt[] }> = [];
    const maxSolutions = 12;

    const recurse = (
      startIndex: number,
      rowIds: string[],
      colCandidates: Set<string>
    ): boolean => {
      if (rowIds.length === side) {
        const rowPrompts = rowIds.map((id) => byId.get(id)).filter((x): x is GeneratedPrompt => Boolean(x));
        if (rowPrompts.length !== side) return false;
        const usedKinds = new Set(
          rowPrompts.filter((p) => !this.allowsDuplicateArchetype(p)).map((p) => this.promptArchetype(p))
        );
        const colPriority = new Map<string, number>(
          [...colCandidates].map((id) => [id, pop(id) + Math.random() * 6])
        );
        const cols: GeneratedPrompt[] = [];
        const orderedCols = [...colCandidates]
          .filter((id) => !rowIds.includes(id))
          .sort((a, b) => (colPriority.get(b) ?? 0) - (colPriority.get(a) ?? 0));
        for (const id of orderedCols) {
          const prompt = byId.get(id);
          if (!prompt) continue;
          const kind = this.promptArchetype(prompt);
          if (!this.allowsDuplicateArchetype(prompt) && usedKinds.has(kind)) continue;
          cols.push(prompt);
          if (!this.allowsDuplicateArchetype(prompt)) usedKinds.add(kind);
          if (cols.length === side) break;
        }
        if (cols.length !== side) return false;
        if (this.gridMeetsMinimumIntersections(rowPrompts, cols, minIntersection) && this.gridHasUniquePromptArchetypes(rowPrompts, cols)) {
          solutions.push({ rows: rowPrompts, cols });
          return solutions.length >= maxSolutions;
        }
        return false;
      }

      for (let i = startIndex; i < ordered.length; i += 1) {
        const candidateId = ordered[i]!;
        if (rowIds.includes(candidateId)) continue;
        const compat = compatibility.get(candidateId) ?? new Set<string>();
        const nextCols = new Set<string>([...colCandidates].filter((id) => compat.has(id) && !rowIds.includes(id) && id !== candidateId));
        if (nextCols.size < side) continue;
        const shouldStop = recurse(i + 1, [...rowIds, candidateId], nextCols);
        if (shouldStop) return true;
      }

      return false;
    };

    recurse(0, [], new Set(ids));
    if (!solutions.length) return null;
    return solutions[Math.floor(Math.random() * solutions.length)] ?? null;
  }

  private generateStrictGridFromTop(
    side: 3 | 4,
    sortedPrompts: GeneratedPrompt[],
    minIntersection: number
  ): { rows: GeneratedPrompt[]; cols: GeneratedPrompt[] } | null {
    const maxRowsPool = side === 3 ? 60 : 40;
    const rowsPool = sortedPrompts.slice(0, Math.min(maxRowsPool, sortedPrompts.length));

    const buildCols = (rows: GeneratedPrompt[]): GeneratedPrompt[] | null => {
      const cols: GeneratedPrompt[] = [];
      const usedKinds = new Set(
        rows.filter((p) => !this.allowsDuplicateArchetype(p)).map((p) => this.promptArchetype(p))
      );
      for (const candidate of sortedPrompts) {
        if (rows.some((r) => r.id === candidate.id) || cols.some((c) => c.id === candidate.id)) continue;
        const kind = this.promptArchetype(candidate);
        if (!this.allowsDuplicateArchetype(candidate) && usedKinds.has(kind)) continue;
        if (!rows.every((r) => this.intersectionRecentSize(r.id, candidate.id) >= minIntersection)) continue;
        cols.push(candidate);
        if (!this.allowsDuplicateArchetype(candidate)) usedKinds.add(kind);
        if (cols.length === side) return cols;
      }
      return null;
    };

    if (side === 3) {
      for (let a = 0; a < rowsPool.length; a += 1) {
        for (let b = a + 1; b < rowsPool.length; b += 1) {
          for (let c = b + 1; c < rowsPool.length; c += 1) {
            const rows = [rowsPool[a]!, rowsPool[b]!, rowsPool[c]!];
            if (!this.lineHasUniqueRequiredArchetypes(rows)) continue;
            const cols = buildCols(rows);
            if (cols && this.gridMeetsMinimumIntersections(rows, cols, minIntersection) && this.gridHasUniquePromptArchetypes(rows, cols)) return { rows, cols };
          }
        }
      }
      return null;
    }

    for (let a = 0; a < rowsPool.length; a += 1) {
      for (let b = a + 1; b < rowsPool.length; b += 1) {
        for (let c = b + 1; c < rowsPool.length; c += 1) {
          for (let d = c + 1; d < rowsPool.length; d += 1) {
            const rows = [rowsPool[a]!, rowsPool[b]!, rowsPool[c]!, rowsPool[d]!];
            if (!this.lineHasUniqueRequiredArchetypes(rows)) continue;
            const cols = buildCols(rows);
            if (cols && this.gridMeetsMinimumIntersections(rows, cols, minIntersection) && this.gridHasUniquePromptArchetypes(rows, cols)) return { rows, cols };
          }
        }
      }
    }
    return null;
  }

  private gridMeetsMinimumIntersections(rows: GeneratedPrompt[], cols: GeneratedPrompt[], minIntersection: number): boolean {
    if (!rows.length || !cols.length) return false;
    for (const row of rows) {
      for (const col of cols) {
        if (this.intersectionRecentSize(row.id, col.id) < minIntersection) return false;
      }
    }
    return true;
  }

  private gridHasUniquePromptArchetypes(rows: GeneratedPrompt[], cols: GeneratedPrompt[]): boolean {
    const prompts = [...rows, ...cols].filter((p) => !this.allowsDuplicateArchetype(p));
    const kinds = prompts.map((p) => this.promptArchetype(p));
    return new Set(kinds).size === kinds.length;
  }

  private lineHasUniqueRequiredArchetypes(prompts: GeneratedPrompt[]): boolean {
    const required = prompts.filter((p) => !this.allowsDuplicateArchetype(p));
    const kinds = required.map((p) => this.promptArchetype(p));
    return new Set(kinds).size === kinds.length;
  }

  private allowsDuplicateArchetype(prompt: GeneratedPrompt): boolean {
    if (prompt.type !== "team") return false;
    const keys = Object.keys(prompt.validation).filter((k) => (prompt.validation as Record<string, unknown>)[k] !== undefined);
    return keys.length === 1 && keys[0] === "team";
  }

  private promptArchetype(prompt: GeneratedPrompt): string {
    const v = prompt.validation;
    const keys = Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort();
    return `${prompt.type}:${keys.join("|")}`;
  }

  private intersectionRecentSize(aId: string, bId: string): number {
    const a = this.recentCandidatesByPrompt.get(aId);
    const b = this.recentCandidatesByPrompt.get(bId);
    if (!a || !b) return 0;
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    let count = 0;
    for (const key of small) {
      if (big.has(key)) count += 1;
    }
    return count;
  }

  private intersectionSize(aId: string, bId: string): number {
    const a = this.candidatesByPrompt.get(aId);
    const b = this.candidatesByPrompt.get(bId);
    if (!a || !b) return 0;
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    let count = 0;
    for (const key of small) {
      if (big.has(key)) count += 1;
    }
    return count;
  }

  private shuffle<T>(arr: T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  private weightedPick(pool: GeneratedPrompt[]): GeneratedPrompt | null {
    const weighted = pool.map((p) => ({ p, w: Math.max(1, p.weight) }));
    const total = weighted.reduce((sum, i) => sum + i.w, 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const item of weighted) {
      r -= item.w;
      if (r <= 0) return item.p;
    }
    return weighted[weighted.length - 1]?.p ?? null;
  }

  private validCategoryBalance(candidate: GeneratedPrompt, selected: GeneratedPrompt[], cellCount: number): boolean {
    const counts = new Map<string, number>();
    for (const s of selected) counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
    const nextCount = (counts.get(candidate.category) ?? 0) + 1;
    if (nextCount > 3) return false;
    const teamOnly = selected.filter((s) => s.category === "team").length + (candidate.category === "team" ? 1 : 0);
    if (teamOnly > 2) return false;

    const remaining = cellCount - (selected.length + 1);
    const statCount = selected.filter((s) => s.category === "stat").length + (candidate.category === "stat" ? 1 : 0);
    if (statCount + remaining < 2) return false;
    return true;
  }

  private noConflict(candidate: GeneratedPrompt, selected: GeneratedPrompt[], cellCount: number): boolean {
    const side = Math.sqrt(cellCount);
    if (!Number.isInteger(side)) return true;
    const idx = selected.length;
    const row = Math.floor(idx / side);
    const col = idx % side;
    const rowPrompts = selected.slice(row * side, row * side + side);
    const colPrompts = selected.filter((_, i) => i % side === col);

    const candidateTeam = candidate.validation.team;
    if (candidateTeam) {
      if (rowPrompts.some((p) => p.validation.team === candidateTeam)) return false;
    }

    const catInRow = rowPrompts.filter((p) => p.category === candidate.category).length;
    if (catInRow >= 2) return false;
    const catInCol = colPrompts.filter((p) => p.category === candidate.category).length;
    if (catInCol >= 2) return false;
    return true;
  }

  private intersectionHasPlayers(candidate: GeneratedPrompt, selected: GeneratedPrompt[], cellCount: number): boolean {
    const side = Math.sqrt(cellCount);
    if (!Number.isInteger(side)) return true;
    const idx = selected.length;
    const row = Math.floor(idx / side);
    const col = idx % side;
    const rowPrompts = [...selected.slice(row * side, row * side + side), candidate];
    const colPrompts = [...selected.filter((_, i) => i % side === col), candidate];
    if (rowPrompts.length === side && !this.lineHasSharedCandidate(rowPrompts)) return false;
    if (colPrompts.length === side && !this.lineHasSharedCandidate(colPrompts)) return false;
    return true;
  }

  private lineHasSharedCandidate(prompts: GeneratedPrompt[]): boolean {
    let running: Set<string> | null = null;
    for (const p of prompts) {
      const c = this.candidatesByPrompt.get(p.id) ?? new Set<string>();
      if (!running) {
        running = new Set(c);
      } else {
        const current: string[] = Array.from((running as Set<string>).values());
        running = new Set(current.filter((x: string) => c.has(x)));
      }
      if (!running.size) return false;
    }
    return (running?.size ?? 0) > 0;
  }

  private finalBoardChecks(board: GeneratedPrompt[], cellCount: number) {
    const statCount = board.filter((p) => p.category === "stat").length;
    if (statCount < 2) return false;
    const side = Math.sqrt(cellCount);
    if (!Number.isInteger(side)) return true;
    for (let r = 0; r < side; r += 1) {
      const row = board.slice(r * side, r * side + side);
      const teams = row.map((p) => p.validation.team).filter(Boolean) as string[];
      if (new Set(teams).size !== teams.length) return false;
    }
    return true;
  }

  private trackBoard(promptIds: string[]) {
    this.recentBoards.unshift(promptIds);
    this.recentBoards = this.recentBoards.slice(0, 5);
    this.recentPromptIds = [...promptIds, ...this.recentPromptIds].slice(0, 20 * 9);
  }

  private buildPromptEngine() {
    this.prompts = buildPromptCatalog();
    this.promptById = new Map(this.prompts.map((p) => [p.id, p]));
    this.candidatesByPrompt.clear();
    this.recentCandidatesByPrompt.clear();
    for (const p of this.prompts) {
      const matches = new Set<string>();
      const recentMatches = new Set<string>();
      for (const facts of this.players.values()) {
        if (this.matchesValidation(facts, p.validation)) {
          matches.add(facts.key);
          if (this.isRecentPlayer(facts)) recentMatches.add(facts.key);
        }
      }
      this.candidatesByPrompt.set(p.id, matches);
      this.recentCandidatesByPrompt.set(p.id, recentMatches);
    }
    this.prompts = this.prompts.filter(
      (p) => (this.recentCandidatesByPrompt.get(p.id)?.size ?? 0) >= NbaDataService.MIN_CANDIDATES_PER_PROMPT
    );
    this.promptById = new Map(this.prompts.map((p) => [p.id, p]));
    const allowed = new Set(this.prompts.map((p) => p.id));
    for (const id of [...this.candidatesByPrompt.keys()]) {
      if (!allowed.has(id)) this.candidatesByPrompt.delete(id);
    }
    for (const id of [...this.recentCandidatesByPrompt.keys()]) {
      if (!allowed.has(id)) this.recentCandidatesByPrompt.delete(id);
    }
  }

  private isRecentPlayer(facts: PlayerFacts): boolean {
    const currentYear = new Date().getUTCFullYear();
    const recentCutoffYear = currentYear - 5;
    return [...facts.years].some((y) => y >= recentCutoffYear);
  }

  private matchesValidation(facts: PlayerFacts, validation: PromptValidation): boolean {
    const seasonEntries = [...facts.seasons.values()];
    const maxPointsGame = facts.maxPointsGame;
    const bestPpg = seasonEntries.length ? Math.max(...seasonEntries.map((s) => s.points / Math.max(1, s.games))) : 0;
    const bestApg = seasonEntries.length ? Math.max(...seasonEntries.map((s) => s.assists / Math.max(1, s.games))) : 0;
    const bestRpg = seasonEntries.length ? Math.max(...seasonEntries.map((s) => s.rebounds / Math.max(1, s.games))) : 0;
    const best3PtPct = seasonEntries.length
      ? Math.max(...seasonEntries.map((s) => (s.threePa > 0 ? s.threePm / s.threePa : 0)))
      : 0;
    const careerGames = seasonEntries.reduce((a, s) => a + s.games, 0);
    const careerPoints = seasonEntries.reduce((a, s) => a + s.points, 0);
    const careerPpg = careerGames > 0 ? careerPoints / careerGames : 0;

    if (validation.team && !facts.teams.has(validation.team)) return false;
    if (validation.teamsAll && !validation.teamsAll.every((t) => facts.teams.has(t))) return false;
    if (validation.teammate && !facts.teammates.has(normalize(validation.teammate))) return false;
    if (validation.teammatesAll && !validation.teammatesAll.every((t) => facts.teammates.has(normalize(t)))) return false;
    if (validation.ppg_season !== undefined && bestPpg < validation.ppg_season) return false;
    if (validation.apg_season !== undefined && bestApg < validation.apg_season) return false;
    if (validation.rpg_season !== undefined && bestRpg < validation.rpg_season) return false;
    if (validation.threept_pct_season !== undefined && best3PtPct < validation.threept_pct_season) return false;
    if (validation.points_game !== undefined && maxPointsGame < validation.points_game) return false;
    if (validation.seasons_gte !== undefined && facts.years.size < validation.seasons_gte) return false;
    if (validation.draft_overall_eq !== undefined && facts.draftNumber !== validation.draft_overall_eq) return false;
    if (validation.draft_overall_lte !== undefined && (!facts.draftNumber || facts.draftNumber > validation.draft_overall_lte)) return false;
    if (validation.draft_round_eq !== undefined && facts.draftRound !== validation.draft_round_eq) return false;
    if (validation.undrafted && Boolean(facts.draftNumber)) return false;
    if (validation.drafted_year !== undefined && facts.draftYear !== validation.drafted_year) return false;
    if (validation.drafted_by && facts.draftedBy !== validation.drafted_by) return false;
    if (validation.finals && !facts.gameTypes.has("Playoffs")) return false;
    if (validation.one_franchise && facts.teams.size !== 1) return false;
    if (validation.franchises_gte !== undefined && facts.teams.size < validation.franchises_gte) return false;
    if (validation.career_ppg_gte !== undefined && careerPpg < validation.career_ppg_gte) return false;
    if (validation.championships_gte !== undefined && (facts.flags.championships ?? 0) < validation.championships_gte) return false;
    if (validation.champion && !facts.flags.champion) return false;
    if (validation.mvp && !facts.flags.mvp) return false;
    if (validation.roty && !facts.flags.roty) return false;
    if (validation.all_star && !facts.flags.allStar) return false;
    if (validation.finals_mvp && !facts.flags.finalsMvp) return false;
    if (validation.dpoy && !facts.flags.dpoy) return false;
    if (validation.sixth_man && !facts.flags.sixthMan) return false;
    if (validation.mip && !facts.flags.mip) return false;
    if (validation.all_nba && !facts.flags.allNba) return false;
    if (validation.olympic_gold && !facts.flags.olympicGold) return false;
    if (validation.hof && !facts.flags.hof) return false;
    if (validation.scoring_champion && !facts.flags.scoringChampion) return false;
    if (validation.assist_leader && !facts.flags.assistLeader) return false;
    if (validation.rebound_leader && !facts.flags.reboundLeader) return false;
    if (validation.never_mvp && facts.flags.mvp) return false;
    if (validation.never_all_star && facts.flags.allStar) return false;
    if (validation.never_champion && facts.flags.champion) return false;
    if (validation.never_all_nba && facts.flags.allNba) return false;
    return true;
  }

  private seedFallbackPlayers() {
    const seed = [
      { key: "lbj", name: "LeBron James", teams: ["LAL", "MIA", "CLE"], years: [2004, 2012, 2020], draftYear: 2003, draftRound: 1, draftNumber: 1, flags: curatedFlags.lebronjames },
      { key: "mj", name: "Michael Jordan", teams: ["CHI", "WAS"], years: [1985, 1996, 2002], draftYear: 1984, draftRound: 1, draftNumber: 3, flags: curatedFlags.michaeljordan },
      { key: "td", name: "Tim Duncan", teams: ["SAS"], years: [1998, 2003, 2014], draftYear: 1997, draftRound: 1, draftNumber: 1, flags: curatedFlags.timduncan }
    ];
    for (const s of seed) {
      const p: PlayerFacts = {
        key: s.key,
        name: s.name,
        personId: null,
        teams: new Set(s.teams),
        teamNames: new Set(),
        years: new Set(s.years),
        gameTypes: new Set(["Regular Season", "Playoffs", "All-Star Game"]),
        teammates: new Set(),
        teamYears: new Set(),
        seasons: new Map<number, PlayerSeasonTotals>([
          [2020, { games: 70, points: 1750, assists: 700, rebounds: 560, threePm: 120, threePa: 350 }]
        ]),
        maxPointsGame: 60,
        draftYear: s.draftYear,
        draftRound: s.draftRound,
        draftNumber: s.draftNumber,
        draftedBy: s.teams[0],
        flags: { ...s.flags }
      };
      this.players.set(p.key, p);
      this.byName.set(normalize(p.name), p);
    }
    this.linkTeammatesFromTeamYears();
  }

  private async loadPlayers(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      const full = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
      if (!full) continue;
      const key = normalizePersonKey(row.personId) || normalize(full);
      const p = this.getOrCreatePlayer(key, full);
      p.name = full;
      p.personId = /^\d+$/.test(key) ? key : p.personId;
      const draftYear = Number(row.draftYear);
      const draftRound = Number(row.draftRound);
      const draftNumber = Number(row.draftNumber);
      if (Number.isFinite(draftYear) && draftYear > 0) p.draftYear = draftYear;
      if (Number.isFinite(draftRound) && draftRound > 0) p.draftRound = draftRound;
      if (Number.isFinite(draftNumber) && draftNumber > 0) p.draftNumber = draftNumber;
      this.players.set(key, p);
      this.byName.set(normalize(full), p);
    }
  }

  private async loadStats(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      const key = normalizePersonKey(row.personId) || normalize(`${row.firstName ?? ""} ${row.lastName ?? ""}`);
      const full = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
      if (!key || !full) continue;
      const p = this.getOrCreatePlayer(key, full);
      p.name = full;
      p.personId = /^\d+$/.test(key) ? key : p.personId;

      const teamCode = normalizeTeamCode(
        (row.teamAbbreviation ?? teamNameToCode[normalize(row.playerteamName ?? row.teamName ?? "")] ?? "").trim().toUpperCase()
      );
      const teamName = (row.playerteamName ?? row.teamName ?? "").trim();
      if (teamCode) p.teams.add(teamCode);
      if (teamName) p.teamNames.add(teamName);

      const gameType = (row.gameType ?? "").trim();
      if (gameType) p.gameTypes.add(gameType);
      if (gameType === "All-Star Game") p.flags.allStar = true;

      const date = new Date(row.gameDateTimeEst ?? row.gameDate ?? "");
      const year = Number.isNaN(date.getTime()) ? NaN : date.getUTCFullYear();
      if (Number.isFinite(year)) p.years.add(year);
      if (teamCode && Number.isFinite(year)) p.teamYears.add(`${teamCode}|${year}`);

      const points = Number(row.points ?? 0);
      const assists = Number(row.assists ?? 0);
      const rebounds = Number(row.reboundsTotal ?? 0);
      const threePa = Number(row.threePointersAttempted ?? 0);
      const threePm = Number(row.threePointersMade ?? 0);
      if (Number.isFinite(year)) {
        const season = p.seasons.get(year) ?? { games: 0, points: 0, assists: 0, rebounds: 0, threePm: 0, threePa: 0 };
        season.games += 1;
        season.points += Number.isFinite(points) ? points : 0;
        season.assists += Number.isFinite(assists) ? assists : 0;
        season.rebounds += Number.isFinite(rebounds) ? rebounds : 0;
        season.threePa += Number.isFinite(threePa) ? threePa : 0;
        season.threePm += Number.isFinite(threePm) ? threePm : 0;
        p.seasons.set(year, season);
      }
      if (Number.isFinite(points)) {
        p.maxPointsGame = Math.max(p.maxPointsGame, points);
      }

      if (!p.draftedBy && p.teamYears.size) {
        const earliest = [...p.teamYears].sort()[0];
        if (earliest) p.draftedBy = earliest.split("|")[0];
      }

      this.players.set(key, p);
      this.byName.set(normalize(full), p);
    }
    this.linkTeammatesFromTeamYears();
  }

  private async loadSimplePlayers(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row = mapCsvRow(headers, cols);
      const full = (row.full_name ?? `${row.first_name ?? ""} ${row.last_name ?? ""}`).trim();
      if (!full) continue;
      const key = normalizePersonKey(row.id) || normalize(full);
      const p = this.getOrCreatePlayer(key, full);
      p.name = full;
      p.personId = /^\d+$/.test(key) ? key : p.personId;
      this.players.set(key, p);
      this.byName.set(normalize(full), p);
    }
  }

  private async loadCommonPlayerInfo(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row = mapCsvRow(headers, cols);

      const full = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || (row.display_first_last ?? "").trim();
      if (!full) continue;
      const key = normalizePersonKey(row.person_id) || normalize(full);
      const p = this.getOrCreatePlayer(key, full);
      p.name = full;
      p.personId = /^\d+$/.test(key) ? key : p.personId;

      const draftYear = Number.parseInt((row.draft_year ?? "").split(".")[0] ?? "", 10);
      const draftRound = Number.parseInt((row.draft_round ?? "").split(".")[0] ?? "", 10);
      const draftNumber = Number.parseInt((row.draft_number ?? "").split(".")[0] ?? "", 10);
      if (Number.isFinite(draftYear) && draftYear > 0) p.draftYear = draftYear;
      if (Number.isFinite(draftRound) && draftRound > 0) p.draftRound = draftRound;
      if (Number.isFinite(draftNumber) && draftNumber > 0) p.draftNumber = draftNumber;

      const modernTeamCode = normalizeTeamCode(row.team_abbreviation ?? "");
      if (modernTeamCode) p.teams.add(modernTeamCode);
      const teamName = (row.team_name ?? "").trim();
      if (teamName) p.teamNames.add(teamName);
      if (!p.draftedBy && modernTeamCode) p.draftedBy = modernTeamCode;

      const fromYear = Number.parseInt((row.from_year ?? "").split(".")[0] ?? "", 10);
      const toYear = Number.parseInt((row.to_year ?? "").split(".")[0] ?? "", 10);
      if (Number.isFinite(fromYear) && Number.isFinite(toYear) && fromYear > 0 && toYear >= fromYear) {
        for (let year = fromYear; year <= toYear; year += 1) {
          p.years.add(year);
          if (modernTeamCode) p.teamYears.add(`${modernTeamCode}|${year}`);
        }
      }

      this.players.set(key, p);
      this.byName.set(normalize(full), p);
    }
  }

  private async loadDraftHistory(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row = mapCsvRow(headers, cols);

      const key = normalizePersonKey(row.person_id);
      const full = (row.player_name ?? "").trim();
      if (!key || !full) continue;
      const p = this.getOrCreatePlayer(key, full);
      p.name = full;
      p.personId = /^\d+$/.test(key) ? key : p.personId;

      const draftYear = Number.parseInt(row.season ?? "", 10);
      const draftRound = Number.parseInt(row.round_number ?? "", 10);
      const draftNumber = Number.parseInt(row.overall_pick ?? "", 10);
      if (Number.isFinite(draftYear) && draftYear > 0) p.draftYear = draftYear;
      if (Number.isFinite(draftRound) && draftRound > 0) p.draftRound = draftRound;
      if (Number.isFinite(draftNumber) && draftNumber > 0) p.draftNumber = draftNumber;

      const draftedBy = normalizeTeamCode(row.team_abbreviation ?? "");
      if (draftedBy) p.draftedBy = draftedBy;
      this.byName.set(normalize(full), p);
    }
  }

  private async augmentPersonIdsFromCommonInfo(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row = mapCsvRow(headers, cols);
      const personId = normalizePersonKey(row.person_id ?? row.personId);
      if (!/^\d+$/.test(personId)) continue;
      const full =
        `${row.first_name ?? row.firstName ?? ""} ${row.last_name ?? row.lastName ?? ""}`.trim() ||
        (row.display_first_last ?? row.displayFirstLast ?? "").trim();
      if (!full) continue;
      const byName = this.byName.get(normalize(full));
      if (byName) {
        byName.personId = personId;
      }
    }
  }

  private async loadGameMeta(filePath: string): Promise<Map<string, { seasonType: string; year?: number }>> {
    const map = new Map<string, { seasonType: string; year?: number }>();
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row = mapCsvRow(headers, cols);
      const gameId = (row.game_id ?? "").trim();
      if (!gameId) continue;
      const seasonType = (row.season_type ?? "").trim() || "Regular Season";
      const date = new Date(row.game_date ?? "");
      const year = Number.isNaN(date.getTime()) ? undefined : date.getUTCFullYear();
      if (!map.has(gameId)) map.set(gameId, { seasonType, year });
    }
    return map;
  }

  private isThreePointerMade(row: Record<string, string>): boolean {
    const text = `${row.homedescription ?? ""} ${row.visitordescription ?? ""}`.toUpperCase();
    return text.includes("3PT");
  }

  private isMissEvent(row: Record<string, string>): boolean {
    const text = `${row.homedescription ?? ""} ${row.visitordescription ?? ""} ${row.neutraldescription ?? ""}`.toUpperCase();
    return text.includes("MISS");
  }

  private async loadPlayByPlay(playByPlayPath: string, gameMetaById: Map<string, { seasonType: string; year?: number }>) {
    const file = readline.createInterface({ input: fs.createReadStream(playByPlayPath) });
    let headers: string[] = [];
    const seenGamesByPlayerSeason = new Set<string>();
    const pointsByPlayerGame = new Map<string, number>();
    const seenEvents = new Set<string>();

    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row = mapCsvRow(headers, cols);

      const eventType = Number.parseInt(row.eventmsgtype ?? "", 10);
      const gameId = (row.game_id ?? "").trim();
      if (!gameId || !Number.isFinite(eventType)) continue;
      const eventNum = Number.parseInt(row.eventnum ?? "", 10);
      if (Number.isFinite(eventNum)) {
        const eventKey = `${gameId}|${eventNum}`;
        if (seenEvents.has(eventKey)) continue;
        seenEvents.add(eventKey);
      }

      const meta = gameMetaById.get(gameId);
      const year = meta?.year;
      const seasonType = meta?.seasonType ?? "Regular Season";
      const isTrackedNbaGame = seasonType === "Regular Season" || seasonType === "Playoffs";

      const player1Key = normalizePersonKey(row.player1_id ?? "");
      const player2Key = normalizePersonKey(row.player2_id ?? "");
      const player1Name = (row.player1_name ?? "").trim();
      const player2Name = (row.player2_name ?? "").trim();
      const player1Team = normalizeTeamCode(row.player1_team_abbreviation ?? "");
      const player2Team = normalizeTeamCode(row.player2_team_abbreviation ?? "");

      const attachParticipation = (key: string, name: string, teamCode: string) => {
        if (!key || !name) return;
        const p = this.getOrCreatePlayer(key, name);
        p.name = name;
        p.personId = /^\d+$/.test(key) ? key : p.personId;
        this.byName.set(normalize(name), p);
        if (isTrackedNbaGame && teamCode) p.teams.add(teamCode);
        if (year !== undefined) {
          p.years.add(year);
          if (isTrackedNbaGame && teamCode) p.teamYears.add(`${teamCode}|${year}`);
        }
        if (seasonType) p.gameTypes.add(seasonType);
        if (seasonType.toUpperCase().includes("ALL STAR")) p.flags.allStar = true;
      };

      attachParticipation(player1Key, player1Name, player1Team);
      attachParticipation(player2Key, player2Name, player2Team);

      if (isTrackedNbaGame && year !== undefined) {
        const markGameSeen = (key: string) => {
          if (!key) return;
          const player = this.players.get(key);
          if (!player) return;
          const gameSeenKey = `${key}|${year}|${gameId}`;
          if (seenGamesByPlayerSeason.has(gameSeenKey)) return;
          seenGamesByPlayerSeason.add(gameSeenKey);
          const season = player.seasons.get(year) ?? { games: 0, points: 0, assists: 0, rebounds: 0, threePm: 0, threePa: 0 };
          season.games += 1;
          player.seasons.set(year, season);
        };
        markGameSeen(player1Key);
        markGameSeen(player2Key);
      }

      if ((eventType === 1 || eventType === 3) && isTrackedNbaGame) {
        if (!player1Key) continue;
        const shooter = this.players.get(player1Key);
        if (!shooter) continue;
        const pts = eventType === 1 ? (this.isThreePointerMade(row) ? 3 : 2) : this.isMissEvent(row) ? 0 : 1;
        if (pts > 0) {
          if (year !== undefined) {
            const season = shooter.seasons.get(year) ?? { games: 0, points: 0, assists: 0, rebounds: 0, threePm: 0, threePa: 0 };
            season.points += pts;
            if (eventType === 1 && this.isThreePointerMade(row)) {
              season.threePm += 1;
              season.threePa += 1;
            }
            shooter.seasons.set(year, season);
          }
          const pgKey = `${player1Key}|${gameId}`;
          const prior = pointsByPlayerGame.get(pgKey) ?? 0;
          const now = prior + pts;
          pointsByPlayerGame.set(pgKey, now);
          shooter.maxPointsGame = Math.max(shooter.maxPointsGame, now);
        }
      }

      if (eventType === 2) {
        if (!isTrackedNbaGame || !player1Key || year === undefined) continue;
        if (!this.isThreePointerMade(row)) continue;
        const shooter = this.players.get(player1Key);
        if (!shooter) continue;
        const season = shooter.seasons.get(year) ?? { games: 0, points: 0, assists: 0, rebounds: 0, threePm: 0, threePa: 0 };
        season.threePa += 1;
        shooter.seasons.set(year, season);
      }

      if (eventType === 4) {
        if (!isTrackedNbaGame || !player1Key || year === undefined) continue;
        const rebounder = this.players.get(player1Key);
        if (!rebounder) continue;
        const season = rebounder.seasons.get(year) ?? { games: 0, points: 0, assists: 0, rebounds: 0, threePm: 0, threePa: 0 };
        season.rebounds += 1;
        rebounder.seasons.set(year, season);
      }

      if (eventType === 1 && isTrackedNbaGame && player2Key && year !== undefined) {
        const assister = this.players.get(player2Key);
        if (!assister) continue;
        const season = assister.seasons.get(year) ?? { games: 0, points: 0, assists: 0, rebounds: 0, threePm: 0, threePa: 0 };
        season.assists += 1;
        assister.seasons.set(year, season);
      }
    }
  }

  private async loadBbrefCareerInfo(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row = mapCsvRow(headers, cols);
      const key = (row.player_id ?? "").trim();
      const name = (row.player ?? "").trim();
      if (!key || !name) continue;
      const p = this.getOrCreatePlayer(key, name);
      p.name = name;
      this.byName.set(normalize(name), p);

      const fromYear = Number.parseInt(row.from ?? "", 10);
      const toYear = Number.parseInt(row.to ?? "", 10);
      if (Number.isFinite(fromYear) && Number.isFinite(toYear) && fromYear > 0 && toYear >= fromYear) {
        for (let year = fromYear; year <= toYear; year += 1) {
          p.years.add(year);
        }
      }

      const hof = (row.hof ?? "").trim().toUpperCase();
      if (hof === "TRUE") p.flags.hof = true;
    }
  }

  private async loadBbrefSeasonInfo(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });

      const key = (row.player_id ?? "").trim();
      const name = (row.player ?? "").trim();
      if (!key || !name) continue;
      const p = this.getOrCreatePlayer(key, name);
      p.name = name;
      this.byName.set(normalize(name), p);

      const year = Number.parseInt(row.season ?? "", 10);
      if (Number.isFinite(year) && year > 0) p.years.add(year);

      const rawTeam = (row.team ?? "").trim().toUpperCase();
      if (rawTeam && rawTeam !== "TOT") {
        const team = normalizeTeamCode(rawTeam);
        if (team) p.teams.add(team);
        if (team && Number.isFinite(year)) p.teamYears.add(`${team}|${year}`);
      }
    }
  }

  private async loadBbrefPerGame(filePath: string) {
    type SeasonAgg = {
      hasTot: boolean;
      year: number;
      games: number;
      points: number;
      assists: number;
      rebounds: number;
      threePm: number;
      threePa: number;
    };

    const byPlayerSeason = new Map<string, SeasonAgg>();
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });

      const key = (row.player_id ?? "").trim();
      const name = (row.player ?? "").trim();
      if (!key || !name) continue;
      const year = Number.parseInt(row.season ?? "", 10);
      if (!Number.isFinite(year) || year <= 0) continue;
      const team = (row.team ?? "").trim().toUpperCase();
      const games = Number(row.g ?? 0);
      const ppg = Number(row.pts_per_game ?? 0);
      const apg = Number(row.ast_per_game ?? 0);
      const rpg = Number(row.trb_per_game ?? 0);
      const threesPg = Number(row.x3p_per_game ?? 0);
      const threesAttPg = Number(row.x3pa_per_game ?? 0);
      if (!Number.isFinite(games) || games <= 0) continue;

      const p = this.getOrCreatePlayer(key, name);
      p.name = name;
      this.byName.set(normalize(name), p);

      const bucketKey = `${key}|${year}`;
      const current = byPlayerSeason.get(bucketKey);
      const rowAgg: SeasonAgg = {
        hasTot: team === "TOT",
        year,
        games,
        points: games * (Number.isFinite(ppg) ? ppg : 0),
        assists: games * (Number.isFinite(apg) ? apg : 0),
        rebounds: games * (Number.isFinite(rpg) ? rpg : 0),
        threePm: games * (Number.isFinite(threesPg) ? threesPg : 0),
        threePa: games * (Number.isFinite(threesAttPg) ? threesAttPg : 0)
      };

      if (!current) {
        byPlayerSeason.set(bucketKey, rowAgg);
      } else if (rowAgg.hasTot) {
        byPlayerSeason.set(bucketKey, rowAgg);
      } else if (!current.hasTot) {
        current.games += rowAgg.games;
        current.points += rowAgg.points;
        current.assists += rowAgg.assists;
        current.rebounds += rowAgg.rebounds;
        current.threePm += rowAgg.threePm;
        current.threePa += rowAgg.threePa;
      }
    }

    for (const [keyYear, agg] of byPlayerSeason) {
      const [playerKey = ""] = keyYear.split("|");
      const p = this.players.get(playerKey);
      if (!p) continue;
      const season = p.seasons.get(agg.year) ?? { games: 0, points: 0, assists: 0, rebounds: 0, threePm: 0, threePa: 0 };
      season.games = Math.max(season.games, Math.round(agg.games));
      season.points = Math.max(season.points, Math.round(agg.points));
      season.assists = Math.max(season.assists, Math.round(agg.assists));
      season.rebounds = Math.max(season.rebounds, Math.round(agg.rebounds));
      season.threePm = Math.max(season.threePm, Math.round(agg.threePm));
      season.threePa = Math.max(season.threePa, Math.round(agg.threePa));
      p.seasons.set(agg.year, season);
    }
  }

  private async loadBbrefDraftHistory(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      const key = (row.player_id ?? "").trim();
      const name = (row.player ?? "").trim();
      if (!key || !name) continue;
      const p = this.getOrCreatePlayer(key, name);
      p.name = name;
      this.byName.set(normalize(name), p);

      const draftYear = Number.parseInt(row.season ?? "", 10);
      const draftRound = Number.parseInt(row.round ?? "", 10);
      const draftNumber = Number.parseInt(row.overall_pick ?? "", 10);
      if (Number.isFinite(draftYear) && draftYear > 0) p.draftYear = draftYear;
      if (Number.isFinite(draftRound) && draftRound > 0) p.draftRound = draftRound;
      if (Number.isFinite(draftNumber) && draftNumber > 0) p.draftNumber = draftNumber;

      const draftedBy = normalizeTeamCode((row.tm ?? "").trim().toUpperCase());
      if (draftedBy) p.draftedBy = draftedBy;
    }
  }

  private async loadBbrefAllStar(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      const key = (row.player_id ?? "").trim();
      const name = (row.player ?? "").trim();
      if (!key || !name) continue;
      const p = this.getOrCreatePlayer(key, name);
      p.name = name;
      p.flags.allStar = true;
      this.byName.set(normalize(name), p);
    }
  }

  private async loadBbrefAwardShares(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      const key = (row.player_id ?? "").trim();
      const name = (row.player ?? "").trim();
      if (!key || !name) continue;
      const p = this.getOrCreatePlayer(key, name);
      p.name = name;
      this.byName.set(normalize(name), p);
      const award = normalize((row.award ?? "").replace(/_/g, " "));
      if (!award) continue;
      const isWinner = (row.winner ?? "").trim().toUpperCase() === "TRUE";
      if (!isWinner) continue;
      if (award.includes("mvp") && !award.includes("finals")) p.flags.mvp = true;
      if (award.includes("roy") || (award.includes("rookie") && award.includes("year"))) p.flags.roty = true;
      if (award.includes("dpoy") || (award.includes("defensive") && award.includes("year"))) p.flags.dpoy = true;
      if (award.includes("smoy") || (award.includes("sixth") && award.includes("man"))) p.flags.sixthMan = true;
      if (award.includes("mip") || (award.includes("improved") && award.includes("player"))) p.flags.mip = true;
      if (award.includes("finals") && award.includes("mvp")) p.flags.finalsMvp = true;
    }
  }

  private async loadBbrefEndSeasonTeams(filePath: string) {
    const file = readline.createInterface({ input: fs.createReadStream(filePath) });
    let headers: string[] = [];
    for await (const line of file) {
      if (!headers.length) {
        headers = parseCsvLine(line);
        continue;
      }
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? "";
      });
      const key = (row.player_id ?? "").trim();
      const name = (row.player ?? "").trim();
      if (!key || !name) continue;
      const p = this.getOrCreatePlayer(key, name);
      p.name = name;
      this.byName.set(normalize(name), p);
      const type = normalize((row.type ?? "").replace(/_/g, " "));
      if (type.includes("allnba")) p.flags.allNba = true;
    }
  }

  private augmentMaxPointsFromLegacyCache(cachePath: string) {
    try {
      if (!fs.existsSync(cachePath)) return;
      const raw = fs.readFileSync(cachePath, "utf8");
      const parsed = JSON.parse(raw) as NbaCachePayload;
      if (!Array.isArray(parsed.players)) return;
      const byName = new Map<string, number>();
      for (const lp of parsed.players) {
        if (!lp?.name) continue;
        const k = normalize(lp.name);
        const prior = byName.get(k) ?? 0;
        byName.set(k, Math.max(prior, lp.maxPointsGame ?? 0));
      }
      for (const p of this.players.values()) {
        const maxPts = byName.get(normalize(p.name));
        if (maxPts && maxPts > p.maxPointsGame) p.maxPointsGame = maxPts;
      }
    } catch {
      // best-effort enrichment only
    }
  }

  private linkTeammatesFromTeamYears() {
    const bucket = new Map<string, string[]>();
    for (const p of this.players.values()) {
      for (const ty of p.teamYears) {
        const list = bucket.get(ty) ?? [];
        list.push(p.key);
        bucket.set(ty, list);
      }
    }
    for (const list of bucket.values()) {
      for (let i = 0; i < list.length; i += 1) {
        const a = this.players.get(list[i]!);
        if (!a) continue;
        for (let j = 0; j < list.length; j += 1) {
          if (i === j) continue;
          const b = this.players.get(list[j]!);
          if (!b) continue;
          a.teammates.add(normalize(b.name));
        }
      }
    }
  }

  private attachCuratedFlags() {
    for (const p of this.players.values()) {
      const curated = curatedFlags[normalize(p.name)];
      if (curated) {
        p.flags = { ...p.flags, ...curated };
      }
    }
  }
}

export const nbaData = new NbaDataService();
void nbaData.init();
