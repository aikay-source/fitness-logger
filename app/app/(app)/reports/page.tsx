import ReportsClient from "./ReportsClient";

export default function ReportsPage() {
  const now = new Date();
  return (
    <ReportsClient
      initialYear={now.getFullYear()}
      initialMonth={now.getMonth() + 1}
    />
  );
}
