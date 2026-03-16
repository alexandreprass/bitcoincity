import { NextResponse } from 'next/server'
import { isValidBtcAddress } from '@/lib/bitcoin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')

  if (!address || !isValidBtcAddress(address)) {
    return NextResponse.json({ error: 'Invalid Bitcoin address' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://blockchain.info/q/addressbalance/${address}?confirmations=1`,
      {
        headers: { 'User-Agent': 'BitcoinCity/1.0' },
        next: { revalidate: 3600 },
      }
    )

    if (!res.ok) {
      if (res.status === 429) {
        return NextResponse.json({ error: 'Rate limited. Please try again in a few minutes.' }, { status: 429 })
      }
      throw new Error(`Blockchain API error: ${res.status}`)
    }

    const text = await res.text()
    const balance = parseInt(text, 10)

    if (isNaN(balance)) {
      throw new Error('Invalid balance response')
    }

    return NextResponse.json({ balance, address })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch balance' },
      { status: 500 }
    )
  }
}
