# TrafficerAI V3 Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    TrafficerAI V3 Runtime                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │   LLM Cortex     │         │  Curriculum      │              │
│  │ (What to do?)    │────────→│  System (Goals)  │              │
│  └──────────────────┘         └──────────────────┘              │
│           │                                                     │
│           ├──→ ┌─────────────────────────────────┐              │
│               │   Intent Router                 │              │
│               │ (Route to appropriate engine)  │              │
│               └──────────────┬──────────────────┘              │
│                              │                                 │
│        ┌─────────────────────┼─────────────────────┐            │
│        │                     │                     │            │
│        ↓                     ↓                     ↓            │
│   ┌─────────────┐   ┌─────────────┐    ┌─────────────┐        │
│   │  Skill      │   │  Agent      │    │  Action     │        │
│   │  Registry   │   │  Coordinator│    │  Execution  │        │
│   │ (Skills)    │   │ (Orchestrate)   │  Loop       │        │
│   └──────┬──────┘   └──────┬──────┘    └──────┬──────┘        │
│          │                 │                   │              │
│          └─────────────────┼───────────────────┘              │
│                            │                                  │
│                 ┌──────────┴──────────┐                       │
│                 │                     │                       │
│        ┌────────↓────────┐   ┌───────↓────────┐              │
│        │   Specialized   │   │    Survival    │              │
│        │     Engines     │   │    Engine      │              │
│        │ Mining/Crafting │   │(PRIORITY)      │              │
│        │ Combat/Building │   └────────────────┘              │
│        │ Exploration     │                                   │
│        └────────┬────────┘                                   │
│                 │                                            │
│        ┌────────↓──────────────────────────┐                │
│        │   Mobility Engine / Mineflayer   │                │
│        │ (HOW: Movement, Pathfinding)     │                │
│        └────────┬──────────────────────────┘                │
│                 │                                            │
│        ┌────────↓──────────────────────────┐                │
│        │   Bot (Mineflayer Connection)    │                │
│        └──────────────────────────────────┘                │
│                                                             │
├─────────────────────────────────────────────────────────────│
│                    Memory & Learning                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Memory     │  │  Reflection  │  │ Experience  │      │
│  │   System     │  │   Engine     │  │   Record    │      │
│  │ (Short/Long) │  │ (Learn from  │  │ (All logs)  │      │
│  │              │  │  failures)   │  │             │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                  Knowledge & World Models                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Minecraft    │  │  Knowledge   │  │   World     │      │
│  │  Brain       │  │   Graph      │  │   Model     │      │
│  │ (Recipes,    │  │ (Dependencies)  │ (Locations) │      │
│  │  Tools)      │  │              │  │             │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Principle

**LLM answers: "What should I do?"**
**System decides: "How do I do it?"**

### Why This Matters

- **Deterministic Runtime:** All movement, combat, mining, crafting is deterministic (no LLM guessing)
- **Fast Execution:** Real-time gameplay decisions don't wait for LLM
- **Learnable:** System learns from failures and adapts strategies
- **Scalable:** Can run multiple bots without LLM bottleneck
- **Recoverable:** If LLM goes down, bot can still execute queued goals

---

## System Components

### 1. LLM Cortex (`llmCortex.js`)

**Responsibility:** Strategic decision-making

**Input:**
```javascript
{
  worldSnapshot: {           // Compact 3D state
    position: {x, y, z},
    health: 10,
    food: 15,
    inventory: [...],
    nearbyEntities: [...],
    threats: [...]
  },
  currentGoal: "obtain_iron",
  recentFailures: [...],
  lessons: [...],
  availableGoals: [...]
}
```

**Output:**
```javascript
{
  intent: "gather_wood",
  reason: "Need wood for crafting table",
  priority: 80,
  parameters: { quantity: 64 },
  estimatedDuration: "5 minutes"
}
```

**Rules:**
- ✅ Decides WHAT to do
- ❌ Never decides HOW to do it
- ❌ Never generates movement commands
- ❌ Never generates coordinates
- ✅ Considers safety and survival
- ✅ Uses past failures to improve decisions
- ✅ Suggests 1 intent at a time

### 2. Intent Router (`intentRouter.js`)

**Responsibility:** Dispatch intents to specialized handlers

**Routing Logic:**
```
gather_* → Mining Engine + Crafting Engine
explore_* → Exploration Engine
attack_*, hunt_* → Combat Engine
build_*, place_* → Building Engine
follow_* → Mobility Engine
craft_* → Crafting Engine
eat, sleep, hide → Survival Engine (PRIORITY)
```

**Flow:**
```
Intent → Route → Engine → Skill Registry → Execute
```

### 3. Curriculum System (`curriculumSystem.js`)

**Responsibility:** Auto-generate progression goals

**Four Progression Tiers:**

```
TIER 1 (Hour 0: Survival Foundation)
├── gather_wood (8 logs)
├── craft_crafting_table
├── craft_wooden_pickaxe
└── craft_wooden_sword

TIER 2 (Hour 1: Stone Age)
├── mine_stone (32+ cobblestone)
├── craft_stone_pickaxe
├── craft_furnace
├── mine_coal (8+ coal)
└── build_basic_shelter

TIER 3 (Hour 2: Iron Age)
├── mine_iron (16+ iron_ore)
├── smelt_iron (16+ iron_ingots)
├── craft_iron_pickaxe
├── craft_iron_sword
├── craft_iron_armor
└── find_village (optional)

TIER 4+ (Hour 3: Diamond & Beyond)
├── mine_diamond
├── craft_diamond_pickaxe
├── find_nether_portal
├── explore_nether
└── defeat_dragon (ultimate)
```

**Generation:**
- Start with Tier 1
- Unlock Tier 2 when Tier 1 complete (50% threshold)
- Unlock Tier 3 when Tier 2 complete
- Generate new challenges from discoveries

### 4. Skill Registry (`skillRegistry.js`)

**Responsibility:** Centralized skill execution

**Skill Categories:**

```
Movement Skills:
├── navigate_to_target(x, y, z, options)
├── climb_surface(block)
├── bridge_gap(width, material)
├── tunnel_through(direction, length)
└── recover_from_stuck()

Mining Skills:
├── mine_block(blockType, range)
├── mine_vein(oreType, range)
├── harvest_tree(radius)
└── dig_tunnel(direction, length)

Crafting Skills:
├── craft_item(item, count)
├── use_furnace(input, duration)
├── use_workbench(recipe)
└── collect_ingredients(item, count)

Combat Skills:
├── attack_target(entity)
├── dodge_attack()
├── manage_health()
└── select_weapon(target)

Building Skills:
├── place_block(block, position)
├── construct_structure(type)
└── place_foundation()

Utility Skills:
├── eat_food(type)
├── sleep_in_bed()
├── take_item(item, count)
└── throw_item(item, count)
```

### 5. Skill Composition Engine (`skillComposition.js`)

**Responsibility:** Build skill chains automatically

**Example: Obtain Iron**

```
Goal: obtain_iron
└─ Requires: stone_pickaxe
   ├─ Requires: stone (3x)
   │  └─ Requires: wood (2x)
   │     └─ Skill: harvest_tree()
   │        └─ Action: craft_planks() → craft_crafting_table()
   │           └─ Skill: mine_stone() → Skill: craft_stone_pickaxe()
   │
   └─ Requires: stick (2x)
      └─ Requires: wood (2x)
         └─ Skill: harvest_tree()

Final Chain:
1. harvest_tree()
2. craft_planks()
3. craft_crafting_table()
4. mine_stone(3)
5. craft_stone_pickaxe()
6. mine_iron(1)
7. smelt_iron()
8. craft_iron_pickaxe()
```

### 6. Action Execution Loop

**Flow:**

```
1. LLM selects intent
   ↓
2. Intent Router routes to engine
   ↓
3. Engine expands into skill chain
   ↓
4. Execute first skill
   ├─ EXECUTE: Attempt skill
   ├─ VERIFY: Check if successful
   ├─ RECOVER: If failed, try alternative
   └─ RETRY: Up to N attempts
   ↓
5. Collect experience
   ├─ Duration
   ├─ Resources used
   ├─ Success/failure
   └─ Threat level
   ↓
6. If failed → Reflection Engine
   ├─ Analyze why
   ├─ Generate lesson
   └─ Update strategy
   ↓
7. Continue to next skill
   ↓
8. Return result to memory
```

### 7. Agent Coordinator (`agentCoordinator.js`)

**Responsibility:** Select which agent controls execution

**Agent Priority:**

```
1. SURVIVAL AGENT (Highest Priority - Always check first)
   └─ Health < 8 or Food < 4?
      ├─ Eat food
      ├─ Hide from threats
      └─ Retreat to safe location

2. COMBAT AGENT
   └─ Hostile entity detected?
      ├─ Evaluate threat level
      ├─ Select weapon
      └─ Engage or evade

3. ACTIVE GOAL AGENT
   └─ Current goal manager?
      ├─ Mining Agent (mine_*, gather_*)
      ├─ Crafting Agent (craft_*, smelt_*)
      ├─ Building Agent (build_*, place_*)
      ├─ Exploration Agent (explore_*)
      └─ Farming Agent (farm_*, breed_*)

4. DEFAULT: EXPLORATION AGENT
   └─ Discover new biomes
   └─ Scout for resources
   └─ Map terrain
```

### 8. Survival Engine (`engines/survivalEngine.js`)

**Responsibility:** Health/food management (CRITICAL PATH)

**Monitoring:**

```javascript
const risk = {
  health: 10,           // Out of 20
  food: 12,             // Out of 20
  critical: health <= 8 || food <= 4,
  hungry: food <= 12,
  armor: 2              // Out of 4 pieces
}
```

**Actions:**

```
Critical Health?
├─ Stop current task
├─ Retreat 20 blocks
├─ Eat food until safe
└─ Return to task

Starving?
├─ Eat available food
├─ Hunt mobs for meat
└─ Farm crops
```

### 9. Mining Engine (`engines/miningEngine.js`)

**Responsibility:** Ore location and extraction

**Strategy:**

```
1. Scan for ore (branch mining pattern)
2. Identify vein
3. Select pickaxe (match ore level)
4. Approach
5. Mine all blocks in vein
6. Collect drops
7. Log location for future reference
```

### 10. Crafting Engine (`engines/craftingEngine.js`)

**Responsibility:** Item creation

**Process:**

```
1. Query Minecraft Brain for recipe
2. Collect ingredients (auto-use Mining Engine if needed)
3. Find workbench/furnace
4. Execute craft/smelt
5. Verify output
6. Store results
```

### 11. Combat Engine (`engines/combatEngine.js`)

**Responsibility:** Mob engagement

**Logic:**

```
1. Identify threat (type, distance, health)
2. Evaluate risk (can we win?)
3. Select weapon (best available)
4. Engage:
   ├─ Attack when in range
   ├─ Dodge attacks
   └─ Heal if needed
5. Collect drops
```

### 12. Building Engine (`engines/buildingEngine.js`)

**Responsibility:** Structure construction

**Templates:**

```
Basic Shelter:
  └─ 5x5x3 room
     ├─ Door
     ├─ Bed
     ├─ Chest
     └─ Furnace

Farm:
  └─ 10x10 plot
     ├─ Soil
     ├─ Water channel
     └─ Seeds planted

Bridge:
  └─ 1-wide path
     ├─ 3 blocks high
     └─ Support columns
```

### 13. Exploration Engine (`engines/explorationEngine.js`)

**Responsibility:** World mapping and POI discovery

**Features:**

```
1. Scan biome (recognize type)
2. Identify POIs:
   ├─ Villages (shelter, trading)
   ├─ Temples (loot)
   ├─ Caves (resources)
   ├─ Structures (unique blocks)
   └─ Water (fishing, drowning hazard)
3. Record location
4. Assess resources
5. Mark threats
6. Route to next unexplored chunk
```

### 14. Minecraft Brain (`minecraftBrain.js`)

**Responsibility:** Complete Minecraft knowledge database

**Contains:**

```javascript
{
  recipes: {
    crafting_table: {
      requires: [{ item: 'plank', count: 4 }],
      produces: 1,
      duration: 0
    },
    iron_pickaxe: {
      requires: [
        { item: 'iron_ingot', count: 3 },
        { item: 'stick', count: 2 }
      ],
      produces: 1,
      duration: 0
    },
    // ... 500+ recipes
  },
  
  tools: {
    wooden_pickaxe: { tier: 1, durability: 60, speed: 1.2 },
    stone_pickaxe: { tier: 2, durability: 132, speed: 1.8 },
    // ...
  },
  
  ores: {
    diamond: {
      minHeight: -64,
      maxHeight: 16,
      requiredTool: 'iron_pickaxe',
      drops: 'diamond'
    },
    // ...
  },
  
  mobs: {
    zombie: {
      hostile: true,
      drops: ['rotten_flesh', 'iron_ingot'],
      health: 20,
      damage: 3
    },
    // ...
  }
}
```

### 15. Knowledge Graph (`knowledgeGraph.js`)

**Responsibility:** Dependency resolution

**Format:**

```javascript
define('diamond_pickaxe', {
  solutions: [
    {
      name: 'craft_from_diamond_and_sticks',
      requires: ['diamond:3', 'stick:2', 'crafting_table'],
      action: { skill: 'craft_item', args: { item: 'diamond_pickaxe' } },
      risk: 1,
      time: 3,
      efficiency: 9
    }
  ]
})
```

**Query:**

```
node('diamond_pickaxe') →
  └─ Find all solutions
     └─ Evaluate risk/time/efficiency
        └─ Select best solution
           └─ Resolve dependencies recursively
              └─ Return skill chain
```

### 16. Memory System (`memorySystem.js`)

**Storage:**

```javascript
{
  shortTerm: {
    currentGoal: 'obtain_iron',
    currentPlan: [...],
    inventory: {...}
  },
  
  longTerm: {
    discoveries: [
      { type: 'village', pos: {x, y, z}, at: timestamp },
      { type: 'cave', pos: {x, y, z}, at: timestamp }
    ],
    failures: [
      { reason: 'stone_pickaxe_missing', context: {...}, at: timestamp }
    ],
    successes: [
      { reason: 'obtained_iron:5', context: {...}, at: timestamp }
    ],
    lessons: [
      { text: 'Always check pickaxe before mining', at: timestamp }
    ],
    knownLocations: {...},
    knownResources: {...}
  },
  
  learning: [
    { 
      goal: 'obtain_iron',
      skill: 'mine_iron',
      success: true,
      duration: 2500,
      resources: { pickaxe_durability: -5 },
      at: timestamp
    }
  ]
}
```

**Persistence:** Saved to `trafficer-ai-v2-memory.json`

### 17. Reflection Engine (`reflectionEngine.js`)

**Responsibility:** Learn from failures

**Process:**

```
Failure Event: "stone_pickaxe_missing"
    ↓
Analyze:
├─ What happened? (tried to mine iron without pickaxe)
├─ Why? (forgot to check inventory)
├─ How to prevent? (check requirements before action)
└─ Store lesson
    ↓
Update Strategy:
├─ Next time: verify pickaxe before mining
├─ Next time: craft pickaxe if missing
└─ Share lesson with planner
```

### 18. Experience Record (`experienceRecord.js`)

**Responsibility:** Log every action for analysis

**Record Format:**

```javascript
{
  timestamp: 1234567890,
  goal: 'obtain_iron',
  intent: 'mine_iron_ore',
  skill: 'mine_ore',
  
  execution: {
    startPos: {x, y, z},
    endPos: {x, y, z},
    duration: 2500,
    attempts: 1,
    status: 'success'
  },
  
  outcome: {
    itemsObtained: { raw_iron: 3 },
    resourcesUsed: { pickaxe_durability: 5 },
    threatening: false,
    threatLevel: 0,
    reward: 1.5
  },
  
  context: {
    biome: 'forest',
    weather: 'clear',
    time: 'day',
    nearbyPlayers: 1,
    nearbyMobs: 0
  }
}
```

### 19. World Model (`worldModel.js`)

**Responsibility:** Local state tracking

**State:**

```javascript
{
  bases: {},          // Player-built structures
  villages: {},       // NPC villages
  mines: {},          // Mining sites
  caves: {},          // Cave systems
  portals: {},        // Nether portals
  dangerZones: {},    // Mob spawn areas
  resources: {},      // Known resource clusters
  players: {},        // Other player locations
  structures: {}      // Generated structures
}
```

### 20. Local World Snapshot (`localWorldSnapshot.js`)

**Responsibility:** Create compact context for LLM

**Output:**

```javascript
{
  position: { x: 123, y: 64, z: -456 },
  
  inventory: {
    items: [
      { name: 'wooden_pickaxe', count: 1 },
      { name: 'wood', count: 10 }
    ],
    totalSlots: 36,
    usedSlots: 2
  },
  
  threats: [
    { name: 'zombie', distance: 12, health: 10 },
    { name: 'creeper', distance: 8, health: 20 }
  ],
  
  nearby: {
    trees: 5,
    ores: ['coal_ore:3', 'iron_ore:1'],
    utilities: ['furnace:1', 'chest:1']
  },
  
  health: 18,
  food: 15,
  
  recentFailures: [
    'stone_pickaxe_missing',
    'stuck_in_terrain'
  ]
}
```

---

## Data Flow Examples

### Example 1: Autonomous "Gather Wood"

```
1. LLM Cortex analyzes world
   └─ Sees: crafting_table needed, not in inventory
   └─ Decides: intent=gather_wood

2. Intent Router routes to Mining Engine
   └─ Executes skill: harvest_tree

3. Skill Registry runs harvest_tree
   └─ Movement Engine finds nearest tree
   └─ Break all wood blocks
   └─ Collect drops

4. Action Loop verifies
   └─ Check inventory: wood count increased? ✓

5. Experience recorded
   └─ Goal: gather_wood
   └─ Result: success
   └─ Duration: 2500ms
   └─ Items: +5 wood

6. Memory updated
   └─ longTerm.successes += "gathered_wood"
   └─ Confidence: +1

7. Planner next step
   └─ craft_planks() ready to execute
```

### Example 2: Learning From Failure

```
1. Goal: mine_iron

2. Execute: mine_iron_ore
   └─ Result: FAILED
   └─ Reason: "stone_pickaxe_missing"

3. Reflection Engine
   └─ Analyze: Why? (forgot to check requirements)
   └─ Lesson: "Check pickaxe before mining"
   └─ Store: memory.lessons += lesson

4. Future decision
   └─ Same goal again?
   └─ Planner checks: do I have stone_pickaxe?
   └─ If no: add craft_stone_pickaxe to plan
   └─ If yes: proceed with mining

5. Prevented failure
   └─ Time saved: avoided retry loop
   └─ Efficiency: +10%
```

### Example 3: Survival Override

```
1. Current task: mining_coal

2. Survival Engine monitors
   └─ Check health: 7 (CRITICAL)
   └─ Check food: 3 (CRITICAL)

3. Trigger override
   └─ Stop mining task
   └─ Route to Survival Agent

4. Survival Agent executes
   └─ Retreat 20 blocks
   └─ Eat available food
   └─ Check health: now 15 (safe)

5. Resume original task
   └─ Continue mining_coal where left off
```

---

## Integration Points

### With Mineflayer

```
Skill Registry
    ↓
Movement Skill: navigate_to_target
    ↓
Mobility Engine / Pathfinder
    ↓
Mineflayer API
    ↓
Minecraft Server
```

### With Gemini (LLM)

```
Local World Snapshot
    ↓
Format compact context
    ↓
Send to Gemini: "What should I do next?"
    ↓
Gemini generates intent
    ↓
Intent Router
    ↓
Execute through engines
    ↓
Record experience
    ↓
Next iteration
```

---

## Performance Considerations

### Memory Management

- **Episodic Buffer:** Keep last 100 actions
- **Failure Buffer:** Keep last 50 failures
- **Location Buffer:** Keep last 200 discovered locations
- **Lesson Buffer:** Keep all lessons (usually <100)

### Execution Speed

- **LLM Decision:** ~5s (async, happens in background)
- **Skill Execution:** ~100ms to ~30s (depends on skill)
- **Verification:** ~500ms (check if goal achieved)
- **Recovery:** ~2s per retry attempt

### Resource Usage

- **Memory File:** ~5-50MB (depending on session length)
- **JSON Parsing:** Negligible
- **CPU:** Event-driven (low when idle)

---

## Success Metrics

✅ Bot autonomously gathers wood
✅ Bot crafts without chat commands
✅ Bot mines stone and smelts iron
✅ Bot recovers from failures
✅ Bot learns from mistakes (no repeated failures)
✅ Bot survives indefinitely (eats, hides)
✅ Bot completes multi-hour progression chain
✅ Bot adapts strategy based on learned lessons
✅ Bot explores and discovers new resources
✅ Bot achieves self-selected goals

---

## Next Implementation Steps

1. ✅ Create LLM Cortex module
2. ✅ Create Intent Router
3. ✅ Enhance Curriculum System
4. Create Skill Composition Engine
5. Create Action Execution Loop
6. Create Experience Record System
7. Enhance Reflection Engine
8. Test integration with runtime
9. Validate with multi-hour session
10. Document lessons learned
