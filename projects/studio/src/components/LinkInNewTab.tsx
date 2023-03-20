import { ReactNode } from 'react'

type Props = {
  href: string
  children: ReactNode
}

export default function LinkInNewTab (props: Props) {
  return (
    <a
      href={props.href}
      target="_blank"
      rel="noreferrer noopener"
    >
      {props.children}
    </a>
  )
}
