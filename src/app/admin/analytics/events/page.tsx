import { getEvents } from "../actions";
import { EventManagerClient } from "./event-manager-client";

export const dynamic = "force-dynamic";

export default async function EventManagerPage() {
  const events = await getEvents();

  return <EventManagerClient initialEvents={events} />;
}
