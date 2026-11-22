import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS } from '../constants/translations';

const LanguageContext = createContext();

const STORAGE_KEY = '@vendorvoice_language';

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState('ta'); // Default Tamil for South Indian street vendors

  useEffect(() => {
    // Load persisted language preference
    const loadLang = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved && (saved === 'ta' || saved === 'en')) {
          setLanguageState(saved);
        }
      } catch (e) {
        // Fallback to default
      }
    };
    loadLang();
  }, []);

  const setLanguage = async (newLang) => {
    setLanguageState(newLang);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {
      // ignore
    }
  };

  const toggleLanguage = () => {
    const nextLang = language === 'ta' ? 'en' : 'ta';
    setLanguage(nextLang);
  };

  const t = (key) => {
    const langDict = TRANSLATIONS[language] || TRANSLATIONS.en;
    if (langDict[key]) return langDict[key];
    if (TRANSLATIONS.en[key]) return TRANSLATIONS.en[key];
    return key;
  };

  const getItemName = (item) => {
    if (!item) return '';
    return language === 'ta' ? (item.name_ta || item.name_en) : (item.name_en || item.name_ta);
  };

  const getMarketName = (market) => {
    if (!market) return '';
    return language === 'ta' ? (market.name_ta || market.name_en) : (market.name_en || market.name_ta);
  };

  const getFestivalName = (festival) => {
    if (!festival) return '';
    return language === 'ta' ? (festival.name_ta || festival.name_en) : (festival.name_en || festival.name_ta);
  };

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage,
      toggleLanguage,
      t,
      getItemName,
      getMarketName,
      getFestivalName
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
