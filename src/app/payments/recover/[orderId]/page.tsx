import RecoverClient from './RecoverClient'

export default async function PaymentRecoveryPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  return <RecoverClient orderId={orderId} />
}
