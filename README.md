<img width="1094" height="613" alt="image" src="https://github.com/user-attachments/assets/198eba17-83cc-4226-a19a-aa6617b7f48d" />



# TrafficerTR

TrafficerTR is an Electron-based Minecraft bot client focused on multi-bot control, scripting, proxy tools, webhooks, and Gemini-powered AI mode.

GitHub: [Cmmdx256/TrafficerTR](https://github.com/Cmmdx256/TrafficerTR)

## Current Version

- App build: TrafficerTR v1.3
- Package version: v1.3.0
- AI provider: Gemini only
- Default Gemini model: `gemini-flash-latest`
- Legacy Ollama/local AI has been removed

## Added In v1.3

- Nuker is now active in the Botting controls.
- Simple Nuker range slider: a value of `N` targets an `N x N` horizontal area around the bot.
- Advanced Nuker height controls: Up and Down extend the selected area vertically.
- Nuker block filter with blacklist and whitelist modes.
- Fastplace mode for sending the whole selected range in one burst.
- Optional head rotation toggle for normal dig mode.
- Nuker Turkish/English UI translations.
- Nuker no longer depends on the bot's look direction when Simple range is used.
- Nuker avoids digging the bot's own support block in Simple range mode.
- App title/version label updated to v1.3.

## Added In v1.2 Fixed

- Gemini-only AI mode with API key field in the Botting AI section.
- Gemini model selector with `gemini-flash-latest`.
- Intent-based command layer for commands such as come, follow, protect, gather, explore, craft, eat, sleep, and stop.
- Live player-follow intent: `BotName gel` and `BotName yanima gel` track the player entity instead of a stale coordinate.
- Closed-loop action execution: execute, verify, recover, retry, and remember.
- Mobility Engine v2 state tracking: `IDLE`, `PLANNING`, `MOVING`, `RECOVERING`, `COMPLETED`, `FAILED`.
- Compact local 3D world snapshot for Gemini context.
- Action memory for recent actions, outcomes, failures, and recovery attempts.
- Custom GIF background support in Settings, with remove button.
- Theme controls automatically pause while a custom GIF background is active.
- Ely.by authentication option.
- GitHub update link and in-app GitHub About link.
- Provider queue/rate-limit status in AI status output.
- Offline bot cleanup: disconnected bot rows are removed after 30 seconds unless they reconnect.

## Fixed Or Being Stabilized

- Duplicate Gemini requests and duplicate chat replies.
- Gemini quota/rate-limit queue behavior across multiple bots.
- Bot-name chat trigger: AI now reacts only when the bot's current login name is mentioned.
- Bot-name-only ping no longer causes movement.
- `dur` / `stop` can interrupt movement immediately.
- `look_at unknown` now attempts nearest visible context instead of failing as an unknown action.
- Compound wood request handling: collect logs, craft planks, craft crafting table, and give it to the player.
- Vec3 safety for JSON/plain object positions from Gemini.
- `pos.floored is not a function` crash path in mobility position handling.
- Strict movement verification instead of trusting raw Pathfinder `goal_reached`.
- Recovery loop reduction in Mobility Engine.
- Spawn readiness: AI waits for entity, world, health, and food before activating.
- Front/back block detection bug: the system now reads the block in front of the bot, not behind it.
- Settings layout overlap and background GIF display issues.
- About text and Turkish/English UI cleanup.
- Nuker range collection incorrectly creating narrow tunnels instead of the selected square area.
- Nuker Fastplace falling back to one-block digging because of stale `Blocks/tick` settings.

## Under Maintenance

- AI Mode is still marked `BETA / UNDERMAINTENANCE` while the intent-driven autonomous agent layer is being stabilized.
- Nuker is active, but server anti-cheat/protocol behavior can still limit instant block breaking on some servers.
- Some premium-labeled controls remain disabled.
- Minecraft `26.1`, `26.1.1`, and `26.1.2` remain listed but disabled until native protocol support is reliable.

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

## Current Features

- Start, stop, select, and monitor Minecraft bots.
- Chat, movement, hotbar, inventory, Anti-AFK, KillAura, Pathfinder, and scripting controls.
- Nuker with range, block filter, Fastplace, and optional head rotation controls.
- Gemini AI mode controlled from Minecraft chat.
- Multi-bot Gemini queue/rate-limit handling.
- Proxy list management, proxy testing, and proxy logs.
- Discord webhook notifications for bot actions, joins, kicks, chat, proxy logs, and feedback.
- Turkish and English language selection.
- Summer/Winter themes.
- Custom GIF background support.
- Real-time day/night atmosphere.
- GitHub update checking.

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

AI mode listens only when the bot name is mentioned. If the bot joined as `cugus`, use:

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

## Install

Requirements:

- Node.js
- npm
- Gemini API key

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

Maintained by Glock (Cmmdx).

TrafficerTR is being developed toward a persistent autonomous Minecraft Agent OS, with Gemini as the strategic cortex and deterministic engines as the body.

---------------------------

AI used somewhere 
