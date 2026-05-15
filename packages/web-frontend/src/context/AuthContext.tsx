import React, { createContext, useState, ReactNode, useEffect } from 'react';

interface AuthContextType {
    token: string | null;
    user: string | null;
    isAuthenticated: boolean;
    setToken: (token: string) => void;
    setUser: (user: string) => void;
    logout: () => void;
    checkAuth: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [token, setTokenState] = useState<string | null>(null);
    const [user, setUserState] = useState<string | null>(null);

    // Initialize from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('username');
        
        if (storedToken) {
            setTokenState(storedToken);
            setUserState(storedUser);
        }
    }, []);

    const setToken = (newToken: string) => {
        setTokenState(newToken);
        localStorage.setItem('token', newToken);
    };

    const setUser = (newUser: string) => {
        setUserState(newUser);
        localStorage.setItem('username', newUser);
    };

    const logout = () => {
        setTokenState(null);
        setUserState(null);
        localStorage.removeItem('token');
        localStorage.removeItem('username');
    };

    const checkAuth = () => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            setTokenState(storedToken);
        }
    };

    const value: AuthContextType = {
        token,
        user,
        isAuthenticated: !!token,
        setToken,
        setUser,
        logout,
        checkAuth,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};