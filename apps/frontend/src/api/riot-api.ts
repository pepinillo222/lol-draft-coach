import { invoke } from "@tauri-apps/api/core";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class RiotApiError extends Error {
    constructor(
        message: string,
        public status?: number,
    ) {
        super(message);
    }
}

// GET a Riot API endpoint through the desktop backend. Returns null on 404.
// Waits and retries when the key's rate limit is hit.
export async function riotGet<T>(
    host: string,
    path: string,
    apiKey: string,
): Promise<T | null> {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            return (await invoke("riot_api_get", {
                host,
                path,
                apiKey,
            })) as T | null;
        } catch (e) {
            const message = String(e);
            const rateLimited = message.match(/^rate_limited:(\d+)/);
            if (rateLimited) {
                await sleep((Number(rateLimited[1]) + 1) * 1000);
                continue;
            }
            const status = message.match(/^riot_(\d+)/);
            throw new RiotApiError(
                message,
                status ? Number(status[1]) : undefined,
            );
        }
    }
    throw new RiotApiError("rate_limited", 429);
}

export type RiotAccount = { puuid: string; gameName: string; tagLine: string };

export type RiotChampionMastery = {
    championId: number;
    championPoints: number;
    championLevel: number;
};

export type RiotMatch = {
    info: {
        gameStartTimestamp: number;
        gameDuration: number;
        participants: {
            puuid: string;
            championId: number;
            teamPosition: string;
            win: boolean;
            gameEndedInEarlySurrender?: boolean;
        }[];
    };
};
