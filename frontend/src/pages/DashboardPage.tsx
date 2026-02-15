import { Box } from '@mantine/core'
import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  return (
      <Box className={styles.root}>
          <SideBar
            title="NutriSaaS"
            items={[]}
            footer={null}
            color="--color4"
            defaultCollapsed={true}
          />

          <Box className={styles.content}>
            <PageInfo 
              title="Dashboard"
            />
          </Box>
      </Box>
  )
}
