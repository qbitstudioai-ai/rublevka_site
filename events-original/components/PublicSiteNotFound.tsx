import NotFound from "@/app/not-found";
import { GroveFooter } from "./GroveFooter";
import { PublicSiteHeader } from "./PublicSiteHeader";

export function PublicSiteNotFound() {
  return (
    <div className="public-site-shell">
      <PublicSiteHeader />
      <NotFound />
      <GroveFooter />
    </div>
  );
}
