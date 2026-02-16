export type SidebarNavigationItem = {
	label: string
	to: string
}

export const APP_SIDEBAR_ITEMS: SidebarNavigationItem[] = [
	{ label: 'Dashboard', to: '/dashboard' },
	{ label: 'Adicionar Paciente', to: '/patients/new' },
]
