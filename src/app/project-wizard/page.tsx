import { redirect } from "next/navigation";

export default function LegacyProjectWizardRedirect() {
  redirect("/projects/new");
}
