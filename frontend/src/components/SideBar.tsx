import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'
import styles from './SideBar.module.css'

type SideBarItem = {
  label: string
  to: string
}

type SideBarProps = {
  title?: string
  items: SideBarItem[]
  footer?: ReactNode
  className?: string
}

export function SideBar({ title = 'Menu', items, footer, className }: SideBarProps) {
  return (
    <aside className={cn(styles.root, className)}>
      <header className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
      </header>

      <nav className={styles.nav}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(styles.link, isActive && styles.linkActive)
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {footer ? <footer className={styles.footer}>{footer}</footer> : null}
    </aside>
  )
}
