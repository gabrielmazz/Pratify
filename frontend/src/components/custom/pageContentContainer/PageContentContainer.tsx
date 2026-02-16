import type { ReactNode } from 'react'
import { Box } from '@mantine/core'
import { cn } from '../../../lib/utils'

type PageContentContainerProps = {
	items?: ReactNode[]
	footer?: ReactNode
	children?: ReactNode
	className?: string
	contentClassName?: string
	itemClassName?: string
}

export function PageContentContainer({
	items,
	footer,
	children,
	className,
	contentClassName,
	itemClassName,
}: PageContentContainerProps) {
	const hasItems = Array.isArray(items) && items.length > 0

	return (
		<Box
			component="section"
			className={cn(
				'w-full h-full min-h-0 flex flex-col gap-3 p-4 border border-[hsl(var(--border))] rounded-[80px] bg-[hsl(var(--card))] shadow-[0_10px_26px_rgba(17,24,39,0.06)] max-[768px]:p-3 max-[768px]:rounded-[14px]',
				className,
			)}
		>
			<Box className={cn('flex-1 min-h-0 overflow-auto flex flex-col gap-3 p-6', contentClassName)}>
				{hasItems
					? items.map((item, index) => (
						<Box key={index} className={cn('shrink-0', itemClassName)}>
							{item}
						</Box>
					))
					: children}
			</Box>

			{footer ? (
				<Box component="footer" className="shrink-0 border-t border-[hsl(var(--border))] pt-3 p-6">
					{footer}
				</Box>
			) : null}
		</Box>
	)
}
