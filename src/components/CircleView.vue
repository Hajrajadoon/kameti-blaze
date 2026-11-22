<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { wallet } from '../store.js'
import { deriveAddress, scanWallet, formatBch } from '../chain.js'
import { sendPayment } from '../payment.js'
import { circleId, getRounds, DEFAULT_WINDOW_DAYS } from '../circle.js'
import { trackPayments, isLate } from '../tracking.js'
import { getHeight, getBlockHash, drawOrder, DRAW_CONFIRMATIONS } from '../draw.js'
import { fetchEvents, resolveEvents } from '../events.js'
import { windowText, buildCalendar, downloadText } from '../reminders.js'
import { NETWORK } from '../config.js'
import EventsPanel from './EventsPanel.vue'
import AgreementCard from './AgreementCard.vue'

const props = defineProps({
  circle: { type: Object, required: true },
})
defineEmits(['demo-copy'])

// Safety cap per payment. Raise it deliberately before real use on mainnet.
const MAX_CIRCLE_SATS = 200_000n // 0.002 BCH: a small safety cap for the first mainnet tests
const FEE_BUFFER_SATS = 1000n // rough allowance for the network fee of one payment

const meIdx = ref(-1) // member found from the connected wallet, -1 = the wallet is not a member
const previewIdx = ref(-1) // view-only choice when no wallet is connected
const busyRound = ref(null)
const errorText = ref('')
const lastTx = ref('')
const lastPaidText = ref('')
let controller = null

const paid = ref([]) // paid[roundIndex][memberNumber] = { txid, height }
const tracking = ref(false)
const trackError = ref('')
const lastTracked = ref('')
const circleIdText = ref('')
let statusSeq = 0 // so an older, slower answer can never replace a newer one

// balance check for reminders
const balanceInfo = ref(null)
const balanceBusy = ref(false)
const balanceError = ref('')

// circle changes (join, leave, swap) read from the blockchain
const ev = ref(null)
const evLoading = ref(false)
const evError = ref('')
let evTimer = null

const windowDays = computed(() => props.circle.payWindow || DEFAULT_WINDOW_DAYS)

// ----- dice draw -----
const hasDraw = computed(
  () => Number.isInteger(props.circle.drawHeight) && props.circle.drawHeight > 0,
)
const hasPriority = computed(
  () =>
    Number.isInteger(props.circle.first) &&
    props.circle.first >= 0 &&
    props.circle.first < props.circle.members.length,
)
const drawStatus = ref(hasDraw.value ? 'loading' : 'none') // none | loading | pending | ready | error
const drawError = ref('')
const currentHeight = ref(0)
const blockHash = ref('')
const seq = ref(null)
let drawTimer = null

const orderReady = computed(() => !hasDraw.value || drawStatus.value === 'ready')
const remainingBlocks = computed(() =>
  Math.max(0, props.circle.drawHeight + DRAW_CONFIRMATIONS - currentHeight.value),
)

// ----- the circle as it is now (after joins, leaves and swaps) -----
const baseOrder = computed(() => seq.value || props.circle.members.map((_, i) => i))
const effCircle = computed(() =>
  ev.value ? { ...props.circle, members: ev.value.universe } : props.circle,
)
const effOrder = computed(() => (ev.value ? ev.value.order : baseOrder.value))
const rounds = computed(() => getRounds(effCircle.value, effOrder.value))

// who the page shows "owes" for: the connected wallet's member, else the preview choice
const viewIdx = computed(() => (meIdx.value >= 0 ? meIdx.value : previewIdx.value))
const viewActive = computed(() => viewIdx.value >= 0 && effOrder.value.includes(viewIdx.value))
const isActive = computed(() => meIdx.value >= 0 && effOrder.value.includes(meIdx.value))

// names, so every sentence on the page says who it is about
const meName = computed(() => (meIdx.value >= 0 ? effCircle.value.members[meIdx.value]?.name || '' : ''))
const viewName = computed(() => (viewIdx.value >= 0 ? effCircle.value.members[viewIdx.value]?.name || '' : ''))
const myReceiveRound = computed(() => {
  if (meIdx.value < 0) return 0
  return rounds.value.findIndex(r => r.recipientNo === meIdx.value + 1) + 1
})
const idClass = computed(() => {
  if (!wallet.ready) return 'id-off'
  return meIdx.value >= 0 && isActive.value ? 'id-ok' : 'id-warn'
})

// The hash of a block that is already 2 blocks deep never changes, so it is remembered
const hashKey = h => `kameti-hash-${NETWORK}-${h}`
function cachedHash(h) {
  try {
    const v = localStorage.getItem(hashKey(h))
    return v && /^[0-9a-f]{64}$/.test(v) ? v : null
  } catch (e) {
    return null
  }
}
function saveHash(h, v) {
  try {
    localStorage.setItem(hashKey(h), v)
  } catch (e) {
    // fine
  }
}

async function loadDraw() {
  if (!hasDraw.value) return
  try {
    drawError.value = ''
    let hash = cachedHash(props.circle.drawHeight)
    if (!hash) {
      const height = await getHeight()
      currentHeight.value = height
      if (height < props.circle.drawHeight + DRAW_CONFIRMATIONS) {
        drawStatus.value = 'pending'
        return
      }
      hash = await getBlockHash(props.circle.drawHeight)
      saveHash(props.circle.drawHeight, hash)
    }
    const id = await circleId(props.circle)
    seq.value = await drawOrder(
      hash,
      id,
      props.circle.members.length,
      hasPriority.value ? props.circle.first : -1,
    )
    blockHash.value = hash
    drawStatus.value = 'ready'
    if (drawTimer) {
      clearInterval(drawTimer)
      drawTimer = null
    }
    detectMe()
    refreshAll()
  } catch (e) {
    console.error('Draw failed:', e)
    drawStatus.value = 'error'
    drawError.value = e?.message || String(e)
  }
}

async function loadEvents() {
  if (!orderReady.value) return
  evLoading.value = true
  evError.value = ''
  try {
    const id = await circleId(props.circle)
    const list = await fetchEvents(props.circle, id)
    ev.value = await resolveEvents(props.circle, baseOrder.value, list)
    detectMe()
  } catch (e) {
    console.error('Reading circle changes failed:', e)
    evError.value = 'Could not read circle changes: ' + (e?.message || String(e))
  } finally {
    evLoading.value = false
  }
}

// Seat changes and payments are read at the same time. If a seat change altered the order
// or the member list, the payments are read once more with the new order.
async function refreshAll() {
  const signature = () => effOrder.value.join(',') + '|' + effCircle.value.members.length
  const before = signature()
  await Promise.all([loadEvents(), refreshStatus()])
  if (signature() !== before) await refreshStatus()
}

// While some change is not in a block yet, look again every 30 seconds
watch(
  () => Boolean(ev.value?.log?.some(item => item.tentative || item.status === 'waiting')),
  waiting => {
    if (waiting && !evTimer) {
      evTimer = setInterval(() => {
        if (!evLoading.value) refreshAll()
      }, 30000)
    } else if (!waiting && evTimer) {
      clearInterval(evTimer)
      evTimer = null
    }
  },
)

// The round whose period has started most recently (-1 = no round has started yet)
const currentRoundIndex = computed(() => {
  const now = Date.now()
  let idx = -1
  rounds.value.forEach((r, i) => {
    if (new Date(r.periodStart).getTime() <= now) idx = i
  })
  return idx
})

// paying and posting changes need a real, connected member wallet
const canPay = computed(
  () => wallet.ready && isActive.value && busyRound.value === null && orderReady.value,
)

// A round can only be paid once its pay window has opened (so a later seat swap cannot misdirect money)
const windowOpen = r => Date.now() >= Date.parse(r.periodStart)

// 'self' | 'paid' | 'late' | 'pending' for a member number in a round
function statusFor(roundIdx, memberNo) {
  const round = rounds.value[roundIdx]
  if (round.recipientNo === memberNo) return 'self'
  if (paid.value[roundIdx]?.[memberNo]) return 'paid'
  return isLate(round.dueDate) ? 'late' : 'pending'
}

// Columns of the status grid follow the payout order
const cellStatus = (roundIdx, colIdx) => statusFor(roundIdx, rounds.value[colIdx].recipientNo)

// In round i everybody except its receiver pays. These lists name who has paid and who has not.
const payersOf = roundIdx => rounds.value.filter((_, j) => j !== roundIdx)
const paidNames = roundIdx =>
  payersOf(roundIdx)
    .filter(c => paid.value[roundIdx]?.[c.recipientNo])
    .map(c => c.recipient.name)
const unpaidNames = roundIdx =>
  payersOf(roundIdx)
    .filter(c => !paid.value[roundIdx]?.[c.recipientNo])
    .map(c => c.recipient.name)

function paidCount(roundIdx) {
  return Object.keys(paid.value[roundIdx] || {}).length
}
const percent = roundIdx =>
  Math.round((paidCount(roundIdx) / Math.max(1, rounds.value.length - 1)) * 100)

const myPayments = computed(() => {
  if (!orderReady.value || !viewActive.value) return []
  const no = viewIdx.value + 1
  return rounds.value
    .map((r, i) => ({ ...r, idx: i, status: statusFor(i, no) }))
    .filter(r => r.status !== 'self')
})
const duePayments = computed(() => myPayments.value.filter(p => p.status !== 'paid'))
const nextPayment = computed(() => duePayments.value[0] || null)

// Has the connected member already paid someone, or received money? (they cannot leave then)
const myMoneyMoved = computed(() => {
  if (meIdx.value < 0) return false
  const no = meIdx.value + 1
  return rounds.value.some((r, i) => {
    const p = paid.value[i] || {}
    return Boolean(p[no]) || (r.recipientNo === no && Object.keys(p).length > 0)
  })
})

// Shows what was seen last time straight away, then updates it from the blockchain
async function refreshStatus() {
  if (!orderReady.value) return
  const mySeq = ++statusSeq
  tracking.value = true
  trackError.value = ''
  const key = `kameti-paid-${circleIdText.value}-${effOrder.value.join('.')}-${effCircle.value.members.length}`
  try {
    if (!paid.value.length) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || 'null')
        if (Array.isArray(saved) && saved.length === rounds.value.length) paid.value = saved
      } catch (e) {
        // no saved result: fine
      }
    }
    const id = await circleId(props.circle)
    const result = await trackPayments(effCircle.value, rounds.value, id)
    if (mySeq !== statusSeq) return
    paid.value = result
    try {
      localStorage.setItem(key, JSON.stringify(result))
    } catch (e) {
      // fine
    }
    lastTracked.value = new Date().toLocaleTimeString()
  } catch (e) {
    console.error('Tracking failed:', e)
    if (mySeq === statusSeq) trackError.value = 'Could not read payments: ' + (e?.message || String(e))
  } finally {
    if (mySeq === statusSeq) tracking.value = false
  }
}

// Finds the member from the connected wallet. This is the only way to become "me".
function detectMe() {
  const m = wallet.manager
  if (!m) return
  const mine = new Set()
  for (let i = 0; i < 20; i++) {
    try {
      mine.add(deriveAddress(m, 0, i).toLowerCase())
    } catch (e) {
      // skip addresses that cannot be derived
    }
  }
  meIdx.value = effCircle.value.members.findIndex(mem => mine.has(mem.address.toLowerCase()))
}

watch(
  [() => wallet.ready, () => wallet.manager],
  () => {
    if (wallet.ready) detectMe()
    else meIdx.value = -1
    balanceInfo.value = null
    lastTx.value = ''
    lastPaidText.value = ''
  },
  { immediate: true },
)

onMounted(async () => {
  circleIdText.value = await circleId(props.circle)
  if (hasDraw.value) {
    await loadDraw()
    if (drawStatus.value !== 'ready') {
      drawTimer = setInterval(() => {
        if (drawStatus.value !== 'ready') loadDraw()
      }, 60000)
    }
  } else {
    refreshAll()
  }
})

onBeforeUnmount(() => {
  if (drawTimer) clearInterval(drawTimer)
  if (evTimer) clearInterval(evTimer)
})

function cancel() {
  if (controller) controller.abort('Cancelled by user')
}

async function checkMyBalance() {
  balanceError.value = ''
  balanceInfo.value = null
  if (!wallet.manager) {
    balanceError.value = 'Connect your wallet first.'
    return
  }
  balanceBusy.value = true
  try {
    const scan = await scanWallet(wallet.manager, 20)
    const need = duePayments.value.reduce(
      (sum, p) => sum + BigInt(p.amountSats) + FEE_BUFFER_SATS,
      0n,
    )
    balanceInfo.value = { have: scan.totalSats, need }
  } catch (e) {
    console.error('Balance check failed:', e)
    balanceError.value = 'Could not check your balance: ' + (e?.message || String(e))
  } finally {
    balanceBusy.value = false
  }
}

function addToCalendar() {
  if (!duePayments.value.length) return
  const text = buildCalendar({
    circleName: props.circle.name,
    circleId: circleIdText.value,
    payerNo: viewIdx.value + 1,
    payments: duePayments.value.map(p => ({
      round: p.round,
      to: p.recipient.name,
      amount: formatBch(p.amountSats),
      start: p.periodStart,
      end: p.dueDate,
    })),
  })
  downloadText('kameti-payments.ics', text, 'text/calendar')
}

async function payRound(round) {
  errorText.value = ''
  lastTx.value = ''
  lastPaidText.value = ''

  if (!orderReady.value) {
    errorText.value = 'The order has not been drawn yet.'
    return
  }
  if (!wallet.manager) {
    errorText.value = 'Connect your wallet first.'
    return
  }
  if (!isActive.value) {
    errorText.value = 'The connected wallet is not an active member of this circle.'
    return
  }
  if (!windowOpen(round)) {
    errorText.value = 'This round opens on ' + round.periodStart.slice(0, 10) + '.'
    return
  }

  busyRound.value = round.round
  controller = new AbortController()
  const timer = setTimeout(() => controller.abort('Timed out waiting for the wallet'), 120000)

  try {
    // Look up fresh coins right before paying, so we never spend stale ones
    const scan = await scanWallet(wallet.manager, 20)
    const id = await circleId(props.circle)

    const result = await sendPayment(
      wallet.manager,
      scan.coins,
      round.recipient.address,
      BigInt(round.amountSats),
      `Kameti ${props.circle.name}: ${meName.value} pays ${round.recipient.name}`,
      controller.signal,
      {
        opReturn: ['KAMETI', id, String(round.round), String(meIdx.value + 1)],
        maxSats: MAX_CIRCLE_SATS,
      },
    )
    lastTx.value = result.txid || 'sent'
    lastPaidText.value = `${meName.value} paid ${round.recipient.name} ${formatBch(round.amountSats)} BCH`
    setTimeout(refreshStatus, 2500)
  } catch (e) {
    console.error('Round payment failed:', e)
    errorText.value =
      e?.name === 'AbortError'
        ? 'Cancelled, or the wallet did not answer in time. Keep this tab in front and your wallet open, then try again.'
        : e?.message || String(e)
  } finally {
    clearTimeout(timer)
    busyRound.value = null
    controller = null
  }
}
</script>

<template>
  <section class="circle">
    <header class="head">
      <div>
        <h2>{{ circle.name }}</h2>
        <p class="muted">
          {{ rounds.length }} members · {{ rounds.length }} rounds · every {{ circle.every }}
          {{ circle.unit }} · {{ formatBch(circle.amountSats) }} BCH each
        </p>
      </div>
      <div class="chips">
        <span class="chip">{{ NETWORK }}</span>
        <span v-if="circle.demo" class="chip gold">demo draw</span>
        <span v-else-if="hasDraw" class="chip">blockchain draw</span>
        <span v-else class="chip">set by hand</span>
        <span v-if="hasPriority" class="chip gold">priority seat: {{ circle.members[circle.first].name }}</span>
      </div>
    </header>

    <!-- who is looking at this page -->
    <div class="identity" :class="idClass">
      <p v-if="wallet.ready && meIdx >= 0 && isActive">
        <strong>Connected as {{ meName }}.</strong>
        You pay the other members in their rounds<span v-if="myReceiveRound"
          >, and you receive in round {{ myReceiveRound }}</span
        >.
      </p>
      <p v-else-if="wallet.ready && meIdx >= 0">
        <strong>Connected as {{ meName }}</strong>, who is no longer an active member of this circle.
      </p>
      <p v-else-if="wallet.ready">
        <strong>This wallet is not a member of this circle.</strong> You can join if a seat is open.
      </p>
      <p v-else>
        <strong>No wallet connected.</strong> You are only viewing this circle. Connect your wallet above to pay.
      </p>

      <label v-if="meIdx < 0" class="preview">
        Preview as (view only, no payments)
        <select v-model.number="previewIdx">
          <option :value="-1">Choose a member...</option>
          <option v-for="(m, i) in effCircle.members" :key="i" :value="i">
            {{ m.name }}{{ effOrder.includes(i) ? '' : ' (left)' }}
          </option>
        </select>
      </label>
    </div>

    <p class="muted">
      Everyone pays inside the first <strong>{{ windowDays }} days</strong> of each round, so the receiver gets
      the whole amount at once. Every payment goes straight to the receiver. Nobody holds the pool. Dates are in UTC.
    </p>

    <AgreementCard :agreement="circle.agreement" />

    <details class="verify">
      <summary>Check before you pay · circle id <code>{{ circleIdText }}</code></summary>
      <p class="muted">
        Every member must see the same circle id and the same addresses. If your id differs from the group's,
        do not pay: someone may have changed the link. These are the members when the circle was created.
      </p>
      <ol>
        <li v-for="(m, i) in circle.members" :key="i" class="addr">
          {{ m.name }}: <code>{{ m.address }}</code>
        </li>
      </ol>
    </details>

    <!-- the draw -->
    <div v-if="hasDraw" class="box">
      <h3>Who receives when</h3>

      <p v-if="circle.demo" class="warn">
        <strong>Demo circle:</strong> the draw used a block that already existed, so an organizer could choose the
        moment to get a favourable order. Use the normal draw for real circles.
      </p>

      <p v-if="hasPriority" class="muted">
        <strong>{{ circle.members[circle.first].name }}</strong> holds the priority seat and receives in round 1.
        The group agreed this before the draw, and the draw decides everyone else. The first receiver carries the
        most trust.
      </p>

      <p v-if="drawStatus === 'loading'">Reading the blockchain...</p>

      <div v-else-if="drawStatus === 'pending'">
        <p>
          The order is decided by block <strong>{{ circle.drawHeight }}</strong> of the {{ NETWORK }} blockchain.
          Nobody can predict or control it. Current block: {{ currentHeight }}. The draw runs in about
          <strong>{{ remainingBlocks }}</strong> more blocks (roughly {{ remainingBlocks * 10 }} minutes).
        </p>
        <p class="muted">
          All members should open this link and check the list above before the draw. If the list changes later, the
          order changes too, and everyone can see it.
        </p>
        <p class="btns">
          <button class="secondary" @click="loadDraw">Check again</button>
          <button v-if="!circle.demo" class="secondary" @click="$emit('demo-copy')">
            Skip the wait: make an instant demo copy (demo only)
          </button>
        </p>
      </div>

      <div v-else-if="drawStatus === 'ready'">
        <ol class="order">
          <li v-for="(idx, i) in seq" :key="idx">
            <span class="num">{{ i + 1 }}</span>
            <strong>{{ circle.members[idx].name }}</strong>
            <span v-if="hasPriority && i === 0" class="chip gold">priority seat</span>
            <span v-else class="chip">draw</span>
            <span class="muted">receives in round {{ i + 1 }}</span>
          </li>
        </ol>
        <details>
          <summary>Verify the draw yourself</summary>
          <p class="muted">
            Draw done with block {{ circle.drawHeight }}. Block hash:
            <code class="addr">{{ blockHash }}</code>. Anyone can repeat the draw from the block hash and the circle
            id ({{ circleIdText }}) and will get the same order. Later seat swaps are listed under "Seat changes".
          </p>
        </details>
      </div>

      <div v-else-if="drawStatus === 'error'">
        <p role="alert">Could not run the draw: {{ drawError }}</p>
        <p><button class="secondary" @click="loadDraw">Try again</button></p>
      </div>
    </div>

    <template v-if="orderReady">
      <!-- what the viewed member owes -->
      <div v-if="viewActive" class="box">
        <h3>What {{ viewName }} owes</h3>

        <div v-if="nextPayment" class="next" :class="{ late: nextPayment.status === 'late' }">
          <p class="muted">Next payment · round {{ nextPayment.round }}</p>
          <p class="big">
            {{ viewName }} pays {{ nextPayment.recipient.name }} {{ formatBch(nextPayment.amountSats) }} BCH
          </p>
          <p>
            Between {{ nextPayment.periodStart.slice(0, 10) }} and {{ nextPayment.dueDate.slice(0, 10) }}.
            <span v-if="nextPayment.status === 'late'" class="chip bad">late</span>
            <span v-else class="chip">{{ windowText(nextPayment.periodStart, nextPayment.dueDate) }}</span>
          </p>
        </div>
        <p v-else>✅ All of {{ viewName }}'s payments are done.</p>

        <ul class="owelist">
          <li v-for="r in myPayments" :key="r.round">
            Round {{ r.round }}: pay <strong>{{ r.recipient.name }}</strong> {{ formatBch(r.amountSats) }} BCH,
            {{ r.periodStart.slice(0, 10) }} to {{ r.dueDate.slice(0, 10) }}
            <span v-if="r.status === 'paid'" class="chip ok">paid</span>
            <span v-else-if="r.status === 'late'" class="chip bad">late</span>
          </li>
        </ul>

        <p class="btns">
          <button class="secondary" :disabled="!duePayments.length" @click="addToCalendar">
            Add my payment dates to my calendar
          </button>
          <button v-if="wallet.ready && meIdx >= 0" class="secondary" :disabled="balanceBusy" @click="checkMyBalance">
            {{ balanceBusy ? 'Checking...' : 'Check my wallet balance' }}
          </button>
        </p>
        <p v-if="balanceError" role="alert">{{ balanceError }}</p>
        <p v-if="balanceInfo">
          Your wallet has <strong>{{ formatBch(balanceInfo.have) }} BCH</strong>. Your unpaid payments need about
          <strong>{{ formatBch(balanceInfo.need) }} BCH</strong> including fees.
          <span v-if="balanceInfo.have >= balanceInfo.need" class="okmsg">Your balance is enough.</span>
          <span v-else class="warn">
            Please add about {{ formatBch(balanceInfo.need - balanceInfo.have) }} BCH to your wallet before the
            payment dates.
          </span>
        </p>
        <p class="muted">Payments are never taken automatically. You approve each one in your own wallet.</p>
      </div>

      <!-- the rounds -->
      <h3>Rounds</h3>
      <div class="rounds">
        <article v-for="(r, i) in rounds" :key="r.round" class="round" :class="{ now: i === currentRoundIndex }">
          <div class="rtop">
            <strong>Round {{ r.round }}</strong>
            <span v-if="i === currentRoundIndex" class="chip ok">current</span>
            <span v-else-if="!windowOpen(r)" class="chip">opens {{ r.periodStart.slice(0, 10) }}</span>
          </div>
          <p class="who"><span class="muted">Receives</span> <strong>{{ r.recipient.name }}</strong></p>
          <p class="muted">Pay window: {{ r.periodStart.slice(0, 10) }} to {{ r.dueDate.slice(0, 10) }}</p>

          <div
            class="bar"
            role="progressbar"
            aria-label="Payments received this round"
            aria-valuemin="0"
            :aria-valuemax="rounds.length - 1"
            :aria-valuenow="paidCount(i)"
          >
            <span :style="{ width: percent(i) + '%' }"></span>
          </div>
          <p class="muted">
            {{ paidCount(i) }} of {{ rounds.length - 1 }} paid ({{ formatBch(paidCount(i) * r.amountSats) }} BCH received)
          </p>

          <p class="who2">
            <span v-for="n in paidNames(i)" :key="'p' + n" class="chip ok">{{ n }} paid</span>
            <span
              v-for="n in unpaidNames(i)"
              :key="'u' + n"
              class="chip"
              :class="isLate(r.dueDate) ? 'bad' : 'gold'"
            >{{ n }} {{ isLate(r.dueDate) ? 'is late' : 'to pay' }}</span>
          </p>

          <div class="act">
            <p v-if="viewActive && r.recipientNo === viewIdx + 1" class="okmsg">
              {{ viewName }} (you) receive this round
            </p>
            <p v-else-if="viewActive && statusFor(i, viewIdx + 1) === 'paid'" class="okmsg">
              {{ viewName }} (you) paid {{ r.recipient.name }}
            </p>
            <template v-else>
              <button :disabled="!canPay || !windowOpen(r)" @click="payRound(r)">
                {{
                  busyRound === r.round
                    ? 'Waiting for wallet...'
                    : windowOpen(r)
                      ? 'Pay ' + r.recipient.name + ' (' + formatBch(r.amountSats) + ' BCH)'
                      : 'Opens ' + r.periodStart.slice(0, 10)
                }}
              </button>
              <button v-if="busyRound === r.round" class="secondary" @click="cancel">Cancel</button>
            </template>
          </div>
        </article>
      </div>

      <p class="btns">
        <button class="secondary" :disabled="tracking" @click="refreshStatus">
          {{ tracking ? 'Reading the blockchain...' : 'Refresh payment status' }}
        </button>
        <span v-if="lastTracked" class="muted">Last checked: {{ lastTracked }}</span>
      </p>
      <p v-if="trackError" role="alert">{{ trackError }}</p>

      <details>
        <summary>Full payment grid</summary>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>Round (receiver)</th>
                <th v-for="r in rounds" :key="r.round">{{ r.recipient.name }} pays</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in rounds" :key="r.round">
                <td>{{ r.round }} ({{ r.recipient.name }} receives)</td>
                <td v-for="(c, j) in rounds" :key="c.round" class="cell">
                  <span v-if="cellStatus(i, j) === 'self'" title="Receiver">—</span>
                  <span v-else-if="cellStatus(i, j) === 'paid'" class="okmsg" :title="paid[i][c.recipientNo].txid">paid</span>
                  <span v-else-if="cellStatus(i, j) === 'late'" class="late-text">late</span>
                  <span v-else class="muted">not yet</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="muted">
          Each row is one round, and the name in brackets receives the money. A payment counts when the blockchain
          shows it reached the receiver with this circle's note and at least the agreed amount.
        </p>
      </details>

      <details>
        <summary>Seat changes: leave, swap or join</summary>
        <EventsPanel
          :circle="circle"
          :circle-id="circleIdText"
          :ev="ev"
          :me-no="isActive ? meIdx + 1 : 0"
          :money-moved="myMoneyMoved"
          :loading="evLoading"
          :error="evError"
          @refresh="refreshAll"
        />
      </details>
    </template>

    <p v-if="errorText" role="alert">{{ errorText }}</p>
    <p v-if="lastTx" class="okmsg addr">
      {{ lastPaidText }}. Transaction: <code>{{ lastTx }}</code>
    </p>
  </section>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: flex-start; margin-bottom: 0.75rem; }
.head h2 { font-size: 1.6rem; }
.chips { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.chip { font-size: 0.8rem; padding: 0.15rem 0.6rem; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); display: inline-block; }
.chip.ok { background: #234036; color: #7CE8B8; border-color: #234036; }
.chip.gold { background: var(--gold); color: #1A1305; border-color: var(--gold); }
.chip.bad { background: #4A1F1C; color: #FFB4AB; border-color: #6B2A26; }
.identity { border-radius: 12px; padding: 0.7rem 1rem; margin: 0.5rem 0 1rem; border: 1px solid; }
.identity p { margin: 0.2rem 0; }
.id-ok { background: #123324; border-color: #1F6B49; }
.id-warn { background: #2A2410; border-color: #6B5A1E; }
.id-off { background: var(--card); border-color: var(--line); }
.preview { display: grid; gap: 0.25rem; margin-top: 0.5rem; }
.preview select { padding: 0.45rem; }
.box { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 1rem; margin: 1rem 0; }
.warn { color: var(--gold); }
.okmsg { color: var(--mint); }
.addr { overflow-wrap: anywhere; }
.btns { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
.order { list-style: none; padding: 0; margin: 0 0 0.5rem; display: grid; gap: 0.4rem; }
.order li { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
.num { width: 1.6rem; height: 1.6rem; border-radius: 50%; background: var(--card-2); display: inline-flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.85rem; }
.next { background: var(--card-2); border: 1px solid var(--line); border-left: 4px solid var(--mint); border-radius: 10px; padding: 0.7rem 1rem; margin-bottom: 0.75rem; }
.next.late { border-left-color: var(--danger); }
.next p { margin: 0.2rem 0; }
.big { font-size: 1.25rem; font-weight: 700; }
.owelist { padding-left: 1.1rem; }
.rounds { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.9rem; margin-bottom: 1rem; }
.round { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 0.9rem; }
.round.now { border-color: var(--mint); }
.round p { margin: 0.3rem 0; }
.rtop { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.who { font-size: 1.05rem; }
.who2 { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.bar { height: 8px; background: #0B1110; border-radius: 999px; overflow: hidden; margin-top: 0.5rem; }
.bar span { display: block; height: 100%; background: var(--mint); }
.act { margin-top: 0.6rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.act button { max-width: 100%; }
.scroll { overflow-x: auto; }
.scroll table { width: 100%; }
th, td { padding: 0.5rem 0.7rem; }
.cell { text-align: center; }
.late-text { color: var(--danger); }
</style>