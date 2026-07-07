import { useState } from 'react'
import { BRAND, SPECIALTIES, REGIONS } from '../data'
import { IconPhone, IconMail, IconClock, IconCheck } from './Icons'

const initial = {
  name: '',
  phone: '',
  specialty: '',
  openingPeriod: '',
  openingRegion: '',
  message: '',
  agree: false,
}

// 개원희망시기 옵션 — 오늘이 속한 분기부터 향후 12개 분기(3년)를 자동 생성
const QUARTERS = (() => {
  const d = new Date()
  let year = d.getFullYear()
  let q = Math.floor(d.getMonth() / 3) + 1 // 1~4분기
  const list = []
  for (let i = 0; i < 12; i++) {
    list.push(`${year}년 ${q}분기`)
    q += 1
    if (q > 4) {
      q = 1
      year += 1
    }
  }
  return list
})()

export default function Contact() {
  const [form, setForm] = useState(initial)
  const [sent, setSent] = useState(false)

  const update = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
  }

  const onSubmit = (e) => {
    e.preventDefault()
    // TODO: 실제 전송 로직(API/이메일/구글폼 등) 연결 지점
    // 현재는 데모로 화면에만 접수 완료 표시
    setSent(true)
    setForm(initial)
    setTimeout(() => setSent(false), 6000)
  }

  return (
    <section className="section cta" id="contact">
      <div className="container">
        {/* 상단 무료 진단 CTA */}
        <div className="cta__box reveal" style={{ marginBottom: 48 }}>
          <span className="price-tag">
            정가 <s>30만원</s> → 지금 무료
          </span>
          <h2>무료 블로그·마케팅 정밀 진단 리포트</h2>
          <p>
            현재 노출 상태, 경쟁 병원 키워드 비교, 개선 우선순위, 성장 시뮬레이션까지.
            우리 병원의 성장 가능성을 데이터로 확인해 보세요.
          </p>
          <div className="cta__actions">
            <a href="#contact-form" className="btn btn--light btn--lg">
              무료 진단 신청하기
            </a>
            <a href={`tel:${BRAND.phone.replace(/-/g, '')}`} className="btn btn--ghost btn--lg">
              전화 상담 {BRAND.phone}
            </a>
          </div>
          <div className="cta__note">상담은 100% 무료이며, 부담 없이 문의하실 수 있습니다.</div>
        </div>

        {/* 문의 폼 */}
        <div className="contact__inner" id="contact-form">
          <div className="contact__info reveal">
            <span className="eyebrow">CONTACT</span>
            <h2>상담 신청</h2>
            <p>
              아래 정보를 남겨주시면 담당 컨설턴트가 24시간 이내에 연락드립니다.
              병원 상황에 맞는 맞춤 전략을 제안해 드립니다.
            </p>
            <ul className="contact__list">
              <li>
                <span className="ico">
                  <IconPhone width={20} height={20} />
                </span>
                <div>
                  <b>전화 상담</b>
                  <span>{BRAND.phone} (평일 09:00~18:00)</span>
                </div>
              </li>
              <li>
                <span className="ico">
                  <IconMail width={20} height={20} />
                </span>
                <div>
                  <b>이메일</b>
                  <span>{BRAND.email}</span>
                </div>
              </li>
              <li>
                <span className="ico">
                  <IconClock width={20} height={20} />
                </span>
                <div>
                  <b>응답 시간</b>
                  <span>영업일 기준 24시간 이내 회신</span>
                </div>
              </li>
            </ul>
          </div>

          <form className="form reveal" onSubmit={onSubmit}>
            {sent && (
              <div className="form__ok">
                <IconCheck width={18} height={18} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />
                상담 신청이 접수되었습니다. 곧 연락드리겠습니다!
              </div>
            )}
            <div className="form__row">
              <div className="field">
                <label>
                  성함 <span className="req">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="홍길동"
                  value={form.name}
                  onChange={update('name')}
                />
              </div>
              <div className="field">
                <label>
                  연락처 <span className="req">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={update('phone')}
                />
              </div>
            </div>
            <div className="form__row">
              <div className="field">
                <label>진료과목</label>
                <select value={form.specialty} onChange={update('specialty')}>
                  <option value="">선택해주세요</option>
                  {SPECIALTIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="기타">기타</option>
                </select>
              </div>
              <div className="field">
                <label>
                  개원희망시기
                  <span className="field__hint">개원(예정) 시</span>
                </label>
                <select value={form.openingPeriod} onChange={update('openingPeriod')}>
                  <option value="">선택해주세요</option>
                  {QUARTERS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="미정">아직 미정</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>
                개원희망지역
                <span className="field__hint">개원(예정) 시</span>
              </label>
              <select value={form.openingRegion} onChange={update('openingRegion')}>
                <option value="">선택해주세요</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>문의 내용</label>
              <textarea
                placeholder="현재 고민이나 목표를 자유롭게 적어주세요."
                value={form.message}
                onChange={update('message')}
              />
            </div>
            <label className="form__consent">
              <input type="checkbox" required checked={form.agree} onChange={update('agree')} />
              <span>
                개인정보 수집·이용에 동의합니다. 수집된 정보는 상담 목적 외에는 사용되지 않습니다.
              </span>
            </label>
            <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%' }}>
              무료 상담 신청하기
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
