import {
    JSXElement,
    createContext,
    createEffect,
    createSignal,
    on,
    onCleanup,
    onMount,
    useContext,
} from "solid-js";
import { get, set } from "idb-keyval";
import {
    PersonalPool,
    PoolMatch,
    buildPersonalPool,
    getPoolEntry,
    roleFromTeamPosition,
} from "@draftgap/core/src/personal/pool";
import {
    parseRiotId,
    platformHost,
    regionalHost,
} from "@draftgap/core/src/personal/riot";
import { Role } from "@draftgap/core/src/models/Role";
import {
    RiotAccount,
    RiotApiError,
    RiotChampionMastery,
    RiotMatch,
    riotGet,
} from "../api/riot-api";
import { useUser } from "./UserContext";
import { useLolClient } from "./LolClientContext";
import { useMedia } from "../hooks/useMedia";

// Ranked solo/duo only: other queues say little about how a pick does in a
// real draft.
const RANKED_SOLO_QUEUE = 420;
const MATCH_HISTORY_SIZE = 100;
// Personal keys allow 100 requests every 2 minutes.
const REQUEST_SPACING_MS = 1250;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
// Games shorter than this are remakes.
const MIN_GAME_DURATION_S = 300;

type CachedMatches = Record<string, PoolMatch | null>;
type CachedPool = {
    puuid: string;
    masteries: [string, number][];
};

const LAST_POOL_KEY = "personal-pool-last";
const matchesKey = (puuid: string) => `personal-pool-matches-${puuid}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function summarizeMatch(
    matchId: string,
    match: RiotMatch,
    puuid: string,
): PoolMatch | null {
    const me = match.info.participants.find((p) => p.puuid === puuid);
    if (!me) return null;
    if (
        me.gameEndedInEarlySurrender ||
        match.info.gameDuration < MIN_GAME_DURATION_S
    ) {
        return null;
    }
    return {
        matchId,
        championKey: String(me.championId),
        role: roleFromTeamPosition(me.teamPosition),
        win: me.win,
        timestamp: match.info.gameStartTimestamp,
    };
}

function errorMessage(e: unknown) {
    if (e instanceof RiotApiError) {
        if (e.status === 401 || e.status === 403) {
            return "La API key no es válida o ha caducado.";
        }
        if (e.status === 429) {
            return "Límite de peticiones de Riot alcanzado, prueba en unos minutos.";
        }
        return `Error de la Riot API (${e.message}).`;
    }
    return String(e);
}

export type PoolStatus = "idle" | "loading" | "ready" | "error";

export function createPersonalPoolContext() {
    const { config } = useUser();
    const { currentSummonerPuuid } = useLolClient();
    const { isDesktop } = useMedia();

    const [pool, setPool] = createSignal<PersonalPool>();
    const [status, setStatus] = createSignal<PoolStatus>("idle");
    const [error, setError] = createSignal<string>();
    const [progress, setProgress] = createSignal<{
        done: number;
        total: number;
    }>();

    let loading = false;

    async function showCachedPool() {
        const cached = await get<CachedPool>(LAST_POOL_KEY);
        if (!cached || pool()) return;
        const matches =
            (await get<CachedMatches>(matchesKey(cached.puuid))) ?? {};
        setPool(
            buildPersonalPool(
                Object.values(matches).filter((m): m is PoolMatch => !!m),
                new Map(cached.masteries),
            ),
        );
        setStatus("ready");
    }

    async function resolvePuuid(apiKey: string) {
        const fromClient = currentSummonerPuuid();
        if (fromClient) return fromClient;

        const riotId = parseRiotId(config.riotId);
        if (!riotId) {
            throw new Error(
                "Abre el cliente del LoL o pon tu Riot ID (Nombre#TAG) en Ajustes.",
            );
        }
        const account = await riotGet<RiotAccount>(
            regionalHost(config.riotPlatform),
            `riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
                riotId.gameName,
            )}/${encodeURIComponent(riotId.tagLine)}`,
            apiKey,
        );
        if (!account) {
            throw new Error(`No existe la cuenta ${config.riotId}.`);
        }
        return account.puuid;
    }

    async function refresh() {
        const apiKey = config.riotApiKey.trim();
        if (loading || !isDesktop || !apiKey) return;
        loading = true;
        setStatus("loading");
        setError(undefined);

        try {
            const puuid = await resolvePuuid(apiKey);
            const platform = platformHost(config.riotPlatform);
            const regional = regionalHost(config.riotPlatform);

            const masteryList =
                (await riotGet<RiotChampionMastery[]>(
                    platform,
                    `lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`,
                    apiKey,
                )) ?? [];
            const masteries = masteryList.map(
                (m) =>
                    [String(m.championId), m.championPoints] as [
                        string,
                        number,
                    ],
            );

            const ids =
                (await riotGet<string[]>(
                    regional,
                    `lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${RANKED_SOLO_QUEUE}&count=${MATCH_HISTORY_SIZE}`,
                    apiKey,
                )) ?? [];

            const cache = (await get<CachedMatches>(matchesKey(puuid))) ?? {};
            const missing = ids.filter((id) => !(id in cache));
            setProgress({ done: 0, total: missing.length });

            for (const [i, id] of missing.entries()) {
                await sleep(REQUEST_SPACING_MS);
                const match = await riotGet<RiotMatch>(
                    regional,
                    `lol/match/v5/matches/${id}`,
                    apiKey,
                );
                cache[id] = match ? summarizeMatch(id, match, puuid) : null;
                setProgress({ done: i + 1, total: missing.length });
                if ((i + 1) % 10 === 0) await set(matchesKey(puuid), cache);
            }

            // Only keep the matches still in the recent history.
            const recent: CachedMatches = {};
            for (const id of ids) recent[id] = cache[id] ?? null;
            await set(matchesKey(puuid), recent);
            await set(LAST_POOL_KEY, { puuid, masteries } satisfies CachedPool);

            setPool(
                buildPersonalPool(
                    Object.values(recent).filter((m): m is PoolMatch => !!m),
                    new Map(masteries),
                ),
            );
            setStatus("ready");
        } catch (e) {
            console.error("Personal pool refresh failed", e);
            setError(errorMessage(e));
            setStatus(pool() ? "ready" : "error");
        } finally {
            setProgress(undefined);
            loading = false;
        }
    }

    onMount(() => showCachedPool());

    // Refresh when the key, account or client account changes, and every
    // few minutes after that to pick up new games.
    createEffect(
        on(
            () => [
                config.riotApiKey,
                config.riotId,
                config.riotPlatform,
                currentSummonerPuuid(),
            ],
            () => refresh(),
        ),
    );
    const interval = setInterval(() => refresh(), REFRESH_INTERVAL_MS);
    onCleanup(() => clearInterval(interval));

    const entryFor = (championKey: string, role: Role) => {
        const p = pool();
        return p ? getPoolEntry(p, championKey, role) : undefined;
    };

    const isActive = () => config.personalPoolMode !== "off" && !!pool();

    return { pool, status, error, progress, refresh, entryFor, isActive };
}

const PersonalPoolContext =
    createContext<ReturnType<typeof createPersonalPoolContext>>();

export function PersonalPoolProvider(props: { children: JSXElement }) {
    const ctx = createPersonalPoolContext();

    return (
        <PersonalPoolContext.Provider value={ctx}>
            {props.children}
        </PersonalPoolContext.Provider>
    );
}

export function usePersonalPool() {
    const ctx = useContext(PersonalPoolContext);
    if (!ctx) throw new Error("No PersonalPoolContext found");

    return ctx;
}
