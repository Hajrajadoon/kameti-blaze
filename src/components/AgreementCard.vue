<script setup>
import { computed } from 'vue'
import { AGREEMENT_RULES } from '../circle.js'

const props = defineProps({
  agreement: { type: Object, default: null },
})

const rules = computed(() =>
  AGREEMENT_RULES.filter(r => props.agreement?.rules?.includes(r.id)),
)
const note = computed(() => props.agreement?.note || '')
</script>

<template>
  <section class="agreement" aria-labelledby="agreement-title">
    <h3 id="agreement-title">Group agreement</h3>

    <template v-if="rules.length || note">
      <p class="muted">
        Read this before you pay. It is part of the circle: if anyone changes it, the circle id changes too.
      </p>
      <ul>
        <li v-for="r in rules" :key="r.id">{{ r.text }}</li>
      </ul>
      <p v-if="note"><strong>Group note:</strong> {{ note }}</p>
    </template>
    <p v-else class="muted">This circle has no written agreement.</p>

    <p class="muted">
      The app records these rules and shows late payments, but it cannot enforce them. For questions
      about inheritance or obligations, ask a scholar or a lawyer.
    </p>
  </section>
</template>

<style scoped>
.agreement { background: var(--card-2); border: 1px solid var(--line); border-left: 4px solid var(--gold); border-radius: 10px; padding: 0.8rem 1rem; margin: 1rem 0; }
.agreement ul { margin: 0.4rem 0 0.6rem; padding-left: 1.2rem; }
.agreement li { margin: 0.2rem 0; }
</style>