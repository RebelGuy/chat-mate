import { ReactElement, useState } from 'react'

type Props = {
  children: (onRef: (ref: React.Ref<any>) => void) => ReactElement
}

export default function AutoFocus (props: Props) {
  const [isUsed, setIsUsed] = useState(false)

  const onRef = (element: any) => {
    if (isUsed) {
      return
    }

    setIsUsed(true)

    if (element != null) {
      setTimeout(() => { element.focus() }, 100)
    }
  }

  return props.children(onRef)
}
