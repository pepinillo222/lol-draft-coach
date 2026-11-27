import { describe, expect, test } from "bun:test";
import {
    PoolMatch,
    buildPersonalPool,
    getExperienceRating,
    getPoolEntry,
    isInPool,
    roleFromTeamPosition,
} from "./pool";
import { Role } from "../models/Role";

function games(
    championKey: string,
    role: Role,
    wins: number,
    losses: number,
): PoolMatch[] {
    return Array.from({ length: wins + losses }, (_, i) => ({
        matchId: `${championKey}-${role}-${i}`,
        championKey,
        role,
        win: i < wins,
        timestamp: 1000 + i,
    }));
}

describe("buildPersonalPool", () => {
    const matches = [
        ...games("82", Role.Top, 30, 20), // Mordekaiser, strong
        ...games("887", Role.Top, 8, 12), // Gwen, weaker
        ...games("875", Role.Top, 2, 0), // Sett, tiny sample
    ];
    const mastery = new Map([
        ["82", 493_000],
        ["887", 292_000],
        ["875", 265_000],
    ]);
    const pool = buildPersonalPool(matches, mastery);

    test("averages the player's games", () => {
        expect(pool.totalGames).toBe(72);
        expect(pool.overallWinrate).toBeCloseTo(40 / 72);
    });

    test("ranks picks by how the player does on them", () => {
        const morde = getPoolEntry(pool, "82", Role.Top);
        const gwen = getPoolEntry(pool, "887", Role.Top);
        expect(morde.games).toBe(50);
        expect(morde.rating).toBeGreaterThan(0);
        expect(gwen.rating).toBeLessThan(0);
        expect(morde.rating).toBeGreaterThan(gwen.rating);
    });

    test("does not trust tiny samples", () => {
        const sett = getPoolEntry(pool, "875", Role.Top);
        expect(sett.performanceRating).toBeGreaterThan(0);
        expect(sett.performanceRating).toBeLessThan(25);
    });

    test("penalises champions the player never plays", () => {
        const unknown = getPoolEntry(pool, "1", Role.Middle);
        expect(unknown.games).toBe(0);
        expect(unknown.rating).toBeCloseTo(-35);
        expect(isInPool(unknown)).toBe(false);
    });

    test("mastery alone counts as experience", () => {
        const offRole = getPoolEntry(pool, "82", Role.Jungle);
        expect(offRole.games).toBe(0);
        expect(offRole.experienceRating).toBeGreaterThan(-1);
        expect(isInPool(offRole)).toBe(true);
    });
});

describe("helpers", () => {
    test("experience penalty shrinks with mastery", () => {
        expect(getExperienceRating(0, 0)).toBeCloseTo(-35);
        expect(getExperienceRating(40_000, 0)).toBeGreaterThan(-14);
        expect(getExperienceRating(400_000, 0)).toBeGreaterThan(-0.01);
    });

    test("maps match-v5 positions to roles", () => {
        expect(roleFromTeamPosition("UTILITY")).toBe(Role.Support);
        expect(roleFromTeamPosition("TOP")).toBe(Role.Top);
        expect(roleFromTeamPosition("")).toBeNull();
        expect(roleFromTeamPosition(undefined)).toBeNull();
    });
});
