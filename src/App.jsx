import { Navigate, Route, Routes, useParams } from 'react-router-dom'

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
import Inbox from './pages/Inbox'
import Thread from './pages/Inbox/Thread'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'
import Toast from './components/ui/Toast'
import GrainOverlay from './components/ui/GrainOverlay'
import DesignPreview from './pages/DesignPreview'

// Preserves the :threadId param across the old /app/messages/:threadId ->
// /app/inbox/messages/:threadId redirect (`<Navigate>` alone can't do this).
function RedirectToInboxThread() {
  const { threadId } = useParams()
  return <Navigate to={`/app/inbox/messages/${threadId}`} replace />
}

function App() {
  return (
    <>
      <GrainOverlay />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
        </Route>

        {/* Temporary, dev-only — verifies the Phase 11 dark design foundation
            before any page-level redesign. Remove once no longer needed,
            same as the Phase 3 /styleguide route was removed in Phase 9. */}
        <Route path="/design-preview" element={<DesignPreview />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="asks/new" element={<CreateAsk />} />
            <Route path="discover" element={<DiscoverAsks />} />
            <Route path="asks/:askId" element={<AskDetails />} />
            <Route path="asks/:askId/respond" element={<RespondToAsk />} />
            <Route path="asks/:askId/compare" element={<CompareResponses />} />
            <Route path="inbox" element={<Inbox />}>
              <Route path="messages/:threadId" element={<Thread />} />
            </Route>
            {/* Compatibility redirects — old Messages/Notifications routes */}
            <Route path="messages" element={<Navigate to="/app/inbox" replace />} />
            <Route path="messages/:threadId" element={<RedirectToInboxThread />} />
            <Route path="notifications" element={<Navigate to="/app/inbox?tab=notifications" replace />} />
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
