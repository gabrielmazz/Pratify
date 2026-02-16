import type { IconType } from 'react-icons'
import { MdDashboard, MdOutlineLibraryBooks, MdOutlinePersonAddAlt1, MdOutlinePeopleAlt } from 'react-icons/md'

type SidebarNavigationChildItem = {
	label: string
	to: string
	icon?: IconType
}

export type SidebarNavigationItem = {
	label: string
	to?: string
	icon?: IconType
	description?: string
	children?: SidebarNavigationChildItem[]
}

export const APP_SIDEBAR_ITEMS: SidebarNavigationItem[] = [
	{
		label: 'Dashboard',
		to: '/dashboard',
		icon: MdDashboard,
		description: 'Visao geral da conta',
	},
	{
		label: 'Pacientes',
		to: '/patients',
		icon: MdOutlinePeopleAlt,
		description: 'Gestao de cadastro e consulta',
		children: [
			{
				label: 'Listar Pacientes',
				to: '/patients',
				icon: MdOutlineLibraryBooks,
			},
			{
				label: 'Adicionar Paciente',
				to: '/patients/new',
				icon: MdOutlinePersonAddAlt1,
			},
		],
	},
]
