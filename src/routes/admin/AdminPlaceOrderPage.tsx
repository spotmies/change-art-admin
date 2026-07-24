import { useNavigate } from 'react-router-dom';
import { AdminBriefForm, GreetingHero } from '@modules/shared-ui';
import { useAdminClients, useCreateJobCard, useProvisionClient } from '../../modules/admin-panel/hooks/use-admin-clients';

export function AdminPlaceOrderPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAdminClients({ per_page: 200 });
  const { mutateAsync: provisionClient } = useProvisionClient();
  const { mutateAsync: createJobCard } = useCreateJobCard();
  return (
    <div className="page">
      <GreetingHero
        title="Place Order (Admin)"
        subtitle="Direct order placement — pick any client, attach a brief, and drop a job straight into production."
      />
      <AdminBriefForm
        mode="order"
        clients={data?.items ?? []}
        clientsLoading={isLoading}
        clientsError={isError}
        onProvisionClient={provisionClient}
        onCreateJob={createJobCard}
        onSubmit={() => navigate('/admin/new-jobs')}
      />
    </div>
  );
}
