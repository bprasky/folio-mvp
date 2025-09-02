import ModalChromeClient from "@/components/modal/ModalChromeClient";
import EventModalBodyClient from "@/components/events/modal/EventModalBodyClient";
import { fetchEventForModal } from "@/lib/fetchEventForModal";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

export default async function EventPreviewModalPage({ params }: { params: { eventId: string } }) {
  const data = await fetchEventForModal(params.eventId);
  if (!data) return notFound();
  return (
    <ModalChromeClient>
      <EventModalBodyClient data={data} />
    </ModalChromeClient>
  );
}
