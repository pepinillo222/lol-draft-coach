import { For, Match, Show, Switch as SolidSwitch } from "solid-js";
import { ButtonGroup } from "../common/ButtonGroup";
import { Button } from "../common/Button";
import { useUser } from "../../contexts/UserContext";
import { usePersonalPool } from "../../contexts/PersonalPoolContext";
import { PersonalPoolMode } from "@draftgap/core/src/models/user/Config";
import { RIOT_PLATFORMS, RiotPlatform } from "@draftgap/core/src/personal/riot";

const inputClass =
    "text-lg py-1 px-2 block w-full rounded-md bg-neutral-800 placeholder:text-neutral-500 text-neutral-100";

const modeOptions: { value: PersonalPoolMode; label: string }[] = [
    { value: "off", label: "Off" },
    { value: "boost", label: "Priorizar mi pool" },
    { value: "pool-only", label: "Solo mi pool" },
];

export function PersonalPoolSettings() {
    const { config, setConfig } = useUser();
    const { pool, status, error, progress, refresh } = usePersonalPool();

    return (
        <div>
            <h3 class="text-3xl uppercase">Mi pool</h3>
            <p class="text-neutral-400 mt-1">
                Ordena las sugerencias según cómo juegas tú cada campeón: tus
                últimas 100 partidas de SoloQ y tu maestría.
            </p>

            <label class="flex flex-col gap-1 mt-2">
                <span class="text-lg uppercase">Riot API key</span>
                <input
                    type="password"
                    class={inputClass}
                    placeholder="RGAPI-..."
                    value={config.riotApiKey}
                    onChange={(e) =>
                        setConfig({ riotApiKey: e.currentTarget.value.trim() })
                    }
                />
            </label>

            <div class="flex gap-2 mt-2">
                <label class="flex flex-col gap-1 flex-1">
                    <span class="text-lg uppercase">Riot ID</span>
                    <input
                        class={inputClass}
                        placeholder="Nombre#TAG"
                        value={config.riotId}
                        onChange={(e) =>
                            setConfig({ riotId: e.currentTarget.value.trim() })
                        }
                    />
                </label>
                <label class="flex flex-col gap-1">
                    <span class="text-lg uppercase">Servidor</span>
                    <select
                        class={inputClass}
                        value={config.riotPlatform}
                        onChange={(e) =>
                            setConfig({
                                riotPlatform: e.currentTarget
                                    .value as RiotPlatform,
                            })
                        }
                    >
                        <For each={RIOT_PLATFORMS}>
                            {(platform) => (
                                <option value={platform}>
                                    {platform.toUpperCase()}
                                </option>
                            )}
                        </For>
                    </select>
                </label>
            </div>
            <p class="text-neutral-500 text-sm mt-1">
                Con el cliente del LoL abierto se usa tu cuenta automáticamente.
            </p>

            <div class="flex flex-col gap-1 mt-2">
                <span class="text-lg uppercase">Sugerencias</span>
                <ButtonGroup
                    options={modeOptions}
                    selected={config.personalPoolMode}
                    size="sm"
                    onChange={(value: PersonalPoolMode) =>
                        setConfig({ personalPoolMode: value })
                    }
                />
            </div>

            <div class="flex items-center justify-between gap-4 mt-3">
                <span class="text-neutral-300">
                    <SolidSwitch>
                        <Match when={!config.riotApiKey}>
                            Pon tu API key para activar el pool.
                        </Match>
                        <Match when={status() === "loading"}>
                            Cargando partidas
                            <Show when={progress()?.total}>
                                {" "}
                                ({progress()!.done}/{progress()!.total})
                            </Show>
                            ...
                        </Match>
                        <Match when={error()}>{error()}</Match>
                        <Match when={pool()}>
                            {pool()!.totalGames} partidas cargadas,{" "}
                            {Math.round(pool()!.overallWinrate * 100)}% de
                            victorias.
                        </Match>
                    </SolidSwitch>
                </span>
                <Button
                    variant="secondary"
                    disabled={!config.riotApiKey || status() === "loading"}
                    onClick={() => refresh()}
                >
                    Actualizar
                </Button>
            </div>
        </div>
    );
}
