import { Navigate, Route, Routes } from 'react-router-dom'

import PublicLayout from './layouts/PublicLayout'
import AppLayout from './layouts/AppLayout'
import ProtectedRoute from './layouts/ProtectedRoute'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import CreateAsk from './pages/CreateAsk'
import DiscoverAsks from './pages/DiscoverAsks'
import AskDetails from './pages/AskDetails'
import RespondToAsk from './pages/RespondToAsk'
import CompareResponses from './pages/CompareResponses'
import Messages from './pages/Messages'
import Thread from './pages/Messages/Thread'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'
import Toast from './components/ui/Toast'

function App() {
  return (
    <>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="asks/new" element={<CreateAsk />} />
            <Route path="discover" element={<DiscoverAsks />} />
            <Route path="asks/:askId" element={<AskDetails />} />
            <Route path="asks/:askId/respond" element={<RespondToAsk />} />
            <Route path="asks/:askId/compare" element={<CompareResponses />} />
            <Route path="messages" element={<Messages />}>
              <Route path=":threadId" element={<Thread />} />
            </Route>
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/:userId" element={<Profile />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toast />
    </>
  )
}

export default App
