// Supabase Edge Function (Deno) for sending email reminders
// Deploy with: supabase functions deploy email-reminders --project-ref <project>
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const emailWebhook = Deno.env.get('EMAIL_WEBHOOK')! // configure with your email provider or SMTP bridge

export default async function handler(_req: Request) {
  const supabase = await createSupabaseClient(supabaseUrl, serviceRoleKey)

  const now = new Date()
  const windowEnd = new Date(now.getTime() + 1000 * 60 * 15) // next 15 minutes
  const { data: alarms, error } = await supabase
    .from('alarms')
    .select('id, label, fire_at, lead_minutes, channel, activity_id, user_id, activities(title, due_at), profiles(full_name)')
    .in('channel', ['email', 'both'])
    .lte('fire_at', windowEnd.toISOString())
    .gte('fire_at', now.toISOString())

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const payloads = (alarms || []).map((alarm) => ({
    to: alarm.user_id,
    subject: `Reminder: ${alarm.label}`,
    body: `Upcoming: ${alarm.activities?.title || 'Activity'} at ${alarm.activities?.due_at}`
  }))

  if (payloads.length > 0) {
    await fetch(emailWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payloads })
    })
  }

  return new Response(JSON.stringify({ sent: payloads.length }), { headers: { 'Content-Type': 'application/json' } })
}

async function createSupabaseClient(url: string, key: string) {
  const supabaseLib = (globalThis as any).SupabaseClient
  if (supabaseLib) return new supabaseLib(url, key, { global: { fetch } })
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  return createClient(url, key, { global: { fetch } })
}

serve(handler)
