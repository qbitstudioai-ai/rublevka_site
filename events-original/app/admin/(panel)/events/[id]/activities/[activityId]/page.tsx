import Link from "next/link";
import { notFound } from "next/navigation";
import { saveActivityAction } from "@/app/admin/actions";
import { ActivityForm } from "@/components/admin/ActivityForm";
import { mediaUrl } from "@/lib/media";
import { kopecksToInput } from "@/lib/money";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getDb } from "@/lib/server/db";
import { getActivity, listGallery, parseDetails } from "@/lib/server/repo/activities";
import { getEventById } from "@/lib/server/repo/events";
import { idSchema } from "@/lib/server/validation";

export default async function EditActivityPage({ params }: { params: Promise<{ id: string; activityId: string }> }) {
  await requireAdmin();
  const raw = await params;
  const eventId = idSchema.safeParse(raw.id);
  const activityId = idSchema.safeParse(raw.activityId);
  if (!eventId.success || !activityId.success) notFound();

  const db = getDb();
  const event = getEventById(db, eventId.data);
  const activity = event ? getActivity(db, event.id, activityId.data) : null;
  if (!event || !activity) notFound();
  const back = `/admin/events/${event.id}#activities`;

  return (
    <div className="a-page a-page-narrow">
      <Link className="a-back" href={back}>
        ← {event.title}
      </Link>
      <h1>{activity.title}</h1>
      <p className="a-hint">Изменения не затрагивают уже сделанные регистрации: в них сохранены название и цена на момент регистрации.</p>
      <ActivityForm
        key={activity.updated_at}
        mode="edit"
        cancelHref={back}
        action={saveActivityAction.bind(null, event.id, activity.id)}
        initial={{
          title: activity.title,
          shortDescription: activity.short_description,
          longDescription: activity.long_description,
          startTime: activity.start_time ?? "",
          durationText: activity.duration_text ?? "",
          pricingType: activity.pricing_type,
          price: activity.pricing_type === "fixed" ? kopecksToInput(activity.fixed_price_kopecks) : "",
          priceSuffix: activity.price_suffix ?? "",
          details: parseDetails(activity.details).join("\n"),
          isActive: activity.is_active === 1,
          cardSrc: mediaUrl(activity.card_image),
          gallery: listGallery(db, [activity.id])
            .map((image) => ({ id: image.id, src: mediaUrl(image.image_path) }))
            .filter((image): image is { id: number; src: string } => !!image.src),
        }}
      />
    </div>
  );
}
