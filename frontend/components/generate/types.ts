export interface LanguageOption {
  name: string;
  native: string;
  isDesi: boolean;
  romanName: string;
  romanDetail: string;
  nativeName?: string;
  nativeDetail?: string;
}

export const LANGUAGES: LanguageOption[] = [
  {
    name: "Auto-detect",
    native: "",
    isDesi: false,
    romanName: "Auto / Roman",
    romanDetail: "Roman (transliterated)",
    nativeName: "Native Script",
    nativeDetail: "Original regional script",
  },
  {
    name: "Hindi",
    native: "नमस्ते",
    isDesi: true,
    romanName: "Hinglish",
    romanDetail: "Roman (namaste)",
    nativeName: "हिंदी",
    nativeDetail: "Devanagari (नमस्ते)",
  },
  {
    name: "English",
    native: "Hello",
    isDesi: false,
    romanName: "English",
    romanDetail: "Standard Latin",
  },
  {
    name: "Urdu",
    native: "السلام علیکم",
    isDesi: true,
    romanName: "Roman Urdu",
    romanDetail: "Roman (salaam)",
    nativeName: "اردو",
    nativeDetail: "Nastaliq (السلام علیکم)",
  },
  {
    name: "Tamil",
    native: "வணக்கம்",
    isDesi: true,
    romanName: "Tanglish",
    romanDetail: "Roman (vanakkam)",
    nativeName: "தமிழ்",
    nativeDetail: "Tamil (வணக்கம்)",
  },
  {
    name: "Marathi",
    native: "नमस्कार",
    isDesi: true,
    romanName: "Marathlish",
    romanDetail: "Roman (namaskar)",
    nativeName: "मराठी",
    nativeDetail: "Devanagari (नमस्कार)",
  },
  {
    name: "Telugu",
    native: "నమస్కారం",
    isDesi: true,
    romanName: "Tenglish",
    romanDetail: "Roman (namaskaram)",
    nativeName: "తెలుగు",
    nativeDetail: "Telugu (నమస్కారం)",
  },
  {
    name: "Kannada",
    native: "ನಮಸ್ಕಾರ",
    isDesi: true,
    romanName: "Kanglish",
    romanDetail: "Roman (namaskara)",
    nativeName: "ಕನ್ನಡ",
    nativeDetail: "Kannada (ನಮಸ್ಕಾರ)",
  },
  {
    name: "Malayalam",
    native: "നമസ്കാരം",
    isDesi: true,
    romanName: "Manglish",
    romanDetail: "Roman (namaskaram)",
    nativeName: "മലയാളം",
    nativeDetail: "Malayalam (നമസ്കാരം)",
  },
  {
    name: "Bengali",
    native: "নমস্কার",
    isDesi: true,
    romanName: "Benglish",
    romanDetail: "Roman (namaskar)",
    nativeName: "বাংলা",
    nativeDetail: "Bengali (নমস্কার)",
  },
  {
    name: "Gujarati",
    native: "નમસ્તે",
    isDesi: true,
    romanName: "Gujlish",
    romanDetail: "Roman (namaste)",
    nativeName: "ગુજરાતી",
    nativeDetail: "Gujarati (નમસ્તે)",
  },
  {
    name: "Punjabi",
    native: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ",
    isDesi: true,
    romanName: "Punglish",
    romanDetail: "Roman (sat sri akal)",
    nativeName: "ਪੰਜਾਬੀ",
    nativeDetail: "Gurmukhi (ਸਤ ਸ੍ਰੀ ਅਕਾਲ)",
  },
  {
    name: "Odia",
    native: "ନମସ୍କାର",
    isDesi: true,
    romanName: "Odialish",
    romanDetail: "Roman (namaskar)",
    nativeName: "ଓଡ଼ିଆ",
    nativeDetail: "Odia (ନମସ୍କାର)",
  },
];
