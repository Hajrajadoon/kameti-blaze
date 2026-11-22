import {
  binToHex,
  hexToBin,
  decodeTransaction,
  cashAddressToLockingBytecode,
} from '@bitauth/libauth'
import { provider } from './chain.js'

const STORE_KEY = 'kameti-tx-v1'
const MAX_SAVED = 600

// A transaction never changes once it exists, so what we learn about it can be kept for good.
const memory = new Map()

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return
    for (const [txid, v] of Object.entries(JSON.parse(raw))) {
      memory.set(txid, {
        notes: v.n,
        outputs: v.o.map(([lockingHex, sats]) => ({ lockingHex, sats: BigInt(sats) })),
        inputs: v.i.map(([prevTxid, index]) => ({ txid: prevTxid, index })),
      })
    }
  } catch (e) {
    // storage may be blocked or damaged: start empty
  }
}
load()

let saveTimer = null
function saveSoon() {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    try {
      const obj = {}
      for (const [txid, v] of [...memory.entries()].slice(-MAX_SAVED)) {
        obj[txid] = {
          n: v.notes,
          o: v.outputs.map(o => [o.lockingHex, o.sats.toString()]),
          i: v.inputs.map(i => [i.txid, i.index]),
        }
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(obj))
    } catch (e) {
      // not being able to save is fine
    }
  }, 1500)
}

export function lockingBytecodeOf(address) {
  const r = cashAddressToLockingBytecode(address)
  if (typeof r === 'string') throw new Error('Bad address: ' + r)
  return r.bytecode
}

// Electrum servers index addresses by "scripthash"
export async function scripthashOf(address) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', lockingBytecodeOf(address)))
  return binToHex(digest.reverse())
}

// Reads the text chunks of an OP_RETURN output, or returns null if it is not one
function parseNote(script) {
  if (script[0] !== 0x6a) return null
  const chunks = []
  let i = 1
  while (i < script.length) {
    const op = script[i++]
    let len
    if (op >= 1 && op <= 75) len = op
    else if (op === 0x4c) len = script[i++]
    else return null
    if (i + len > script.length) return null
    chunks.push(new TextDecoder().decode(script.slice(i, i + len)))
    i += len
  }
  return chunks
}

const inflight = new Map()

// What we need to know about a transaction: its notes, outputs and inputs
export function readTx(txid) {
  if (memory.has(txid)) return Promise.resolve(memory.get(txid))
  if (inflight.has(txid)) return inflight.get(txid)
  const job = (async () => {
    const hex = await provider.performRequest('blockchain.transaction.get', txid, false)
    const tx = decodeTransaction(hexToBin(hex))
    if (typeof tx === 'string') throw new Error('Could not decode transaction ' + txid)
    const info = {
      notes: [],
      outputs: tx.outputs.map(o => ({ lockingHex: binToHex(o.lockingBytecode), sats: o.valueSatoshis })),
      inputs: tx.inputs.map(i => ({ txid: binToHex(i.outpointTransactionHash), index: i.outpointIndex })),
    }
    for (const out of tx.outputs) {
      const note = parseNote(out.lockingBytecode)
      if (note) info.notes.push(note)
    }
    memory.set(txid, info)
    saveSoon()
    return info
  })().finally(() => inflight.delete(txid))
  inflight.set(txid, job)
  return job
}

// Runs fn over the items, a few at a time. A failed item gives undefined.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      try {
        results[i] = await fn(items[i], i)
      } catch (e) {
        results[i] = undefined
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// A circle cannot be paid before it exists, so older transactions are skipped.
export const earliestHeight = circle =>
  Number.isInteger(circle.drawHeight) && circle.drawHeight > 0 ? Math.max(1, circle.drawHeight - 40) : 0

export async function getHistory(address, minHeight = 0) {
  const list = await provider.performRequest(
    'blockchain.scripthash.get_history',
    await scripthashOf(address),
  )
  const all = Array.isArray(list) ? list : []
  return minHeight > 0 ? all.filter(e => e.height <= 0 || e.height >= minHeight) : all
}