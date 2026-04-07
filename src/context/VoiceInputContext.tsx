'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface VoiceInputContextType {
  isOpen: boolean;
  openVoiceInput: () => void;
  closeVoiceInput: () => void;
  isSubmitting: boolean;
  setIsSubmitting: (val: boolean) => void;
}

const VoiceInputContext = createContext<VoiceInputContextType | undefined>(undefined);

export const VoiceInputProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openVoiceInput = useCallback(() => setIsOpen(true), []);
  const closeVoiceInput = useCallback(() => setIsOpen(false), []);

  return (
    <VoiceInputContext.Provider value={{ 
      isOpen, 
      openVoiceInput, 
      closeVoiceInput,
      isSubmitting,
      setIsSubmitting
    }}>
      {children}
    </VoiceInputContext.Provider>
  );
};

export const useVoiceInputContext = () => {
  const context = useContext(VoiceInputContext);
  if (!context) {
    throw new Error('useVoiceInputContext must be used within a VoiceInputProvider');
  }
  return context;
};
