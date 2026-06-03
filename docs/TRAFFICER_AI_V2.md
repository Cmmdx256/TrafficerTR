# TrafficerAI v2 Architecture

TrafficerAI v2 is a Mineflayer-based Minecraft Agent OS layer. Mineflayer remains the body, deterministic engines remain the hands, and Gemini remains the cortex that selects high-level intents.

## Core Rule

Gemini must not control raw coordinates, mouse/camera, inventory clicks, pathfinder goals, combat execution, or mining execution. Gemini outputs intent. Engines execute.

## Runtime Stack

- World Model: persistent discoveries, players, danger zones, resources.
- Memory System: short-term state plus long-term lessons, successes, failures, and experiences.
- Minecraft Brain: registry-backed item/block lookup plus progression knowledge.
- Knowledge Graph: dependency trees for resources and progression.
- Goal Manager: prioritized goal queue.
- Planner: converts goals into skill steps.
- Skill Registry: reusable, independently executable skills.
- Mobility Engine: movement, recovery, bridge/tunnel/stair/terrain modification support.
- Spatial Reasoning: compact navigation and terrain summaries.
- Local Snapshot: compact LLM-safe observation.
- Engines: Survival, Mining, Crafting, Combat, Building, Exploration.
- Reflection Engine: converts failures into lessons.
- Learning/RL Interfaces: experience collection and future policy-training hooks.
- Agent Coordinator: routes work to Survival, Mining, Combat, Builder, Explorer, and Coordinator agents.

## Implemented In This Sprint

- `src/main/js/ai/v2/runtime.js`
- `src/main/js/ai/v2/worldModel.js`
- `src/main/js/ai/v2/memorySystem.js`
- `src/main/js/ai/v2/minecraftBrain.js`
- `src/main/js/ai/v2/knowledgeGraph.js`
- `src/main/js/ai/v2/goalManager.js`
- `src/main/js/ai/v2/planner.js`
- `src/main/js/ai/v2/skillRegistry.js`
- `src/main/js/ai/v2/spatialReasoning.js`
- `src/main/js/ai/v2/localWorldSnapshot.js`
- `src/main/js/ai/v2/agentCoordinator.js`
- `src/main/js/ai/v2/engines/*`

## Current State

The v2 runtime is connected to the existing Gemini intent pipeline. High-level intents such as `follow_player`, `protect_player`, `gather_wood`, `gather_resource`, `craft_item`, `smelt_item`, `explore_cave`, `obtain_iron`, and `obtain_diamond` can route through the v2 planner and skill registry.

Progression planning is graph-driven instead of playthrough-driven. `KnowledgeGraph` stores item/resource solutions, requirements, rough risk/time/efficiency scores, aliases, and quantities. `Planner` recursively expands a goal into prerequisite tasks, compares available solution strategies, carries counts down dependency chains, and merges repeated resource requests. For example, `obtain_diamond` resolves through the selected diamond strategy, discovers the need for an iron pickaxe, expands iron ingot, raw iron, furnace, fuel, stone tools, cobblestone, planks, logs, and executable skills without a fixed diamond script.

Minecraft Brain now contributes dynamic knowledge from the Mineflayer/minecraft-data registry. It can create graph nodes for craftable items by reading recipes, convert recipe ingredients into requirements, account for recipe output counts, and fall back to gather actions for known blocks/items. Higher-level goal templates such as `build_house`, `build_shelter`, and `make_farm` describe objective-level needs; the planner then recursively expands subrequirements such as logs, cobblestone, glass, torch, door, furnace, fuel, sand, planks, and sticks through the same graph instead of relying on a hardcoded playthrough.

Mining intelligence is catalog-driven. `MinecraftBrain` knows the major ore families: coal, copper, iron, gold, redstone, lapis, diamond, emerald, quartz, and ancient debris, including aliases, ore blocks, drops, required pickaxe tier, dimension hints, progression use, and priority. Generic mining commands such as `ore`, `maden`, or `madenleri topla` route through the ore catalog and rank nearby loaded ores by value, tool suitability, distance, and danger instead of treating "maden" as a literal block name. The mining brain also knows the unlock order: wooden pickaxe for stone/coal, stone pickaxe for iron/copper/lapis, iron pickaxe for diamond/gold/redstone/emerald, and diamond pickaxe for ancient debris. If a requested ore cannot be mined with the current inventory, the executor reports the missing pickaxe prerequisite instead of wasting attempts on an impossible block.

Before cave or ore collection, mining preflight ensures the bot has at least a pickaxe path. If no pickaxe exists, the planner expands `wooden_pickaxe` into logs, planks, sticks, crafting table, and craft action before cave exploration. Pickaxe upgrades follow the same dependency model: stone pickaxe requires wooden pickaxe plus cobblestone; iron pickaxe requires stone mining, raw iron, furnace, fuel, and smelting; diamond pickaxe requires iron-pickaxe mining of diamonds. Missing-tool recovery routes back into the V2 planner instead of blindly retrying the blocked ore.

Mobility is adaptive rather than single-path. `GeminiMobilityEngine` watches pathfinder status, local terrain, hazards, gaps, water, threats, and stuck state. When direct navigation fails it rotates recovery strategies, attempts terrain modification, tries midpoint route candidates, tries safe approach positions around the target, and records failures/dead ends. Bridge, tower, stair, and tunnel recovery actions now verify block placement/digging results instead of assuming success.

The following behaviors execute real Mineflayer actions:

- Follow/come to player through Mobility Engine.
- Protect player through threat selection and combat.
- Gather wood/resources through block search, navigation, tool equip, and digging.
- Craft and smelt through registry/recipe-backed execution.
- Explore through deterministic terrain scoring instead of random walking.
- Build starter shelter through real block placement.
- Harvest/replant nearby mature crops.
- Open villager trading and execute the first affordable trade.
- Give specific inventory items or all items only when explicitly requested.

Some future systems remain intentionally expandable:

- Reinforcement learning policy training
- Advanced villager trade planning
- Large template libraries
- Procedural base generation
- Full SQLite adapter

These interfaces exist so future sprints can fill behavior without rewriting the architecture.
