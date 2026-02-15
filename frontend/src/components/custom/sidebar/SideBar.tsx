import { useState, type CSSProperties, type ReactNode } from 'react'
import { ActionIcon, Box, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../../lib/utils'
import styles from './SideBar.module.css'

// Importacao dos icones do React Icons
import { MdOutlineMenu, MdOutlineMenuOpen } from 'react-icons/md'

type SideBarItem = {
	label: string
	to: string
}

type SideBarProps = {
	title?: string
	items: SideBarItem[]
	footer?: ReactNode
	className?: string
	defaultCollapsed?: boolean
	color?: string
}

const resolveSidebarColor = (color?: string) => {
	if (!color) {
		return undefined
	}

	const value = color.trim()

	if (!value) {
		return undefined
	}

	if (value.startsWith('--')) {
		return `var(${value})`
	}

	return value
}

export function SideBar({
	title = 'Menu',
	items,
	footer,
	className,
	defaultCollapsed = false,
	color,
}: SideBarProps) {
	const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
	const isMobile = useMediaQuery('(max-width: 768px)')
	const collapsed = isMobile ? false : isCollapsed
	const location = useLocation()
	const resolvedColor = resolveSidebarColor(color)
	const rootStyle = resolvedColor
		? ({
			'--sidebar-bg': resolvedColor,
			'--sidebar-accent': resolvedColor,
		} as CSSProperties)
		: undefined

	const toggleCollapsed = () => {
		if (isMobile) return
		setIsCollapsed((value) => !value)
	}

	const isItemActive = (to: string) => {
		return location.pathname === to || location.pathname.startsWith(`${to}/`)
	}

	return (
		<Box component="aside" className={cn(styles.root, collapsed && styles.rootCollapsed, className)} style={rootStyle}>
			<Box component="header" className={cn(styles.header, collapsed && styles.headerCollapsed)}>
				<Title order={2} className={cn(styles.title, collapsed && styles.titleHidden)}>
					{title}
				</Title>
				<ActionIcon
					variant="subtle"
					className={cn(styles.toggle, collapsed ? styles.toggleCollapsed : styles.toggleExpanded)}
					onClick={toggleCollapsed}
					aria-label={collapsed ? 'Expandir sidebar' : 'Retrair sidebar'}
					title={collapsed ? 'Expandir' : 'Retrair'}
				>
					{collapsed ? <MdOutlineMenuOpen size={25} /> : <MdOutlineMenu size={25} />}
				</ActionIcon>
			</Box>

			<Box component="nav" className={styles.nav}>
				{items.map((item) => (
					<Box
						key={item.to}
						component={Link}
						to={item.to}
						className={cn(styles.link, collapsed && styles.linkCollapsed, isItemActive(item.to) && styles.linkActive)}
						title={item.label}
					>
						<Text span className={cn(styles.label, collapsed && styles.labelHidden)}>
							{item.label}
						</Text>
					</Box>
				))}
			</Box>

			{footer ? (
				<Box component="footer" className={cn(styles.footer, collapsed && styles.footerCollapsed)}>
					{footer}
				</Box>
			) : null}
		</Box>
	)
}
