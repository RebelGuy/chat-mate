import React from 'react'
import { PublicCustomEmoji, PublicCustomEmojiNew } from '@rebel/server/controllers/public/emoji/PublicCustomEmoji'
import { addCustomEmoji, getAllCustomEmojis, updateCustomEmoji } from '@rebel/studio/api'
import { isNullOrEmpty } from '@rebel/server/util/strings'

type Props = {}

type State = {
  loading: boolean
  emojis: PublicCustomEmoji[]
  editingEmoji: PublicCustomEmoji | null // todo: make custom emoji type to simplify thigns, e.g. nullify the image data
  newEmoji: PublicCustomEmojiNew
}

export default class CustomEmojiManager extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props)

    this.state = {
      loading: true,
      emojis: [],
      editingEmoji: null,
      newEmoji: {
        schema: 1,
        name: '',
        symbol: '',
        levelRequirement: 0,
        imageData: ''
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

  onUpdate = async (e: React.MouseEvent<HTMLElement>) => {
    const result = await updateCustomEmoji(this.state.editingEmoji!)
    if (result.success) {
      const updatedEmoji = result.data.updatedEmoji
      this.setState({
        editingEmoji: null,
        emojis: this.state.emojis.map(emoji => emoji.id === updatedEmoji.id ? updatedEmoji : emoji)
      })
    } else {
      console.error(result.error)
    }
  }

  onChange = (updatedData: PublicCustomEmoji) => {
    if (this.state.editingEmoji?.id === updatedData.id) {
      this.setState({ editingEmoji: updatedData })
    } else {
      this.setState({ newEmoji: updatedData })
    }
  }

  onAdd = async () => {
    const result = await addCustomEmoji(this.state.newEmoji)
    if (result.success) {
      this.setState({
        newEmoji: {
          schema: 1,
          name: '',
          symbol: '',
          levelRequirement: 0,
          imageData: ''
        },
        emojis: [...this.state.emojis, result.data.newEmoji]
      })
    } else {
      console.error(result.error)
    }
  }

  override async componentDidMount () {
    const emojis = await getAllCustomEmojis()
    if (emojis.success) {
      this.setState({
        emojis: emojis.data.emojis,
        loading: false
      })
    }
  }

  override render (): React.ReactNode {
    if (this.state.loading) {
      return <>Loading...</>
    }

    return (
      <table style={{ width: '90%', padding: '5%' }}>
        <thead>
          <tr>
            <td>Name</td>
            <td>Symbol</td>
            <td>Level Req.</td>
            <td>Image</td>
            <td>Action</td>
          </tr>
        </thead>

        <tbody>
          {this.state.emojis.map(emoji => {
            const isEditing = this.state.editingEmoji?.id === emoji.id
            const actionCell = <>
              {!isEditing && <button data-id={emoji.id} onClick={this.onEdit}>Edit</button>}
              {isEditing && <button onClick={this.onUpdate}>Submit</button>}
              {isEditing && <button onClick={this.onCancelEdit}>Cancel</button>}
            </>
            return <CustomEmojiRow data={isEditing ? this.state.editingEmoji! : emoji} actionCell={actionCell} onChange={isEditing ? this.onChange : null} />
          })}

          <CustomEmojiRow data={{ id: -1, ...this.state.newEmoji }} actionCell={<button onClick={this.onAdd}>Add</button>} onChange={this.onChange} />
        </tbody>
      </table>
    )
  }
}

function CustomEmojiRow (props: { data: PublicCustomEmoji, actionCell: React.ReactNode, onChange: ((updatedData: PublicCustomEmoji) => void) | null }) {
  const onChangeName = (e: React.ChangeEvent<HTMLInputElement>) => props.onChange!({ ...props.data, name: e.currentTarget.value })
  const onChangeSymbol = (e: React.ChangeEvent<HTMLInputElement>) => props.onChange!({ ...props.data, symbol: e.currentTarget.value })
  const onChangeLevelReq = (e: React.ChangeEvent<HTMLInputElement>) => props.onChange!({ ...props.data, levelRequirement: Number(e.currentTarget.value) })
  const onChangeImageData = (imageData: string | null) => props.onChange!({ ...props.data, imageData: imageData ?? '' })
  
  const disabled = props.onChange == null
  return (
    <tr>
    <td><input type="text" disabled={disabled} value={props.data.name} onChange={onChangeName} /></td>
    <td><input type="text" disabled={disabled} value={props.data.symbol} onChange={onChangeSymbol} /></td>
    <td><input type="number" disabled={disabled} value={props.data.levelRequirement} onChange={onChangeLevelReq} /></td>
    <td><RenderedImage disabled={disabled} imageData={props.data.imageData} onSetImage={onChangeImageData} /></td>
    <td>{props.actionCell}</td>
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
        const fr = new FileReader();
        fr.onload = () => props.onSetImage(fr.result as any);
        fr.onerror = () => { throw new Error() }
        fr.readAsText(files[0], 'base64')
    
        // const pngText = Buffer.from(new Uint8Array(await files[0].arrayBuffer())).toString('utf-8')
        // props.onSetImage(pngText)
      }
    }
    return <input type="file" accept="image/png" onChange={onSelect} />
  } else {
    return <>Display image here</>
  }
}
