# AI채팅 키즈 🐻

어린이(유치원생~초등학생) 눈높이 건강 챗봇 **'메디'** — medifront 사이트와는 **별개의 독립 프로젝트**입니다.

- 프론트엔드: React + Vite (단일 페이지 채팅 앱)
- 백엔드: Vercel Serverless Function (`api/kids-chat.js`) + Claude API
- AI 미설정/오프라인 시: 키워드 기반 **체험 모드**로 자동 전환

## 로컬 실행

```bash
cd ai-chat-kids
npm install
npm run dev
```

로컬 `vite dev`에서는 서버리스 함수가 실행되지 않으므로 체험 모드로 동작합니다.
실제 AI 응답까지 로컬에서 확인하려면 Vercel CLI를 사용하세요:

```bash
ANTHROPIC_API_KEY=sk-ant-... npx vercel dev
```

## Vercel 배포 (별도 프로젝트로)

1. Vercel에서 **새 프로젝트**를 만들고 이 저장소를 연결합니다.
2. **Root Directory를 `ai-chat-kids`로 설정**합니다. (medifront 프로젝트와 분리되는 핵심 설정)
3. Environment Variables에 `ANTHROPIC_API_KEY`를 추가합니다.
   - 키 발급: https://platform.claude.com
   - 선택: `ANTHROPIC_MODEL`로 모델 변경 가능 (기본값 `claude-opus-4-8`)
4. 배포하면 끝!

> 나중에 별도 GitHub 저장소로 분리하려면 이 폴더 내용을 새 저장소로 옮기기만 하면 됩니다.
> 폴더 안에 필요한 설정(`package.json`, `vercel.json`, `vite.config.js`)이 모두 들어 있습니다.

## 안전 설계

- 시스템 프롬프트로 진단·처방 금지, 아플 땐 어른·병원 안내, 위험 상황 시 어른과 함께 119 안내
- 무섭거나 부적절한 주제는 부드럽게 거절, 개인정보 수집 금지
- 대화 최근 20턴·메시지당 2,000자 제한
- 화면 하단에 "메디는 의사 선생님을 대신할 수 없어요" 상시 안내 배너
