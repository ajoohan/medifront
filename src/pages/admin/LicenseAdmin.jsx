import { useEffect, useMemo, useState } from 'react'
import { fetchMembers, updateMemberDb } from '../../lib/membersDb'

// 보건복지부 면허민원 기관조회(개별조회) — 성명·면허종별·면허번호·생년월일로 등록 여부를 확인한다.
// 조회에는 기관 이용 신청(범용 공동인증서 로그인)과 정보주체 동의가 필요하다.
const LICENSE_CHECK_URL = 'https://lic.mohw.go.kr/instt/instt_srch_each.do?MENU_ID=I-02-01'

// 의사 승인 대기 = 가입 때 면허번호를 냈지만 아직 등급이 '의사'가 아닌 회원
const isPending = (m) => !!m.licenseNo && m.grade !== '의사'

function formatDate(iso) {
  if (!iso) return '-'
  const [y, m, d] = String(iso).split('-')
  return d ? `${y}.${m}.${d}` : iso
}

// 생년월일 표시 — 저장은 YYMMDD 6자리
const formatBirth = (b) => {
  const s = String(b || '').replace(/\D/g, '')
  return s.length === 6 ? `${s.slice(0, 2)}.${s.slice(2, 4)}.${s.slice(4, 6)}` : b || '미입력'
}

export default function LicenseAdmin() {
  const [members, setMembers] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('') // 방금 복사한 값의 키 (버튼 피드백용)
  const [busyId, setBusyId] = useState(null)
  const [done, setDone] = useState([]) // 이번 화면에서 승인 처리한 회원 id

  useEffect(() => {
    fetchMembers().then((list) => {
      if (list) setMembers(list)
      else setError('회원 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.')
      setLoaded(true)
    })
  }, [])

  const pending = useMemo(() => members.filter(isPending), [members])

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(''), 1200)
    } catch {
      setError('복사에 실패했습니다. 값을 직접 선택해 복사해 주세요.')
    }
  }

  // 승인 = 회원유형을 '의사'로 변경. 서버가 Cognito 등급까지 바꾸고 안내 메일을 보낸다.
  const approve = async (m) => {
    if (!window.confirm(`'${m.name}' 회원을 의사 회원으로 승인하시겠습니까?`)) return
    setBusyId(m.id)
    const r = await updateMemberDb(m.id, { grade: '의사' })
    setBusyId(null)
    if (r?.error) {
      setError(`승인에 실패했습니다: ${r.error}`)
      return
    }
    setMembers((ms) => ms.map((x) => (x.id === m.id ? { ...x, grade: '의사' } : x)))
    setDone((d) => [...d, m.id])
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>의사 면허 확인</h1>
          <p>의사 회원을 신청한 가입자의 면허를 확인하고 승인합니다.</p>
        </div>
        <a
          className="btn btn--primary admin-head__action"
          href={LICENSE_CHECK_URL}
          target="_blank"
          rel="noreferrer"
        >
          복지부 조회창 열기 ↗
        </a>
      </div>

      {error && <div className="admin-notice admin-notice--warn">{error}</div>}

      <div className="license-guide">
        <b>확인 순서</b>
        <ol>
          <li>
            아래 회원의 <b>세 값을 복사</b>해 복지부 조회창에 입력합니다. (조회목적: 증빙서류 제출
            면허 등록여부 확인 / 종별: 의사)
          </li>
          <li>
            조회창에서 <b>[추가]</b>를 먼저 누른 뒤 <b>[조회]</b>를 눌러야 결과가 나옵니다.
          </li>
          <li>
            결과가 <b>일치</b>면 아래 <b>[의사 회원 승인]</b>을 누릅니다. 안내 메일이 자동 발송되고
            매거진 열람이 열립니다.
          </li>
        </ol>
        <small>
          ※ 정보주체(회원)가 가입 시 조회에 동의한 경우에만 조회하세요. 1일 이내 동일 의료인 5회
          초과 조회 시 제한됩니다.
        </small>
      </div>

      {!loaded ? (
        <p className="admin-empty">불러오는 중...</p>
      ) : pending.length === 0 ? (
        <p className="admin-empty">
          승인 대기 중인 의사 회원이 없습니다.
          {done.length > 0 && ` (방금 ${done.length}명 승인 완료)`}
        </p>
      ) : (
        <>
          <p className="license-count">
            승인 대기 <b>{pending.length}</b>명
          </p>
          <div className="license-list">
            {pending.map((m) => (
              <article className="license-card" key={m.id}>
                <div className="license-card__head">
                  <div>
                    <h3>{m.name}</h3>
                    <span className="license-card__meta">
                      {m.email} · 가입 {formatDate(m.joinedAt)}
                    </span>
                  </div>
                  <span className="license-card__badge">승인 대기</span>
                </div>

                <div className="license-fields">
                  <div className="license-field">
                    <span className="license-field__label">성명</span>
                    <b className="license-field__value">{m.name}</b>
                    <button
                      type="button"
                      className="license-field__copy"
                      onClick={() => copy(`name-${m.id}`, m.name)}
                    >
                      {copied === `name-${m.id}` ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <div className="license-field">
                    <span className="license-field__label">면허번호</span>
                    <b className="license-field__value">{m.licenseNo}</b>
                    <button
                      type="button"
                      className="license-field__copy"
                      onClick={() => copy(`lic-${m.id}`, m.licenseNo)}
                    >
                      {copied === `lic-${m.id}` ? '복사됨' : '복사'}
                    </button>
                  </div>
                  <div className="license-field">
                    <span className="license-field__label">생년월일</span>
                    <b className="license-field__value">{formatBirth(m.birth)}</b>
                    <button
                      type="button"
                      className="license-field__copy"
                      onClick={() => copy(`birth-${m.id}`, m.birth)}
                      disabled={!m.birth}
                    >
                      {copied === `birth-${m.id}` ? '복사됨' : '복사'}
                    </button>
                  </div>
                </div>

                {!m.birth && (
                  <p className="license-card__warn">
                    생년월일이 없어 조회할 수 없습니다. 회원에게 문의해 회원관리에서 입력해 주세요.
                  </p>
                )}

                <div className="license-card__actions">
                  <a
                    className="btn btn--ghost"
                    href={LICENSE_CHECK_URL}
                    target="_blank"
                    rel="noreferrer"
                  >
                    복지부에서 조회 ↗
                  </a>
                  <button
                    className="btn btn--primary"
                    onClick={() => approve(m)}
                    disabled={busyId === m.id}
                  >
                    {busyId === m.id ? '승인 중...' : '의사 회원 승인'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  )
}
