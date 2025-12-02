import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { groupCounts } from './services/sync'
import { ensureNotificationPermission, fireLocalNotification, playRingtone } from './services/notifications'
import { useSSMStore } from './store/useSSMStore'
import type { Activity, ActivityType, Alarm, Course, LessonFile, Semester, SemesterStatus, Subject } from './types'
import './App.css'
import { supabase } from './supabaseClient'
import type { Session } from '@supabase/supabase-js'
import { deleteLessonFile, getLessonSignedUrl, listLessonFiles, uploadLessonFile } from './services/storage'

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white shadow-card p-5 border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  )
}

const activityTypes: { label: string; value: ActivityType }[] = [
  { label: 'Assignment', value: 'assignment' },
  { label: 'Quiz', value: 'quiz' },
  { label: 'Exam', value: 'exam' },
  { label: 'Project', value: 'project' },
  { label: 'Lab', value: 'lab' },
  { label: 'Reading', value: 'reading' },
  { label: 'Other', value: 'other' }
]

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'otp' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [subjectForm, setSubjectForm] = useState<Omit<Subject, 'id'>>({
    name: 'General',
    color: '#4f46e5'
  })
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [signedUrlError, setSignedUrlError] = useState('')

  const {
    semesters,
    courses,
    activities,
    alarms,
    subjects,
    lessonFiles,
    addSemester,
    addCourse,
    addActivity,
    addAlarm,
    addSubject,
    setLessonFiles,
    removeLessonFile,
    markActivity,
    syncNow
  } = useSSMStore()

  const [semesterForm, setSemesterForm] = useState<Omit<Semester, 'id'>>({
    user_id: '',
    title: 'Semester',
    year: new Date().getFullYear(),
    start_date: new Date().toISOString().substring(0, 10),
    end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().substring(0, 10),
    status: 'current'
  })

  const [courseForm, setCourseForm] = useState<Omit<Course, 'id'>>({
    semester_id: semesters[0]?.id || '',
    user_id: '',
    code: '',
    title: '',
    lecturer: '',
    credits: 3,
    color: '#6366f1',
    schedule: { days: ['Mon'], start: '09:00', end: '10:30' }
  })

  const [activityForm, setActivityForm] = useState<Omit<Activity, 'id'>>({
    course_id: '',
    type: 'assignment',
    title: '',
    description: '',
    due_at: new Date().toISOString().slice(0, 16),
    priority: 2,
    status: 'todo',
    weight: 10
  })

  const [alarmForm, setAlarmForm] = useState<Omit<Alarm, 'id'>>({
    user_id: '',
    activity_id: '',
    label: 'Reminder',
    fire_at: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    lead_minutes: 30,
    ringtone: '',
    channel: 'both'
  })

  useEffect(() => {
    navigator.serviceWorker?.register('/sw.js').catch(() => {})
    ensureNotificationPermission()

    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess)
      if (!sess) {
        setAuthMode('login')
      }
    })
    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    setCourseForm((prev) => ({ ...prev, semester_id: semesters[semesters.length - 1]?.id || '' }))
  }, [semesters])

  useEffect(() => {
    if (session?.user?.id) {
      const uid = session.user.id
      setSemesterForm((prev) => ({ ...prev, user_id: uid }))
      setCourseForm((prev) => ({ ...prev, user_id: uid }))
      setAlarmForm((prev) => ({ ...prev, user_id: uid }))
      if (!subjects.length) {
        addSubject({ name: 'General', color: '#4f46e5' })
      }
      if (!selectedSubject && subjects.length) {
        setSelectedSubject(subjects[0].id)
      }
    }
  }, [session, subjects.length, selectedSubject, addSubject, subjects])

  useEffect(() => {
    const fetchFiles = async () => {
      if (!session?.user?.id || !subjects.length) return
      const files = await listLessonFiles(session.user.id, subjects.map((s) => s.id))
      setLessonFiles(files)
    }
    fetchFiles().catch(console.error)
  }, [session, subjects, setLessonFiles])

  const stats = useMemo(() => groupCounts({ semesters, courses, activities, alarms }), [semesters, courses, activities, alarms])

  // Auth handlers
  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setAuthMessage('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}`
      }
    })
    setIsLoading(false)
    setAuthMessage(error ? error.message : 'Check your email for a verification code/link.')
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setAuthMessage('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setIsLoading(false)
    setAuthMessage(error ? error.message : '')
  }

  async function handleSendOtp(e: FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setAuthMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}` }
    })
    setIsLoading(false)
    setAuthMessage(error ? error.message : 'Code sent to your email. Enter it below.')
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setAuthMessage('')
    const { error } = await supabase.auth.verifyOtp({ email, token: otpToken, type: 'email' })
    setIsLoading(false)
    setAuthMessage(error ? error.message : 'Signed in.')
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setAuthMessage('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`
    })
    setIsLoading(false)
    setAuthMessage(error ? error.message : 'Reset email sent. Check your inbox for the code/link.')
  }

  const userId = session?.user?.id

  const handleSemesterSubmit = (e: FormEvent) => {
    e.preventDefault()
    addSemester({ ...semesterForm, user_id: userId })
  }

  const handleCourseSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!courseForm.semester_id) return
    addCourse({ ...courseForm, user_id: userId })
  }

  const handleActivitySubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!activityForm.course_id) return
    addActivity(activityForm)
  }

  const handleAlarmSubmit = (e: FormEvent) => {
    e.preventDefault()
    addAlarm({ ...alarmForm, user_id: userId || 'self' })
    fireLocalNotification(alarmForm.label, { body: 'Alarm scheduled and will play ringtone locally.' })
    playRingtone(alarmForm.ringtone)
  }

  const handleSubjectSubmit = (e: FormEvent) => {
    e.preventDefault()
    addSubject(subjectForm)
    setSubjectForm({ name: '', color: '#4f46e5' })
  }

  const [lessonUploadFile, setLessonUploadFile] = useState<File | null>(null)

  const handleLessonUpload = async (e: FormEvent) => {
    e.preventDefault()
    if (!session?.user?.id) {
      setUploadError('Sign in first')
      return
    }
    if (!selectedSubject) {
      setUploadError('Choose a subject')
      return
    }
    if (!lessonUploadFile) {
      setUploadError('Pick a file to upload')
      return
    }
    setUploadError('')
    setUploading(true)
    try {
      const uploaded = await uploadLessonFile({ file: lessonUploadFile, subjectId: selectedSubject, userId: session.user.id })
      setLessonFiles([...lessonFiles, uploaded])
      setLessonUploadFile(null)
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteLesson = async (file: LessonFile) => {
    setUploading(true)
    try {
      await deleteLessonFile(file.path)
      removeLessonFile(file.path)
    } catch (err: any) {
      setUploadError(err.message || 'Could not delete file')
    } finally {
      setUploading(false)
    }
  }

  const handleViewLesson = async (file: LessonFile) => {
    setSignedUrlError('')
    try {
      const url = await getLessonSignedUrl(file.path)
      window.open(url, '_blank', 'noopener')
    } catch (err: any) {
      setSignedUrlError(err.message || 'Could not open file (signed URL failed)')
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow-card rounded-2xl border border-slate-100 p-6 space-y-4">
          <h1 className="text-2xl font-display font-semibold text-slate-900">Sign in to SSM</h1>
          <p className="text-sm text-slate-600">Use email verification codes for secure login. Supabase sends the code to your Gmail inbox.</p>

          <div className="flex gap-2">
            {(['login', 'signup', 'otp', 'reset'] as const).map((mode) => (
              <button
                key={mode}
                className={`flex-1 px-3 py-2 rounded-xl text-sm border ${authMode === mode ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200'}`}
                onClick={() => setAuthMode(mode)}
                type="button"
              >
                {mode === 'login' && 'Login'}
                {mode === 'signup' && 'Register'}
                {mode === 'otp' && 'Login Code'}
                {mode === 'reset' && 'Forgot Password'}
              </button>
            ))}
          </div>

          <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
            <input className="input" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {authMode === 'login' || authMode === 'signup' ? (
              <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            ) : null}
            {authMode === 'otp' && (
              <>
                <div className="flex gap-2">
                  <button className="btn" type="button" disabled={isLoading} onClick={handleSendOtp}>
                    Send login code
                  </button>
                </div>
                <input className="input" placeholder="Enter code from email" value={otpToken} onChange={(e) => setOtpToken(e.target.value)} />
              </>
            )}

            {authMode === 'login' && (
              <button className="btn" disabled={isLoading} onClick={handleLogin}>
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            )}
            {authMode === 'signup' && (
              <button className="btn" disabled={isLoading} onClick={handleSignup}>
                {isLoading ? 'Creating account...' : 'Create account'}
              </button>
            )}
            {authMode === 'otp' && (
              <button className="btn" disabled={isLoading} onClick={handleVerifyOtp}>
                {isLoading ? 'Verifying...' : 'Verify code'}
              </button>
            )}
            {authMode === 'reset' && (
              <button className="btn" disabled={isLoading} onClick={handleResetPassword}>
                {isLoading ? 'Sending reset...' : 'Send reset code'}
              </button>
            )}
          </form>

          {authMessage && <p className="text-sm text-indigo-600">{authMessage}</p>}
          <p className="text-xs text-slate-500">Use a Gmail address to receive verification codes and reset emails promptly.</p>
        </div>
      </div>
    )
  }

  const lessonStats = {
    subjects: subjects.length,
    files: lessonFiles.length,
    totalSizeMb: lessonFiles.reduce((sum, f) => sum + (f.size || 0), 0) / (1024 * 1024)
  }

  return (
    <div className="min-h-screen text-slate-900">
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <p className="uppercase tracking-[0.3em] text-xs text-slate-500">Semester & Study Manager</p>
            <h1 className="text-3xl md:text-4xl font-bold font-display text-slate-900 mt-1">Stay ahead this semester</h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
              Track semesters, courses, activities, alarms, and reports. Offline-first with Supabase sync, scheduled emails, and report exports ready for
              Vercel.
            </p>
          </div>
          <button
            className="px-4 py-2 rounded-full bg-indigo-600 text-white shadow-card hover:bg-indigo-700 transition"
            onClick={() => syncNow().catch(console.error)}
          >
            Sync to Supabase
          </button>
          <button
            className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 border border-slate-200 transition"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </header>

        <div className="grid md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-2xl shadow-card border border-indigo-50">
            <p className="text-sm text-slate-500">Semesters</p>
            <p className="text-2xl font-semibold">{stats.semesters}</p>
          </div>
          <div className="p-4 bg-white rounded-2xl shadow-card border border-emerald-50">
            <p className="text-sm text-slate-500">Courses</p>
            <p className="text-2xl font-semibold">{stats.courses}</p>
          </div>
          <div className="p-4 bg-white rounded-2xl shadow-card border border-amber-50">
            <p className="text-sm text-slate-500">Open Activities</p>
            <p className="text-2xl font-semibold">{stats.openActivities}</p>
          </div>
          <div className="p-4 bg-white rounded-2xl shadow-card border border-rose-50">
            <p className="text-sm text-slate-500">Overdue</p>
            <p className="text-2xl font-semibold text-rose-600">{stats.overdue}</p>
          </div>
          <div className="p-4 bg-white rounded-2xl shadow-card border border-sky-50">
            <p className="text-sm text-slate-500">Subjects</p>
            <p className="text-2xl font-semibold">{lessonStats.subjects}</p>
          </div>
          <div className="p-4 bg-white rounded-2xl shadow-card border border-slate-50">
            <p className="text-sm text-slate-500">Files</p>
            <p className="text-2xl font-semibold">{lessonStats.files}</p>
            <p className="text-xs text-slate-500">{lessonStats.totalSizeMb.toFixed(2)} MB</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <SectionCard title="Add Semester">
            <form className="grid grid-cols-2 gap-3" onSubmit={handleSemesterSubmit}>
              <input className="input" placeholder="Title" value={semesterForm.title} onChange={(e) => setSemesterForm({ ...semesterForm, title: e.target.value })} required />
              <input
                className="input"
                placeholder="Year"
                type="number"
                value={semesterForm.year}
                onChange={(e) => setSemesterForm({ ...semesterForm, year: Number(e.target.value) })}
                required
              />
              <input className="input" type="date" value={semesterForm.start_date} onChange={(e) => setSemesterForm({ ...semesterForm, start_date: e.target.value })} required />
              <input className="input" type="date" value={semesterForm.end_date} onChange={(e) => setSemesterForm({ ...semesterForm, end_date: e.target.value })} required />
              <select
                className="input col-span-2"
                value={semesterForm.status}
                onChange={(e) => setSemesterForm({ ...semesterForm, status: e.target.value as SemesterStatus })}
              >
                <option value="current">Current</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
              <button className="btn col-span-2">Save Semester</button>
            </form>
          </SectionCard>

          <SectionCard title="Add Course">
            <form className="grid grid-cols-2 gap-3" onSubmit={handleCourseSubmit}>
              <select className="input col-span-2" value={courseForm.semester_id} onChange={(e) => setCourseForm({ ...courseForm, semester_id: e.target.value })} required>
                <option value="">Select Semester</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} {s.year}
                  </option>
                ))}
              </select>
              <input className="input" placeholder="Code" value={courseForm.code} onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} required />
              <input className="input" placeholder="Title" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} required />
              <input className="input" placeholder="Lecturer" value={courseForm.lecturer} onChange={(e) => setCourseForm({ ...courseForm, lecturer: e.target.value })} />
              <input
                className="input"
                type="number"
                placeholder="Credits"
                value={courseForm.credits}
                onChange={(e) => setCourseForm({ ...courseForm, credits: Number(e.target.value) })}
              />
              <button className="btn col-span-2">Save Course</button>
            </form>
          </SectionCard>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <SectionCard title="Add Activity">
            <form className="grid grid-cols-2 gap-3" onSubmit={handleActivitySubmit}>
              <select className="input col-span-2" value={activityForm.course_id} onChange={(e) => setActivityForm({ ...activityForm, course_id: e.target.value })} required>
                <option value="">Select Course</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={activityForm.type}
                onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as ActivityType })}
              >
                {activityTypes.map((t) => (
                  <option value={t.value} key={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input className="input" placeholder="Title" value={activityForm.title} onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })} required />
              <input className="input" type="datetime-local" value={activityForm.due_at} onChange={(e) => setActivityForm({ ...activityForm, due_at: e.target.value })} required />
              <textarea
                className="input col-span-2"
                placeholder="Description"
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
              />
              <button className="btn col-span-2">Save Activity</button>
            </form>
          </SectionCard>

          <SectionCard title="Add Alarm">
            <form className="grid grid-cols-2 gap-3" onSubmit={handleAlarmSubmit}>
              <select className="input col-span-2" value={alarmForm.activity_id} onChange={(e) => setAlarmForm({ ...alarmForm, activity_id: e.target.value })}>
                <option value="">Attach to Activity (optional)</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
              <input className="input" placeholder="Label" value={alarmForm.label} onChange={(e) => setAlarmForm({ ...alarmForm, label: e.target.value })} required />
              <input className="input" type="datetime-local" value={alarmForm.fire_at} onChange={(e) => setAlarmForm({ ...alarmForm, fire_at: e.target.value })} required />
              <input
                className="input"
                type="number"
                placeholder="Lead minutes"
                value={alarmForm.lead_minutes}
                onChange={(e) => setAlarmForm({ ...alarmForm, lead_minutes: Number(e.target.value) })}
              />
              <select className="input" value={alarmForm.channel} onChange={(e) => setAlarmForm({ ...alarmForm, channel: e.target.value as Alarm['channel'] })}>
                <option value="both">Browser + Email</option>
                <option value="browser">Browser</option>
                <option value="email">Email</option>
              </select>
              <button className="btn col-span-2">Save Alarm</button>
            </form>
          </SectionCard>
        </div>

        <SectionCard title="Subjects & Lessons">
          <div className="grid md:grid-cols-3 gap-4">
            <form className="space-y-3" onSubmit={handleSubjectSubmit}>
              <p className="text-sm text-slate-600">Create subject</p>
              <input className="input" placeholder="Subject name" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} required />
              <input className="input" type="color" value={subjectForm.color} onChange={(e) => setSubjectForm({ ...subjectForm, color: e.target.value })} />
              <button className="btn" type="submit">
                Add subject
              </button>
            </form>

            <form className="space-y-3 md:col-span-2" onSubmit={handleLessonUpload}>
              <p className="text-sm text-slate-600">Upload lesson (PDF, PPT, Word, Excel)</p>
              <div className="grid grid-cols-2 gap-3">
                <select className="input col-span-2 md:col-span-1" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} required>
                  <option value="">Choose subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  className="input col-span-2 md:col-span-1"
                  type="file"
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.csv"
                  onChange={(e) => setLessonUploadFile(e.target.files?.[0] || null)}
                  required
                />
                <button className="btn col-span-2" type="submit" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload file'}
                </button>
              </div>
              {uploadError && <p className="text-sm text-rose-600">{uploadError}</p>}
            </form>
          </div>
        </SectionCard>

        <SectionCard title="Lesson Library">
          {lessonFiles.length === 0 && <p className="text-sm text-slate-500">No files yet. Create a subject and upload your lessons.</p>}
          <div className="grid md:grid-cols-2 gap-3">
            {lessonFiles.map((file) => {
              const subj = subjects.find((s) => s.id === file.subject_id)
              return (
                <div key={file.id} className="flex items-center justify-between border border-slate-100 rounded-xl px-4 py-3 bg-slate-50">
                  <div>
                    <p className="font-semibold">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      Subject: {subj?.name || '—'} · {(file.size || 0) / 1024 > 1 ? `${((file.size || 0) / 1024).toFixed(1)} KB` : `${file.size || 0} B`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-indigo-600 text-sm" type="button" onClick={() => handleViewLesson(file)} disabled={uploading}>
                      View
                    </button>
                    <button className="text-rose-600 text-sm" type="button" onClick={() => handleDeleteLesson(file)} disabled={uploading}>
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          {signedUrlError && <p className="text-sm text-rose-600 mt-3">{signedUrlError}</p>}
        </SectionCard>

        <SectionCard title="Upcoming Activities">
          <div className="space-y-3">
            {activities.length === 0 && <p className="text-sm text-slate-500">Add an activity to see it here.</p>}
            {activities.map((activity) => {
              const course = courses.find((c) => c.id === activity.course_id)
              return (
                <div key={activity.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm text-slate-500">{course?.title || 'Course'}</p>
                    <p className="font-semibold">{activity.title}</p>
                    <p className="text-xs text-slate-500">{new Date(activity.due_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700 capitalize">{activity.type}</span>
                    <select
                      className="input"
                      value={activity.status}
                      onChange={(e) => markActivity(activity.id, e.target.value as Activity['status'])}
                    >
                      <option value="todo">To Do</option>
                      <option value="in_progress">In Progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

export default App
