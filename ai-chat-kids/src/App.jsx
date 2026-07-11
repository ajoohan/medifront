import { useEffect, useRef, useState } from 'react'

// AI채팅 키즈 — 어린이 건강 친구 '메디'
const GREETING =
  '안녕! 나는 메디야 🐻 몸과 건강에 대해 궁금한 게 있으면 뭐든지 물어봐! 아프면 꼭 어른에게 말해야 하는 거, 알지?'

const QUICK_QUESTIONS = [
  '양치는 왜 해야 해요?',
  '주사는 왜 맞아요?',
  '감기에 걸리면 어떻게 해요?',
  '채소를 꼭 먹어야 해요?',
]

// 서버(AI)에 연결할 수 없을 때 쓰는 체험 모드 답변 — 키워드 매칭
const OFFLINE_REPLIES = [
  {
    keywords: ['양치', '이빨', '치아', '충치'],
    reply:
      '양치를 안 하면 세균들이 이에 남은 음식을 먹고 이를 아프게 해요! 🦷 아침저녁으로 3분씩 쓱싹쓱싹 닦아 주면 충치 걱정 끝!',
  },
  {
    keywords: ['주사', '예방접종', '병원 무서'],
    reply:
      '주사는 우리 몸에 나쁜 병균과 싸우는 연습을 시켜 주는 거예요. 💪 따끔한 건 아주 잠깐이고, 그 덕분에 튼튼해진답니다!',
  },
  {
    keywords: ['감기', '열', '기침', '콧물'],
    reply:
      '감기에 걸리면 푹 쉬고, 물을 많이 마시고, 꼭 어른에게 말해요! 🤧 많이 아프면 병원에 가서 의사 선생님을 만나는 게 최고예요.',
  },
  {
    keywords: ['채소', '편식', '야채', '골고루'],
    reply:
      '채소에는 몸을 지켜 주는 비타민 용사들이 살고 있어요! 🥦 골고루 먹으면 키도 쑥쑥 크고 감기도 덜 걸린답니다.',
  },
  {
    keywords: ['손', '씻'],
    reply:
      '손에는 눈에 안 보이는 세균이 잔뜩 있어요! 🧼 비누로 30초 동안 구석구석 씻으면 병균들이 뿅 하고 사라져요.',
  },
]

const OFFLINE_DEFAULT =
  '지금은 메디가 연습 모드라서 간단한 것만 대답할 수 있어요. 😅 양치, 주사, 감기, 채소, 손 씻기에 대해 물어봐 줄래요?'

function offlineReply(text) {
  const found = OFFLINE_REPLIES.find((item) => item.keywords.some((k) => text.includes(k)))
  return found ? found.reply : OFFLINE_DEFAULT
}

export default function App() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  const send = async (text) => {
    const question = text.trim()
    if (!question || loading) return

    const nextMessages = [...messages, { role: 'user', content: question }]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/kids-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 인사말(첫 메시지)은 빼고 실제 대화만 전송
        body: JSON.stringify({ messages: nextMessages.slice(1) }),
      })
      const data = await res.json().catch(() => null)

      if (res.ok && data?.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      } else if (res.status === 503 || res.status === 404 || data?.code === 'not_configured') {
        // AI 서버 미설정/미배포 → 체험 모드
        setOffline(true)
        setMessages((prev) => [...prev, { role: 'assistant', content: offlineReply(question) }])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data?.error || '앗, 뭔가 잘못됐어요. 다시 물어봐 줄래요? 🙏',
          },
        ])
      }
    } catch {
      setOffline(true)
      setMessages((prev) => [...prev, { role: 'assistant', content: offlineReply(question) }])
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__title">
          <span className="app__logo" aria-hidden>
            🐻
          </span>
          <div>
            <h1>
              AI채팅 <span className="app__accent">키즈</span>
            </h1>
            <p>
              어린이 건강 친구 <b>메디</b>
              {offline && <span className="app__offline"> · 연습 모드</span>}
            </p>
          </div>
        </div>
      </header>

      <main className="chat">
        <div className="chat__messages" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble bubble--${m.role}`}>
              {m.role === 'assistant' && (
                <span className="bubble__avatar" aria-hidden>
                  🐻
                </span>
              )}
              <p>{m.content}</p>
            </div>
          ))}
          {loading && (
            <div className="bubble bubble--assistant">
              <span className="bubble__avatar" aria-hidden>
                🐻
              </span>
              <p className="typing" aria-label="메디가 생각하는 중">
                <span />
                <span />
                <span />
              </p>
            </div>
          )}
        </div>

        <div className="chat__chips">
          {QUICK_QUESTIONS.map((q) => (
            <button key={q} type="button" onClick={() => send(q)} disabled={loading}>
              {q}
            </button>
          ))}
        </div>

        <form className="chat__form" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메디에게 궁금한 걸 물어보세요!"
            maxLength={500}
            aria-label="메디에게 보낼 질문"
          />
          <button type="submit" disabled={loading || !input.trim()}>
            보내기 🚀
          </button>
        </form>
      </main>

      <footer className="app__notice">
        메디는 AI 친구라서 의사 선생님을 대신할 수 없어요. 아프면 꼭 어른에게 말하고 병원에 가세요!
        많이 아플 땐 어른과 함께 <b>119</b>에 전화해요. 🚑
      </footer>
    </div>
  )
}
