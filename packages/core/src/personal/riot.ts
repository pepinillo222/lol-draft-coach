// Riot API platform (server) -> regional routing value.
export const REGION_BY_PLATFORM = {
    euw1: "europe",
    eun1: "europe",
    tr1: "europe",
    ru: "europe",
    me1: "europe",
    na1: "americas",
    br1: "americas",
    la1: "americas",
    la2: "americas",
    kr: "asia",
    jp1: "asia",
    oc1: "sea",
    sg2: "sea",
    tw2: "sea",
    vn2: "sea",
} as const;

export type RiotPlatform = keyof typeof REGION_BY_PLATFORM;

export const RIOT_PLATFORMS = Object.keys(REGION_BY_PLATFORM) as RiotPlatform[];

export function platformHost(platform: RiotPlatform) {
    return `${platform}.api.riotgames.com`;
}

export function regionalHost(platform: RiotPlatform) {
    return `${REGION_BY_PLATFORM[platform]}.api.riotgames.com`;
}

// "Name#TAG" -> { gameName, tagLine }
export function parseRiotId(riotId: string) {
    const [gameName, tagLine, ...rest] = riotId.trim().split("#");
    if (!gameName || !tagLine || rest.length) return undefined;
    return { gameName: gameName.trim(), tagLine: tagLine.trim() };
}
