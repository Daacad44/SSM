// Edge Function for weekly PDF & XLSX generation
// Uses chromium from Deno Deploy friendly build
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import ExcelJS from 'https://esm.sh/exceljs@4.4.0'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const storageBucket = Deno.env.get('REPORT_BUCKET') || 'reports'

export default async function handler(req: Request) {
  const supabase = await createSupabaseClient(supabaseUrl, serviceRoleKey)
  const { user_id, week_start, week_end } = await req.json()

  const { data: activities } = await supabase
    .from('activities')
    .select('title, type, due_at, status, courses(title)')
    .gte('due_at', week_start)
    .lte('due_at', week_end)
    .order('due_at', { ascending: true })

  // Build PDF
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  page.drawText('Weekly Report', { x: 40, y: 790, size: 22, font, color: rgb(0.2, 0.2, 0.5) })
  activities?.forEach((a, idx) => {
    page.drawText(`${idx + 1}. ${a.title} (${a.type}) - ${a.status} - ${new Date(a.due_at).toLocaleString()}`, {
      x: 40,
      y: 750 - idx * 20,
      size: 12,
      font,
      color: rgb(0.1, 0.1, 0.1)
    })
  })
  const pdfBytes = await pdf.save()

  // Build Excel
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Week')
  sheet.columns = [
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Course', key: 'course', width: 20 },
    { header: 'Due', key: 'due', width: 22 },
    { header: 'Status', key: 'status', width: 14 }
  ]
  activities?.forEach((a) => {
    sheet.addRow({
      title: a.title,
      type: a.type,
      course: a.courses?.title,
      due: a.due_at,
      status: a.status
    })
  })
  const xlsxBytes = await workbook.xlsx.writeBuffer()

  const pdfPath = `${user_id}/${week_start}-report.pdf`
  const xlsxPath = `${user_id}/${week_start}-report.xlsx`

  await supabase.storage.from(storageBucket).upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })
  await supabase.storage.from(storageBucket).upload(xlsxPath, xlsxBytes, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: true })

  const { data: pdfUrl } = await supabase.storage.from(storageBucket).createSignedUrl(pdfPath, 60 * 60)
  const { data: xlsxUrl } = await supabase.storage.from(storageBucket).createSignedUrl(xlsxPath, 60 * 60)

  return new Response(JSON.stringify({ pdf: pdfUrl?.signedUrl, xlsx: xlsxUrl?.signedUrl }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

async function createSupabaseClient(url: string, key: string) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  return createClient(url, key, { global: { fetch } })
}

serve(handler)
