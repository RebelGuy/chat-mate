import { SxProps, styled } from '@mui/material'

const Container = styled('div')(data => ({
  ':hover': {
    opacity: 0.8
  },
  cursor: 'pointer'
}))

type Props = {
  children: React.ReactElement,
  onClick: (e: React.MouseEvent<HTMLDivElement>) => any,
} & SxProps

export default function Clickable (props: Props) {
  const { children, onClick, ...sxProps } = props

  return (
    <Container onClick={props.onClick} sx={sxProps}>
      {props.children}
    </Container>
  )
}
