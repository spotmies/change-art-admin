import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { queryKeys } from '@lib/query-keys';
import { toastApiError } from '@lib/toast-error';
import {
  adminService,
  type CreateUserBody,
  type UpdateUserBody,
} from '../services/admin.service';

/**
 * User mutations for the Admin → User Management screen. Each invalidates the
 * whole `users` key on success so the list + stat cards refetch.
 */

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUserBody) => adminService.createUser(body),
    onSuccess: (user) => {
      void qc.invalidateQueries({ queryKey: queryKeys.users.all() });
      toast.success(`${user.name} created`);
    },
    onError: (err) => toastApiError(err),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserBody }) =>
      adminService.updateUser(id, body),
    onSuccess: (user, { body }) => {
      void qc.invalidateQueries({ queryKey: queryKeys.users.all() });
      if (body.is_active === true) {
        toast.success(`${user.name} reactivated. If they cannot log in, ask them to check their email for a password reset link.`, { duration: 6000 });
      } else {
        toast.success(`${user.name} updated`);
      }
    },
    onError: (err) => toastApiError(err),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.deactivateUser(id),
    onSuccess: (user) => {
      void qc.invalidateQueries({ queryKey: queryKeys.users.all() });
      toast.success(`${user.name} deactivated`);
    },
    onError: (err) => toastApiError(err),
  });
}
