<script setup>
import { ref } from 'vue'

// Fill these in as the project grows. A link left empty shows "coming soon".
const CASHTOKENS_ADDRESS = 'bitcoincash:zzdq02x89gjyrg58j3mz4jr7r6r6uzlnag69rn2ews'
const PRESENTATION_URL = '' // the Widget Factory presentation
const NEW_REPO_URL = '' // the hackathon repo, created on 14 Nov
const OLD_REPO_URL = 'https://github.com/Hajrajadoon/kameti-v1'
const OLD_DEMO_URL = 'https://kameti-v1.vercel.app/'

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
  <aside class="banner">
    <p>
      <strong>BCH BLAZE 2026 project.</strong>
      Presentation:
      <a v-if="PRESENTATION_URL" :href="PRESENTATION_URL" target="_blank" rel="noopener noreferrer">open</a>
      <span v-else>coming soon</span>
      · Source code:
      <a v-if="NEW_REPO_URL" :href="NEW_REPO_URL" target="_blank" rel="noopener noreferrer">GitHub (hackathon repo)</a>
      <span v-else>coming soon</span>
    </p>
    <p>
      <strong>Pre-existing work, declared:</strong> this project was started on 20 Oct 2026, before the
      hackathon. Old repo:
      <a :href="OLD_REPO_URL" target="_blank" rel="noopener noreferrer">GitHub</a>
      · Demo from before the hackathon:
      <a :href="OLD_DEMO_URL" target="_blank" rel="noopener noreferrer">open</a>
    </p>
    <p style="overflow-wrap: anywhere">
      <strong>Community Choice (EMBER2026 tokens):</strong>
      <code>{{ CASHTOKENS_ADDRESS }}</code>
      <button type="button" @click="copyAddress">{{ copied ? 'Copied' : 'Copy' }}</button>
    </p>
  </aside>
</template>

<style scoped>
.banner {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  color: #1e3a8a;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}
.banner p { margin: 0.25rem 0; }
.banner button { margin-left: 0.5rem; padding: 0.15rem 0.5rem; font-size: 0.85rem; cursor: pointer; }
</style>