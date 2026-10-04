import { HomeView } from "../components/home/home-view";
import { catalogDay } from "../components/games/card-logic";

/**
 * The home page.
 *
 * A server component so the clock the badges are judged by is read once,
 * here, and handed to the client: NEW and UPDATED are day windows, and a
 * browser reading its own clock could disagree with the HTML it hydrates.
 * Regenerated hourly, so a badge is never more than an hour behind the day.
 *
 * Metadata is the root layout's: this page is the site.
 */
export const revalidate = 3600;

export default function HomePage() {
  return <HomeView now={catalogDay()} />;
}
