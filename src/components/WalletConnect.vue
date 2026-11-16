<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import {
  useWizardConnect,
  WizardConnectQRDialog,
} from '@paytaca/wizardconnect-vue'

import { NETWORK } from '../config.js'
import { deriveAddress, scanWallet, formatBch } from '../chain.js'
import { wallet } from '../store.js'
import TestPayment from './TestPayment.vue'

// The test payment form sends real money, so it only exists on your own computer
const isDev = import.meta.env.DEV

const {
  state,
  manager,
  uri,
  qrUri,
  walletName,
  connect,
  disconnect,
  error,
} = useWizardConnect({
  dappName: 'Kameti.cash',
  dappIcon: `${window.location.origin}/favicon.svg`,
})

const walletReady = ref(false)
const walletAddress = ref('')
const scanning = ref(false)
const scanError = ref('')
const addressError = ref('')
const totalSats = ref(null)
const coins = ref([])
const scannedAddressCount = ref(0)
const lastChecked = ref('')

let attachedTo = null
let walletReadyHandler = null
let disconnectHandler = null

function resetBalance() {
  totalSats.value = null
  coins.value = []
  scannedAddressCount.value = 0
  lastChecked.value = ''
  scanError.value = ''
}

function resetWallet() {
  walletReady.value = false
  walletAddress.value = ''
  addressError.value = ''
  wallet.manager = null
  wallet.ready = false
  resetBalance()
}

function refreshAddress(m) {
  try {
    const address = deriveAddress(m, 0, 0)

    if (typeof address !== 'string') {
      throw new Error('Wallet address is not a string.')
    }

    walletAddress.value = address
    addressError.value = ''
    walletReady.value = true
    wallet.manager = m
    wallet.ready = true
  } catch (e) {
    console.error('Could not derive wallet address:', e)
    walletAddress.value = ''
    addressError.value = e?.message || 'Could not read wallet address.'
    walletReady.value = false
    wallet.manager = null
    wallet.ready = false
  }
}

function attachWallet(m) {
  if (!m || m === attachedTo) return

  if (attachedTo) {
    if (walletReadyHandler) {
      attachedTo.removeListener?.('walletready', walletReadyHandler)
    }
    if (disconnectHandler) {
      attachedTo.removeListener?.('disconnect', disconnectHandler)
    }
  }

  attachedTo = m

  walletReadyHandler = () => {
    refreshAddress(m)
  }

  disconnectHandler = () => {
    resetWallet()
  }

  m.addListener('walletready', walletReadyHandler)
  m.addListener('disconnect', disconnectHandler)

  if (state.value === 'connected' || walletReady.value) {
    refreshAddress(m)
  }
}

watch(manager, attachWallet, { immediate: true })

watch(
  state,
  currentState => {
    console.log('WizardConnect state:', currentState)

    if (currentState === 'connected' && manager.value) {
      refreshAddress(manager.value)
    }

    if (currentState === 'disconnected' || currentState === 'disconnected_by_user') {
      resetWallet()
    }
  },
  { immediate: true },
)

async function checkBalance() {
  const m = manager.value

  if (!m) {
    scanError.value = 'Connect your wallet first.'
    return
  }

  scanning.value = true
  scanError.value = ''

  try {
    refreshAddress(m)

    if (!walletAddress.value) {
      throw new Error(addressError.value || 'Could not obtain a valid wallet address.')
    }

    const result = await scanWallet(m, 20)

    if (manager.value !== m) return

    totalSats.value = result.totalSats
    coins.value = result.coins
    scannedAddressCount.value = result.scannedAddressCount
    lastChecked.value = new Date().toLocaleTimeString()
  } catch (e) {
    console.error('Balance lookup failed:', e)
    scanError.value = 'Could not check balance: ' + (e?.message || String(e))
  } finally {
    scanning.value = false
  }
}

function handleDisconnect() {
  resetWallet()
  disconnect()
}

onBeforeUnmount(() => {
  if (attachedTo) {
    if (walletReadyHandler) {
      attachedTo.removeListener?.('walletready', walletReadyHandler)
    }
    if (disconnectHandler) {
      attachedTo.removeListener?.('disconnect', disconnectHandler)
    }
  }
})
</script>

<template>
  <div class="wallet">
    <div v-if="walletReady">
      <p class="line">
        <span class="chip ok">Wallet connected</span>
        <strong v-if="walletName">{{ walletName }}</strong>
        <span class="muted">on {{ NETWORK }}</span>
      </p>
      <p v-if="walletAddress" class="addr">
        <span class="muted">Your wallet's first address (used to recognise you):</span><br />
        <code>{{ walletAddress }}</code>
      </p>
      <p v-if="addressError" role="alert">{{ addressError }}</p>

      <div class="btns">
        <button class="secondary" :disabled="scanning || !walletAddress" @click="checkBalance">
          {{ scanning ? 'Checking balance...' : 'Check balance' }}
        </button>
        <button class="secondary" @click="handleDisconnect">Disconnect</button>
      </div>
      <p v-if="scanError" role="alert">{{ scanError }}</p>

      <details v-if="totalSats !== null" open>
        <summary>Wallet balance: {{ formatBch(totalSats) }} BCH</summary>
        <p class="muted">
          {{ coins.length }} coins found in {{ scannedAddressCount }} addresses. Last checked {{ lastChecked }}.
          The balance covers the scanned receive and change addresses only, and not CashToken outputs.
        </p>
        <ul v-if="coins.length" class="coins">
          <li v-for="coin in coins" :key="coin.txid + ':' + coin.vout">
            {{ coin.path }} address #{{ coin.index }}: {{ formatBch(coin.satoshis) }} BCH
          </li>
        </ul>
      </details>

      <TestPayment
        v-if="isDev && totalSats !== null && coins.length"
        :manager="manager"
        :coins="coins"
        @sent="checkBalance"
      />

      <p class="muted">
        If your wallet does not respond to a request, check that your phone's date and time are set to automatic.
      </p>
    </div>

    <div v-else>
      <button v-if="state !== 'reconnecting'" :disabled="state === 'connecting'" @click="connect()">
        {{ state === 'connecting' ? 'Connecting...' : 'Connect Wallet' }}
      </button>
      <p v-else>Reconnecting to your wallet... Keep the wallet app open.</p>
      <p v-if="state === 'connecting'" class="muted">Waiting for your wallet to connect...</p>
      <p v-if="error" role="alert">{{ error }}</p>
    </div>

    <WizardConnectQRDialog
      :show="state === 'connecting'"
      :uri="uri ?? ''"
      :qrUri="qrUri ?? ''"
      :onClose="handleDisconnect"
    />
  </div>
</template>

<style scoped>
.line { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin: 0 0 0.4rem; }
.chip { font-size: 0.8rem; padding: 0.15rem 0.6rem; border-radius: 999px; }
.chip.ok { background: #234036; color: #7CE8B8; }
.addr { overflow-wrap: anywhere; margin: 0.4rem 0; }
.btns { display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 0.6rem 0; }
.coins { margin: 0.3rem 0; padding-left: 1.1rem; font-size: 0.9rem; }
</style>