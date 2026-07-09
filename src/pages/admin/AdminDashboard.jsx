import { useState } from 'react'
import MembersAdmin from './MembersAdmin'
import MagazineAdmin from './MagazineAdmin'

const VIEWS = [
  { key: 'members', label: '회원관리', component: MembersAdmin },
  { key: 'magazine', label: '매거진 관리', component: MagazineAdmin },
]

export default function AdminDashboard({ onLogout }) {
  const [view, setView] = useState('members')
  const Current = VIEWS.find((v) => v.key === view)?.component ?? MembersAdmin

  return (
    <div className="admin">
      <aside className="admin__side">
        <div className="admin__brand">
          MEDIFRONT <span>ADMIN</span>
        </div>
        <nav className="admin__nav">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              className={`admin__navitem ${view === v.key ? 'is-active' : ''}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
          <button className="admin__navitem" disabled>
            상담 관리 <small>준비중</small>
          </button>
          <button className="admin__navitem" disabled>
            설정 <small>준비중</small>
          </button>
        </nav>
        <button className="admin__logout" onClick={onLogout}>
          로그아웃
        </button>
      </aside>

      <main className="admin__main">
        <Current />
      </main>
    </div>
  )
}
