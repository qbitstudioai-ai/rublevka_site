import Link from "next/link";
import { notFound } from "next/navigation";
import { saveActivityAction } from "@/app/admin/actions";
import { ActivityForm } from "@/components/admin/ActivityForm";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getDb } from "@/lib/server/db";
import { getEventById } from "@/lib/server/repo/events";
import { idSchema } from "@/lib/server/validation";

export default async function NewActivityPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();
  const event = getEventById(getDb(), parsedId.data);
  if (!event) notFound();
  const back = `/admin/events/${event.id}#activities`;

  return (
    <div className="a-page a-page-narrow">
      <Link className="a-back" href={back}>
        ← {event.title}
      </Link>
      <h1>Новая услуга</h1>
      <ActivityForm
        mode="create"
        cancelHref={back}
        action={saveActivityAction.bind(null, event.id, null)}
        initial={{
          title: "",
          shortDescription: "",
          longDescription: "",
          startTime: "",
          durationText: "",
          pricingType: "fixed",
          price: "",
          priceSuffix: "",
          details: "",
          isActive: true,
          cardSrc: null,
          gallery: [],
        }}
      />
    </div>
  );
}
