import { useEffect, useRef, useState } from 'react'
import { GREETING, getBotReply } from '../lib/aiChatBot'
import { IconSpark } from './Icons'

const STORAGE_KEY = 'medifront_ai_chat'

function loadMessages() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    // 저장된 대화가 손상된 경우 무시하고 새로 시작
  }
  return [{ role: 'bot', text: GREETING.text, quickReplies: GREETING.quickReplies }]
}

// AI 채팅 상담 — 우측 하단 플로팅 버튼 + 채팅 패널
export default function AIChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(loadMessages)
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const bodyRef = useRef(null)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {
      // 저장 실패는 치명적이지 않음 (시크릿 모드 등)
    }
  }, [messages])

  // 새 메시지·타이핑 표시 시 맨 아래로 스크롤
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, typing, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    inputRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const send = (text) => {
    const q = text.trim()
    if (!q || typing) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setTyping(true)
    // 자연스러운 응답 딜레이
    timerRef.current = setTimeout(
      () => {
        const reply = getBotReply(q)
        setMessages((prev) => [
          ...prev,
          { role: 'bot', text: reply.text, quickReplies: reply.quickReplies, link: reply.link },
        ])
        setTyping(false)
      },
      600 + Math.random() * 500,
    )
  }

  const onSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  const last = messages[messages.length - 1]
  const quickReplies = !typing && last?.role === 'bot' ? last.quickReplies : null

  return (
    <>
      {open && (
        <div className="ai-chat" role="dialog" aria-label="AI 상담 채팅">
          <div className="ai-chat__head">
            <span className="ai-chat__avatar">
              <IconSpark width={18} height={18} />
            </span>
            <div>
              <b>메디프론트 AI 상담</b>
              <span className="ai-chat__status">
                <i /> 실시간 응답
              </span>
            </div>
            <button className="ai-chat__close" onClick={() => setOpen(false)} aria-label="닫기">
              ✕
            </button>
          </div>

          <div className="ai-chat__body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-chat__msg ai-chat__msg--${m.role}`}>
                <p>{m.text}</p>
                {m.link && (
                  <a className="ai-chat__cta" href={m.link.href} onClick={() => setOpen(false)}>
                    {m.link.label} →
                  </a>
                )}
              </div>
            ))}
            {typing && (
              <div
                className="ai-chat__msg ai-chat__msg--bot ai-chat__typing"
                aria-label="답변 작성 중"
              >
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          {quickReplies && quickReplies.length > 0 && (
            <div className="ai-chat__quick">
              {quickReplies.map((qr) => (
                <button key={qr} type="button" onClick={() => send(qr)}>
                  {qr}
                </button>
              ))}
            </div>
          )}

          <form className="ai-chat__input" onSubmit={onSubmit}>
            <input
              ref={inputRef}
              type="text"
              placeholder="궁금한 점을 입력하세요"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="메시지 입력"
            />
            <button type="submit" disabled={!input.trim() || typing} aria-label="보내기">
              전송
            </button>
          </form>
        </div>
      )}

      <button
        className={`ai-chat-fab${open ? ' ai-chat-fab--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'AI 상담 채팅 닫기' : 'AI 상담 채팅 열기'}
      >
        {open ? (
          '✕'
        ) : (
          <>
            <IconSpark width={20} height={20} />
            <span className="ai-chat-fab__label">AI 상담</span>
          </>
        )}
      </button>
    </>
  )
}
