import { useEffect, useRef } from 'react'

// 화면 상단에 잠깐 떴다 사라지는 알림.
// 페이지를 가리지 않으면서 "무슨 일이 일어났는지"만 알린다 —
// 로그아웃처럼 사용자가 누르지 않았는데 상태가 바뀐 경우에 쓴다.
const ICONS = {
  info: (
    <path
      d="M12 8h.01M11 12h1v4h1"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  ok: (
    <path
      d="m8 12.5 2.5 2.5L16 9.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  warn: (
    <path
      d="M12 8v4.5M12 16h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
}

export default function Toast({ toast, onClose }) {
  const timer = useRef(null)

  // 새 알림이 뜰 때마다 타이머를 다시 잡는다 (id 가 바뀌면 새 알림)
  useEffect(() => {
    if (!toast) return
    clearTimeout(timer.current)
    timer.current = setTimeout(onClose, toast.duration ?? 5000)
    return () => clearTimeout(timer.current)
  }, [toast, onClose])

  if (!toast) return null
  const type = toast.type || 'info'

  return (
    <div className="toast-layer" aria-live="polite">
      <div key={toast.id} className={`toast toast--${type}`} role="status">
        <span className="toast__icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            {ICONS[type] || ICONS.info}
          </svg>
        </span>
        <div className="toast__body">
          {toast.title && <b>{toast.title}</b>}
          <p>{toast.text}</p>
        </div>
        <button type="button" className="toast__close" onClick={onClose} aria-label="알림 닫기">
          ✕
        </button>
      </div>
    </div>
  )
}
