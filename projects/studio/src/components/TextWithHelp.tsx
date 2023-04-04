import { Box, Tooltip } from '@mui/material'

type Props = {
  text: string
  help: string
}

export default function TextWithHelp ({ text, help }: Props) {
  return (
    <Tooltip title={help}>
      <Box sx={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlinePosition: 'under', textUnderlineOffset: 1 }}>
        {text}
      </Box>
    </Tooltip>
  )
}
