import { useEffect, useRef } from 'react'

// 화면 위에 겹쳐 뜨는 것(자료 열람·편집기 등)을 브라우저 뒤로가기로 닫는다.
//
// 관리자 화면과 자료 열람은 주소를 바꾸지 않고 상태로만 전환된다. 그래서 뒤로가기를
// 누르면 그 화면이 닫히는 대신 사이트 이전 페이지로 나가 버린다 — 목록으로 돌아가려던
// 사용자 입장에서는 작업이 통째로 날아가는 셈이다.
//
// 열릴 때 히스토리에 항목을 하나 쌓아 두고, 뒤로가기(popstate)를 받으면 그 항목을
// 소비하면서 onBack 을 부른다. 화면 안 버튼으로 닫았을 때는 쌓아둔 항목이 남으므로
// history.back() 으로 직접 되돌려, 뒤로가기를 한 번 더 눌러야 나가는 일이 없게 한다.
export default function useBackClose(open, onBack) {
  const cbRef = useRef(onBack)
  cbRef.current = onBack

  useEffect(() => {
    if (!open) return
    let popped = false
    window.history.pushState({ mfOverlay: true }, '')

    const onPop = () => {
      popped = true // 이미 히스토리에서 빠져나온 상태 — 아래에서 back() 을 부르면 안 된다
      cbRef.current?.()
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      if (!popped) window.history.back()
    }
  }, [open])
}
