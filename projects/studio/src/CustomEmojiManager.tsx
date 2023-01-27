import React from 'react'
import { PublicCustomEmoji, PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { addCustomEmoji, getAccessibleRanks, getAllCustomEmojis, updateCustomEmoji } from '@rebel/studio/api'
import { isNullOrEmpty } from '@rebel/server/util/strings'
import RanksSelector from '@rebel/studio/RanksSelector'
import { PublicRank } from '@rebel/server/controllers/public/rank/PublicRank'
import ApiRequest from '@rebel/studio/ApiRequest'
import ApiRequestTrigger from '@rebel/studio/ApiRequestTrigger'
import ReactDOM from 'react-dom'
import { sortBy } from '@rebel/server/util/arrays'
import RequireRank from '@rebel/studio/components/RequireRank'

// this code is yuckyu and needs cleaning up, but it works!

type EmojiData = Omit<PublicCustomEmoji, 'isActive' | 'version'>

type Props = {}

type State = {
  emojis: PublicCustomEmoji[]
  accessibleRanks: PublicRank[]
  editingEmoji: EmojiData | null
  newEmoji: PublicCustomEmojiNew
}

export default class CustomEmojiManager extends React.PureComponent<Props, State> {
  private loadingRef = React.createRef<HTMLDivElement>()
  private errorRef = React.createRef<HTMLDivElement>()

  constructor (props: Props) {
    super(props)

    this.state = {
      emojis: [],
      accessibleRanks: [],
      editingEmoji: null,
      newEmoji: {
        schema: 1,
        name: '',
        symbol: '',
        levelRequirement: 0,
        canUseInDonationMessage: true,
        imageData: '',
        whitelistedRanks: []
      }
    }
  }

  onEdit = (e: React.MouseEvent<HTMLElement>) => {
    const id = Number(e.currentTarget.dataset.id)!
    const editingEmoji = this.state.emojis.find(emoji => emoji.id === id)!
    this.setState({ editingEmoji })
  }

  onCancelEdit = (e: React.MouseEvent<HTMLElement>) => {
    this.setState({ editingEmoji: null })
  }

  onUpdate = async (loginToken: string, streamer: string) => {
    const result = await updateCustomEmoji(this.state.editingEmoji!, loginToken, streamer)
    if (result.success) {
      const updatedEmoji = result.data.updatedEmoji
      this.setState({
        editingEmoji: null,
        emojis: this.state.emojis.map(emoji => emoji.id === updatedEmoji.id ? updatedEmoji : emoji)
      })
    }
    return result
  }

  onChange = (updatedData: EmojiData) => {
    if (this.state.editingEmoji?.id === updatedData.id) {
      this.setState({ editingEmoji: updatedData })
    } else {
      this.setState({ newEmoji: updatedData })
    }
  }

  onAdd = async (loginToken: string, streamer: string) => {
    const result = await addCustomEmoji(this.state.newEmoji, loginToken, streamer)
    if (result.success) {
      this.setState({
        newEmoji: {
          schema: 1,
          name: '',
          symbol: '',
          levelRequirement: 0,
          canUseInDonationMessage: true,
          imageData: '',
          whitelistedRanks: []
        },
        emojis: [...this.state.emojis, result.data.newEmoji]
      })
    }
    return result
  }

  getAccessibleRanks = async (loginToken: string, streamer: string) => {
    const accessibleRanks = await getAccessibleRanks(loginToken, streamer)
    if (accessibleRanks.success) {
      this.setState({
        accessibleRanks: accessibleRanks.data.accessibleRanks
      })
    }
    return accessibleRanks
  }

  getEmojis = async (loginToken: string, streamer: string) => {
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
        <div ref={this.loadingRef} />
        <div ref={this.errorRef} />
        <ApiRequest onDemand token={1} requiresStreamer onRequest={this.getEmojis}>
          {(response, loadingNode, errorNode) => <>
            {response && <ApiRequest onDemand token={1} requiresStreamer onRequest={this.getAccessibleRanks}>
              <table style={{ width: '90%', padding: '5%' }}>
                <thead>
                  <tr>
                    <td>Name</td>
                    <td>Symbol</td>
                    <td>Level Req.</td>
                    <td><span title="Emoji can be used in donation messages">$</span></td>
                    <td><span title="If there is no selection, all ranks will be able to use the emoji">Rank Whitelist</span></td>
                    <td>Image</td>
                    <RequireRank owner><td>Action</td></RequireRank>
                  </tr>
                </thead>

                <ApiRequestTrigger requiresStreamer onRequest={this.onUpdate}>
                  {(onDoUpdate, responseForUpdate, loadingNodeForUpdate, errorNodeForUpdate) => <>
                    <tbody>
                      {this.state.emojis.map(emoji => {
                        const isEditing = this.state.editingEmoji?.id === emoji.id
                        const actionCell = <>
                          {!isEditing && <button data-id={emoji.id} onClick={this.onEdit}>Edit</button>}
                          {isEditing && <button onClick={onDoUpdate}>Submit</button>}
                          {isEditing && <button onClick={this.onCancelEdit}>Cancel</button>}
                        </>
                        return (
                          <CustomEmojiRow
                            key={emoji.symbol}
                            data={isEditing ? this.state.editingEmoji! : emoji}
                            actionCell={actionCell}
                            accessibleRanks={this.state.accessibleRanks}
                            isNew={false}
                            onChange={isEditing ? this.onChange : null}
                          />
                        )
                      })}

                      <RequireRank owner>
                        <ApiRequestTrigger requiresStreamer onRequest={this.onAdd}>
                          {(onDoAdd, response, loadingNodeForAdd, errorNodeForAdd) => <>
                            <CustomEmojiRow
                              data={{ id: -1, ...this.state.newEmoji }}
                              actionCell={<button onClick={onDoAdd}>Add</button>}
                              accessibleRanks={this.state.accessibleRanks}
                              isNew={true}
                              onChange={this.onChange}
                            />
                            {ReactDOM.createPortal(loadingNodeForAdd, this.loadingRef.current!)}
                            {ReactDOM.createPortal(errorNodeForAdd, this.errorRef.current!)}
                          </>}
                        </ApiRequestTrigger>
                      </RequireRank>
                    </tbody>
                    {ReactDOM.createPortal(loadingNodeForUpdate, this.loadingRef.current!)}
                    {ReactDOM.createPortal(errorNodeForUpdate, this.errorRef.current!)}
                  </>}
                </ApiRequestTrigger>
              </table>
            </ApiRequest>}
            {loadingNode}
            {errorNode}
          </>}
        </ApiRequest>
      </>
    )
  }
}

function CustomEmojiRow (props: { data: EmojiData, actionCell: React.ReactNode, accessibleRanks: PublicRank[], isNew: boolean, onChange: ((updatedData: EmojiData) => void) | null }) {
  const onChangeName = (e: React.ChangeEvent<HTMLInputElement>) => props.onChange!({ ...props.data, name: e.currentTarget.value })
  const onChangeSymbol = (e: React.ChangeEvent<HTMLInputElement>) => props.onChange!({ ...props.data, symbol: e.currentTarget.value })
  const onChangeLevelReq = (e: React.ChangeEvent<HTMLInputElement>) => props.onChange!({ ...props.data, levelRequirement: Number(e.currentTarget.value) })
  const onChangeCanUseInDonationMessage = (e: React.ChangeEvent<HTMLInputElement>) => props.onChange!({ ...props.data, canUseInDonationMessage: e.currentTarget.checked })
  const onChangeImageData = (imageData: string | null) => props.onChange!({ ...props.data, imageData: imageData ?? '' })
  const onChangeWhitelistedRanks = (newRanks: number[]) => props.onChange!({ ...props.data, whitelistedRanks: newRanks })
  
  const disabled = props.onChange == null
  return (
    <tr>
    <td><input type="text" disabled={disabled} value={props.data.name} onChange={onChangeName} /></td>
    <td><input type="text" disabled={!props.isNew} value={props.data.symbol} onChange={onChangeSymbol} /></td>
    <td><input type="number" disabled={disabled} value={props.data.levelRequirement} onChange={onChangeLevelReq} /></td>
    <td><input type="checkbox" disabled={disabled} checked={props.data.canUseInDonationMessage} onChange={onChangeCanUseInDonationMessage} /></td>
    <td><RanksSelector disabled={disabled} ranks={props.data.whitelistedRanks} accessibleRanks={props.accessibleRanks} onChange={onChangeWhitelistedRanks} /></td>
    <td><RenderedImage disabled={disabled} imageData={props.data.imageData} onSetImage={onChangeImageData} /></td>
    <RequireRank owner ><td>{props.actionCell}</td></RequireRank>
  </tr>
  )
}

function RenderedImage (props: { imageData: string, disabled: boolean, onSetImage: (imageData: string | null) => void }) {
  if (isNullOrEmpty(props.imageData)) {
    const onSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files
      if (files == null || files.length === 0) {
        props.onSetImage(null)
      } else {
        // https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL
        // reads as base64 encoding, including the data: tag
        const fr = new FileReader();
        fr.onload = () => {
          const data = fr.result as string
          const tag = 'data:image/png;base64,'
          props.onSetImage(data.substring(tag.length))
        }
        fr.onerror = () => { throw new Error() }
        fr.readAsDataURL(files[0])
      }
    }
    return <input type="file" accept="image/png" disabled={props.disabled} onChange={onSelect} />
  } else {
    const onClear = () => props.onSetImage(null)

    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <img src={`data:image/png;base64,${props.imageData}`} style={{ maxHeight: 32 }} alt="" />
        {!props.disabled && <div style={{ paddingLeft: 4, cursor: 'pointer' }} onClick={onClear}>x</div>}
      </div>
    )
  }
}
