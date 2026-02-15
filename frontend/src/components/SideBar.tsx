import { useState, type CSSProperties, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'
import styles from './SideBar.module.css'

// Importação dos ícones do React Icons
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
	const resolvedColor = resolveSidebarColor(color)
	const rootStyle = resolvedColor
		? ({
			'--sidebar-bg': resolvedColor,
			'--sidebar-accent': resolvedColor,
		} as CSSProperties)
		: undefined

	const toggleCollapsed = () => {
		setIsCollapsed((value) => !value)
	}

	return (
		<aside className={cn(styles.root, isCollapsed && styles.rootCollapsed, className)} style={rootStyle}>
			<header className={cn(styles.header, isCollapsed && styles.headerCollapsed)}>
				<h2 className={cn(styles.title, isCollapsed && styles.titleHidden)}>{title}</h2>
				<button
					type="button"
					className={cn(styles.toggle, isCollapsed ? styles.toggleCollapsed : styles.toggleExpanded)}
					onClick={toggleCollapsed}
					aria-label={isCollapsed ? 'Expandir sidebar' : 'Retrair sidebar'}
					title={isCollapsed ? 'Expandir' : 'Retrair'}
				>
					{isCollapsed ? <MdOutlineMenuOpen size={25} /> : <MdOutlineMenu size={25} />}
				</button>
			</header>

			<nav className={styles.nav}>
				{items.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						className={({ isActive }) =>
							cn(styles.link, isCollapsed && styles.linkCollapsed, isActive && styles.linkActive)
						}
						title={item.label}
					>
						<span className={cn(styles.label, isCollapsed && styles.labelHidden)}>{item.label}</span>
					</NavLink>
				))}
			</nav>

			{footer ? (
				<footer className={cn(styles.footer, isCollapsed && styles.footerCollapsed)}>
					{footer}
				</footer>
			) : null}
		</aside>
	)
}
