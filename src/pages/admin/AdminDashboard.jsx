import MembersAdmin from './MembersAdmin'

export default function AdminDashboard({ onLogout }) {
  return (
    <div className="admin">
      <aside className="admin__side">
        <div className="admin__brand">
          MEDIFRONT <span>ADMIN</span>
        </div>
        <nav className="admin__nav">
          <button className="admin__navitem is-active">회원관리</button>
          <button className="admin__navitem" disabled>
            상담 관리 <small>준비중</small>
          </button>
          <button className="admin__navitem" disabled>
            매거진 관리 <small>준비중</small>
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
        <MembersAdmin />
      </main>
    </div>
  )
}
