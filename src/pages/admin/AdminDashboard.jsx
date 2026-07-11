import { useState } from 'react'
import MembersAdmin from './MembersAdmin'
import MagazineAdmin from './MagazineAdmin'
import SettingsAdmin from './SettingsAdmin'
import ConsultMeetingAdmin, { ConsultDirectAdmin } from './ConsultAdmin'

const VIEWS = [
  { key: 'members', label: '회원관리', component: MembersAdmin },
  { key: 'magazine', label: '매거진 관리', component: MagazineAdmin },
]

// 상담 관리 서브메뉴 (대면 상담 / 1:1 상담)
const CONSULT_VIEWS = [
  { key: 'consult-meeting', label: '대면 상담', component: ConsultMeetingAdmin },
  { key: 'consult-direct', label: '1:1 상담', component: ConsultDirectAdmin },
]

const SETTINGS_VIEW = { key: 'settings', label: '설정', component: SettingsAdmin }

const ALL_VIEWS = [...VIEWS, ...CONSULT_VIEWS, SETTINGS_VIEW]

export default function AdminDashboard({ onLogout }) {
  const [view, setView] = useState('members')
  const Current = ALL_VIEWS.find((v) => v.key === view)?.component ?? MembersAdmin

  return (
    <div className="admin">
      <aside className="admin__side">
        <button
          className="admin__brand"
          onClick={() => setView('members')}
          aria-label="관리자 메인으로"
        >
          MEDIFRONT <span>ADMIN</span>
        </button>
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

          <div className="admin__navgroup">상담 관리</div>
          {CONSULT_VIEWS.map((v) => (
            <button
              key={v.key}
              className={`admin__navitem admin__navitem--sub ${view === v.key ? 'is-active' : ''}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}

          <button
            className={`admin__navitem ${view === SETTINGS_VIEW.key ? 'is-active' : ''}`}
            onClick={() => setView(SETTINGS_VIEW.key)}
          >
            {SETTINGS_VIEW.label}
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
