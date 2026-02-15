import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText as GSAPSplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP)

type SplitType = 'chars' | 'words' | 'lines' | 'chars,words' | 'words,lines' | 'chars,words,lines'

type AnimationVars = {
  opacity?: number
  x?: number
  y?: number
  scale?: number
  rotate?: number
}

type SplitResult = {
  chars?: Element[]
  words?: Element[]
  lines?: Element[]
  revert: () => void
}

type SplitTextProps = {
  text: string
  className?: string
  delay?: number
  duration?: number
  ease?: string
  splitType?: SplitType | string
  from?: AnimationVars
  to?: AnimationVars
  threshold?: number
  rootMargin?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  tag?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3'
  onLetterAnimationComplete?: () => void
  showCallback?: boolean
}

export default function SplitText({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  tag = 'p',
  onLetterAnimationComplete,
  showCallback = false,
}: SplitTextProps) {
  const ref = useRef<HTMLElement | null>(null)
  const splitRef = useRef<SplitResult | null>(null)
  const animationCompletedRef = useRef(false)
  const onCompleteRef = useRef(onLetterAnimationComplete)

  useEffect(() => {
    onCompleteRef.current = onLetterAnimationComplete
  }, [onLetterAnimationComplete])

  useGSAP(
    () => {
      if (!ref.current || !text) return
      if (animationCompletedRef.current) return

      const el = ref.current
      let splitInstance: SplitResult | null = null
      let isDisposed = false

      const runAnimation = () => {
        if (isDisposed || !el) return

        if (splitRef.current) {
          try {
            splitRef.current.revert()
          } catch {
            // noop
          }
          splitRef.current = null
        }

        const startPct = (1 - threshold) * 100
        const marginMatch = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin)
        const marginValue = marginMatch ? parseFloat(marginMatch[1]) : 0
        const marginUnit = marginMatch ? marginMatch[2] || 'px' : 'px'
        const sign =
          marginValue === 0
            ? ''
            : marginValue < 0
            ? `-=${Math.abs(marginValue)}${marginUnit}`
            : `+=${marginValue}${marginUnit}`

        const start = `top ${startPct}%${sign}`
        let targets: Element[] = []

        const assignTargets = (self: SplitResult) => {
          if (splitType.includes('chars') && self.chars?.length) targets = self.chars
          if (!targets.length && splitType.includes('words') && self.words?.length) targets = self.words
          if (!targets.length && splitType.includes('lines') && self.lines?.length) targets = self.lines
          if (!targets.length) targets = self.chars || self.words || self.lines || []
        }

        splitInstance = new GSAPSplitText(el, {
          type: splitType,
          smartWrap: true,
          autoSplit: splitType === 'lines',
          linesClass: 'split-line',
          wordsClass: 'split-word',
          charsClass: 'split-char',
          reduceWhiteSpace: false,
          onSplit: (self: SplitResult) => {
            assignTargets(self)

            return gsap.fromTo(
              targets,
              { ...from },
              {
                ...to,
                duration,
                ease,
                stagger: delay / 1000,
                scrollTrigger: {
                  trigger: el,
                  start,
                  once: true,
                  fastScrollEnd: true,
                  anticipatePin: 0.4,
                },
                onComplete: () => {
                  animationCompletedRef.current = true
                  if (showCallback) {
                    onCompleteRef.current?.()
                  }
                },
                willChange: 'transform, opacity',
                force3D: true,
              }
            )
          },
        }) as unknown as SplitResult

        splitRef.current = splitInstance
      }

      if (document.fonts.status === 'loaded') {
        runAnimation()
      } else {
        void document.fonts.ready.then(() => {
          runAnimation()
        })
      }

      return () => {
        isDisposed = true

        ScrollTrigger.getAll().forEach((trigger) => {
          if (trigger.trigger === el) trigger.kill()
        })

        if (splitRef.current) {
          try {
            splitRef.current.revert()
          } catch {
            // noop
          }
        }
        splitRef.current = null
      }
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        showCallback,
      ],
      scope: ref,
    }
  )

  const style: CSSProperties = {
    textAlign,
    overflow: 'hidden',
    display: 'inline-block',
    whiteSpace: 'normal',
    wordWrap: 'break-word',
    willChange: 'transform, opacity',
  }

  const classes = `split-parent ${className}`.trim()
  if (tag === 'span') {
    return (
      <span ref={ref as unknown as RefObject<HTMLSpanElement>} style={style} className={classes}>
        {text}
      </span>
    )
  }

  if (tag === 'div') {
    return (
      <div ref={ref as unknown as RefObject<HTMLDivElement>} style={style} className={classes}>
        {text}
      </div>
    )
  }

  if (tag === 'h1') {
    return (
      <h1 ref={ref as unknown as RefObject<HTMLHeadingElement>} style={style} className={classes}>
        {text}
      </h1>
    )
  }

  if (tag === 'h2') {
    return (
      <h2 ref={ref as unknown as RefObject<HTMLHeadingElement>} style={style} className={classes}>
        {text}
      </h2>
    )
  }

  if (tag === 'h3') {
    return (
      <h3 ref={ref as unknown as RefObject<HTMLHeadingElement>} style={style} className={classes}>
        {text}
      </h3>
    )
  }

  return (
    <p ref={ref as unknown as RefObject<HTMLParagraphElement>} style={style} className={classes}>
      {text}
    </p>
  )
}
