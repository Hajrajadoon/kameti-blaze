<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { validate, createCircle, encodeCircle, decodeCircle } from './circle.js'
import { getHeight } from './draw.js'
import { NETWORK } from './config.js'
import WalletConnect from './components/WalletConnect.vue'
import CircleView from './components/CircleView.vue'
import ProjectBanner from './components/ProjectBanner.vue'
import SiteHeader from './components/SiteHeader.vue'
import Landing from './components/Landing.vue'
import CreateWizard from './components/CreateWizard.vue'

// A shared link is data from someone else, so it is fully checked before it is used
function openFromLink() {
  const hash = location.hash.slice(1)
  if (!hash) return null
  try {
    const c = decodeCircle(hash)
    return validate(c).length === 0 ? c : null
  } catch {
    return null
  }
}

const circle = ref(openFromLink())
const badLink = ref(Boolean(location.hash.slice(1)) && !circle.value)
const showCreate = ref(badLink.value)

// which page is showing: the landing page, the create flow, or a circle
const view = computed(() => (circle.value ? 'circle' : showCreate.value ? 'create' : 'home'))

const errors = ref([])
const creating = ref(false)
const copyError = ref('')

// Links always point to the site root, so they work on localhost and on Vercel
const shareLink = computed(() =>
  circle.value
    ? `${location.origin}${import.meta.env.BASE_URL}#${encodeCircle(circle.value)}`
    : '',
)

// Opens a circle when the address changes while the page is already open
// (for example a pasted link, or the example-circle button)
function syncFromHash() {
  const hash = location.hash.slice(1)
  if (!hash) {
    if (circle.value) circle.value = null
    return
  }
  if (circle.value && encodeCircle(circle.value) === hash) return
  const c = openFromLink()
  if (c) {
    circle.value = c
    badLink.value = false
    showCreate.value = false
    window.scrollTo({ top: 0 })
  } else {
    circle.value = null
    badLink.value = true
    showCreate.value = true
  }
}
onMounted(() => window.addEventListener('hashchange', syncFromHash))
onBeforeUnmount(() => window.removeEventListener('hashchange', syncFromHash))

function go(target) {
  circle.value = null
  badLink.value = false
  copyError.value = ''
  errors.value = []
  location.hash = ''
  showCreate.value = target === 'create'
  window.scrollTo({ top: 0 })
}

async function scrollToSection(id) {
  if (view.value !== 'home') {
    go('home')
    await nextTick()
  }
  await nextTick()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

// Called by the create flow once its own checks pass
async function onCreate({ input, orderMode, drawLead }) {
  errors.value = validate(input)
  if (errors.value.length) return

  let drawHeight = 0
  if (orderMode === 'draw' || orderMode === 'demo') {
    creating.value = true
    try {
      // demo = a block that already exists, so the order appears immediately
      const lead = orderMode === 'demo' ? -2 : Number(drawLead)
      drawHeight = (await getHeight()) + lead
    } catch (e) {
      console.error(e)
      errors.value = [
        'Could not read the blockchain to schedule the draw: ' + (e?.message || String(e)),
        'You can still create the circle with "Set by hand", which needs no blockchain server.',
      ]
      creating.value = false
      return
    }
    creating.value = false
  }

  circle.value = createCircle({
    ...input,
    first: input.first ?? -1,
    drawHeight,
    demo: orderMode === 'demo',
  })
  badLink.value = false
  location.hash = encodeCircle(circle.value)
  window.scrollTo({ top: 0 })
}

// Turns the circle on screen into an instant demo circle (same members and settings)
async function makeDemoCopy() {
  copyError.value = ''
  try {
    const height = await getHeight()
    circle.value = createCircle({ ...circle.value, drawHeight: height - 2, demo: true })
    location.hash = encodeCircle(circle.value)
  } catch (e) {
    console.error(e)
    copyError.value = 'Could not read the blockchain. Check your connection and try again.'
  }
}
</script>

<template>
  <SiteHeader :view="view" @go="go" @section="scrollToSection" />
  <ProjectBanner />

  <Landing v-if="view === 'home'" @create="go('create')" @section="scrollToSection" />

  <!-- The wallet connection stays mounted on every page, so it survives moving around the site -->
  <main v-show="view !== 'home'" class="app">
    <p v-if="NETWORK === 'mainnet'" class="notice">
      <strong>Mainnet:</strong> payments here use real Bitcoin Cash. Start with small amounts and check every address.
    </p>

    <section class="panel">
      <WalletConnect />
      <p class="muted">
        Connect any wallet that supports WizardConnect. Tested with Paytaca. Cashonize is reported to
        work by the BLAZE team, but we have not tested it ourselves.
      </p>
    </section>

    <p v-if="badLink" role="alert">
      This link is not a valid circle for this network. Ask the organizer for a new link.
    </p>

    <CreateWizard v-if="!circle" :errors="errors" :creating="creating" @create="onCreate" />

    <div v-else>
      <CircleView :key="shareLink" :circle="circle" @demo-copy="makeDemoCopy" />
      <p v-if="copyError" role="alert">{{ copyError }}</p>
      <p>Share this link with the other members. Everyone opens the same link and connects their own wallet:</p>
      <input :value="shareLink" readonly style="width: 100%" />
      <p v-if="shareLink.length > 2000" class="muted">
        This link is long. If a chat app cuts it off, send it as a file or in two messages.
      </p>
      <p><button type="button" class="secondary" @click="go('create')">Start a new circle</button></p>
    </div>
  </main>
</template>