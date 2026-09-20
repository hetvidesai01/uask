import { useParams } from 'react-router-dom'

export default function RespondToAsk() {
  const { askId } = useParams()

  return (
    <div className="stack">
      <h1>Respond to ASK ({askId})</h1>
    </div>
  )
}
