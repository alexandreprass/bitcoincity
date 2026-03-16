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
  if (btc >= 100) return 50
  if (btc >= 10) return 30
  if (btc >= 1) return 15
  if (btc >= 0.1) return 5
  if (btc >= 0.01) return 2
  return 0.8
}

export function getBuildingColor(satoshis: number): string {
  const btc = satoshisToBtc(satoshis)
  if (btc >= 100) return '#FFD700'   // Gold - mega whale
  if (btc >= 10) return '#C0C0C0'    // Silver - whale
  if (btc >= 1) return '#4A90D9'     // Blue - holder
  if (btc >= 0.1) return '#50C878'   // Green - stacker
  if (btc >= 0.01) return '#E8A87C'  // Tan - starter
  return '#8B7355'                    // Brown - shack
}

export function getBuildingLabel(satoshis: number): string {
  const btc = satoshisToBtc(satoshis)
  if (btc >= 100) return 'Mega Whale Tower'
  if (btc >= 10) return 'Whale Skyscraper'
  if (btc >= 1) return 'Holder Tower'
  if (btc >= 0.1) return 'Stacker Building'
  if (btc >= 0.01) return 'Starter House'
  return 'Humble Shack'
}

export function isValidBtcAddress(address: string): boolean {
  // Basic validation: starts with 1, 3, or bc1, length check
  if (/^(1|3)[a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return true
  if (/^bc1[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address)) return true
  return false
}
