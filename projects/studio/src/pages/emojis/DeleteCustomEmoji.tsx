import { Delete } from '@mui/icons-material'
import { IconButton } from '@mui/material'
import useRequest, { onConfirmRequest } from '@rebel/studio/hooks/useRequest'
import { deleteCustomEmoji } from '@rebel/studio/utility/api'

type Props = {
  id: number
  name: string
  isLoading: boolean
  onDeleted: () => void
}

export default function DeleteCustomEmoji (props: Props) {
  const deleteRequest = useRequest(deleteCustomEmoji(props.id), {
    onDemand: true,
    onRequest: () => onConfirmRequest(`Are you sure you want to delete emoji "${props.name}"?`),
    onError: (error) => window.alert(`Failed to delete emoji: ${error.message}`),
    onSuccess: props.onDeleted
  })

  return (
    <>
      <IconButton disabled={props.isLoading || deleteRequest.isLoading} onClick={deleteRequest.triggerRequest}>
        <Delete />
      </IconButton>
    </>
  )
}
