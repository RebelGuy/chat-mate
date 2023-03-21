import { Box } from '@mui/system'

export default function TextWithNewlines ({ text }: { text: string }) {
  return <>
    {text.split('\n').map(x =>
      <Box sx={{ mt: 1 }}>
        {x.length === 0 ? <>&nbsp;</> : x}
      </Box>
    )}
  </>
}
