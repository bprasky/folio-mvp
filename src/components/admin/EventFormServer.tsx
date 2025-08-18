// no "use client" here
import { EventType } from "@prisma/client";
import EventForm from "./EventForm";

export default function EventFormServer(props: any) {
  const eventTypeOptions = Object.values(EventType) as string[];
  return <EventForm {...props} eventTypeOptions={eventTypeOptions} />;
} 