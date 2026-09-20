import { useParams } from 'react-router-dom'

export default function Thread() {
  const { threadId } = useParams()

  return <h2>Thread ({threadId})</h2>
}
