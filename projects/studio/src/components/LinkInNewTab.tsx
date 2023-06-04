import { Link, SxProps } from '@mui/material'
import { ReactNode } from 'react'

type Props = {
  href: string
  children: ReactNode
  hideTextDecoration?: boolean
  sx?: SxProps
}

export default function LinkInNewTab (props: Props) {
  return (
    <Link
      style={{
        textDecoration: props.hideTextDecoration ? 'none' : undefined,
        color: props.hideTextDecoration ? 'inherit' : undefined
      }}
      sx={props.sx}
      href={props.href}
      target="_blank"
      rel="noreferrer noopener"
    >
      {props.children}
    </Link>
  )
}
