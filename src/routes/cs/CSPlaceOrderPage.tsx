import { useNavigate } from 'react-router-dom';
import { AdminBriefForm, GreetingHero } from '@modules/shared-ui';
import { useAdminClients, useCreateJobCard, useProvisionClient } from '../../modules/admin-panel/hooks/use-admin-clients';

export function CSPlaceOrderPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAdminClients({ per_page: 200 });
  const { mutateAsync: provisionClient } = useProvisionClient();
  const { mutateAsync: createJobCard } = useCreateJobCard();
  return (
    <div className="page">
      <GreetingHero
        title="Place Order on Behalf of Client"
        subtitle="Submit a confirmed order directly into the production pipeline."
      />
      <AdminBriefForm
        mode="order"
        clients={data?.items ?? []}
        clientsLoading={isLoading}
        clientsError={isError}
        onProvisionClient={provisionClient}
        onCreateJob={createJobCard}
        onSubmit={() => navigate('/cs/new-jobs')}
      />
    </div>
  );
}
