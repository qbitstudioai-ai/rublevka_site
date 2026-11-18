import Link from "next/link";
import { createEventAction } from "@/app/admin/actions";
import { EventForm } from "@/components/admin/EventForm";
import { todayIso } from "@/lib/format";
import { requireAdmin } from "@/lib/server/admin-auth";
import { getOrigin } from "@/lib/server/origin";

export default async function NewEventPage() {
  await requireAdmin();
  const origin = await getOrigin();

  return (
    <div className="a-page a-page-narrow">
      <Link className="a-back" href="/admin">
        ← Все мероприятия
      </Link>
      <h1>Новое мероприятие</h1>
      <p className="a-hint">Сохраните как черновик, добавьте услуги и опубликуйте, когда всё будет готово.</p>
      <EventForm
        mode="create"
        origin={origin}
        action={createEventAction}
        initial={{
          title: "",
          slug: "",
          eventDate: todayIso(),
          startTime: "16:00",
          endDate: "",
          endTime: "",
          heroFit: "cover",
          price: "",
          extraInfo: "",
          longDescription: "",
          shortDescription: "Заполните данные участника и, если хотите, добавьте активности к своему дню.",
          locationText: "",
          status: "draft",
          heroSrc: null,
        }}
      />
    </div>
  );
}
