import { Link, useParams } from 'react-router-dom'

export default function AskDetails() {
  const { askId } = useParams()

  return (
    <div className="stack">
      <h1>ASK Details ({askId})</h1>
      <div className="row">
        <Link to={`/app/asks/${askId}/respond`}>Respond to this ASK</Link>
        <Link to={`/app/asks/${askId}/compare`}>Compare responses</Link>
      </div>
    </div>
  )
}
