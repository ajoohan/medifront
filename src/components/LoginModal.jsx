import { useEffect, useState } from 'react'
import Logo from './Logo'
import { useUser } from '../context/UserContext'

const GRADES = ['일반', '의사', '원장']

export default function LoginModal({ open, onClose }) {
  const { login } = useUser()
  const [email, setEmail] = useState('')
  const [grade, setGrade] = useState('일반')

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
    // TODO: 실제 로그인 인증 로직 연결 지점 (현재는 데모 — 선택한 등급으로 로그인)
    login({ name: email.trim() || '데모 회원', grade })
    onClose()
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
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field login-modal__pw">
            <label>비밀번호</label>
            <input type="password" placeholder="비밀번호" required />
          </div>

          <div className="field login-modal__pw">
            <label>
              회원 등급 <span className="login-modal__demo">데모</span>
            </label>
            <div className="login-modal__grades">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={grade === g ? 'is-active' : undefined}
                  onClick={() => setGrade(g)}
                >
                  {g}
                </button>
              ))}
            </div>
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

        <p className="login-modal__note">
          * 데모: 선택한 등급으로 로그인됩니다. 매거진은 의사·원장 등급만 열람 가능합니다.
        </p>
      </div>
    </div>
  )
}
