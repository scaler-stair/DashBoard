import { getSession, activeOrgId, canUpdateStatus } from "@/lib/auth";
import { orgObservations } from "@/lib/stats";
import { ObservationsTable } from "@/components/observations-table";

export default async function ObservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ quarter?: string; dept?: string; risk?: string; status?: string }>;
}) {
  const session = (await getSession())!;
  const orgId = await activeOrgId(session);
  const rows = orgId ? await orgObservations(orgId) : [];
  const params = await searchParams;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Observations</h1>
      <ObservationsTable rows={rows} canEdit={canUpdateStatus(session.role)} initialFilters={params} />
    </div>
  );
}
