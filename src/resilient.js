import { provider } from './chain.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const retryable = e =>
  /connect|connection|closed|timeout|timed out|disconnect|socket|network/i.test(String(e?.message || e))

// The connection to the blockchain server can drop for a moment.
// Every request is tried a few times before an error is shown.
for (const name of [
  'getUtxos',
  'getBlockHeight',
  'getRawTransaction',
  'sendRawTransaction',
  'performRequest',
]) {
  const original = provider[name]
  if (typeof original !== 'function') continue
  provider[name] = async function (...args) {
    let last
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await original.apply(provider, args)
      } catch (e) {
        last = e
        if (!retryable(e)) throw e
        await sleep(600 * (attempt + 1))
      }
    }
    throw last
  }
}