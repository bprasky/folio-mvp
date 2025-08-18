import FestivalLayoutClient from "./FestivalLayoutClient";

export default function FestivalLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  // Delegate blur/render logic to the client wrapper that knows the active segments
  return <FestivalLayoutClient modal={modal}>{children}</FestivalLayoutClient>;
}
