import { Box, CircularProgress, SxProps } from '@mui/material'

export default function CentredLoadingSpinner (props: { sx?: SxProps }) {
  return <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', ...props.sx }}>
    <CircularProgress />
  </Box>
}
