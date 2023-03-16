import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, TextField } from '@mui/material'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { EmojiData } from '@rebel/studio/pages/emojis/CustomEmojiManager'
import RanksSelector from '@rebel/studio/pages/emojis/RanksSelector'
import { useState } from 'react'

type Props = {
  open: boolean
  data: EmojiData | null
  accessibleRanks: PublicRank[]
  error: React.ReactNode
  isLoading: boolean
  onSave: (data: EmojiData) => void
  onCancel: () => void
  onCheckDuplicateSymbol: (symbol: string) => boolean
}

const DEFAULT_DATA: EmojiData = {
  id: 0,
  name: 'New Emoji',
  symbol: 'emoji',
  canUseInDonationMessage: true,
  imageData: '',
  levelRequirement: 0,
  whitelistedRanks: []
}

export default function CustomEmojiEditor (props: Props) {
  const [editingData, setEditingData] = useState<EmojiData>(props.data ?? DEFAULT_DATA)
  const [symbolValidation, setSymbolValidation] = useState<string | null>(null)
  const [levelRequirementValidation, setLevelRequirementValidation] = useState<string | null>(null)

  const isValid = symbolValidation == null && levelRequirementValidation == null && !isNullOrEmpty(editingData.imageData)

  const setSymbol = (symbol: string) => {
    symbol = symbol.trim()
    setEditingData({ ...editingData, symbol })

    if (props.onCheckDuplicateSymbol(symbol)) {
      setSymbolValidation('Symbol already exists.')
    } else if (symbol.includes(':')) {
      setSymbolValidation(`Cannot include the character ':'.`)
    } else if (symbol.length < 1 || symbol.length > 32) {
      setSymbolValidation('Must be between 1 and 32 characters.')
    }
  }

  const setLevelRequirement = (levelRequirement: string) => {
    const num = Number(levelRequirement)
    setEditingData({ ...editingData, levelRequirement: num })

    if (num < 0 || num > 100) {
      setLevelRequirementValidation('Must be between 0 and 100')
    } else if (!Number.isInteger(num)) {
      setLevelRequirementValidation('Must be a whole number.')
    }
  }

  const onSelectImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files == null || files.length === 0) {
      return
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL
    // reads as base64 encoding, including the `data:` prefix
    const fr = new FileReader();
    fr.onload = () => {
      const data = fr.result as string
      const prefix = 'data:image/png;base64,'
      const imageData = data.substring(prefix.length)
      setEditingData({ ...editingData, imageData })
    }
    fr.onerror = () => { throw new Error() }
    fr.readAsDataURL(files[0])
  }

  return (
    <Dialog open={props.open} fullWidth sx={{ typography: 'body1' }}>
      <DialogTitle>Edit Emoji</DialogTitle>
      <DialogContent>
        <Box>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <TextField
              label="Name"
              value={editingData.name}
              disabled={props.isLoading}
              onChange={e => setEditingData({ ...editingData, name: e.target.value })}
            />
            <TextField
              label="Symbol"
              value={editingData.symbol}
              disabled={props.isLoading}
              onChange={e => setSymbol(e.target.value)}
              error={symbolValidation != null}
              helperText={symbolValidation}
              sx={{ mt: 3 }}
            />
            <TextField
              label="Level Requirement"
              inputMode="numeric"
              value={editingData.levelRequirement}
              disabled={props.isLoading}
              onChange={e => setLevelRequirement(e.target.value)}
              error={levelRequirementValidation != null}
              helperText={levelRequirementValidation}
              sx={{ mt: 3 }}
            />
            <FormControlLabel
              label="Allow in donation messages"
              sx={{ mt: 2 }}
              control={
                <Checkbox
                  checked={editingData.canUseInDonationMessage}
                  disabled={props.isLoading}
                  onChange={e => setEditingData({ ...editingData, canUseInDonationMessage: e.target.checked })}
                />
              }
            />
            <FormControl>
              Whitelist ranks
              <RanksSelector
                disabled={props.isLoading}
                accessibleRanks={props.accessibleRanks}
                ranks={editingData.whitelistedRanks}
                onChange={ranks => setEditingData({ ...editingData, whitelistedRanks: ranks })}
              />
            </FormControl>
            <FormControl>
              Image
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {!isNullOrEmpty(editingData.imageData) && <img src={`data:image/png;base64,${editingData.imageData}`} style={{ maxHeight: 32 }} alt="" />}
              </div>
              <Button disabled={props.isLoading} component="label">
                <input type="file" hidden accept="image/png" disabled={props.isLoading} onChange={onSelectImage} />
                Select image
              </Button>
            </FormControl>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button disabled={!isValid || props.isLoading} onClick={() => props.onSave(editingData)}>
          {props.data == null ? 'Create emoji' : 'Update emoji'}
        </Button>
        <Button onClick={() => props.onCancel()}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
