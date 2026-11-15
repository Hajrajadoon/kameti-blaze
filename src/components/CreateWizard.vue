<script setup>
import { ref, computed } from 'vue'
import { wallet } from '../store.js'
import { deriveAddress } from '../chain.js'
import { ADDRESS_PREFIX } from '../config.js'
import {
  bchToSats,
  satsToBch,
  validate,
  MIN_MEMBERS,
  MAX_MEMBERS,
  DEFAULT_WINDOW_DAYS,
  AGREEMENT_RULES,
  NOTE_MAX,
} from '../circle.js'

const props = defineProps({
  errors: { type: Array, default: () => [] },
  creating: { type: Boolean, default: false },
})
const emit = defineEmits(['create'])

const stepTitles = ['Basics', 'Members and order', 'Agreement and review']
const step = ref(1)
const stepErrors = ref([])
const walletMsg = ref('')

const name = ref('')
const amountBch = ref('0.0001')
const every = ref(1)
const unit = ref('months')
const payWindow = ref(DEFAULT_WINDOW_DAYS)
const startDate = ref(new Date().toISOString().slice(0, 10))
const orderMode = ref('draw') // 'draw' = blockchain draw, 'manual' = list order, 'demo' = instant demo draw
const drawLead = ref(3)
const firstIdx = ref(-1) // priority seat: member who takes round 1 (-1 = nobody)
const members = ref([
  { name: '', address: '' },
  { name: '', address: '' },
  { name: '', address: '' },
])
const ruleIds = ref(AGREEMENT_RULES.map(r => r.id))
const note = ref('')

const needFirst = computed({
  get: () => firstIdx.value === 0,
  set: v => {
    firstIdx.value = v ? 0 : -1
  },
})

const allErrors = computed(() => [...stepErrors.value, ...props.errors])
const sats = computed(() => bchToSats(amountBch.value))
const potText = computed(() =>
  sats.value > 0 ? satsToBch(sats.value * members.value.length) : '',
)
const orderText = computed(() => {
  if (orderMode.value === 'manual') return 'Set by hand: the list order is the payout order'
  const base = orderMode.value === 'demo' ? 'Instant demo draw (demos only)' : 'Blockchain draw'
  if (firstIdx.value >= 0) {
    const who = members.value[firstIdx.value]?.name || `Member ${firstIdx.value + 1}`
    return `${base}, with ${who} on the priority seat`
  }
  return base
})
const chosenRules = computed(() => AGREEMENT_RULES.filter(r => ruleIds.value.includes(r.id)))

function buildInput() {
  return {
    name: name.value,
    members: members.value.map(m => ({ name: m.name.trim(), address: m.address.trim() })),
    amountSats: bchToSats(amountBch.value),
    startDate: startDate.value,
    every: Number(every.value),
    unit: unit.value,
    payWindow: Number(payWindow.value),
    first: orderMode.value !== 'manual' && firstIdx.value >= 0 ? firstIdx.value : undefined,
    agreement: { rules: [...ruleIds.value], note: note.value.trim() },
  }
}

function basicErrors() {
  const e = []
  if (!name.value.trim()) e.push('Give the circle a name.')
  const s = bchToSats(amountBch.value)
  if (!Number.isInteger(s) || s < 1000 || s > 100_000_000) {
    e.push('Amount per member must be between 0.00001 and 1 BCH.')
  }
  const ev = Number(every.value)
  if (!(Number.isInteger(ev) && ev >= 1 && ev <= 366)) {
    e.push('"Pay every" must be a whole number from 1 to 366.')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate.value || '')) e.push('Choose the first round date.')
  const periodDays = unit.value === 'days' ? ev : unit.value === 'weeks' ? 7 * ev : 28 * ev
  if (Number(payWindow.value) > periodDays) e.push('The payment window cannot be longer than one round.')
  return e
}

function next() {
  stepErrors.value = []
  if (step.value === 1) {
    const e = basicErrors()
    if (e.length) {
      stepErrors.value = e
      return
    }
    step.value = 2
  } else if (step.value === 2) {
    const e = validate(buildInput())
    if (e.length) {
      stepErrors.value = e
      return
    }
    step.value = 3
  }
  window.scrollTo({ top: 0 })
}

function back() {
  stepErrors.value = []
  if (step.value > 1) step.value -= 1
  window.scrollTo({ top: 0 })
}

function submit() {
  stepErrors.value = []
  const input = buildInput()
  const e = validate(input)
  if (e.length) {
    stepErrors.value = e
    return
  }
  emit('create', { input, orderMode: orderMode.value, drawLead: Number(drawLead.value) })
}

// Fills Member 1 with the address of the connected wallet, so nobody has to copy and paste it
function useMyWallet() {
  walletMsg.value = ''
  if (!wallet.ready || !wallet.manager) {
    walletMsg.value = 'Connect your wallet first, with the Connect Wallet button at the top of this page.'
    return
  }
  try {
    const address = deriveAddress(wallet.manager, 0, 0)
    if (members.value.some((m, i) => i > 0 && m.address.trim().toLowerCase() === address.toLowerCase())) {
      walletMsg.value = 'This wallet is already listed as another member.'
      return
    }
    members.value[0].address = address
    walletMsg.value = 'Member 1 is now your connected wallet. Type your name next to it.'
  } catch (e) {
    walletMsg.value = 'Could not read your wallet address: ' + (e?.message || String(e))
  }
}

function addMember() {
  if (members.value.length < MAX_MEMBERS) members.value.push({ name: '', address: '' })
}

function removeMember(i) {
  if (members.value.length <= MIN_MEMBERS) return
  members.value.splice(i, 1)
  if (firstIdx.value === i) firstIdx.value = -1
  else if (firstIdx.value > i) firstIdx.value -= 1
}

function move(i, delta) {
  const j = i + delta
  if (j < 0 || j >= members.value.length) return
  const list = [...members.value]
  ;[list[i], list[j]] = [list[j], list[i]]
  members.value = list
}
</script>

<template>
  <form class="wizard" @submit.prevent>
    <h2>Create a circle</h2>

    <ol class="progress" aria-label="Steps">
      <li v-for="(t, i) in stepTitles" :key="t" :class="{ on: step === i + 1, done: step > i + 1 }">
        <span>{{ i + 1 }}</span> {{ t }}
      </li>
    </ol>

    <!-- Step 1 -->
    <section v-if="step === 1" class="step">
      <label>
        Circle name
        <input v-model="name" maxlength="60" placeholder="For example: Family savings circle" />
      </label>
      <label>
        Amount per member, per round (BCH)
        <input v-model="amountBch" inputmode="decimal" />
      </label>
      <p v-if="potText" class="muted">
        Each round the receiver collects about {{ potText }} BCH in total ({{ members.length }} members
        paying this amount, the receiver's own share included).
      </p>
      <div class="row">
        <label>
          Pay every
          <input v-model.number="every" type="number" min="1" max="366" />
        </label>
        <label>
          Unit
          <select v-model="unit">
            <option value="days">days</option>
            <option value="weeks">weeks</option>
            <option value="months">months</option>
          </select>
        </label>
        <label>
          First round date
          <input v-model="startDate" type="date" />
        </label>
      </div>
      <label>
        Everyone pays within the first
        <select v-model.number="payWindow">
          <option :value="3">3 days of each round</option>
          <option :value="5">5 days of each round</option>
          <option :value="7">7 days of each round (recommended)</option>
          <option :value="10">10 days of each round</option>
        </select>
      </label>
      <p class="muted">
        All members pay the round's receiver inside this window, so the receiver gets the whole amount
        at once and not in pieces through the month.
      </p>
    </section>

    <!-- Step 2 -->
    <section v-if="step === 2" class="step">
      <h3>Members</h3>
      <p class="muted">
        Use each member's wallet address on this network ({{ ADDRESS_PREFIX }}:...). Paste addresses, never type them.
      </p>
      <p>
        <button type="button" class="secondary" @click="useMyWallet">Use my connected wallet as Member 1</button>
      </p>
      <p v-if="walletMsg" class="muted" role="status">{{ walletMsg }}</p>

      <div v-for="(m, i) in members" :key="i" class="member">
        <span class="num">{{ i + 1 }}</span>
        <input v-model="m.name" :placeholder="i === 0 ? 'Member 1 name (you)' : `Member ${i + 1} name`" maxlength="40" />
        <input v-model="m.address" :placeholder="`${ADDRESS_PREFIX}:q...`" />
        <template v-if="orderMode === 'manual'">
          <button type="button" class="secondary" :disabled="i === 0" title="Move up" @click="move(i, -1)">↑</button>
          <button type="button" class="secondary" :disabled="i === members.length - 1" title="Move down" @click="move(i, 1)">↓</button>
        </template>
        <button type="button" class="secondary" :disabled="members.length <= MIN_MEMBERS" title="Remove" @click="removeMember(i)">✕</button>
      </div>
      <p>
        <button type="button" class="secondary" :disabled="members.length >= MAX_MEMBERS" @click="addMember">+ Add member</button>
      </p>

      <h3>Who receives first?</h3>
      <label class="check">
        <input v-model="orderMode" type="radio" value="draw" />
        <span>Blockchain draw (recommended). A future block hash decides the order, so nobody can control it.</span>
      </label>
      <label class="check">
        <input v-model="orderMode" type="radio" value="manual" />
        <span>Set by hand. The list order above is the payout order.</span>
      </label>
      <label class="check">
        <input v-model="orderMode" type="radio" value="demo" />
        <span>Instant demo draw (demos only, not fair for real circles).</span>
      </label>

      <label v-if="orderMode === 'draw'">
        The draw happens
        <select v-model.number="drawLead">
          <option :value="1">after 1 block (testing)</option>
          <option :value="3">after about 3 blocks (about 30 minutes)</option>
          <option :value="6">after about 6 blocks (about 1 hour)</option>
          <option :value="12">after about 12 blocks (about 2 hours)</option>
        </select>
      </label>
      <p v-if="orderMode === 'draw'" class="muted">
        Everyone should open the circle link and check the member list before the draw.
      </p>

      <div v-if="orderMode !== 'manual'" class="first">
        <label class="check">
          <input v-model="needFirst" type="checkbox" />
          <span><strong>I need the first turn.</strong> Member 1 (you) receives in round 1, and the draw decides everyone else.</span>
        </label>
        <label>
          Or give the first turn to
          <select v-model.number="firstIdx">
            <option :value="-1">Nobody: the draw decides everyone</option>
            <option v-for="(m, i) in members" :key="i" :value="i">{{ m.name || `Member ${i + 1}` }}</option>
          </select>
        </label>
        <p v-if="firstIdx >= 0" class="muted">
          Use this only when the whole group agrees before the circle starts. The first receiver
          carries the most trust, so agree only if you know them.
        </p>
      </div>
      <p v-else class="muted">In "set by hand" mode, Member 1 receives first. Use the arrows to change the order.</p>
    </section>

    <!-- Step 3 -->
    <section v-if="step === 3" class="step">
      <h3>Group agreement</h3>
      <p class="muted">
        Write down the group's rules now. They are saved with the circle, and everyone sees them before paying.
        The two rules marked "always included" protect the circle's principles.
      </p>
      <label v-for="r in AGREEMENT_RULES" :key="r.id" class="check">
        <input v-model="ruleIds" type="checkbox" :value="r.id" :disabled="r.locked" />
        <span>{{ r.text }} <em v-if="r.locked" class="muted">(always included)</em></span>
      </label>
      <label>
        Your own note (optional, {{ note.length }}/{{ NOTE_MAX }})
        <textarea v-model="note" :maxlength="NOTE_MAX" rows="3" placeholder="For example: the heir for Ali is his brother Omar."></textarea>
      </label>

      <h3>Review</h3>
      <dl class="review">
        <dt>Circle</dt><dd>{{ name || '(no name yet)' }}</dd>
        <dt>Amount</dt><dd>{{ amountBch }} BCH per member, every {{ every }} {{ unit }}, from {{ startDate }}</dd>
        <dt>Pay window</dt><dd>first {{ payWindow }} days of each round</dd>
        <dt>Members</dt><dd>{{ members.map(m => m.name || '?').join(', ') }}</dd>
        <dt>Order</dt><dd>{{ orderText }}</dd>
        <dt>Rules</dt><dd>{{ chosenRules.length }} agreed<span v-if="note.trim()"> plus a note</span></dd>
      </dl>
      <p class="muted">Members cannot be forced to pay. The app records the rules and shows who is late.</p>
    </section>

    <ul v-if="allErrors.length" role="alert" class="errs">
      <li v-for="e in allErrors" :key="e">{{ e }}</li>
    </ul>

    <div class="nav">
      <button v-if="step > 1" type="button" class="secondary" @click="back">Back</button>
      <button v-if="step < 3" type="button" @click="next">Next</button>
      <button v-else type="button" :disabled="creating" @click="submit">
        {{ creating ? 'Reading the blockchain...' : 'Create circle' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.wizard { display: grid; gap: 0.8rem; }
.progress { display: flex; gap: 0.5rem; list-style: none; padding: 0; margin: 0 0 0.5rem; flex-wrap: wrap; }
.progress li { border: 1px solid var(--line); border-radius: 999px; padding: 0.25rem 0.75rem; color: var(--muted); font-size: 0.9rem; }
.progress li span { display: inline-block; width: 1.4rem; text-align: center; border-radius: 50%; background: var(--card-2); margin-right: 0.3rem; }
.progress li.on { border-color: var(--mint); color: var(--ink); }
.progress li.on span { background: var(--mint); color: #07130E; }
.progress li.done { color: var(--mint); }
.step { display: grid; gap: 0.75rem; }
label { display: grid; gap: 0.25rem; }
input, select, textarea { padding: 0.5rem; font-size: 1rem; width: 100%; }
.row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: end; }
.row label { flex: 1; min-width: 9rem; }
.member { display: flex; gap: 0.4rem; align-items: center; }
.member .num { width: 1.5rem; text-align: right; color: var(--muted); }
.member input:nth-of-type(1) { width: 28%; }
.member input:nth-of-type(2) { flex: 1; }
.check { display: flex; gap: 0.6rem; align-items: flex-start; }
.check input { width: auto; margin-top: 0.3rem; }
.first { background: var(--card-2); border: 1px solid var(--line); border-radius: 10px; padding: 0.7rem 0.9rem; display: grid; gap: 0.6rem; }
.review { display: grid; grid-template-columns: 8rem 1fr; gap: 0.3rem 1rem; background: var(--card-2); border: 1px solid var(--line); border-radius: 10px; padding: 0.8rem 1rem; margin: 0; }
.review dt { color: var(--muted); }
.review dd { margin: 0; overflow-wrap: anywhere; }
.errs { margin: 0; padding-left: 1.2rem; }
.nav { display: flex; gap: 0.6rem; }
@media (max-width: 560px) { .member { flex-wrap: wrap; } .member input:nth-of-type(1), .member input:nth-of-type(2) { width: 100%; flex: none; } .review { grid-template-columns: 1fr; } }
</style>