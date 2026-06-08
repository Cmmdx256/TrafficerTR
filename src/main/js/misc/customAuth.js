import { createRequire } from 'module'

const require = createRequire(import.meta.url)

function loadMojangAuth() {
  const candidates = [
    'minecraft-protocol/src/client/mojangAuth',
    'minecraft-protocol/dist/client/mojangAuth'
  ]

  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch {
      // Try the next package layout.
    }
  }

  throw new Error(
    'Ely.by auth requires the modern PrismarineJS minecraft-protocol package. Reinstall minecraft-protocol@^1.66.2.'
  )
}

export function applyElyByAuth(options) {
  options.auth = (client, authOptions) => loadMojangAuth()(client, authOptions)
  options.authServer = 'https://authserver.ely.by'
  options.sessionServer = 'https://sessionserver.ely.by'
  options.profilesFolder = false
  return options
}
