import { Box, CircularProgress } from '@mui/material'

export default function CentredLoadingSpinner () {
  return <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
    <CircularProgress />
  </Box>
}
