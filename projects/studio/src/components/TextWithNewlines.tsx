import { SxProps } from '@mui/material'
import { Box } from '@mui/system'

type Props = {
  text: string
  component?: React.ElementType
  sx?: SxProps
}

export default function TextWithNewlines ({ text, component, sx }: Props) {
  return <>
    {text.split('\n').map((x, i) =>
      <Box component={component ?? 'div'} key={i} sx={{ mt: 1, ...sx }}>
        {x.length === 0 ? <>&nbsp;</> : x}
      </Box>
    )}
  </>
}
