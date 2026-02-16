import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ActionIcon, Box, Text, Title, Tooltip } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Link, useLocation } from 'react-router-dom'
import type { IconType } from 'react-icons'
import { MdChevronRight, MdOutlineMenu, MdOutlineMenuOpen, MdOutlineSpa } from 'react-icons/md'
import { cn } from '../../../lib/utils'

type SideBarItem = {
	label: string
	to?: string
	icon?: IconType
	description?: string
	children?: Array<{
		label: string
		to: string
		icon?: IconType
	}>
}

type SideBarProps = {
	title?: string
	items: SideBarItem[]
	footer?: ReactNode
	className?: string
	defaultCollapsed?: boolean
	color?: string
}

const SUBMENU_CLOSE_DELAY_MS = 280
const DEFAULT_FALLBACK_ROUTE = '/dashboard'

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
	const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
	const closeSubmenuTimerRef = useRef<number | null>(null)

	const isMobile = useMediaQuery('(max-width: 768px)')
	const collapsed = isMobile ? false : isCollapsed
	const location = useLocation()
	const resolvedColor = resolveSidebarColor(color)

	const rootStyle = {
		'--sidebar-bg': 'linear-gradient(180deg, rgba(78, 77, 74, 0.08) 0%, rgba(43, 78, 114, 0.12) 100%)',
		'--sidebar-accent': 'var(--color4)',
		...(resolvedColor
			? {
				'--sidebar-bg': resolvedColor,
				'--sidebar-accent': resolvedColor,
			}
			: {}),
	} as CSSProperties

	const clearSubmenuCloseTimer = () => {
		if (closeSubmenuTimerRef.current) {
			window.clearTimeout(closeSubmenuTimerRef.current)
			closeSubmenuTimerRef.current = null
		}
	}

	const openSubmenuNow = (submenuKey: string) => {
		clearSubmenuCloseTimer()
		setOpenSubmenu(submenuKey)
	}

	const closeSubmenuSoon = () => {
		clearSubmenuCloseTimer()
		closeSubmenuTimerRef.current = window.setTimeout(() => {
			setOpenSubmenu(null)
		}, SUBMENU_CLOSE_DELAY_MS)
	}

	useEffect(() => {
		return () => {
			clearSubmenuCloseTimer()
		}
	}, [])

	const toggleCollapsed = () => {
		if (isMobile) {
			return
		}

		setIsCollapsed((value) => !value)
	}

	const isItemActive = (to: string) => {
		return location.pathname === to || location.pathname.startsWith(`${to}/`)
	}

	const isParentItemActive = (item: SideBarItem) => {
		if (item.to && isItemActive(item.to)) {
			return true
		}

		if (!item.children?.length) {
			return false
		}

		return item.children.some((subItem) => isItemActive(subItem.to))
	}

	return (
		<Box
			component="aside"
			className={cn(
				'relative isolate z-[120] w-[260px] min-h-[calc(100vh-5rem)] my-6 pt-20 pb-4 px-3 border-r border-[hsl(var(--border))] rounded-r-[80px] overflow-visible bg-[var(--sidebar-bg)] flex flex-col gap-4 shrink-0 transition-[width,padding] duration-200 ease-in-out max-[768px]:w-full max-[768px]:min-h-[72px] max-[768px]:my-0 max-[768px]:py-[0.65rem] max-[768px]:px-3 max-[768px]:gap-[0.65rem] max-[768px]:border-r-0 max-[768px]:border-b max-[768px]:rounded-none',
				'after:pointer-events-none after:absolute after:inset-0 after:rounded-r-[80px] after:bg-[linear-gradient(120deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0)_42%)] max-[768px]:after:hidden',
				collapsed && 'w-[88px] px-[0.6rem] max-[768px]:w-full max-[768px]:py-[0.65rem] max-[768px]:px-3',
				className,
			)}
			style={rootStyle}
		>
			<Box
				component="header"
				className={cn(
					'relative z-[1] py-1 px-1 flex items-center justify-between gap-2',
					collapsed && 'justify-center px-0',
				)}
			>
				<Box className={cn('flex min-w-0 items-center gap-2', collapsed && 'hidden')}>
					<Box
						component="span"
						className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white/16 text-white shadow-[0_8px_16px_rgba(17,24,39,0.22)]"
					>
						<MdOutlineSpa size={18} />
					</Box>

					<Box className="min-w-0">
						<Title order={2} className="m-0 truncate text-[1.06rem] font-bold text-white">
							{title}
						</Title>
						<Text span className="block truncate text-[0.69rem] uppercase tracking-[0.14em] text-white/75">
							Navegacao
						</Text>
					</Box>
				</Box>

				<Tooltip
					label={collapsed ? 'Expandir menu' : 'Recolher menu'}
					position="right"
					offset={14}
					disabled={isMobile}
				>
					<ActionIcon
						variant="transparent"
						className={cn(
							'flex h-9 w-9 items-center justify-center rounded-xl !border-0 !bg-transparent !text-white cursor-pointer hover:!bg-black/22 active:!bg-black/28 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40',
							!collapsed && !isMobile && 'mr-2',
						)}
						onClick={toggleCollapsed}
						aria-label={collapsed ? 'Expandir sidebar' : 'Retrair sidebar'}
					>
						{collapsed ? <MdOutlineMenuOpen size={22} /> : <MdOutlineMenu size={22} />}
					</ActionIcon>
				</Tooltip>
			</Box>

			<Box component="nav" className="relative z-[1] flex flex-col gap-1.5">
				{items.map((item) => {
					const itemKey = item.to ?? item.label
					const hasChildren = Array.isArray(item.children) && item.children.length > 0
					const childItems = item.children ?? []
					const itemActive = isParentItemActive(item)
					const submenuOpen = openSubmenu === itemKey
					const itemHref = item.to ?? childItems[0]?.to ?? DEFAULT_FALLBACK_ROUTE
					const ItemIcon = item.icon
					const tooltipLabel = item.description ? `${item.label} - ${item.description}` : item.label
					const enableTooltip = !isMobile && collapsed && !hasChildren
					const activeChildPath = hasChildren
						? childItems.reduce<string | null>((matchedPath, subItem) => {
							if (!isItemActive(subItem.to)) {
								return matchedPath
							}

							if (matchedPath === null || subItem.to.length > matchedPath.length) {
								return subItem.to
							}

							return matchedPath
						}, null)
						: null

					return (
						<Box
							key={itemKey}
							className="relative"
							onMouseEnter={() => {
								if (!isMobile && hasChildren) {
									openSubmenuNow(itemKey)
								}
							}}
							onMouseLeave={() => {
								if (!isMobile && hasChildren) {
									closeSubmenuSoon()
								}
							}}
							onBlurCapture={(event) => {
								if (isMobile || !hasChildren) {
									return
								}

								const nextFocusedElement = event.relatedTarget as Node | null
								if (nextFocusedElement && event.currentTarget.contains(nextFocusedElement)) {
									return
								}

								closeSubmenuSoon()
							}}
						>
							<Tooltip
								label={tooltipLabel}
								position="right"
								offset={14}
								openDelay={100}
								disabled={!enableTooltip}
								withinPortal
							>
								<Box
									component={Link}
									to={itemHref}
									aria-label={item.label}
									onClick={(event) => {
										if (!hasChildren) {
											setOpenSubmenu(null)
											return
										}

										event.preventDefault()
										setOpenSubmenu((currentValue) => (currentValue === itemKey ? null : itemKey))
									}}
									onFocus={() => {
										if (!isMobile && hasChildren) {
											openSubmenuNow(itemKey)
										}
									}}
									className={cn(
										'group/item relative flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2.5 no-underline transition-all duration-150',
										'text-white/90 hover:text-white',
										'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40',
										collapsed && 'justify-center px-1.5',
										itemActive && 'text-white',
									)}
								>
									<Box
										component="span"
										className={cn(
											'absolute left-[6px] top-[7px] bottom-[7px] w-[3px] rounded-full transition-colors duration-150',
											itemActive ? 'bg-white' : 'bg-transparent group-hover/item:bg-white/45',
										)}
									/>

									<Box
										component="span"
										className={cn(
											'flex h-9 w-9 shrink-0 items-center justify-center transition-colors duration-150',
											itemActive
												? 'text-white'
												: 'text-white/90 group-hover/item:text-white',
										)}
									>
										{ItemIcon ? <ItemIcon size={18} /> : <MdChevronRight size={17} />}
									</Box>

									<Box className={cn('min-w-0 flex-1', collapsed && 'hidden')}>
										<Text span className="block truncate text-[0.94rem] font-semibold leading-tight text-white">
											{item.label}
										</Text>
										{item.description ? (
											<Text span className="block truncate text-[0.73rem] text-white/75 leading-tight mt-[2px]">
												{item.description}
											</Text>
										) : null}
									</Box>

									{hasChildren && !collapsed ? (
										<Box component="span" className="ml-auto flex items-center gap-1.5">
											<Text
												span
												className="rounded-full border border-white/28 bg-white/10 px-1.5 py-[2px] text-[0.64rem] font-semibold text-white/90"
											>
												{childItems.length}
											</Text>

											<MdChevronRight
												size={18}
												className={cn(
													'shrink-0 text-white/90 transition-transform duration-150',
													submenuOpen && 'rotate-90',
												)}
											/>
										</Box>
									) : null}
								</Box>
							</Tooltip>

							{hasChildren && !isMobile && submenuOpen ? (
								<Box
									className="absolute left-[calc(100%+16px)] top-[-4px] z-40 w-[280px] rounded-2xl border border-[hsl(var(--border))] bg-white p-2.5 shadow-[0_18px_40px_rgba(15,23,42,0.22)]"
									onMouseEnter={() => openSubmenuNow(itemKey)}
									onMouseLeave={closeSubmenuSoon}
								>
									<Box className="absolute -left-[22px] top-0 h-full w-6 bg-transparent" />

									<Box className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5">
										<Text size="xs" fw={800} c="dimmed" tt="uppercase" className="tracking-[0.08em]">
											{item.label}
										</Text>
										{item.description ? (
											<Text size="xs" className="mt-1 text-[hsl(var(--muted-foreground))]">
												{item.description}
											</Text>
										) : null}
									</Box>

										<Box className="mt-2 flex flex-col gap-1">
											{childItems.map((subItem) => {
												const subItemActive = activeChildPath === subItem.to
												const SubItemIcon = subItem.icon
												return (
												<Box
													key={subItem.to}
													component={Link}
													to={subItem.to}
													className={cn(
														'group/sub flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-[0.92rem] font-semibold no-underline transition-colors duration-150',
														'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
														subItemActive && 'bg-[color-mix(in_srgb,var(--sidebar-accent)_16%,white)] text-[var(--sidebar-accent)]',
													)}
													onClick={() => setOpenSubmenu(null)}
												>
													<Box
														component="span"
														className={cn(
															'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150',
															subItemActive
																? 'border-[color-mix(in_srgb,var(--sidebar-accent)_34%,white)] bg-white text-[var(--sidebar-accent)]'
																: 'border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] group-hover/sub:border-[color-mix(in_srgb,var(--sidebar-accent)_26%,white)]',
														)}
													>
														{SubItemIcon ? <SubItemIcon size={15} /> : <MdChevronRight size={14} />}
													</Box>

													<Text span className="truncate">
														{subItem.label}
													</Text>

													<MdChevronRight
														size={16}
														className={cn(
															'ml-auto text-[hsl(var(--muted-foreground))] transition-transform duration-150 group-hover/sub:translate-x-[2px]',
															subItemActive && 'text-[var(--sidebar-accent)]',
														)}
													/>
												</Box>
											)
										})}
									</Box>
								</Box>
							) : null}

							{hasChildren && isMobile && submenuOpen ? (
								<Box className="mt-1 ml-2 rounded-xl border border-[hsl(var(--border))] bg-white p-2 shadow-sm">
									<Box className="flex flex-col gap-1">
										{childItems.map((subItem) => {
											const subItemActive = activeChildPath === subItem.to
											const SubItemIcon = subItem.icon
											return (
												<Box
													key={subItem.to}
													component={Link}
													to={subItem.to}
													onClick={() => setOpenSubmenu(null)}
													className={cn(
														'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.9rem] font-medium no-underline transition-colors duration-150',
														'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]',
														subItemActive && 'bg-[color-mix(in_srgb,var(--sidebar-accent)_18%,white)] text-[var(--sidebar-accent)]',
													)}
												>
													<Box
														component="span"
														className="flex h-6 w-6 items-center justify-center rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
													>
														{SubItemIcon ? <SubItemIcon size={14} /> : <MdChevronRight size={14} />}
													</Box>
													{subItem.label}
												</Box>
											)
										})}
									</Box>
								</Box>
							) : null}
						</Box>
					)
				})}
			</Box>

			{footer ? (
				<Box
					component="footer"
					className={cn(
						'relative z-[1] mt-auto p-2 transition-[opacity,max-height,padding] duration-150',
						collapsed && 'opacity-0 max-h-0 overflow-hidden p-0 pointer-events-none',
					)}
				>
					{footer}
				</Box>
			) : null}
		</Box>
	)
}
