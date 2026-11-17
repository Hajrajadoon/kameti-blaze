<script setup>
import { wallet } from '../store.js'
import { NETWORK } from '../config.js'

defineProps({ view: { type: String, default: 'home' } })
defineEmits(['go', 'section'])
</script>

<template>
  <header class="top">
    <div class="bar">
      <button class="brand" type="button" aria-label="Kameti.cash, home" @click="$emit('go', 'home')">
        <svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
          <circle cx="26" cy="27" r="13" fill="none" stroke="#3DDC97" stroke-width="5" />
          <circle cx="38" cy="27" r="13" fill="none" stroke="#F2C14E" stroke-width="5" />
          <circle cx="32" cy="38" r="13" fill="none" stroke="#EAF4EF" stroke-width="5" />
        </svg>
        <span>Kameti<b>.cash</b></span>
      </button>

      <nav aria-label="Main">
        <button class="link" type="button" @click="$emit('section', 'how')">How it works</button>
        <button class="link" type="button" @click="$emit('section', 'compare')">Why Kameti</button>
        <button class="link" type="button" @click="$emit('section', 'risks')">Risks</button>
        <button class="link" type="button" @click="$emit('section', 'faq')">FAQ</button>
      </nav>

      <div class="right">
        <span class="pill" :class="{ warn: NETWORK === 'mainnet' }">{{ NETWORK }}</span>
        <span v-if="wallet.ready" class="pill ok">Wallet connected</span>
        <button type="button" @click="$emit('go', 'create')">Create a circle</button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.top { position: sticky; top: 0; z-index: 20; background: rgba(14, 21, 19, 0.94); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); }
.bar { max-width: 1080px; margin: 0 auto; padding: 0.6rem 1rem; display: flex; align-items: center; gap: 1rem; }
.brand { display: inline-flex; align-items: center; gap: 0.5rem; background: none; color: var(--ink); padding: 0; min-height: 0; font-size: 1.15rem; font-weight: 700; }
.brand b { color: var(--mint); }
nav { display: flex; gap: 0.25rem; flex: 1; }
.link { background: none; color: var(--muted); padding: 0.4rem 0.6rem; font-weight: 500; }
.link:hover { color: var(--ink); }
.right { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }
.pill { font-size: 0.75rem; padding: 0.2rem 0.55rem; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.pill.warn { color: var(--gold); border-color: #6B5A1E; }
.pill.ok { color: var(--mint); border-color: #1F6B49; }
@media (max-width: 760px) {
  .bar { flex-wrap: wrap; gap: 0.4rem 0.75rem; }
  nav { order: 3; width: 100%; flex: none; overflow-x: auto; white-space: nowrap; }
  .pill.ok { display: none; }
}
</style>