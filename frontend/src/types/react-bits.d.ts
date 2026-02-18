declare module '@/components/react-bits/FloatingLines' {
	import type { FC } from 'react'

	type WavePosition = {
		x?: number
		y?: number
		rotate?: number
	}

	type FloatingLinesProps = {
		linesGradient?: string[]
		enabledWaves?: Array<'top' | 'middle' | 'bottom'>
		lineCount?: number | number[]
		lineDistance?: number | number[]
		topWavePosition?: WavePosition
		middleWavePosition?: WavePosition
		bottomWavePosition?: WavePosition
		animationSpeed?: number
		interactive?: boolean
		bendRadius?: number
		bendStrength?: number
		mouseDamping?: number
		parallax?: boolean
		parallaxStrength?: number
		mixBlendMode?: string
	}

	const FloatingLines: FC<FloatingLinesProps>
	export default FloatingLines
}
