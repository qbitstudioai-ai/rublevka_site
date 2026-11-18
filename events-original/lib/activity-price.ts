import { priceText } from "./money";
import type { ActivityView } from "./types";

export const activityPriceText = (activity: ActivityView) => priceText(activity.pricingType, activity.priceKopecks, activity.priceSuffix);
