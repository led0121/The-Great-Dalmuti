import { createContext, useContext, useState } from 'react';
import { translations } from './translations';

export const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState('ko');

    const t = (key, params = {}) => {
        let text = translations[language][key] || key;
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
        return text;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}
