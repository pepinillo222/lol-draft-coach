# Draft Coach

Asistente personal de draft para League of Legends: recomienda campeones y builds según el draft, en una ventana aparte (pensado para un segundo monitor).

Basado en [DraftGap](https://github.com/vigovlugt/draftgap) de Vigo Vlugt (licencia MIT, ver `LICENSE`). DraftGap pone el motor de draft, la sincronización con el cliente del LoL y las estadísticas diarias.

## Qué añade sobre DraftGap

Hecho:
- App de escritorio para Windows con nombre propio, sin el actualizador automático de DraftGap.

Planeado:
- **Pool personal**: las recomendaciones tienen en cuenta tus partidas y tu maestría (Riot API).
- **Builds según el draft**: ajustes según el perfil de daño, la curación, el aguante y el control del equipo rival.
- **Plan de partida con IA local** (Ollama) por cada draft.

## Cómo instalarlo (Windows)

1. Ve a la pestaña **Actions** del repositorio, elige **Release** y pulsa **Run workflow**.
2. Cuando termine (unos 15 minutos), abre la pestaña **Releases** y descarga el instalador `.exe`.
3. Instálalo y ábrelo con el cliente del LoL abierto. Durante la selección de campeones detecta el draft automáticamente.

Windows puede avisar de "editor desconocido" porque la app no está firmada: pulsa "Más información" y luego "Ejecutar de todas formas".

## Desarrollo

Requiere [Bun](https://bun.sh) y Rust.

```bash
bun install
bun run dev          # versión web en http://localhost:3000
cd apps/frontend && bun x tauri dev   # app de escritorio
```

Más detalles técnicos en `AGENTS.md`.
