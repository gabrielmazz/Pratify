import { ActionIcon, Box, Grid, Text } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'

// Importação dos icones do React Icons
import { IoExitOutline } from 'react-icons/io5'
import { IoMdNotificationsOutline } from 'react-icons/io'

type PageInfoProps = {
	title?: string
}

export function PageInfo({
	title = 'Pagina inicial',
}: PageInfoProps) {
	const navigate = useNavigate()
	const { logout } = useAuth()

	const handleLogout = () => {
		logout()
		navigate('/login', { replace: true })
	}

	return (

		<Box
			aria-label={title}
			className="
                h-[76px] w-full 
                flex-shrink-0 
                bg-[var(--color2)] 
                px-4 md:ml-auto md:h-[100px] md:w-[98%] md:rounded-b-[80px] md:px-8
            "
		>
			<Grid
                className="
                    h-full w-full
                    flex items-center
                "
            >
				<Grid.Col 
                    span={8}
                    className="flex items-center gap-4 pl-2 md:pl-24 text-white"
                >
					<Text className="text-lg font-semibold md:text-3xl">
                        {title}
                    </Text>
				</Grid.Col>

				<Grid.Col 
                    span={4} 
                    className="flex items-center justify-end gap-4 pr-2 md:pr-24 text-white">
					<IoMdNotificationsOutline size={38} />
					<ActionIcon
						variant="transparent"
						onClick={handleLogout}
						aria-label="Sair da conta"
						title="Sair"
					>
						<IoExitOutline size={38} />
					</ActionIcon>
				</Grid.Col>
                
			</Grid>
		</Box> 
	)
}
