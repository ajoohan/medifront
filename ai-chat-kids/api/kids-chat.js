// AI채팅 키즈 — 어린이 눈높이 건강 상담 챗봇 API (Vercel Serverless Function)
// Claude API 연동: Vercel 환경변수 ANTHROPIC_API_KEY 필요 (없으면 503 → 프론트가 체험 모드로 전환)
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'

const SYSTEM_PROMPT = `너는 '메디'야. 'AI채팅 키즈'의 어린이 건강 친구 AI 챗봇이란다.
대화 상대는 유치원생~초등학생 어린이야.

말하기 규칙:
- 쉽고 짧은 한국어 문장으로 말해. 어려운 의학 용어는 쉬운 말로 풀어서 설명해.
- 다정한 해요체를 쓰고, 이모지를 한두 개씩 섞어서 밝고 재미있게 말해.
- 답변은 2~5문장으로 짧게 해. 필요하면 어린이가 이해하기 쉬운 비유를 사용해.

안전 규칙 (가장 중요!):
- 너는 의사가 아니야. 절대 병명을 진단하거나 약을 처방하지 마.
- 어린이가 아프다고 하면, 꼭 부모님·선생님 같은 어른에게 말하고 병원에 가라고 알려줘.
- 많이 아프거나 위험한 상황(숨쉬기 힘듦, 심한 피, 의식 잃음 등) 이야기가 나오면 즉시 어른에게 알리고 어른과 함께 119에 전화하라고 안내해.
- 무섭거나 폭력적이거나 어린이에게 맞지 않는 주제는 부드럽게 거절하고 건강한 주제로 돌려줘.
- 이름, 주소, 전화번호 같은 개인정보는 묻지도 말고, 알려주면 저장하지 않는다고 말해줘.

역할:
- 몸과 건강에 대한 어린이의 궁금증(양치, 손 씻기, 편식, 주사, 병원이 무서운 이유 등)을 재미있게 풀어줘.
- 건강한 습관(일찍 자기, 골고루 먹기, 운동하기)을 칭찬하고 응원해 줘.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'POST 요청만 받을 수 있어요.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res
      .status(503)
      .json({ error: 'AI 서버가 아직 준비되지 않았어요.', code: 'not_configured' })
  }

  const { messages } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '메시지가 비어 있어요.' })
  }

  // 최근 20개 턴만 사용, 각 메시지 2,000자 제한
  const history = messages
    .slice(-20)
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return res.status(400).json({ error: '마지막 메시지는 어린이의 질문이어야 해요.' })
  }

  const client = new Anthropic()

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: history,
    })

    if (response.stop_reason === 'refusal') {
      return res.status(200).json({
        reply:
          '음, 그 이야기는 메디가 대답하기 어려워요. 🙏 몸과 건강에 대한 궁금한 걸 물어봐 줄래요?',
      })
    }

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()

    return res.status(200).json({
      reply: text || '앗, 메디가 잠깐 딴생각을 했어요. 한 번만 다시 물어봐 줄래요? 😅',
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res
        .status(429)
        .json({ error: '지금 친구들이 너무 많이 몰렸어요! 잠시 후 다시 물어봐 주세요. 🐻' })
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return res
        .status(503)
        .json({ error: 'AI 서버 설정에 문제가 있어요.', code: 'not_configured' })
    }
    console.error('kids-chat error:', error)
    return res
      .status(500)
      .json({ error: '메디가 잠깐 어지러워요. 조금 있다가 다시 말 걸어 주세요! 🙏' })
  }
}
