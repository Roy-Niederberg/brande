import fs from 'fs'
import gemini from './providers/gemini.js'

const providers_map = { gemini }
const read = (name, ex = 'txt') => fs.readFileSync(`./data/${name}.${ex}`, 'utf-8')

let providers_config

const load_config = () => {
  const config = JSON.parse(read('providers_config', 'json'))
  providers_config = config.providers
    .filter(p => p.enabled)
    .map(p => ({ provider: providers_map[p.name], config: p.config }))
    .filter(p => p.provider)
  if (!providers_config.length) throw new Error('No enabled providers in providers_config.json')
}

load_config()

export const generate = async (prompt) => {
  const errors = []
  for (const { provider, config } of providers_config) {
    try {
      console.log(`Trying provider: ${provider.name}`)
      return await provider.generate(prompt, config)
    } catch (e) {
      console.error(`Provider ${provider.name} failed:`, e.message)
      errors.push({ provider: provider.name, error: e.message })
    }
  }
  throw new Error(`All providers failed: ${JSON.stringify(errors)}`)
}

export const reload_config = () => load_config()
