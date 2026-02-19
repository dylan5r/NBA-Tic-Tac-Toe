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

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

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

const difficultyProfile = {
  casual: { easy: 0.6, medium: 0.3, hard: 0.1, expert: 0 },
  ranked: { easy: 0.3, medium: 0.4, hard: 0.2, expert: 0.1 }
} as const;

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
  path.resolve(cwd, "../../nba data"),
  path.resolve(cwd, "../nba data"),
  path.resolve(cwd, "nba data")
];

class NbaDataService {
  private players = new Map<string, PlayerFacts>();
  private byName = new Map<string, PlayerFacts>();
  private prompts: GeneratedPrompt[] = [];
  private promptById = new Map<string, GeneratedPrompt>();
  private candidatesByPrompt = new Map<string, Set<string>>();
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

    const playersPath = path.join(dataDir, "Players.csv");
    const statsPath = path.join(dataDir, "PlayerStatistics.csv");
    if (!fs.existsSync(playersPath) || !fs.existsSync(statsPath)) {
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

  isReady() {
    return this.ready;
  }

  challengesForBoard(params: { cellCount: number; ranked: boolean }): GeneratedPrompt[] {
    const profile = params.ranked ? "ranked" : "casual";
    const board = this.generateBalancedBoard(params.cellCount, profile);
    this.trackBoard(board.map((p) => p.id));
    return board;
  }

  challengesForGrid(params: { size: 3 | 4; ranked: boolean }): { rows: GeneratedPrompt[]; cols: GeneratedPrompt[] } {
    const count = params.size;
    const pool = this.generateBalancedBoard(count * 2, params.ranked ? "ranked" : "casual");
    const rows = pool.slice(0, count);
    const cols = pool.slice(count, count * 2);
    this.trackBoard(pool.map((p) => p.id));
    return { rows, cols };
  }

  validateAnswer(answer: string, challenge: GeneratedPrompt, used: Set<string>): { ok: boolean; reason?: string; key?: string; canonical?: string } {
    if (!answer?.trim()) return { ok: false, reason: "Enter a player name." };
    const direct = this.byName.get(normalize(answer));
    if (!direct) return { ok: false, reason: "Player not found in NBA dataset." };
    if (used.has(direct.key)) return { ok: false, reason: "Player already used this match." };
    if (!this.matchesValidation(direct, challenge.validation)) {
      return { ok: false, reason: `Answer does not satisfy: ${challenge.text}` };
    }
    return { ok: true, key: direct.key, canonical: direct.name };
  }

  validateAnswerAgainstMany(
    answer: string,
    challenges: GeneratedPrompt[],
    used: Set<string>
  ): { ok: boolean; reason?: string; key?: string; canonical?: string } {
    if (!answer?.trim()) return { ok: false, reason: "Enter a player name." };
    const direct = this.byName.get(normalize(answer));
    if (!direct) return { ok: false, reason: "Player not found in NBA dataset." };
    if (used.has(direct.key)) return { ok: false, reason: "Player already used this match." };
    for (const challenge of challenges) {
      if (!this.matchesValidation(direct, challenge.validation)) {
        return { ok: false, reason: `Answer does not satisfy: ${challenge.text}` };
      }
    }
    return { ok: true, key: direct.key, canonical: direct.name };
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
    return { key, name: p.name };
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
    return { key, name: p.name };
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

  private generateBalancedBoard(cellCount: number, profile: "casual" | "ranked"): GeneratedPrompt[] {
    const pool = this.prompts.filter((p) => (this.candidatesByPrompt.get(p.id)?.size ?? 0) > 0);
    const recent = new Set(this.recentPromptIds);
    const avoidLastBoards = new Set(this.recentBoards.flat());
    const filtered = pool.filter((p) => !recent.has(p.id) && !avoidLastBoards.has(p.id));
    const source = filtered.length >= cellCount ? filtered : pool;

    for (let attempt = 0; attempt < 500; attempt += 1) {
      const selected: GeneratedPrompt[] = [];
      while (selected.length < cellCount) {
        const candidate = this.weightedPick(source, profile);
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

  private weightedPick(pool: GeneratedPrompt[], profile: "casual" | "ranked"): GeneratedPrompt | null {
    const weights = difficultyProfile[profile];
    const weighted = pool.map((p) => ({ p, w: p.weight * weights[p.difficulty] }));
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
    const teammateCount = selected.filter((s) => s.category === "teammate").length + (candidate.category === "teammate" ? 1 : 0);
    if (statCount + remaining < 2) return false;
    if (teammateCount + remaining < 1) return false;
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
    const teammateCount = board.filter((p) => p.category === "teammate").length;
    if (statCount < 2 || teammateCount < 1) return false;
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
    for (const p of this.prompts) {
      const matches = new Set<string>();
      for (const facts of this.players.values()) {
        if (this.matchesValidation(facts, p.validation)) matches.add(facts.key);
      }
      this.candidatesByPrompt.set(p.id, matches);
    }
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
      const key = row.personId || normalize(full);
      const p = this.players.get(key) ?? {
        key,
        name: full,
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
      p.name = full;
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
      const key = row.personId || normalize(`${row.firstName ?? ""} ${row.lastName ?? ""}`);
      const full = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
      if (!key || !full) continue;
      const p = this.players.get(key) ?? {
        key,
        name: full,
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
      p.name = full;

      const teamCode = (row.teamAbbreviation ?? teamNameToCode[normalize(row.playerteamName ?? row.teamName ?? "")] ?? "").trim().toUpperCase();
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
