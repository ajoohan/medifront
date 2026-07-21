import { useState } from 'react'
import { LICENSE_CHECK_URL } from '../../lib/license'

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

// 회원관리 안에서 '의사 승인 대기' 필터를 켰을 때 표시되는 확인 화면.
// 복지부 조회에 넣을 세 값을 복사 버튼과 함께 보여주고, 확인 후 바로 승인한다.
export default function LicenseReview({ members, onApprove }) {
  const [copied, setCopied] = useState('') // 방금 복사한 값의 키 (버튼 피드백용)
  const [busyId, setBusyId] = useState(null)
  const [copyError, setCopyError] = useState('')

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(''), 1200)
    } catch {
      setCopyError('복사에 실패했습니다. 값을 직접 선택해 복사해 주세요.')
    }
  }

  const approve = async (m) => {
    if (!window.confirm(`'${m.name}' 회원을 의사 회원으로 승인하시겠습니까?`)) return
    setBusyId(m.id)
    await onApprove(m)
    setBusyId(null)
  }

  return (
    <>
      <div className="license-guide">
        <b>면허 확인 순서</b>
        <ol>
          <li>
            아래 회원의 <b>세 값을 복사</b>해 복지부 조회창에 입력합니다. (조회목적: 증빙서류 제출
            면허 등록여부 확인 / 종별: 의사)
          </li>
          <li>
            조회창에서 <b>[추가]</b>를 먼저 누른 뒤 <b>[조회]</b>를 눌러야 결과가 나옵니다.
          </li>
          <li>
            결과가 <b>일치</b>면 <b>[의사 회원 승인]</b>을 누릅니다. 안내 메일이 자동 발송되고
            매거진 열람이 열립니다.
          </li>
        </ol>
        <small>
          ※ 정보주체(회원)가 가입 시 조회에 동의한 경우에만 조회하세요. 1일 이내 동일 의료인 5회
          초과 조회 시 제한됩니다.
        </small>
      </div>

      {copyError && <div className="admin-notice admin-notice--warn">{copyError}</div>}

      {members.length === 0 ? (
        <p className="admin-empty">승인 대기 중인 의사 회원이 없습니다.</p>
      ) : (
        <div className="license-list">
          {members.map((m) => (
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
                  생년월일이 없어 조회할 수 없습니다. 회원에게 문의해 아래 상세에서 입력해 주세요.
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
      )}
    </>
  )
}
