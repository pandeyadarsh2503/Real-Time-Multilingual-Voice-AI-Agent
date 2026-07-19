import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { chatAPI, voiceAPI } from '../services/api'

/**
 * Chat state shared by the chat window, voice interfaces, and any view
 * that hands off into the conversation — replaces a 13-prop drill.
 */
const ChatContext = createContext(null)

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used inside <ChatProvider>')
  return ctx
}

export function ChatProvider({ user, children }) {
  const audioRef = useRef(null)
  const [sessionId] = useState(() => uuidv4())   // fresh session per app load
  const [messages, setMessages] = useState([])
  const [status, setStatus] = useState('ready')
  // Pre-login language choice (Login page pills) carries through.
  const [language, setLanguage] = useState(() => localStorage.getItem('preferredLang') || 'en')

  const patientName = user?.displayName || 'Guest'

  const addMessage = useCallback((role, content, lang) => {
    setMessages((prev) => [
      ...prev,
      { id: uuidv4(), role, content, language: lang, ts: Date.now() },
    ])
  }, [])

  const handleUserMessage = useCallback((text, lang) => {
    addMessage('user', text, lang)
  }, [addMessage])

  const handleAIResponse = useCallback((text, lang) => {
    addMessage('assistant', text, lang)
    if (lang) setLanguage(lang)
  }, [addMessage])

  const playAudio = useCallback(async (text, lang) => {
    try {
      setStatus('speaking')
      const res = await voiceAPI.tts(text, lang)
      const url = URL.createObjectURL(res.data)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setStatus('ready')
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        setStatus('ready')
      }
      await audio.play()
    } catch {
      setStatus('ready')
    }
  }, [])

  const sendChatMessage = useCallback(async (userText) => {
    if (!userText.trim()) return
    handleUserMessage(userText, language)
    setStatus('thinking')
    try {
      const res = await chatAPI.send(userText, sessionId, patientName, language)
      const { response, language: detectedLang } = res.data
      if (detectedLang && detectedLang !== language) setLanguage(detectedLang)
      handleAIResponse(response, detectedLang || language)
      await playAudio(response, detectedLang || language)
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Something went wrong. Please try again.'
      toast.error(errMsg)
      handleAIResponse(errMsg, language)
      setStatus('ready')
    }
  }, [sessionId, patientName, language, handleUserMessage, handleAIResponse, playAudio])

  // Initial greeting after login
  useEffect(() => {
    if (user && messages.length === 0) {
      setMessages([{
        id: uuidv4(),
        role: 'assistant',
        content: `Hello ${patientName}! I'm your AI healthcare assistant.\nYou can book appointments, check availability, or ask me anything.`,
        language: 'en',
        ts: Date.now(),
      }])
    }
  }, [user]) // eslint-disable-line

  const value = {
    sessionId,
    messages,
    status,
    setStatus,
    language,
    setLanguage,
    patientName,
    sendChatMessage,
    handleUserMessage,
    handleAIResponse,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
