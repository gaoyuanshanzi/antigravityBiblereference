import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [geminiKey, setGeminiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check local storage on mount
    const storedAuth = localStorage.getItem('bible_auth');
    const storedKey = localStorage.getItem('gemini_api_key');

    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
    if (storedKey) {
      setGeminiKey(storedKey);
    }
    setIsLoading(false);
  }, []);

  const login = (id, password, key) => {
    if (id === 'admin' && password === '123jesus') {
      setIsAuthenticated(true);
      localStorage.setItem('bible_auth', 'true');
      
      if (key) {
        setGeminiKey(key);
        localStorage.setItem('gemini_api_key', key);
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setGeminiKey('');
    localStorage.removeItem('bible_auth');
    localStorage.removeItem('gemini_api_key');
  };

  if (isLoading) {
    return <div className="h-screen w-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, geminiKey, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
