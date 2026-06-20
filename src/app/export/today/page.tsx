import { redirect } from "next/navigation";

// Redirect old export URL to new AI page
export default function ExportTodayRedirect() {
  redirect("/ai");
}
