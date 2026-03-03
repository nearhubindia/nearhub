import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin';
}

export function ProtectedRoute({ children, requiredRole = 'admin' }: ProtectedRouteProps) {
  const adminToken = localStorage.getItem('adminToken');
  const adminUser = localStorage.getItem('adminUser');

  // Check if user is authenticated
  if (!adminToken || !adminUser) {
    return <Navigate to="/admin/login" replace />;
  }

  // Optionally check role
  if (requiredRole === 'admin') {
    let isAuthorized = false;
    try {
      const user = JSON.parse(adminUser);
      const validRoles = ['admin', 'super_admin', 'moderator'];
      isAuthorized = validRoles.includes(user.role);
    } catch {
      isAuthorized = false;
    }

    if (!isAuthorized) {
      return <Navigate to="/admin/login" replace />;
    }
  }

  return <>{children}</>;
}
