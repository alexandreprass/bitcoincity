const BTC_API_BASE = 'https://blockchain.info'

export async function getAddressBalance(address: string): Promise<number> {
  const res = await fetch(
    `${BTC_API_BASE}/q/addressbalance/${address}?confirmations=1`,
    { next: { revalidate: 86400 } }
  )
  if (!res.ok) {
    throw new Error('Failed to fetch balance')
  }
  const satoshis = parseInt(await res.text(), 10)
  return satoshis
}

export function satoshisToBtc(satoshis: number): number {
  return satoshis / 100_000_000
}

export function getBuildingHeight(satoshis: number): number {
  const btc = satoshisToBtc(satoshis)
  if (btc >= 100) return 8
  if (btc >= 10) return 7
  if (btc >= 5) return 6
  if (btc >= 3) return 5
  if (btc >= 1) return 4
  if (btc >= 0.5) return 3
  if (btc >= 0.1) return 2
  return 1
}

export function getBuildingColor(satoshis: number): string {
  const btc = satoshisToBtc(satoshis)
  if (btc >= 100) return '#FFD700'
  if (btc >= 10) return '#C0C0C0'
  if (btc >= 5) return '#4169E1'
  if (btc >= 3) return '#4A90D9'
  if (btc >= 1) return '#5B8DEF'
  if (btc >= 0.5) return '#50C878'
  if (btc >= 0.1) return '#E8A87C'
  return '#8B7355'
}

export function getBuildingLabel(satoshis: number): string {
  const btc = satoshisToBtc(satoshis)
  if (btc >= 100) return 'Mega Whale Tower'
  if (btc >= 10) return 'Whale Skyscraper'
  if (btc >= 5) return 'Diamond Tower'
  if (btc >= 3) return 'Platinum Building'
  if (btc >= 1) return 'Holder Tower'
  if (btc >= 0.5) return 'Stacker Building'
  if (btc >= 0.1) return 'Starter House'
  return 'Humble Shack'
}

export function isValidBtcAddress(address: string): boolean {
  if (/^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true
  if (/^bc1[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address)) return true
  return false
}

export const VERIFICATION_WALLET = 'bc1pc6yv23fhkck86pekw7ecpptwyw4uzcq3jp2y04ynatrtg29r4fnq68nhx0'
