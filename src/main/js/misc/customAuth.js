import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const mojangAuth = require('minecraft-protocol/src/client/mojangAuth')

export function applyElyByAuth(options) {
  options.auth = (client, authOptions) => mojangAuth(client, authOptions)
  options.authServer = 'https://authserver.ely.by'
  options.sessionServer = 'https://sessionserver.ely.by'
  options.profilesFolder = false
  return options
}
