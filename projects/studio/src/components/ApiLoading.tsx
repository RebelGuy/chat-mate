import { Box, CircularProgress } from '@mui/material'

export default function ApiLoading ({ isLoading }: { isLoading: boolean }) {
  if (!isLoading) {
    return null
  }

  return (
    <Box sx={{ m: 1, display: 'flex', alignItems: 'center' }}>
      <CircularProgress size="1rem" />
      <Box sx={{ display: 'inline', pl: 1 }}>Loading...</Box>
    </Box>
  )
}
