import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Phase 5: Stripe webhook handler
  // const body = await request.text()
  // const signature = request.headers.get('stripe-signature')
  // Verify + handle events: checkout.session.completed, invoice.paid, etc.

  return NextResponse.json({ received: true })
}
