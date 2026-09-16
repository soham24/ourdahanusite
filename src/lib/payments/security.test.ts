import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function load(path: string, deps: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const exports: Record<string, (...args: any[]) => any> = {} // eslint-disable-line @typescript-eslint/no-explicit-any
  new Function('require', 'exports', js)((name: string) => {
    if (!(name in deps)) throw new Error(`Unexpected dependency ${name}`)
    return deps[name]
  }, exports)
  return exports
}

test('an authorized but uncaptured Razorpay order must not be accepted as paid', () => {
  const {validateRazorpayOrder} = load('../payment-security.ts', {'server-only':{},'@/lib/data/pricing':{},'@/lib/supabase/public':{}})
  const options = {flow:'appointment',userId:'12345678-rest',expectedAmountPaise:100,order:{id:'order',amount:100,amount_paid:0,currency:'INR',receipt:'appointment_12345678_1',status:'attempted'}}
  assert.ok(validateRazorpayOrder(options))
  assert.equal(validateRazorpayOrder({...options,order:{...options.order,status:'paid',amount_paid:100}}), null)
})

test('intent persistence fails closed instead of permitting an unrecoverable checkout', async () => {
  const original = console.error
  console.error = () => {}
  try {
    for (const client of [null, {from:()=>({insert:async()=>({error:{message:'database unavailable'}})})}]) {
      const {recordPaymentIntent} = load('../payment-intents.ts', {'server-only':{},'@/lib/supabase/admin-client':{createAdminClient:()=>client}})
      assert.equal(await recordPaymentIntent({userId:'user',flow:'marketplace',razorpayOrderId:'order',amountPaise:100,payload:{}}), false)
    }
    const {recordPaymentIntent} = load('../payment-intents.ts', {'server-only':{},'@/lib/supabase/admin-client':{createAdminClient:()=>({from:()=>({insert:async()=>({error:null})})})}})
    assert.equal(await recordPaymentIntent({userId:'user',flow:'marketplace',razorpayOrderId:'order',amountPaise:100,payload:{}}), true)
  } finally { console.error = original }
})

test('appointment directory reads occupancy with the trusted client and rejects failed reads', async () => {
  for (const fail of [false, true]) {
    let trustedReads = 0
    const query = (result: unknown) => {
      const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) }
      for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'order']) chain[method] = () => chain
      return chain
    }
    const deps = {
      'server-only': {}, 'next/cache': {cacheLife:()=>{},cacheTag:()=>{}},
      '@/lib/appointment-slots': {generateAvailableSlots:()=>[]},
      '@/lib/cache-tags': {CACHE_TAGS:{}}, '@/lib/cache-policy': {PUBLIC_CONTENT_CACHE:{}},
      '@/lib/data/appointment-overrides': {getOverridesForListings:async()=>({})},
      '@/lib/india-time': {getIndiaToday:()=> '2026-09-16',addIndiaDays:()=> '2026-09-30'},
      '@/lib/isr-debug': {logCacheRegeneration:()=>{}},
      '@/lib/listing-content': {normalizeAppointmentSettings:()=>null},
      '@/lib/supabase/public': {createPublicClient:()=>({from:(table: string)=>{
        assert.equal(table,'listings','private occupancy must not use the anonymous client')
        return query({data:[{id:'listing',name:'Clinic'}],error:null})
      }})},
      '@/lib/supabase/admin-client': {createAdminClient:()=>({from:()=>{
        trustedReads++
        return query({data:[],error:fail ? {message:'offline'} : null})
      }})},
    }
    const {getAppointmentDirectory} = load('../data/appointment-directory.ts',deps)
    if (fail) await assert.rejects(getAppointmentDirectory(), /availability/i)
    else assert.equal((await getAppointmentDirectory()).length,1)
    assert.equal(trustedReads,1)
  }
})
