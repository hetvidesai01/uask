import { useParams } from 'react-router-dom'

export default function CompareResponses() {
  const { askId } = useParams()

  return (
    <div className="stack">
      <h1>Compare Responses ({askId})</h1>
    </div>
  )
}
