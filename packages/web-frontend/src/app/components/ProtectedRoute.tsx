import React, { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
    children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};