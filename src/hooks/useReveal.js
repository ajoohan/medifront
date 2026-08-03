import { useEffect } from 'react'

// 스크롤 진입 시 .reveal 요소에 .in 클래스를 추가해 페이드인.
//
// ⚠️ 처음 그려진 요소만 관찰하면 안 된다. 매거진 목록·빈 화면 안내처럼 데이터를 받아온
// 뒤에 나타나는 요소는 그때 이미 관찰이 끝나 있어 .in 이 붙지 않고, .reveal 의 기본값인
// opacity:0 으로 남아 화면에서 사라진다(자리는 차지하는데 아무것도 안 보인다).
// 그래서 DOM 이 바뀔 때마다 새로 생긴 .reveal 을 추가로 관찰한다.
export default function useReveal() {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )

    // 이미 .in 이 붙은 것은 건너뛴다 (같은 요소를 다시 observe 해도 무해하지만 불필요)
    const observeNew = () =>
      document.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el))

    observeNew()

    // 렌더가 끝난 뒤 한 번에 훑도록 프레임 단위로 묶는다 (변경마다 부르면 낭비)
    let queued = 0
    const mo = new MutationObserver(() => {
      if (queued) return
      queued = requestAnimationFrame(() => {
        queued = 0
        observeNew()
      })
    })
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
      if (queued) cancelAnimationFrame(queued)
    }
  }, [])
}
