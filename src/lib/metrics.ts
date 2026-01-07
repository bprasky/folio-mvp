export type SaveToRoomEvent = {
  productId: string;
  eventId?: string;       // parent event
  subeventId?: string;    // session/booth
  projectId: string;
  roomId: string;
  userId: string;
  ts: string;
};

export function trackSaveToRoom(e: SaveToRoomEvent) {
  // TODO: replace with real analytics pipeline
  try {
    const key = "folio_demo_saves";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(e);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
  // server logs (optional)
  console.log("[metrics] save_to_room", e);
}