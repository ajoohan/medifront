import { useEffect, useState } from 'react'
import Logo from './Logo'
import { useUser } from '../context/UserContext'
import { MOCK_MEMBERS } from '../mock/members'

export default function LoginModal({ open, onClose }) {
  const { login } = useUser()
  const [email, setEmail] = useState('')

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
    // 데모: 회원 데이터에서 이메일로 등급을 조회(없으면 일반)
    const key = email.trim().toLowerCase()
    const found = MOCK_MEMBERS.find((m) => m.email.toLowerCase() === key)
    login({
      name: found?.name || email.trim() || '회원',
      email: email.trim(),
      grade: found?.grade || '일반',
    })
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
          * 데모: 로그인 계정 등급에 따라 매거진 열람 권한이 결정됩니다.
          <br />
          예) minjun.kim@gmail.com(원장) · doyoon.park@gmail.com(의사) ·
          chaewon.yoon@gmail.com(일반)
        </p>
      </div>
    </div>
  )
}
