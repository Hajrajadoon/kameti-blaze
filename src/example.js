import { encodeCircle } from './circle.js'

export const EXAMPLE_CIRCLE = {
  name: "khan's saving circle",
  members: [
    { name: 'Hajra', address: 'bitcoincash:qzdq02x89gjyrg58j3mz4jr7r6r6uzlnaga0sdyl3r' },
    { name: 'Ali', address: 'bitcoincash:qrs2kgk5kkf4a70fwe9mshqdvyq9vxajygtxuy3usg' },
    { name: 'Sara', address: 'bitcoincash:qrm5tu03tycjvn8ecn2v7ld5p9rclrcxggnkamc97s' },
  ],
  amountSats: 10000,
  startDate: '2026-11-17',
  every: 1,
  unit: 'months',
  payWindow: 7,
  drawHeight: 977759,
  demo: true,
  first: 0,
  agreement: {
    rules: ['heir', 'know', 'late', 'nointerest', 'nosell', 'notify'],
  },
}

export const EXAMPLE_LINK =
  `https://kameti-blaze.vercel.app/#${encodeCircle(EXAMPLE_CIRCLE)}`
