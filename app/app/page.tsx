import { redirect } from "next/navigation";

// Root redirects into the authenticated app shell
export default function RootPage() {
  redirect("/dashboard");
}
