import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// ── Chat ───────────────────────────────────────────────────
export const chatAPI = {
  send: (message, sessionId, patientName = null, language = null) =>
    api.post('/chat', {
      message,
      session_id: sessionId,
      patient_name: patientName,
      language,
    }),
}

// ── Voice ──────────────────────────────────────────────────
export const voiceAPI = {
  stt: (audioBlob, languageHint = null) => {
    const form = new FormData()
    form.append('audio', audioBlob, 'recording.webm')
    if (languageHint) form.append('language_hint', languageHint)
    return api.post('/voice/stt', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  tts: (text, language = 'en') =>
    api.post('/voice/tts', { text, language }, { responseType: 'blob' }),
}

// ── Appointments ───────────────────────────────────────────
export const appointmentsAPI = {
  list:     (params = {}) => api.get('/appointments', { params }),
  today:    ()             => api.get('/appointments/today'),
  upcoming: (limit = 5)   => api.get('/appointments/upcoming', { params: { limit } }),
  get:      (id)           => api.get(`/appointments/${id}`),
  cancel:   (id)           => api.delete(`/appointments/${id}`),
}

// ── Outbound ───────────────────────────────────────────────
export const outboundAPI = {
  trigger:          (appointmentId, phone) =>
    api.post('/outbound/trigger', { appointment_id: appointmentId, phone }),
  simulate:         (appointmentId) =>
    api.post('/outbound/simulate', { appointment_id: appointmentId }),
  upcomingReminders: () => api.get('/outbound/upcoming-reminders'),
}
