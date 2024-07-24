import { createSignal } from 'solid-js'

export default function Solid() {
  const [likes, setLikes] = createSignal(0)

  return (
    <button onClick={() => setLikes(likes() + 1)}>
      Likes {likes()}
    </button>
  )
}
