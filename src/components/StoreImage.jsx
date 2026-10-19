import { useState } from 'react'
export default function StoreImage({ src, alt, ...props }) {
  const [failed, setFailed] = useState(null)
  return (
    <img
      {...props}
      src={!src || failed === src ? '/image-placeholder.svg' : src}
      alt={alt}
      onError={() => setFailed(src)}
    />
  )
}
