import { supabase } from '../supabaseClient'
import type { LessonFile } from '../types'

const lessonBucket = import.meta.env.VITE_SUPABASE_BUCKET || 'attachments'

export async function uploadLessonFile(opts: { file: File; subjectId: string; userId: string }) {
  const path = `${opts.userId}/${opts.subjectId}/${Date.now()}-${opts.file.name}`
  const { error, data } = await supabase.storage.from(lessonBucket).upload(path, opts.file, {
    cacheControl: '3600',
    upsert: true,
    contentType: opts.file.type
  })
  if (error) throw error
  return {
    id: data.path,
    subject_id: opts.subjectId,
    name: opts.file.name,
    path: data.path,
    bucket: lessonBucket,
    mime: opts.file.type,
    size: opts.file.size
  } as LessonFile
}

export async function listLessonFiles(userId: string, subjectIds: string[]) {
  const files: LessonFile[] = []
  for (const subjectId of subjectIds) {
    const subjectPath = `${userId}/${subjectId}`
    const { data, error } = await supabase.storage.from(lessonBucket).list(subjectPath, {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' }
    })
    if (error) throw error
    data?.forEach((f) => {
      files.push({
        id: `${subjectPath}/${f.name}`,
        subject_id: subjectId,
        name: f.name,
        path: `${subjectPath}/${f.name}`,
        bucket: lessonBucket,
        mime: f.metadata?.mimetype || 'application/octet-stream',
        size: f.metadata?.size
      })
    })
  }
  return files
}

export async function deleteLessonFile(path: string) {
  const { error } = await supabase.storage.from(lessonBucket).remove([path])
  if (error) throw error
}

export async function getLessonSignedUrl(path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage.from(lessonBucket).createSignedUrl(path, expiresInSeconds)
  if (error || !data?.signedUrl) throw error || new Error('No signed URL')
  return data.signedUrl
}
