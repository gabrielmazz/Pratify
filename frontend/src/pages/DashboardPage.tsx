import { Avatar, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { SideBar } from '../components/SideBar'

export function DashboardPage() {
  const navigate = useNavigate()


  return (
      <div>
          <SideBar
            title="NutriSaaS"
            items={[]}
            footer={null}
            color="--color4"
            defaultCollapsed={true}
          />
      </div>
  )
}
