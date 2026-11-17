<script setup>
import { EXAMPLE_LINK } from '../site.js'

defineEmits(['create', 'section'])

const steps = [
  { n: '01', t: 'Create the circle', d: 'Add the members and the amount. If someone has an urgent need, the group can give them the first turn.' },
  { n: '02', t: 'Draw the order', d: 'The payout order comes from the hash of a future Bitcoin Cash block. Nobody can predict or change it, and anyone can check it.' },
  { n: '03', t: 'Pay the receiver', d: "In the first days of each round, every member sends their share straight to that round's receiver, approving it in their own wallet." },
  { n: '04', t: 'See the proof', d: 'The page reads the blockchain and shows who has paid and who is late. Everyone sees the same record.' },
]

const compare = [
  ['Who holds the money', 'One trusted person', 'Nobody. Members pay the receiver directly'],
  ['Who has paid', 'A notebook', 'A public record on the blockchain'],
  ['Who goes first', 'A paper draw, or the organiser decides', 'A block-hash draw anyone can check, or an agreed priority seat'],
  ['Interest and fees', 'None, by tradition', 'None. The receiver gets exactly what members paid'],
  ['Changing seats', 'Agreed by word of mouth', 'Both members approve in their own wallets'],
  ['Group rules', 'Unwritten', 'A written agreement stored with the circle'],
]

const risks = [
  { t: 'Nobody can force a payment', d: 'The app makes late payments visible to the whole group. It cannot make anyone pay. Only start a circle with people you know and trust.' },
  { t: 'Early turns carry the most trust', d: 'Whoever receives first receives before they have paid everything. Agree early seats openly, and never sell or trade a seat for money.' },
  { t: 'BCH changes in value', d: 'Amounts are in Bitcoin Cash, so their value in rupees or dollars can move during the circle.' },
  { t: 'Payments cannot be undone', d: 'Each payment is approved in your own wallet and is final. Check every address and start with small amounts.' },
]

const faqs = [
  ['Is it interest-free?', 'Yes. Members pay equal shares and the receiver gets exactly what was paid. There is no interest and no fee. We are not scholars, so please ask yours about your own situation.'],
  ['How is the order decided?', 'Either the group agrees a priority seat for someone with an urgent need and the blockchain draws everyone else, or the blockchain draws everyone. The draw uses a future block hash, so nobody can control it.'],
  ['What if someone does not pay?', 'Everyone sees it on the page. The app cannot force payment, so the group decides together what to do. That is why you should only join circles with people you know.'],
  ['Can I leave or swap seats?', 'Before the second round starts, members can leave and a new member can take the open seat. Two members who have not received yet can swap seats if both approve with their wallets.'],
  ['What if a member dies?', 'Write your rule in the circle before it starts, for example that a named heir continues the payments. The app records the rule but cannot enforce it. For inheritance questions, ask a scholar or a lawyer.'],
      ['Which wallet do I need?', 'Any wallet that supports WizardConnect. We tested Paytaca, and the BLAZE team reports that Cashonize works too.'],
  ['Do I need an account?', 'No. The circle lives inside its link, so there is no account and no database. Payments and changes are public notes on the blockchain.'],
]
</script>

<template>
  <div class="landing">
    <section class="wrap hero">
      <div>
        <p class="eyebrow">Built for BCH BLAZE 2026 on Bitcoin Cash</p>
        <h1>A kameti where <span class="mint">nobody holds the money.</span></h1>
        <p class="lead">
          Start a savings circle with people you trust. Everyone pays the round's receiver directly
          from their own wallet, and the whole group sees the proof on the blockchain. No interest. No fees.
        </p>
        <div class="cta">
          <button type="button" @click="$emit('create')">Create a circle</button>
          <button type="button" class="secondary" @click="$emit('section', 'how')">How it works</button>
          <a v-if="EXAMPLE_LINK" class="linkbtn" :href="EXAMPLE_LINK">See an example circle</a>
        </div>
        <ul class="pills">
          <li>No custody</li>
          <li>No interest</li>
          <li>No fees</li>
          <li>Public proof</li>
        </ul>
      </div>

      <aside class="card mock" aria-label="Illustration of a circle round">
        <p class="muted">Illustration · Round 2 of 3</p>
        <h3>Hajra receives 0.0003 BCH</h3>
        <div class="chips">
          <span class="chip ok">Sara paid</span>
          <span class="chip gold">Ali still to pay</span>
        </div>
        <div class="bar" aria-hidden="true"><span></span></div>
        <p class="muted">1 of 2 payments in</p>
        <span class="fake">Pay Hajra 0.0001 BCH</span>
      </aside>
    </section>

    <section id="how" class="wrap block">
      <h2>How it works</h2>
      <p class="muted">Four steps, no accounts.</p>
      <div class="steps">
        <article v-for="s in steps" :key="s.n" class="card">
          <span class="num">{{ s.n }}</span>
          <h3>{{ s.t }}</h3>
          <p>{{ s.d }}</p>
        </article>
      </div>
    </section>
        <section v-if="EXAMPLE_LINK" id="example" class="wrap block">
      <div class="card exbox">
        <div>
          <h2>See a real circle</h2>
          <p>
            This circle ran on Bitcoin Cash mainnet between three wallets we own: a blockchain draw decided the
            order, and the payments you will see are real transactions. The schedule is compressed to a few days so
            you can see every round without waiting a month.
          </p>
          <p class="muted">You do not need a wallet or any BCH to look. Choose a member under "Preview as".</p>
        </div>
        <a class="linkbtn" :href="EXAMPLE_LINK">Open the example circle</a>
      </div>
    </section>

    <section id="compare" class="wrap block">
      <h2>Why it is different</h2>
      <div class="scroll">
        <table class="cmp">
          <thead><tr><th></th><th>Traditional kameti</th><th>Kameti.cash</th></tr></thead>
          <tbody>
            <tr v-for="row in compare" :key="row[0]">
              <th scope="row">{{ row[0] }}</th><td>{{ row[1] }}</td><td class="mint">{{ row[2] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="risks" class="wrap block">
      <h2>Understand the risks</h2>
      <p class="muted">We would rather you know these before you start.</p>
      <div class="risks">
        <article v-for="r in risks" :key="r.t" class="card">
          <h3>{{ r.t }}</h3>
          <p>{{ r.d }}</p>
        </article>
      </div>
    </section>

    <section id="faq" class="wrap block">
      <h2>Questions</h2>
      <details v-for="f in faqs" :key="f[0]">
        <summary>{{ f[0] }}</summary>
        <p>{{ f[1] }}</p>
      </details>
    </section>

    <section class="wrap block cta-end">
      <h2>Ready to start a circle?</h2>
      <button type="button" @click="$emit('create')">Create a circle</button>
    </section>

    <footer class="wrap foot">
      <p class="muted">Kameti.cash · built for BCH BLAZE 2026 · interest-free, no custody, public proof.</p>
    </footer>
  </div>
</template>

<style scoped>
.hero { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 2rem; align-items: center; padding-top: 3rem; padding-bottom: 3rem; }
.eyebrow { color: var(--gold); font-size: 0.85rem; letter-spacing: 0.06em; text-transform: uppercase; margin: 0 0 0.75rem; }
h1 { font-size: clamp(2rem, 5vw, 3.4rem); }
.mint { color: var(--mint); }
.lead { color: var(--muted); font-size: 1.1rem; max-width: 36rem; }
.cta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1.25rem 0; align-items: center; }
.linkbtn { padding: 0.55rem 1rem; border: 1px solid var(--line); border-radius: 10px; color: var(--ink); text-decoration: none; font-weight: 600; }
.pills { display: flex; flex-wrap: wrap; gap: 0.5rem; list-style: none; padding: 0; margin: 0; }
.pills li { border: 1px solid var(--line); border-radius: 999px; padding: 0.25rem 0.75rem; color: var(--muted); font-size: 0.9rem; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 1.1rem; }
.mock h3 { font-size: 1.3rem; }
.chips { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.5rem 0 0.75rem; }
.chip { font-size: 0.8rem; padding: 0.2rem 0.65rem; border-radius: 999px; }
.chip.ok { background: #234036; color: #7CE8B8; }
.chip.gold { background: var(--gold); color: #1A1305; }
.bar { height: 8px; background: #0B1110; border-radius: 999px; overflow: hidden; }
.bar span { display: block; width: 50%; height: 100%; background: var(--mint); }
.fake { display: inline-block; margin-top: 0.5rem; background: var(--mint); color: #07130E; border-radius: 10px; padding: 0.6rem 1rem; font-weight: 600; }
.block { padding-top: 2.5rem; padding-bottom: 1rem; }
.steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 1rem; }
.num { color: var(--mint); font-family: ui-monospace, monospace; font-size: 0.9rem; }
.risks { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-top: 1rem; }
.scroll { overflow-x: auto; }
.cmp { width: 100%; }
.cmp th, .cmp td { padding: 0.65rem 0.8rem; vertical-align: top; }
.cta-end { text-align: center; padding: 3rem 1rem; }
.foot { padding-top: 1rem; padding-bottom: 3rem; border-top: 1px solid var(--line); }
.exbox { display: flex; gap: 1.5rem; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.exbox > div { flex: 1; min-width: 16rem; }
.exbox .linkbtn { background: var(--mint); color: #07130E; border: 0; }
@media (max-width: 860px) {
  .hero { grid-template-columns: 1fr; }
  .steps { grid-template-columns: repeat(2, 1fr); }
  .risks { grid-template-columns: 1fr; }
}
@media (max-width: 520px) { .steps { grid-template-columns: 1fr; } }
</style>