import { ReactNode } from 'react';

export interface AdminContextValue {
  isAdmin: boolean;
  accessRole: string;
  setAdmin: (value: boolean) => void;
}

export interface AdminProviderProps {
  children: ReactNode;
  accessRole?: string;
}

export function AdminProvider(props: AdminProviderProps): JSX.Element;
export function useAdmin(): AdminContextValue;
