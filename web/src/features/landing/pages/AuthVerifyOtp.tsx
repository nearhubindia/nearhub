import { type ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function AuthVerifyOtp(): ReactElement {
  const location = useLocation();

  return <Navigate to={`/auth/register${location.search}`} replace />;
}
