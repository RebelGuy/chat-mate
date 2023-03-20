import { ReactElement } from 'react'

type Props = {
  children: (onRef: (ref: React.Ref<any>) => void) => ReactElement
}

export default function AutoFocus (props: Props) {
  const onRef = (element: any) => {
    if (element != null) {
      setTimeout(() => { element.focus() }, 100)
    }
  }

  return props.children(onRef)
}
