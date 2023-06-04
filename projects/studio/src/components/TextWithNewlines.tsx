import { Box } from '@mui/system'

type Props = {
  text: string
  component?: React.ElementType
}

export default function TextWithNewlines ({ text, component }: Props) {
  return <>
    {text.split('\n').map((x, i) =>
      <Box component={component ?? 'div'} key={i} sx={{ mt: 1 }}>
        {x.length === 0 ? <>&nbsp;</> : x}
      </Box>
    )}
  </>
}
