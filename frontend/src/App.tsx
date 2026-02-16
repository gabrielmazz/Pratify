import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { AuthProvider } from './auth/AuthContext'
import { AppRoutes } from './routes'

function App() {
  return (
    <AuthProvider>
      <MantineProvider>
        <Notifications position="top-right" zIndex={1200} />
        <AppRoutes />
      </MantineProvider>
    </AuthProvider>
  )
}

export default App
