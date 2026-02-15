import { Avatar, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { SideBar } from '../components/SideBar'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  if (!user) {
    return null
  }

  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const sidebarItems = [
    { label: 'Dashboard', to: '/dashboard' },
  ]

  return (
    <div className={styles.layout}>
      <SideBar
        title="NutriSaaS"
        items={sidebarItems}
        footer={
          <Stack gap="sm">
            <Group wrap="nowrap">
              <Avatar color="teal" radius="xl">
                {initials || 'U'}
              </Avatar>
              <div>
                <Text fw={600}>{user.name}</Text>
                <Text size="xs" c="dimmed">
                  {user.email}
                </Text>
              </div>
            </Group>
            <Button variant="light" color="red" onClick={handleLogout}>
              Sair
            </Button>
          </Stack>
        }
      />

      <main className={styles.content}>
        <Card withBorder shadow="sm" radius="md" p="xl" className={styles.card}>
          <Title order={3}>Area do usuario</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Sessao iniciada com sucesso
          </Text>

          <Stack mt="lg" gap="xs">
            <Text className={styles.sectionLabel}>Nome</Text>
            <Text>{user.name}</Text>
            <Text className={styles.sectionLabel} mt="sm">
              E-mail
            </Text>
            <Text>{user.email}</Text>
          </Stack>
        </Card>
      </main>
    </div>
  )
}
