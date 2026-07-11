// 전화번호 자동 하이픈 포맷
// - 휴대폰(01x)·인터넷(070 등) 11자리: 010-1234-5678
// - 서울(02): 02-123-4567 / 02-1234-5678
// - 그 외 지역번호 10자리: 031-123-4567
export function formatPhone(raw) {
  const d = String(raw).replace(/\D/g, '').slice(0, 11)
  if (!d) return ''

  if (d.startsWith('02')) {
    if (d.length <= 2) return d
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`
  }

  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  // 지역번호(01x 제외) 10자리 이하: 3-3-4
  if (d.length <= 10 && !d.startsWith('01')) {
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  }
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}
