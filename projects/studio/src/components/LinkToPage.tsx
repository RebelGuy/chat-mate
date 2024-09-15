import { LinkProps } from '@mui/material'
import { Page } from '@rebel/studio/pages/navigation'
import { PathParam } from '@rebel/studio/utility/types'
import { Link as MuiLink } from '@mui/material'
import { Link as RouterLink, generatePath } from 'react-router-dom'

export type PageProps<P extends Page> = {
  page: P

  hideTextDecoration?: boolean
  label?: string

  // if true, the link will refresh the page
  external?: boolean

  // extend the supported LinkProps as needed
} & Pick<LinkProps, 'style' | 'children'> & {

  // path params are dynamically calculated and required as separate props to the component
  //   :    -------      ))
  [key in PathParam<P['path']>]: string | null
}

export default function LinkToPage<P extends Page> (props: PageProps<P>) {
  let { page, children, style = {}, external, label, ...params } = props
  const path = generatePath(page.path, params)

  if (props.hideTextDecoration) {
    style = {
      ...style,
      textDecoration: 'none',
      color: 'inherit'
    }
  }

  if (external) {
    return (
      <MuiLink href={path} style={style}>{children ?? label}</MuiLink>
    )
  } else {
    return (
      <MuiLink style={style} component={RouterLink} to={path}>{children ?? label}</MuiLink>
    )
  }
}
