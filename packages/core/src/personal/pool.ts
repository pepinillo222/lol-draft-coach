import { Role } from "../models/Role";
import { winrateToRating } from "../rating/ratings";

// One of the player's own ranked games, reduced to what the pool needs.
export type PoolMatch = {
    matchId: string;
    championKey: string;
    role: Role | null;
    win: boolean;
    timestamp: number;
};

export type PoolEntry = {
    championKey: string;
    role: Role;
    games: number;
    wins: number;
    lastPlayed: number;
    masteryPoints: number;
    // How the player does on this pick compared to their own average,
    // shrunk towards 0 when there are few games.
    performanceRating: number;
    // Penalty for picks the player has little experience on.
    experienceRating: number;
    // performanceRating + experienceRating, same scale as the draft ratings.
    rating: number;
};

export type PersonalPool = {
    totalGames: number;
    overallWinrate: number;
    masteryByChampion: Map<string, number>;
    entries: Map<string, PoolEntry>;
};

// Games of "average performance" mixed into every pick's winrate, so a 3-0
// does not look like a 100% winrate champion.
const PERFORMANCE_PRIOR_GAMES = 30;
const MAX_PERFORMANCE_RATING = 50;
// Rating lost on a champion with no experience at all (~5% winrate).
const UNFAMILIAR_PENALTY = 35;
// Mastery points at which ~63% of the unfamiliarity penalty is gone.
const FAMILIARITY_MASTERY_SCALE = 40_000;
// Ranked games on the pick that count as much as the full mastery scale.
const FAMILIARITY_GAMES_SCALE = 20;

export const POOL_MIN_GAMES = 3;
export const POOL_MIN_MASTERY = 20_000;

function poolKey(championKey: string, role: Role) {
    return `${championKey}:${role}`;
}

export function getExperienceRating(masteryPoints: number, games: number) {
    const experience =
        masteryPoints / FAMILIARITY_MASTERY_SCALE +
        games / FAMILIARITY_GAMES_SCALE;
    const familiarity = 1 - Math.exp(-experience);
    return -UNFAMILIAR_PENALTY * (1 - familiarity);
}

export function getPerformanceRating(
    wins: number,
    games: number,
    overallWinrate: number,
) {
    if (games === 0) return 0;
    const shrunk =
        (wins + PERFORMANCE_PRIOR_GAMES * overallWinrate) /
        (games + PERFORMANCE_PRIOR_GAMES);
    const rating = winrateToRating(shrunk) - winrateToRating(overallWinrate);
    return Math.max(
        -MAX_PERFORMANCE_RATING,
        Math.min(MAX_PERFORMANCE_RATING, rating),
    );
}

export function buildPersonalPool(
    matches: PoolMatch[],
    masteryByChampion: Map<string, number>,
): PersonalPool {
    const totalGames = matches.length;
    const totalWins = matches.filter((m) => m.win).length;
    // Keep the average away from 0/1 so ratings stay finite.
    const overallWinrate =
        totalGames === 0
            ? 0.5
            : Math.min(0.8, Math.max(0.2, totalWins / totalGames));

    const counts = new Map<
        string,
        {
            championKey: string;
            role: Role;
            games: number;
            wins: number;
            lastPlayed: number;
        }
    >();
    for (const match of matches) {
        if (match.role === null) continue;
        const key = poolKey(match.championKey, match.role);
        const entry = counts.get(key) ?? {
            championKey: match.championKey,
            role: match.role,
            games: 0,
            wins: 0,
            lastPlayed: 0,
        };
        entry.games++;
        if (match.win) entry.wins++;
        entry.lastPlayed = Math.max(entry.lastPlayed, match.timestamp);
        counts.set(key, entry);
    }

    const entries = new Map<string, PoolEntry>();
    for (const [key, c] of counts) {
        const masteryPoints = masteryByChampion.get(c.championKey) ?? 0;
        const performanceRating = getPerformanceRating(
            c.wins,
            c.games,
            overallWinrate,
        );
        const experienceRating = getExperienceRating(masteryPoints, c.games);
        entries.set(key, {
            ...c,
            masteryPoints,
            performanceRating,
            experienceRating,
            rating: performanceRating + experienceRating,
        });
    }

    return { totalGames, overallWinrate, masteryByChampion, entries };
}

// Personal entry for a pick, including picks the player has no ranked games
// on (then only mastery counts).
export function getPoolEntry(
    pool: PersonalPool,
    championKey: string,
    role: Role,
): PoolEntry {
    const existing = pool.entries.get(poolKey(championKey, role));
    if (existing) return existing;

    const masteryPoints = pool.masteryByChampion.get(championKey) ?? 0;
    const experienceRating = getExperienceRating(masteryPoints, 0);
    return {
        championKey,
        role,
        games: 0,
        wins: 0,
        lastPlayed: 0,
        masteryPoints,
        performanceRating: 0,
        experienceRating,
        rating: experienceRating,
    };
}

export function isInPool(entry: PoolEntry) {
    return (
        entry.games >= POOL_MIN_GAMES || entry.masteryPoints >= POOL_MIN_MASTERY
    );
}

const ROLE_BY_TEAM_POSITION: Record<string, Role> = {
    TOP: Role.Top,
    JUNGLE: Role.Jungle,
    MIDDLE: Role.Middle,
    BOTTOM: Role.Bottom,
    UTILITY: Role.Support,
};

export function roleFromTeamPosition(
    position: string | undefined,
): Role | null {
    if (!position) return null;
    return ROLE_BY_TEAM_POSITION[position] ?? null;
}
