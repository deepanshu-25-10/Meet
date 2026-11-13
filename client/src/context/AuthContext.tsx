import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import { api, getAuthToken, setAuthToken } from '../services/api';
import { disconnectSocket } from '../services/socket';

interface AccessStatus {
  hasPasswordSet: boolean;
  guestPasscode?: string;
  roomSlug: string;
  roomName: string;
  adminName?: string;
  adminEmail?: string;
  isOwner?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  accessStatus: AccessStatus | null;
  savedAdminPassword: string | null;
  isAdminSaved: boolean;
  savedParticipantName: string;
  setSavedParticipantName: (name: string) => void;
  adminLogin: (password: string, savePassword?: boolean) => Promise<void>;
  participantEntry: (name: string, passcode?: string) => Promise<void>;
  setAdminPassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; message: string }>;
  setGuestPasscode: (passcode?: string | null, generateRandom?: boolean) => Promise<{ passcode: string | null; message: string }>;
  forgetAdminPassword: () => void;
  refreshAccessStatus: () => Promise<AccessStatus | null>;
  updateProfile: (payload: { name?: string; avatarUrl?: string; status?: string; bio?: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; name: string; password: string; avatarUrl?: string }) => Promise<void>;
  logout: () => void;
  // Backwards compatibility
  savedPassword: string | null;
  savedName: string;
  setSavedName: (name: string) => void;
  oneClickEntry: (password?: string, name?: string) => Promise<void>;
  setAccessPassword: (newPassword: string, currentPassword?: string) => Promise<{ success: boolean; message: string; hasPasswordSet: boolean }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(getAuthToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  const [savedAdminPassword, setSavedAdminPasswordState] = useState<string | null>(
    localStorage.getItem('deepnav_admin_password') || null,
  );
  const [isAdminSaved, setIsAdminSavedState] = useState<boolean>(
    localStorage.getItem('deepnav_admin_saved') === 'true',
  );

  // Clean legacy dummy names from localStorage
  const getCleanSavedParticipantName = (): string => {
    const raw =
      localStorage.getItem('deepnav_participant_name') ||
      localStorage.getItem('deepnav_saved_name');
    if (
      !raw ||
      raw === 'Alex Rivera' ||
      raw === 'Guest Participant' ||
      raw === 'Alex' ||
      raw.toLowerCase().includes('alex rivera')
    ) {
      localStorage.removeItem('deepnav_saved_name');
      localStorage.removeItem('deepnav_participant_name');
      return '';
    }
    return raw;
  };

  const [savedParticipantName, setSavedParticipantNameState] = useState<string>(
    getCleanSavedParticipantName(),
  );

  const setSavedParticipantName = (name: string) => {
    const clean = name.trim();
    if (clean && clean !== 'Alex Rivera' && clean !== 'Guest Participant') {
      localStorage.setItem('deepnav_participant_name', clean);
      localStorage.setItem('deepnav_saved_name', clean);
      setSavedParticipantNameState(clean);
    } else {
      localStorage.removeItem('deepnav_participant_name');
      localStorage.removeItem('deepnav_saved_name');
      setSavedParticipantNameState('');
    }
  };

  const refreshAccessStatus = async () => {
    try {
      const status = await api.getAccessStatus();
      setAccessStatus(status);
      return status;
    } catch (e) {
      console.warn('Failed to fetch access status:', e);
      return null;
    }
  };

  // Host / Admin Login
  const adminLogin = async (password: string, savePassword = true) => {
    const res = await api.adminLogin(password);
    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);

    if (savePassword) {
      localStorage.setItem('deepnav_admin_saved', 'true');
      localStorage.setItem('deepnav_admin_password', password);
      setIsAdminSavedState(true);
      setSavedAdminPasswordState(password);
    } else {
      localStorage.removeItem('deepnav_admin_saved');
      localStorage.removeItem('deepnav_admin_password');
      setIsAdminSavedState(false);
      setSavedAdminPasswordState(null);
    }
    await refreshAccessStatus();
  };

  const forgetAdminPassword = () => {
    localStorage.removeItem('deepnav_admin_saved');
    localStorage.removeItem('deepnav_admin_password');
    setIsAdminSavedState(false);
    setSavedAdminPasswordState(null);
  };

  // Participant / Guest Entry
  const participantEntry = async (name: string, passcode?: string) => {
    const cleanName = name.trim() || 'Guest Participant';
    setSavedParticipantName(cleanName);

    const res = await api.oneClickEntry({
      name: cleanName,
      password: passcode ? passcode.trim() : undefined,
    });

    setAuthToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
    await refreshAccessStatus();
  };

  // Host creates / changes meeting passcode
  const setGuestPasscode = async (passcode?: string | null, generateRandom?: boolean) => {
    const res = await api.setGuestPasscode({ passcode, generateRandom });
    await refreshAccessStatus();
    return {
      passcode: res.passcode,
      message: res.message,
    };
  };

  // Change Admin Master Password
  const setAdminPassword = async (newPassword: string, currentPassword?: string) => {
    const res = await api.setAdminPassword({ newPassword, currentPassword });
    if (isAdminSaved) {
      localStorage.setItem('deepnav_admin_password', newPassword);
      setSavedAdminPasswordState(newPassword);
    }
    await refreshAccessStatus();
    return res;
  };

  // Backwards compatibility wrappers
  const oneClickEntry = async (password?: string, name?: string) => {
    return participantEntry(name || savedParticipantName || '', password);
  };

  const setAccessPassword = async (newPassword: string, currentPassword?: string) => {
    const res = await api.setGuestPasscode({ passcode: newPassword });
    return {
      success: res.success,
      message: res.message,
      hasPasswordSet: res.hasPasswordSet,
    };
  };

  // Initialize session: auto-login Admin if saved on device, or restore existing token
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const status = await refreshAccessStatus();
        const currentToken = getAuthToken();

        // 1. If existing JWT token is present, verify
        if (currentToken) {
          try {
            const me = await api.getMe();
            const isSavedAdmin = localStorage.getItem('deepnav_admin_saved') === 'true';

            // If the restored session is legacy Alex Rivera or demo@deepnav.io
            // but this device has not saved admin credentials, clear it so participant can type their own name
            if (
              (me.name === 'Alex Rivera' || me.email === 'demo@deepnav.io') &&
              !isSavedAdmin
            ) {
              setAuthToken(null);
              setTokenState(null);
            } else if (isMounted) {
              setUser(me);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Previous token invalid:', e);
            setAuthToken(null);
            setTokenState(null);
          }
        }

        // 2. If user is Admin and saved password on this device, auto-login as Admin!
        const savedPass = localStorage.getItem('deepnav_admin_password');
        const isSaved = localStorage.getItem('deepnav_admin_saved') === 'true';

        if (isSaved && savedPass) {
          try {
            const res = await api.adminLogin(savedPass);
            if (isMounted) {
              setAuthToken(res.token);
              setTokenState(res.token);
              setUser(res.user);
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.warn('Auto admin login failed, awaiting password:', err);
          }
        }
      } catch (err) {
        console.warn('Init error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    disconnectSocket();
  };

  const updateProfile = async (payload: { name?: string; avatarUrl?: string; status?: string; bio?: string }) => {
    const updated = await api.updateProfile(payload);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        accessStatus,
        savedAdminPassword,
        isAdminSaved,
        savedParticipantName,
        setSavedParticipantName,
        adminLogin,
        participantEntry,
        setAdminPassword,
        setGuestPasscode,
        forgetAdminPassword,
        refreshAccessStatus,
        updateProfile,
        login: async (email: string, password: string) => {
          const res = await api.login({ email, password });
          setAuthToken(res.token);
          setTokenState(res.token);
          setUser(res.user);
        },
        register: async (payload: any) => {
          const res = await api.register(payload);
          setAuthToken(res.token);
          setTokenState(res.token);
          setUser(res.user);
        },
        logout,
        // Backwards compatibility
        savedPassword: savedAdminPassword,
        savedName: savedParticipantName,
        setSavedName: setSavedParticipantName,
        oneClickEntry,
        setAccessPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
