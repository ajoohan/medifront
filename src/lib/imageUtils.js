// 이미지 첨부용 유틸 — 고용량 이미지를 자동 압축해 1장당 5MB 미만을 보장합니다.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB

// dataURL의 실제 바이트 크기 (base64 길이 × 3/4)
export function dataUrlBytes(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.floor(base64.length * 0.75)
}

/**
 * 이미지 파일 → 압축된 JPEG dataURL
 * - 기본 최대 폭 1600px로 리사이즈
 * - 5MB를 넘으면 품질(0.85→0.55) → 해상도(×0.75) 순으로 단계 축소해
 *   1장당 5MB 미만이 될 때까지 반복 압축
 */
export function fileToDataUrl(file, maxW = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let width = Math.min(img.width, maxW)
        let quality = 0.85
        let out = null
        for (let i = 0; i < 10; i++) {
          const scale = Math.min(1, width / img.width)
          const canvas = document.createElement('canvas')
          canvas.width = Math.max(1, Math.round(img.width * scale))
          canvas.height = Math.max(1, Math.round(img.height * scale))
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
          out = canvas.toDataURL('image/jpeg', quality)
          if (dataUrlBytes(out) < MAX_IMAGE_BYTES) break
          // 아직 크면: 품질 먼저 낮추고, 그다음 해상도 축소
          if (quality > 0.55) quality -= 0.15
          else width = Math.round(width * 0.75)
        }
        resolve(out)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
