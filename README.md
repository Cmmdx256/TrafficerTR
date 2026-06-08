<img width="1094" height="613" alt="image" src="https://github.com/user-attachments/assets/198eba17-83cc-4226-a19a-aa6617b7f48d" />

# TrafficerTR

TrafficerTR is an Electron-based Minecraft bot client focused on multi-bot control, scripting, proxy tools, webhooks, Nuker controls, and Gemini-powered AI mode.

GitHub: [Cmmdx256/TrafficerTR](https://github.com/Cmmdx256/TrafficerTR)

## Current Version

- App build: TrafficerTR v1.4
- Package version: v1.4.0
- AI provider: Gemini only
- Default Gemini model: `gemini-flash-latest`
- Legacy Ollama/local AI has been removed

## Added In v1.4

- Nuker is active in Botting controls.
- Simple Nuker range slider: a value of `N` targets an `N x N` horizontal area around the bot.
- Advanced Nuker height controls: Up and Down extend the selected area vertically.
- Nuker block filter with blacklist and whitelist modes.
- Fastplace burst mode for sending the selected range quickly.
- Optional head rotation toggle for normal dig mode.
- Nuker Turkish/English UI translations.
- Nuker square range fixes so the selected range no longer collapses into a tiny tunnel.
- Scripting tab Gemini Script AI helper. It writes TrafficerTR scripts and inserts the result into the script editor.
- Aternos tab with list-based server checking UI and BETA discovery button.
- Hacking theme with animated green matrix-style background.
- More polished splash animation, smoother transitions, rounded controls, and UI overflow guards.
- Settings moved to the sidebar and improved to match the rest of the app.
- Custom GIF background support with remove button.
- App title/version label updated to v1.4.
- Interactive tab activated
- added readtime mode

## Fixed Or Stabilized In v1.4

- Duplicate Gemini requests and duplicate chat replies.
- Gemini quota/rate-limit queue behavior across multiple bots.
- Bot-name chat trigger: AI reacts only when the current bot login name appears in chat.
- Bot-name-only ping no longer causes random movement.
- `dur` / `stop` can interrupt movement immediately.
- `look_at unknown` no longer crashes the action path.
- Compound resource requests: collect logs, craft planks, craft crafting table, and give it to the player.
- Single-item give/drop behavior: the bot should not throw everything unless the command asks for everything.
- Vec3 safety for JSON/plain object positions from Gemini.
- `pos.floored is not a function` crash path in mobility position handling.
- Strict movement verification instead of trusting raw Pathfinder `goal_reached`.
- Recovery loop reduction in Mobility Engine.
- Spawn readiness: AI waits for entity, world, health, and food before activating.
- Front/back block detection bug: the system reads the block in front of the bot, not behind it.
- Settings layout overlap and background GIF display issues.
- Top-right minimize/close buttons restored and locked to the correct size.
- Turkish/English UI cleanup, including Settings/Ayarlar behavior.
- Offline bot cleanup: disconnected bot rows are removed after 30 seconds unless they reconnect.

## Under Maintenance

- AI Mode is still marked `BETA / UNDERMAINTENANCE` while the intent-driven autonomous agent layer is being stabilized.
- Nuker is active, but instant breaking depends on server anti-cheat, permissions, and protocol behavior.
- Aternos discovery is marked BETA.
- Some premium-labeled controls remain disabled.
- Minecraft `26.1`, `26.1.1`, and `26.1.2` are currently disabled. The installed PrismarineJS packages list the protocol number, but `minecraft-data` does not ship a real `data/pc/26.1/protocol.json` schema yet. Use `1.21.11` until native data is available.

## Current Features

- Start, stop, select, and monitor Minecraft bots.
- Chat, movement, hotbar, inventory, Anti-AFK, KillAura, Pathfinder, Interact, and scripting controls.
- Main-hand/off-hand support for selected interaction and held-item actions.
- Nuker with range, block filter, Fastplace, Blocks/tick, and optional head rotation controls.
- Gemini AI mode controlled from Minecraft chat.
- Multi-bot Gemini queue/rate-limit handling.
- Gemini Script AI helper for generating TrafficerTR scripts.
- Proxy list management, proxy testing, and proxy logs.
- Discord webhook notifications for bot actions, joins, kicks, chat, proxy logs, and feedback.
- Turkish and English language selection.
- Winter, Summer, and Hacking themes.
- Custom GIF background support.
- Real-time regional clock and day/night atmosphere.
- GitHub update checking.
- Ely.by authentication option.

## Gemini AI Usage

Enter your Gemini API key in the Botting AI section of the app, or set it before starting:

```powershell
$env:GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
npm run dev
```

Optional model override:

```powershell
$env:GEMINI_MODEL="gemini-flash-latest"
```

Optional queue interval:

```powershell
$env:GEMINI_MIN_INTERVAL_MS="2500"
```

AI mode listens only when the bot name appears in the Minecraft chat. If the bot joined as `cugus`, use:

```text
cugus gel
cugus beni takip et
cugus beni koru
cugus odun topla
cugus crafting table yap ve bana ver
cugus dur
cugus durum
```

If the bot joined with another name, use that name instead.

## Script AI Usage

Open Scripting and use the Script AI prompt field. Gemini is used only to generate TrafficerTR script text, then the generated script is inserted into the script editor.

The script generator is intended for built-in commands such as:

```text
chat
delay
repeat
select
sethotbar
useheld
interact
pathfinder
afkon
afkoff
```

## Nuker Usage

Open Botting > Nuker.

- `Simple range`: horizontal area size. Example: `8` means an `8 x 8` area around the bot.
- `Up` / `Down`: vertical height added to the selected area.
- `Blacklist`: breaks everything except protected/default-listed blocks and blocks you list.
- `Whitelist`: breaks only the block IDs you list.
- `Fastplace`: sends all collected blocks in the selected range as a burst.
- `Head rotate`: only affects normal dig mode when Fastplace is off.
- `Blocks/tick`: only used when Fastplace is off.

Block names must use Minecraft IDs such as:

```text
dirt,grass_block,stone,oak_log,sand
```

## Aternos Tab

The Aternos page is for checking server names entered by the user and logging successful/failed results. Use it only for servers you own, manage, or have permission to test.

The discovery button is marked BETA. Avoid high concurrency or abusive scanning behavior.

## Intent-Based AI Design

Gemini should decide what the bot should do, not how to physically do it.

Gemini should produce intents such as:

```json
{
  "intent": "follow_player",
  "target": "speaker",
  "parameters": {
    "near": 2
  },
  "reason": "The player asked the bot to follow."
}
```

The engines then handle:

- entity selection
- coordinates
- movement
- pathfinding
- mining execution
- combat execution
- crafting
- placement
- recovery

## In Development

- Full TrafficerAI v2 Agent OS architecture.
- Intent Router and Skill Registry separation.
- Persistent World Model.
- SQLite-backed long-term memory.
- Minecraft Brain knowledge layer.
- Knowledge Graph for recipes, tools, progression, and dependencies.
- Goal Manager.
- Planner with task trees.
- Dedicated Mining Engine.
- Dedicated Crafting Engine.
- Dedicated Combat Engine.
- Dedicated Building Engine.
- Survival Engine overrides for hunger, health, armor, threats, and danger.
- Reflection Engine for learning from failures.

## Install

Requirements:

- Node.js
- npm
- Gemini API key for AI features

Install dependencies:

```bash
npm install
```

Run development mode:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Package for Windows:

```bash
npm run build:win
```

## Developer

Maintained by Glock (Cmmdx256).

TrafficerTR is being developed toward a persistent autonomous Minecraft Agent OS, with Gemini as the strategic cortex and deterministic engines as the body.
