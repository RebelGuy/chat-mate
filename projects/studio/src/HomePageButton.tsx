type Props = {
  onHome: () => void
}

export default function HomePageButton (props: Props) {
  return <button onClick={props.onHome}>Go back</button>
}
