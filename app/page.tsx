import { redirect } from "next/navigation";

// The MKH app domain should open the production login page.
// Keep the root path aligned with the canonical black-button /login screen.
export default function HomePage() {
  redirect("/login");
}
