import { useNavigate } from 'react-router-dom';
import { AdminBriefForm, GreetingHero } from '@modules/shared-ui';
import { useAdminClients, useCreateJobCard, useProvisionClient, useSendQuotePrice } from '../../modules/admin-panel/hooks/use-admin-clients';
import type { SendQuotePriceBody } from '../../modules/admin-panel/services/admin.service';

export function AdminCreateQuotePage() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAdminClients({ per_page: 200 });
  const { mutateAsync: provisionClient } = useProvisionClient();
  const { mutateAsync: createJobCard } = useCreateJobCard();
  const { mutateAsync: sendQuotePrice } = useSendQuotePrice();
  return (
    <div className="page">
      <GreetingHero
        title="Create Quote (Admin)"
        subtitle="Author a quote with full override — bypass the catalogue, attach custom terms, send on behalf of any Client Servicing."
      />
      <AdminBriefForm
        mode="quote"
        clients={data?.items ?? []}
        clientsLoading={isLoading}
        clientsError={isError}
        onProvisionClient={provisionClient}
        onCreateJob={createJobCard}
        onSendPrice={(jobId: string, body: unknown) => sendQuotePrice({ jobId, body: body as SendQuotePriceBody })}
        onSubmit={() => navigate('/admin/new-quotes')}
      />
    </div>
  );
}
