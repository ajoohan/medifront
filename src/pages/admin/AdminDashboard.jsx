import { useState } from 'react'
import DashboardAdmin from './DashboardAdmin'
import MembersAdmin from './MembersAdmin'
import LicenseAdmin from './LicenseAdmin'
import MagazineAdmin from './MagazineAdmin'
import SettingsAdmin from './SettingsAdmin'
import PerformanceAdmin from './PerformanceAdmin'
import ConsultMeetingAdmin, { ConsultDirectAdmin } from './ConsultAdmin'

const ADMIN_VERSION = 'Version 0.7'

// 대시보드는 사이드바 메뉴에 노출하지 않고, 로그인 기본 화면·로고 클릭 대상으로만 사용
const DASHBOARD_VIEW = { key: 'dashboard', label: '대시보드', component: DashboardAdmin }

const VIEWS = [
  { key: 'members', label: '회원관리', component: MembersAdmin },
  { key: 'license', label: '의사 면허 확인', component: LicenseAdmin },
]

// 콘텐츠 관리 서브메뉴 (성과 관리 / 매거진 관리)
const CONTENT_VIEWS = [
  { key: 'performance', label: '성과 관리', component: PerformanceAdmin },
  { key: 'magazine', label: '매거진 관리', component: MagazineAdmin },
]

// 상담 관리 서브메뉴 (대면 상담: 신청 접수 + 회의록 / 1:1 상담)
const CONSULT_VIEWS = [
  { key: 'consult-meeting', label: '대면 상담', component: ConsultMeetingAdmin },
  { key: 'consult-direct', label: '1:1 상담', component: ConsultDirectAdmin },
]

const SETTINGS_VIEW = { key: 'settings', label: '설정', component: SettingsAdmin }

const ALL_VIEWS = [DASHBOARD_VIEW, ...VIEWS, ...CONTENT_VIEWS, ...CONSULT_VIEWS, SETTINGS_VIEW]

// 드롭다운 그룹 메뉴 — 상위 메뉴와 동일 스타일, 클릭 시 서브메뉴 펼침/접힘
function NavGroup({ label, views, open, onToggle, view, setView }) {
  const hasActive = views.some((v) => v.key === view)
  return (
    <>
      <button
        className={`admin__navitem ${!open && hasActive ? 'is-active' : ''}`}
        onClick={onToggle}
        aria-expanded={open}
      >
        {label}
        <span className={`admin__nav-arrow ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open &&
        views.map((v) => (
          <button
            key={v.key}
            className={`admin__navitem admin__navitem--sub ${view === v.key ? 'is-active' : ''}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
    </>
  )
}

export default function AdminDashboard({ onLogout }) {
  const [view, setView] = useState('dashboard')
  const [contentOpen, setContentOpen] = useState(false) // 콘텐츠 관리 펼침
  const [consultOpen, setConsultOpen] = useState(false) // 상담 관리 펼침
  const Current = ALL_VIEWS.find((v) => v.key === view)?.component ?? DashboardAdmin

  return (
    <div className="admin">
      <aside className="admin__side">
        <button
          className="admin__brand"
          onClick={() => setView('dashboard')}
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

          <NavGroup
            label="콘텐츠 관리"
            views={CONTENT_VIEWS}
            open={contentOpen}
            onToggle={() => setContentOpen((o) => !o)}
            view={view}
            setView={setView}
          />

          <NavGroup
            label="상담 관리"
            views={CONSULT_VIEWS}
            open={consultOpen}
            onToggle={() => setConsultOpen((o) => !o)}
            view={view}
            setView={setView}
          />

          <button
            className={`admin__navitem ${view === SETTINGS_VIEW.key ? 'is-active' : ''}`}
            onClick={() => setView(SETTINGS_VIEW.key)}
          >
            {SETTINGS_VIEW.label}
          </button>
        </nav>
        {/* 데스크톱: 사이드바 하단에 로그아웃·버전 */}
        <div className="admin__side-foot">
          <button className="admin__logout" onClick={onLogout}>
            로그아웃
          </button>
          <div className="admin__version">{ADMIN_VERSION}</div>
        </div>
      </aside>

      <main className="admin__main">
        <Current onGo={setView} />
      </main>

      {/* 모바일: 로그아웃·버전을 화면 하단 푸터에 표시 (CSS로 반응형 전환) */}
      <footer className="admin__foot">
        <button className="admin__logout" onClick={onLogout}>
          로그아웃
        </button>
        <div className="admin__version">{ADMIN_VERSION}</div>
      </footer>
    </div>
  )
}
