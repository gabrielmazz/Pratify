import { useState, type CSSProperties, type ReactNode } from 'react'
import { ActionIcon, Box, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../../lib/utils'

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
	const rootStyle = {
		'--sidebar-bg': 'linear-gradient(180deg, rgba(78, 77, 74, 0.06) 0%, rgba(43, 78, 114, 0.08) 100%)',
		'--sidebar-accent': 'var(--color4)',
		...(resolvedColor
			? {
				'--sidebar-bg': resolvedColor,
				'--sidebar-accent': resolvedColor,
			}
			: {}),
	} as CSSProperties

	const toggleCollapsed = () => {
		if (isMobile) return
		setIsCollapsed((value) => !value)
	}

	const isItemActive = (to: string) => {
		return location.pathname === to || location.pathname.startsWith(`${to}/`)
	}

	return (
		<Box
			component="aside"
			className={cn(
				'w-[260px] min-h-[calc(100vh-5rem)] my-6 py-5 px-4 border-r border-[hsl(var(--border))] rounded-r-[80px] overflow-hidden bg-[var(--sidebar-bg)] flex flex-col gap-6 shrink-0 transition-[width,padding] duration-200 ease-in-out max-[768px]:w-full max-[768px]:min-h-[72px] max-[768px]:my-0 max-[768px]:py-[0.65rem] max-[768px]:px-3 max-[768px]:gap-[0.65rem] max-[768px]:border-r-0 max-[768px]:border-b max-[768px]:rounded-none',
				collapsed && 'w-[86px] px-[0.65rem] max-[768px]:w-full max-[768px]:py-[0.65rem] max-[768px]:px-3',
				className,
			)}
			style={rootStyle}
		>
			<Box
				component="header"
				className={cn(
					'py-1 px-2 flex items-center justify-between gap-2 max-[768px]:p-0',
					collapsed && 'justify-center px-0',
				)}
			>
				<Title
					order={2}
					className={cn(
						'm-0 text-[1.125rem] font-bold whitespace-nowrap mt-[50px] text-white transition-[opacity,width] duration-150 max-[768px]:mt-0 max-[768px]:text-base',
						collapsed && 'opacity-0 w-0 overflow-hidden',
					)}
				>
					{title}
				</Title>
				<ActionIcon
					variant="subtle"
					className="flex items-center justify-center w-10 h-10 rounded-md border border-transparent bg-transparent text-white cursor-pointer ml-[-15px] mt-[50px] max-[768px]:ml-0 max-[768px]:mt-0 hover:border-[var(--sidebar-accent)] hover:bg-[color-mix(in_srgb,var(--sidebar-accent)_8%,transparent)]"
					onClick={toggleCollapsed}
					aria-label={collapsed ? 'Expandir sidebar' : 'Retrair sidebar'}
					title={collapsed ? 'Expandir' : 'Retrair'}
				>
					{collapsed ? <MdOutlineMenuOpen size={25} /> : <MdOutlineMenu size={25} />}
				</ActionIcon>
			</Box>

			<Box component="nav" className="flex flex-col gap-[0.4rem]">
				{items.map((item) => (
					<Box
						key={item.to}
						component={Link}
						to={item.to}
						className={cn(
							'block w-full py-[0.65rem] px-[0.8rem] rounded-[10px] text-[hsl(var(--foreground))] no-underline text-[0.95rem] font-medium transition-[background-color,color,padding] duration-150 hover:bg-[color-mix(in_srgb,var(--sidebar-accent)_12%,transparent)]',
							collapsed && 'px-[0.25rem] text-center',
							isItemActive(item.to) && 'bg-[color-mix(in_srgb,var(--sidebar-accent)_18%,transparent)] text-[var(--sidebar-accent)]',
						)}
						title={item.label}
					>
						<Text span className={cn('inline-block whitespace-nowrap', collapsed && 'opacity-0 w-0 overflow-hidden')}>
							{item.label}
						</Text>
					</Box>
				))}
			</Box>

			{footer ? (
				<Box component="footer" className={cn('mt-auto p-2 transition-[opacity,max-height,padding] duration-150', collapsed && 'opacity-0 max-h-0 overflow-hidden p-0 pointer-events-none')}>
					{footer}
				</Box>
			) : null}
		</Box>
	)
}
