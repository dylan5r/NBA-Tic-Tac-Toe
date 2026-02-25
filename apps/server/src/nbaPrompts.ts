export type PromptDifficulty = "easy" | "medium" | "hard" | "expert";
export type PromptType = "team" | "award" | "teammate" | "draft" | "stat" | "combo" | "expert";

export interface PromptValidation {
  team?: string;
  teammate?: string;
  teammatesAll?: string[];
  teamsAll?: string[];
  ppg_season?: number;
  apg_season?: number;
  rpg_season?: number;
  threept_pct_season?: number;
  points_game?: number;
  champion?: boolean;
  mvp?: boolean;
  roty?: boolean;
  all_star?: boolean;
  finals_mvp?: boolean;
  dpoy?: boolean;
  sixth_man?: boolean;
  mip?: boolean;
  all_nba?: boolean;
  olympic_gold?: boolean;
  hof?: boolean;
  scoring_champion?: boolean;
  assist_leader?: boolean;
  rebound_leader?: boolean;
  seasons_gte?: number;
  draft_overall_eq?: number;
  draft_overall_lte?: number;
  draft_round_eq?: number;
  undrafted?: boolean;
  drafted_year?: number;
  drafted_by?: string;
  finals?: boolean;
  one_franchise?: boolean;
  franchises_gte?: number;
  never_mvp?: boolean;
  never_all_star?: boolean;
  never_champion?: boolean;
  never_all_nba?: boolean;
  career_ppg_gte?: number;
  championships_gte?: number;
}

export interface NbaPrompt {
  id: string;
  type: PromptType;
  category: PromptType;
  difficulty: PromptDifficulty;
  weight: number;
  text: string;
  validation: PromptValidation;
}

const teams: Array<{ code: string; name: string }> = [
  { code: "LAL", name: "Los Angeles Lakers" },
  { code: "BOS", name: "Boston Celtics" },
  { code: "CHI", name: "Chicago Bulls" },
  { code: "GSW", name: "Golden State Warriors" },
  { code: "MIA", name: "Miami Heat" },
  { code: "SAS", name: "San Antonio Spurs" },
  { code: "DAL", name: "Dallas Mavericks" },
  { code: "PHX", name: "Phoenix Suns" },
  { code: "NYK", name: "New York Knicks" },
  { code: "TOR", name: "Toronto Raptors" },
  { code: "BKN", name: "Brooklyn Nets" },
  { code: "DEN", name: "Denver Nuggets" },
  { code: "OKC", name: "Oklahoma City Thunder" },
  { code: "LAC", name: "Los Angeles Clippers" },
  { code: "HOU", name: "Houston Rockets" },
  { code: "SAC", name: "Sacramento Kings" },
  { code: "DET", name: "Detroit Pistons" },
  { code: "IND", name: "Indiana Pacers" },
  { code: "ATL", name: "Atlanta Hawks" },
  { code: "ORL", name: "Orlando Magic" },
  { code: "MIN", name: "Minnesota Timberwolves" },
  { code: "POR", name: "Portland Trail Blazers" },
  { code: "UTA", name: "Utah Jazz" },
  { code: "CHA", name: "Charlotte Hornets" },
  { code: "NOP", name: "New Orleans Pelicans" },
  { code: "WAS", name: "Washington Wizards" },
  { code: "MEM", name: "Memphis Grizzlies" },
  { code: "CLE", name: "Cleveland Cavaliers" },
  { code: "PHI", name: "Philadelphia 76ers" },
  { code: "MIL", name: "Milwaukee Bucks" }
];

const weightByDifficulty = (d: PromptDifficulty): number => (d === "easy" ? 5 : d === "medium" ? 3 : d === "hard" ? 2 : 1);

export const buildPromptCatalog = (): NbaPrompt[] => {
  const prompts: NbaPrompt[] = [];

  for (const t of teams) {
    prompts.push({
      id: `team_${t.code.toLowerCase()}`,
      type: "team",
      category: "team",
      difficulty: "easy",
      weight: weightByDifficulty("easy"),
      text: `Played for the ${t.name}`,
      validation: { team: t.code }
    });
  }

  const easyAwards: Array<{ id: string; text: string; validation: PromptValidation }> = [
    { id: "award_champion", text: "NBA Champion", validation: { champion: true } },
    { id: "award_mvp", text: "League MVP", validation: { mvp: true } },
    { id: "award_roty", text: "Rookie of the Year", validation: { roty: true } },
    { id: "award_all_star", text: "All-Star", validation: { all_star: true } },
    { id: "award_finals_mvp", text: "Finals MVP", validation: { finals_mvp: true } },
    { id: "award_dpoy", text: "Defensive Player of the Year", validation: { dpoy: true } },
    { id: "award_sixth_man", text: "Sixth Man of the Year", validation: { sixth_man: true } },
    { id: "award_mip", text: "Most Improved Player", validation: { mip: true } },
    { id: "award_all_nba", text: "All-NBA selection", validation: { all_nba: true } },
    { id: "award_olympic_gold", text: "Olympic Gold Medalist", validation: { olympic_gold: true } },
    { id: "award_hof", text: "Hall of Famer", validation: { hof: true } },
    { id: "award_scoring", text: "Scoring Champion", validation: { scoring_champion: true } },
    { id: "award_assist_lead", text: "Assist Leader", validation: { assist_leader: true } },
    { id: "award_rebound_lead", text: "Rebound Leader", validation: { rebound_leader: true } },
    { id: "award_all_star_no_mvp", text: "All-Star (No MVP required)", validation: { all_star: true } },
    { id: "stat_50_game", text: "50+ point game", validation: { points_game: 50 } },
    { id: "stat_40_game", text: "40+ point game", validation: { points_game: 40 } },
    { id: "stat_30_game", text: "30+ point game", validation: { points_game: 30 } },
    { id: "stat_20_ppg", text: "20+ PPG season", validation: { ppg_season: 20 } },
    { id: "stat_15_ppg", text: "15+ PPG season", validation: { ppg_season: 15 } },
    { id: "stat_10_rpg", text: "10+ RPG season", validation: { rpg_season: 10 } },
    { id: "stat_8_rpg", text: "8+ RPG season", validation: { rpg_season: 8 } },
    { id: "stat_8_apg", text: "8+ APG season", validation: { apg_season: 8 } },
    { id: "stat_6_apg", text: "6+ APG season", validation: { apg_season: 6 } },
    { id: "stat_35_3pt", text: "35%+ 3PT season", validation: { threept_pct_season: 0.35 } },
    { id: "stat_38_3pt", text: "38%+ 3PT season", validation: { threept_pct_season: 0.38 } },
    { id: "career_10_seasons", text: "Played 10+ seasons", validation: { seasons_gte: 10 } }
  ];
  prompts.push(
    ...easyAwards.map((p): NbaPrompt => ({
      id: p.id,
      type: p.id.startsWith("stat_") || p.id.startsWith("career_") ? "stat" : "award",
      category: p.id.startsWith("stat_") || p.id.startsWith("career_") ? "stat" : "award",
      difficulty: "easy" as const,
      weight: weightByDifficulty("easy"),
      text: p.text,
      validation: p.validation
    }))
  );

  const mediumDraft: NbaPrompt[] = [
    { id: "draft_1_pick", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "#1 Overall Pick", validation: { draft_overall_eq: 1 } },
    { id: "draft_top5", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Top 5 Pick", validation: { draft_overall_lte: 5 } },
    { id: "draft_lottery", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Lottery Pick", validation: { draft_overall_lte: 14 } },
    { id: "draft_second_round", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Second Round Pick", validation: { draft_round_eq: 2 } },
    { id: "draft_undrafted", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Undrafted Player", validation: { undrafted: true } },
    { id: "draft_2003", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted in 2003", validation: { drafted_year: 2003 } },
    { id: "draft_2009", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted in 2009", validation: { drafted_year: 2009 } },
    { id: "draft_2012", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted in 2012", validation: { drafted_year: 2012 } },
    { id: "draft_2015", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted in 2015", validation: { drafted_year: 2015 } },
    { id: "draft_2018", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted in 2018", validation: { drafted_year: 2018 } },
    { id: "draft_2020", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted in 2020", validation: { drafted_year: 2020 } },
    { id: "draft_by_lakers", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted by the Lakers", validation: { drafted_by: "LAL" } },
    { id: "draft_by_cavs", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted by the Cavaliers", validation: { drafted_by: "CLE" } },
    { id: "draft_by_bulls", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted by the Bulls", validation: { drafted_by: "CHI" } },
    { id: "draft_by_celtics", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted by the Celtics", validation: { drafted_by: "BOS" } },
    { id: "draft_by_warriors", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted by the Warriors", validation: { drafted_by: "GSW" } },
    { id: "draft_by_knicks", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted by the Knicks", validation: { drafted_by: "NYK" } },
    { id: "draft_by_spurs", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted by the Spurs", validation: { drafted_by: "SAS" } },
    { id: "draft_by_heat", type: "draft", category: "draft", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Drafted by the Heat", validation: { drafted_by: "MIA" } },
    { id: "career_15_seasons", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Played 15+ seasons", validation: { seasons_gte: 15 } },
    { id: "career_8_seasons", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Played 8+ seasons", validation: { seasons_gte: 8 } },
    { id: "career_12_seasons", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Played 12+ seasons", validation: { seasons_gte: 12 } },
    { id: "career_one_team", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Played only for one team", validation: { one_franchise: true } },
    { id: "career_five_teams", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Played for 5+ teams", validation: { franchises_gte: 5 } },
    { id: "career_three_teams", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Played for 3+ teams", validation: { franchises_gte: 3 } },
    { id: "career_finals", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "Played in NBA Finals", validation: { finals: true } },
    { id: "stat_25_ppg", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "25+ PPG season", validation: { ppg_season: 25 } },
    { id: "stat_22_ppg", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "22+ PPG season", validation: { ppg_season: 22 } },
    { id: "stat_27_ppg", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "27+ PPG season", validation: { ppg_season: 27 } },
    { id: "stat_10_apg", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "10+ APG season", validation: { apg_season: 10 } },
    { id: "stat_9_apg", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "9+ APG season", validation: { apg_season: 9 } },
    { id: "stat_12_rpg", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "12+ RPG season", validation: { rpg_season: 12 } },
    { id: "stat_11_rpg", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "11+ RPG season", validation: { rpg_season: 11 } },
    { id: "stat_40_3pt", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "40%+ 3PT season", validation: { threept_pct_season: 0.4 } },
    { id: "stat_45_3pt", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "45%+ 3PT season", validation: { threept_pct_season: 0.45 } },
    { id: "stat_triple_double_style", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "10+ APG and 10+ RPG season", validation: { apg_season: 10, rpg_season: 10 } },
    { id: "stat_double_double_style", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "20+ PPG and 10+ RPG season", validation: { ppg_season: 20, rpg_season: 10 } },
    { id: "stat_guard_star_style", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "25+ PPG and 8+ APG season", validation: { ppg_season: 25, apg_season: 8 } },
    { id: "stat_wing_star_style", type: "stat", category: "stat", difficulty: "medium", weight: weightByDifficulty("medium"), text: "27+ PPG and 8+ RPG season", validation: { ppg_season: 27, rpg_season: 8 } }
  ];
  prompts.push(...mediumDraft);

  const hardCombos: Array<{ id: string; text: string; validation: PromptValidation }> = [
    { id: "combo_champ_spurs", text: "Champion with the Spurs", validation: { team: "SAS", champion: true } },
    { id: "combo_champ_lakers", text: "Champion with the Lakers", validation: { team: "LAL", champion: true } },
    { id: "combo_champ_heat", text: "Champion with the Heat", validation: { team: "MIA", champion: true } },
    { id: "combo_mvp_thunder", text: "MVP with the Thunder", validation: { team: "OKC", mvp: true } },
    { id: "combo_mvp_bucks", text: "MVP with the Bucks", validation: { team: "MIL", mvp: true } },
    { id: "combo_allstar_celtics", text: "All-Star with the Celtics", validation: { team: "BOS", all_star: true } },
    { id: "combo_allstar_lakers", text: "All-Star with the Lakers", validation: { team: "LAL", all_star: true } },
    { id: "combo_allstar_knicks", text: "All-Star with the Knicks", validation: { team: "NYK", all_star: true } },
    { id: "combo_25ppg_suns", text: "25+ PPG with the Suns", validation: { team: "PHX", ppg_season: 25 } },
    { id: "combo_22ppg_celtics", text: "22+ PPG with the Celtics", validation: { team: "BOS", ppg_season: 22 } },
    { id: "combo_22ppg_rockets", text: "22+ PPG with the Rockets", validation: { team: "HOU", ppg_season: 22 } },
    { id: "combo_10apg_hawks", text: "10+ APG with the Hawks", validation: { team: "ATL", apg_season: 10 } },
    { id: "combo_8apg_clippers", text: "8+ APG with the Clippers", validation: { team: "LAC", apg_season: 8 } },
    { id: "combo_40pt3_warriors", text: "40%+ 3PT with the Warriors", validation: { team: "GSW", threept_pct_season: 0.4 } },
    { id: "combo_35pt3_heat", text: "35%+ 3PT with the Heat", validation: { team: "MIA", threept_pct_season: 0.35 } },
    { id: "combo_50pt_knicks", text: "50+ point game with the Knicks", validation: { team: "NYK", points_game: 50 } },
    { id: "combo_pick1_cavs", text: "#1 Pick drafted by Cavaliers", validation: { draft_overall_eq: 1, drafted_by: "CLE" } },
    { id: "combo_draft_lottery_mavs", text: "Lottery pick drafted by Mavericks", validation: { draft_overall_lte: 14, drafted_by: "DAL" } },
    { id: "combo_champion_allstar", text: "Champion and All-Star", validation: { champion: true, all_star: true } },
    { id: "combo_champion_allnba", text: "Champion and All-NBA", validation: { champion: true, all_nba: true } },
    { id: "combo_mvp_allnba", text: "MVP and All-NBA", validation: { mvp: true, all_nba: true } },
    { id: "combo_mvp_scoring", text: "MVP and Scoring Champion", validation: { mvp: true, scoring_champion: true } },
    { id: "combo_dpoy_allstar", text: "DPOY and All-Star", validation: { dpoy: true, all_star: true } },
    { id: "combo_champion_finals_mvp", text: "Champion and Finals MVP", validation: { champion: true, finals_mvp: true } },
    { id: "combo_champion_dpoy", text: "Champion and DPOY", validation: { champion: true, dpoy: true } },
    { id: "combo_lakers_30_game", text: "30+ point game with the Lakers", validation: { team: "LAL", points_game: 30 } },
    { id: "combo_bulls_40_game", text: "40+ point game with the Bulls", validation: { team: "CHI", points_game: 40 } },
    { id: "combo_warriors_30_game", text: "30+ point game with the Warriors", validation: { team: "GSW", points_game: 30 } },
    { id: "combo_knicks_allnba", text: "All-NBA with the Knicks", validation: { team: "NYK", all_nba: true } },
    { id: "combo_celtics_allnba", text: "All-NBA with the Celtics", validation: { team: "BOS", all_nba: true } },
    { id: "combo_heat_allnba", text: "All-NBA with the Heat", validation: { team: "MIA", all_nba: true } },
    { id: "combo_cavs_allstar", text: "All-Star with the Cavaliers", validation: { team: "CLE", all_star: true } },
    { id: "combo_suns_allstar", text: "All-Star with the Suns", validation: { team: "PHX", all_star: true } }
  ];
  prompts.push(
    ...hardCombos.map((p): NbaPrompt => ({
      id: p.id,
      type: "combo",
      category: "combo",
      difficulty: "hard" as const,
      weight: weightByDifficulty("hard"),
      text: p.text,
      validation: p.validation
    }))
  );

  const expertPrompts: NbaPrompt[] = [
    { id: "expert_27_no_mvp", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "Averaged 27+ PPG but never MVP", validation: { ppg_season: 27, never_mvp: true } },
    { id: "expert_champ_no_allstar", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "Champion but never All-Star", validation: { champion: true, never_all_star: true } },
    { id: "expert_pick1_no_allstar", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "#1 Pick but never All-Star", validation: { draft_overall_eq: 1, never_all_star: true } },
    { id: "expert_allstar_no_champ", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "All-Star but never Champion", validation: { all_star: true, never_champion: true } },
    { id: "expert_hof_no_ring", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "Hall of Famer without championship", validation: { hof: true, never_champion: true } },
    { id: "expert_20_no_allnba", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "20+ PPG career but never All-NBA", validation: { career_ppg_gte: 20, never_all_nba: true } },
    { id: "expert_15_one_team", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "Played 15+ seasons with one team", validation: { seasons_gte: 15, one_franchise: true } },
    { id: "expert_two_team_champ", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "Won championship with two different teams", validation: { championships_gte: 2 } },
    { id: "expert_30_ppg_never_mvp", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "30+ PPG season but never MVP", validation: { ppg_season: 30, never_mvp: true } },
    { id: "expert_allstar_no_allnba", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "All-Star but never All-NBA", validation: { all_star: true, never_all_nba: true } },
    { id: "expert_scoring_no_ring", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "Scoring Champion without a title", validation: { scoring_champion: true, never_champion: true } },
    { id: "expert_undrafted_allstar", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "Undrafted and All-Star", validation: { undrafted: true, all_star: true } },
    { id: "expert_undrafted_champion", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "Undrafted and Champion", validation: { undrafted: true, champion: true } },
    { id: "expert_pick1_champion", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "#1 Pick and Champion", validation: { draft_overall_eq: 1, champion: true } },
    { id: "expert_pick1_mvp", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "#1 Pick and MVP", validation: { draft_overall_eq: 1, mvp: true } },
    { id: "expert_allnba_no_ring", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "All-NBA but never Champion", validation: { all_nba: true, never_champion: true } },
    { id: "expert_allstar_no_mvp", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "All-Star but never MVP", validation: { all_star: true, never_mvp: true } },
    { id: "expert_25_10_star", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "25+ PPG and 10+ APG season", validation: { ppg_season: 25, apg_season: 10 } },
    { id: "expert_30_8_star", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "30+ PPG and 8+ RPG season", validation: { ppg_season: 30, rpg_season: 8 } },
    { id: "expert_20_10_10_style", type: "expert", category: "expert", difficulty: "expert", weight: weightByDifficulty("expert"), text: "20+ PPG, 10+ APG and 10+ RPG season", validation: { ppg_season: 20, apg_season: 10, rpg_season: 10 } }
  ];
  prompts.push(...expertPrompts);

  // Exclude multi-team "A AND B teams" prompts to keep challenge combinations playable.
  return prompts.filter((p) => !p.validation.teamsAll?.length);
};
