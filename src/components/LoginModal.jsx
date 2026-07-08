import { useEffect } from 'react'
import Logo from './Logo'

// 간편 로그인(SNS) — UI 플레이스홀더 (실제 연동 전)
const SOCIALS = [
  { name: '카카오', bg: '#FEE500', color: '#3C1E1E', label: 'K' },
  { name: '네이버', bg: '#03C75A', color: '#ffffff', label: 'N' },
  { name: '구글', bg: '#ffffff', color: '#4285F4', label: 'G', border: true },
  { name: '페이스북', bg: '#1877F2', color: '#ffffff', label: 'f' },
]

export default function LoginModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const onSubmit = (e) => {
    e.preventDefault()
    // TODO: 실제 로그인 인증 로직 연결 지점
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button className="login-modal__close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        <div className="login-modal__logo">
          <Logo variant="dark" />
        </div>
        <p className="login-modal__sub">병원 성장의 파트너, 메디프론트</p>

        <form onSubmit={onSubmit}>
          <div className="field">
            <label>이메일</label>
            <input type="email" placeholder="you@example.com" required />
          </div>
          <div className="field login-modal__pw">
            <label>비밀번호</label>
            <input type="password" placeholder="비밀번호" required />
          </div>
          <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }}>
            로그인
          </button>
        </form>

        <div className="login-modal__links">
          <button type="button">회원가입</button>
          <span>·</span>
          <button type="button">아이디 찾기</button>
          <span>·</span>
          <button type="button">비밀번호 찾기</button>
        </div>

        <div className="login-modal__divider">
          <span>SNS 계정으로 로그인</span>
        </div>

        <div className="login-modal__socials">
          {SOCIALS.map((s) => (
            <button
              key={s.name}
              type="button"
              className="social-btn"
              aria-label={`${s.name} 로그인`}
              style={{
                background: s.bg,
                color: s.color,
                border: s.border ? '1px solid var(--line)' : 'none',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="login-modal__note">* 로그인 기능은 준비 중입니다.</p>
      </div>
    </div>
  )
}
