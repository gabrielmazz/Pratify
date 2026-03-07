import type { FC, ReactNode } from 'react'

type ShinyTextProps = {
	text: ReactNode
	href?: string
	target?: string
	rel?: string
	disabled?: boolean
	speed?: number
	className?: string
	color?: string
	shineColor?: string
	spread?: number
	yoyo?: boolean
	pauseOnHover?: boolean
	direction?: 'left' | 'right'
	delay?: number
}

declare const ShinyText: FC<ShinyTextProps>

export default ShinyText
