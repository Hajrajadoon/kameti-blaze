<script setup>
import { ref } from 'vue'
import {
  CASHTOKENS_ADDRESS,
  NEW_REPO_URL,
  OLD_REPO_URL,
  OLD_DEMO_URL,
  PRESENTATION_URL,
  VIDEO_URL,
} from '../site.js'

const copied = ref(false)
async function copyAddress() {
  try {
    await navigator.clipboard.writeText(CASHTOKENS_ADDRESS)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch (e) {
    copied.value = false
  }
}
</script>

<template>
  <aside class="banner" aria-label="Hackathon project information">
    <p>
      <strong>BCH BLAZE 2026</strong>
      · Presentation:
      <a v-if="PRESENTATION_URL" :href="PRESENTATION_URL" target="_blank" rel="noopener noreferrer">open</a>
      <span v-else>coming soon</span>
      · Source code:
      <a :href="NEW_REPO_URL" target="_blank" rel="noopener noreferrer">GitHub (hackathon repo)</a>
      <template v-if="VIDEO_URL"> · <a :href="VIDEO_URL" target="_blank" rel="noopener noreferrer">Video</a></template>
    </p>
    <p>
      <strong>Pre-existing work, declared:</strong> started 20 Oct 2026, before the hackathon.
      Old repo: <a :href="OLD_REPO_URL" target="_blank" rel="noopener noreferrer">GitHub</a>
      · Demo from before the hackathon:
      <a :href="OLD_DEMO_URL" target="_blank" rel="noopener noreferrer">open</a>
    </p>
    <p class="addr">
      <strong>Community Choice (EMBER2026):</strong>
      <code>{{ CASHTOKENS_ADDRESS }}</code>
      <button type="button" class="secondary" @click="copyAddress">{{ copied ? 'Copied' : 'Copy' }}</button>
    </p>
  </aside>
</template>

<style scoped>
.banner { background: #101C18; border-bottom: 1px solid var(--line); padding: 0.5rem 1rem; font-size: 0.85rem; color: var(--muted); }
.banner p { margin: 0.2rem 0; max-width: 1080px; margin-left: auto; margin-right: auto; }
.banner strong { color: var(--ink); }
.addr { overflow-wrap: anywhere; }
.addr button { min-height: 0; padding: 0.15rem 0.6rem; font-size: 0.8rem; margin-left: 0.4rem; }
</style>