import type { ReactNode } from 'react'
import { ActionIcon, Box, Grid, Text } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'

// Importação dos icones do React Icons
import { IoExitOutline } from 'react-icons/io5'
import { IoMdNotificationsOutline } from 'react-icons/io'

type PageInfoProps = {
	title?: ReactNode
	titleAriaLabel?: string
	titleKey?: string | number
}

export function PageInfo({
	title = 'Pagina inicial',
	titleAriaLabel,
	titleKey,
}: PageInfoProps) {
	const navigate = useNavigate()
	const { logout } = useAuth()
	const resolvedAriaLabel = typeof title === 'string' ? title : (titleAriaLabel ?? 'Informacoes da pagina')

	const handleLogout = () => {
		logout()
		navigate('/login', { replace: true })
	}

	return (

		<Box
			aria-label={resolvedAriaLabel}
			className="
                h-[76px] w-full 
                flex-shrink-0 
                bg-[var(--color2)] 
                px-5 md:h-[100px] md:rounded-b-[80px] md:px-8
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
                    className="flex items-center gap-4 pl-2 md:pl-14 text-white"
                >
					{typeof title === 'string' ? (
						<Text key={titleKey} className="text-lg font-semibold md:text-3xl">
							{title}
						</Text>
					) : (
						<Box key={titleKey}>{title}</Box>
					)}
				</Grid.Col>

				<Grid.Col 
                    span={4} 
                    className="flex items-center justify-end gap-4 pr-2 md:pr-24 text-white">
					<Box
						className="flex h-10 w-10 items-center justify-center rounded-md text-white"
						aria-hidden
					>
						<IoMdNotificationsOutline size={32} />
					</Box>
					<ActionIcon
						variant="transparent"
						onClick={handleLogout}
						aria-label="Sair da conta"
						title="Sair"
						className="h-10 w-10 !bg-transparent !text-white hover:!bg-white/10 hover:!text-white active:!bg-white/15"
					>
						<IoExitOutline size={32} />
					</ActionIcon>
				</Grid.Col>
                
			</Grid>
		</Box> 
	)
}
