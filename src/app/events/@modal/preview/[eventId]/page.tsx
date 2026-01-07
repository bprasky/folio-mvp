import ModalChromeClient from "@/components/modal/ModalChromeClient";
import EventModalBodyClient from "@/components/events/modal/EventModalBodyClient";
import { fetchEventForModal } from "@/lib/fetchEventForModal";
import { resolveFeaturedProducts } from "@/lib/events/fetchFeaturedProducts";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

export default async function EventPreviewModalPage({ params }: { params: { eventId: string } }) {
  const data = await fetchEventForModal(params.eventId);
  if (!data) return notFound();

  const featuredProducts = await resolveFeaturedProducts(data.linkedProducts);

  return (
    <ModalChromeClient>
      <EventModalBodyClient data={data} featuredProducts={featuredProducts} />
    </ModalChromeClient>
  );
}
