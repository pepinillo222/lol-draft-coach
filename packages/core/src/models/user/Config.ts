import { RiskLevel } from "../../risk/risk-level";
import { RiotPlatform } from "../../personal/riot";

export type StatsSite = "op.gg" | "u.gg" | "lolalytics";

export const DraftTablePlacement = {
    Bottom: "bottom",
    Hidden: "hidden",
    InPlace: "in-place",
} as const;
type DraftTablePlacement =
    (typeof DraftTablePlacement)[keyof typeof DraftTablePlacement];

// off: plain DraftGap ranking. boost: rank by draft + personal pool.
// pool-only: like boost, but only show picks from the personal pool.
export type PersonalPoolMode = "off" | "boost" | "pool-only";

export type DraftGapConfig = {
    // DRAFT ANALYSIS
    ignoreChampionWinrates: boolean;
    riskLevel: RiskLevel;
    minGames: number;
    analyzeHovers: boolean;

    // DRAFT SUGGESTIONS
    showFavouritesAtTop: boolean;
    banPlacement: DraftTablePlacement;
    unownedPlacement: DraftTablePlacement;
    showAdvancedWinrates: boolean;
    language: string;

    // MISC
    defaultStatsSite: StatsSite;
    enableBetaFeatures: boolean;

    // LOL CLIENT
    disableLeagueClientIntegration: boolean;

    // PERSONAL POOL (Riot API)
    riotApiKey: string;
    riotId: string;
    riotPlatform: RiotPlatform;
    personalPoolMode: PersonalPoolMode;
};
