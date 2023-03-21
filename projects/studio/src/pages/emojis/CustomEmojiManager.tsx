import React, { ReactNode } from 'react'
import { PublicCustomEmoji } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { addCustomEmoji, getAccessibleRanks, getAllCustomEmojis, updateCustomEmoji } from '@rebel/studio/utility/api'
import { isNullOrEmpty } from '@rebel/shared/util/strings'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import ApiRequest from '@rebel/studio/components/ApiRequest'
import { sortBy } from '@rebel/shared/util/arrays'
import RequireRank from '@rebel/studio/components/RequireRank'
import LoginContext from '@rebel/studio/contexts/LoginContext'
import { Box, Button, IconButton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material'
import TextWithHelp from '@rebel/studio/components/TextWithHelp'
import CustomEmojiEditor from '@rebel/studio/pages/emojis/CustomEmojiEditor'
import { ApiResponse } from '@rebel/server/controllers/ControllerBase'
import { GetCustomEmojisResponse } from '@rebel/server/controllers/EmojiController'
import RanksDisplay from '@rebel/studio/pages/emojis/RanksDisplay'
import { Close, ContentCopy, CopyAll, Done, Edit } from '@mui/icons-material'
import { EmptyObject } from '@rebel/shared/types'
import { waitUntil } from '@rebel/shared/util/typescript'
import CopyText from '@rebel/studio/components/CopyText'

export type EmojiData = Omit<PublicCustomEmoji, 'isActive' | 'version'>

type Props = EmptyObject

type State = {
  emojis: PublicCustomEmoji[]
  accessibleRanks: PublicRank[]
  editingEmoji: EmojiData | null
  editingError: ReactNode
  isLoadingEdit: boolean
  openEditor: boolean
}

export default class CustomEmojiManager extends React.PureComponent<Props, State> {
  static override contextType = LoginContext
  override context!: React.ContextType<typeof LoginContext>

  constructor (props: Props) {
    super(props)

    this.state = {
      emojis: [],
      accessibleRanks: [],
      editingEmoji: null,
      editingError: null,
      isLoadingEdit: false,
      openEditor: false
    }
  }

  override async componentDidMount () {
    await waitUntil(() => this.context.initialised && !this.context.isLoading, 100, 5000)
    const accessibleRanks = await getAccessibleRanks(this.context.loginToken!, this.context.streamer!)
    if (accessibleRanks.success) {
      this.setState({
        accessibleRanks: accessibleRanks.data.accessibleRanks
      })
    }
  }

  onEdit = (id: number | null) => {
    this.setState({
      editingEmoji: this.state.emojis.find(emoji => emoji.id === id) ?? null,
      openEditor: true
    })
  }

  onCancelEdit = () => {
    this.setState({
      openEditor: false,
      editingEmoji: null,
      editingError: null,
      isLoadingEdit: false
    })
  }

  onUpdate = async (loginToken: string, streamer: string, updatedData: EmojiData) => {
    const result = await updateCustomEmoji(updatedData, loginToken, streamer)
    if (result.success) {
      const updatedEmoji = result.data.updatedEmoji
      this.setState({
        editingEmoji: null,
        emojis: this.state.emojis.map(emoji => emoji.id === updatedEmoji.id ? updatedEmoji : emoji)
      })
    }
    return result
  }

  onAdd = async (loginToken: string, streamer: string, data: EmojiData) => {
    const result = await addCustomEmoji(data, loginToken, streamer)
    if (result.success) {
      this.setState({
        emojis: [...this.state.emojis, result.data.newEmoji]
      })
    }
    return result
  }

  onSave = async (data: EmojiData) => {
    this.setState({
      isLoadingEdit: true,
      editingError: null
    })

    let response: ApiResponse<any>
    try {
      if (this.state.editingEmoji?.id === data.id) {
        response = await this.onUpdate(this.context.loginToken!, this.context.streamer!, data)
      } else {
        response = await this.onAdd(this.context.loginToken!, this.context.streamer!, data)
      }
    } catch (e: any) {
      response = {
        success: false,
        timestamp: Date.now(),
        error: {
          errorCode: 500,
          errorType: 'Unknown',
          message: e.message
        }
      }
    }

    this.setState({
      isLoadingEdit: false,
      editingError: response.success ? null : response.error.message
    })

    if (response.success) {
      this.setState({
        openEditor: false,
        editingEmoji: null
      })
    }
  }

  onCheckDupliateSymbol = (symbol: string) => {
    return this.state.emojis.find(emoji => {
      return emoji.id !== this.state.editingEmoji?.id && emoji.symbol === symbol
    }) != null
  }

  getEmojis = async (loginToken: string, streamer: string): Promise<GetCustomEmojisResponse> => {
    const emojis = await getAllCustomEmojis(loginToken, streamer)
    if (emojis.success) {
      this.setState({
        emojis: sortBy(emojis.data.emojis, e => e.id),
      })
    }
    return emojis
  }

  override render (): React.ReactNode {
    return (
      <>
        <ApiRequest onDemand token={this.context.streamer} requiresStreamer onRequest={this.getEmojis}>
          {(data, loadingNode, errorNode) => <>
            {data != null &&
              <Box>
                <RequireRank owner>
                  <Button
                    onClick={() => this.onEdit(null)}
                    sx={{ mb: 1 }}
                  >
                    Create new emoji
                  </Button>
                </RequireRank>

                <Table
                  stickyHeader
                  sx={{ width: '100%', transform: 'translateY(-5px)' }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Symbol</TableCell>
                      <TableCell>Level Req.</TableCell>
                      <TableCell><TextWithHelp text="$" help="Emoji can be used in donation messages" /></TableCell>
                      <TableCell><TextWithHelp text="Rank Whitelist" help="If there is no selection, all ranks will be able to use the emoji" /></TableCell>
                      <TableCell>Image</TableCell>
                      <RequireRank owner><TableCell>Action</TableCell></RequireRank>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {this.state.emojis.map(emoji =>
                      <CustomEmojiRow
                        key={emoji.id}
                        data={emoji}
                        accessibleRanks={this.state.accessibleRanks}
                        onEdit={() => this.onEdit(emoji.id)}
                      />)
                    }
                  </TableBody>
                </Table>
              </Box>
            }
            {loadingNode}
            {errorNode}
          </>}
        </ApiRequest>

        <CustomEmojiEditor
          open={this.state.openEditor}
          accessibleRanks={this.state.accessibleRanks}
          data={this.state.editingEmoji}
          error={this.state.editingError}
          isLoading={this.state.isLoadingEdit}
          onCancel={this.onCancelEdit}
          onSave={this.onSave}
          onCheckDuplicateSymbol={this.onCheckDupliateSymbol}
        />
      </>
    )
  }
}

function CustomEmojiRow (props: { data: EmojiData, accessibleRanks: PublicRank[], onEdit: (id: number) => void }) {
  const symbol = `:${props.data.symbol}:`

  return (
    <tr>
      <TableCell>{props.data.name}</TableCell>
      <TableCell>
        {symbol}
        <CopyText text={symbol} tooltip="Copy symbol to clipboard" sx={{ ml: 1 }} />
      </TableCell>
      <TableCell>{props.data.levelRequirement}</TableCell>
      <TableCell>{props.data.canUseInDonationMessage ? <Done /> : <Close />}</TableCell>
      <TableCell><RanksDisplay ranks={props.data.whitelistedRanks} accessibleRanks={props.accessibleRanks} /></TableCell>
      <TableCell>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {!isNullOrEmpty(props.data.imageData) && <img src={`data:image/png;base64,${props.data.imageData}`} style={{ maxHeight: 32 }} alt="" />}
        </div>
      </TableCell>
      <RequireRank owner>
        <TableCell>
          <IconButton onClick={() => props.onEdit(props.data.id)}>
            <Edit />
          </IconButton>
        </TableCell>
      </RequireRank>
    </tr>
  )
}
