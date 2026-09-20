import { useParams } from 'react-router-dom'

export default function Profile() {
  const { userId } = useParams()

  return (
    <div className="stack">
      <h1>{userId ? `Public Profile (${userId})` : 'My Profile'}</h1>
    </div>
  )
}
