import { Outlet } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import PublicFooter from '../components/layout/PublicFooter'

export default function PublicLayout() {
  return (
    <div>
      <Navbar />
      <main>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
