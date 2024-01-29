import { styled } from '@mui/material'

const Header = styled('h3')({})

export default function PanelHeader (props: { children: React.ReactNode }) {
  return (
    <Header sx={{ mb: 1 }}>
      {props.children}
    </Header>
  )
}
