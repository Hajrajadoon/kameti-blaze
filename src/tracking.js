import { binToHex } from '@bitauth/libauth'
import { readTx, getHistory, lockingBytecodeOf, mapLimit, earliestHeight } from './txcache.js'

const NOTE_TAG = 'KAMETI'
const DAY_MS = 86_400_000

// A round is late once its whole due day (UTC) has passed
export const isLate = dueDateIso => Date.now() > Date.parse(dueDateIso) + DAY_MS

/**
 * Returns one entry per round: { [payerNumber]: { txid, height } }
 * payerNumber is the member's fixed number (1 = first member in the list).
 * Every round is read at the same time, and old transactions are skipped.
 */
export async function trackPayments(circle, rounds, id) {
  const n = circle.members.length
  const minHeight = earliestHeight(circle)

  return Promise.all(
    rounds.map(async round => {
      const paid = {}
      const recipientHex = binToHex(lockingBytecodeOf(round.recipient.address))
      const history = await getHistory(round.recipient.address, minHeight)
      const infos = await mapLimit(history, 6, entry => readTx(entry.tx_hash))

      history.forEach((entry, k) => {
        const info = infos[k]
        if (!info) return
        for (const note of info.notes) {
          if (note[0] !== NOTE_TAG || note[1] !== id || Number(note[2]) !== round.round) continue
          const payer = Number(note[3])
          if (!Number.isInteger(payer) || payer < 1 || payer > n || payer === round.recipientNo) continue

          let received = 0n
          for (const o of info.outputs) if (o.lockingHex === recipientHex) received += o.sats

          if (received >= BigInt(round.amountSats) && !paid[payer]) {
            paid[payer] = { txid: entry.tx_hash, height: entry.height }
          }
        }
      })
      return paid
    }),
  )
}