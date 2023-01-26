type FormProps = {
  onSubmit: () => void
  children: React.ReactNode
} & React.HTMLAttributes<HTMLFormElement>

export default function Form (props: FormProps) {
  return <form {...props} onSubmit={(e) => {
    props.onSubmit()

    // prevents the page from refreshing automatically
    e.preventDefault()
  }}>
    {props.children}
  </form>
}
