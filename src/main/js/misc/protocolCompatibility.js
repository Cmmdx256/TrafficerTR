const Module = require('node:module')
const fs = require('node:fs')

let mineflayerInventoryPatchInstalled = false

function installMineflayerInventoryPatch() {
  if (mineflayerInventoryPatchInstalled) return
  mineflayerInventoryPatchInstalled = true

  const originalLoader = Module._extensions['.js']
  Module._extensions['.js'] = function patchedMineflayerInventory(module, filename) {
    const normalized = filename.replace(/\\/g, '/')
    if (!normalized.endsWith('/mineflayer/lib/plugins/inventory.js')) {
      return originalLoader(module, filename)
    }

    let source = fs.readFileSync(filename, 'utf8')
    source = source.replace(
      'if (packet.entityId === bot.entity.id && packet.entityStatus === 9 && !eatingTask.done) {',
      'if (bot.entity && packet.entityId === bot.entity.id && packet.entityStatus === 9 && !eatingTask.done) {'
    )
    return module._compile(source, filename)
  }
}

installMineflayerInventoryPatch()
