import { useState, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { api } from '../api/client';
import { useLanguage } from '../context/LanguageContext';

export const useVoice = () => {
  const { language } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedResult, setParsedResult] = useState(null);
  const [lastSpokenText, setLastSpokenText] = useState('');
  const recognitionRef = useRef(null);

  // Initialize SpeechRecognition on Web / Android Web if available
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === 'ta' ? 'ta-IN' : 'en-IN';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event) => {
          const current = event.resultIndex;
          const text = event.results[current][0].transcript;
          setTranscript(text);
        };

        recognition.onerror = (event) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [language]);

  // Text to Speech playback
  const speak = (text, customLang = null) => {
    if (!text) return;
    const langCode = (customLang || language) === 'ta' ? 'ta-IN' : 'en-IN';
    setLastSpokenText(text);

    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } else {
        Speech.stop();
        Speech.speak(text, {
          language: langCode,
          pitch: 1.0,
          rate: 0.9
        });
      }
    } catch (e) {
      console.warn("TTS Error:", e);
    }
  };

  // Start Voice Recording / Listening
  const startListening = () => {
    setTranscript('');
    setParsedResult(null);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = language === 'ta' ? 'ta-IN' : 'en-IN';
        recognitionRef.current.start();
        return;
      } catch (e) {
        console.warn("Could not start native speech recognition", e);
      }
    }

    // Fallback listening flag
    setIsListening(true);
  };

  const stopListening = async () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);

    if (transcript && transcript.trim()) {
      await processText(transcript);
    }
  };

  // Process any speech or typed text with the backend parser
  const processText = async (rawText) => {
    if (!rawText || !rawText.trim()) return;
    setIsProcessing(true);
    setTranscript(rawText);

    try {
      const parsed = await api.parseVoice(rawText, language);
      setParsedResult(parsed);

      // Speak confirmation prompt for verification
      const spokenText = language === 'ta' ? parsed.spoken_confirmation_ta : parsed.spoken_confirmation_en;
      speak(spokenText);
      return parsed;
    } catch (e) {
      console.warn("Voice parsing failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Save / execute the confirmed voice action
  const confirmAndExecute = async (overrideParsed = null) => {
    const target = overrideParsed || parsedResult;
    if (!target) return null;

    setIsProcessing(true);
    try {
      const result = await api.executeVoiceAction({
        action: target.action,
        item_id: target.item_id,
        quantity: target.quantity,
        unit: target.unit,
        amount: target.amount,
        raw_text: target.raw_text || transcript
      });

      // Confirm spoken reply
      const confirmation = language === 'ta' ? 
        (result.spoken_confirmation_ta || "வெற்றிகரமாக சேமிக்கப்பட்டது") : 
        (result.spoken_confirmation_en || "Saved successfully");
      speak(confirmation);
      return result;
    } catch (e) {
      console.warn("Execute action failed:", e);
      throw e;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isListening,
    transcript,
    setTranscript,
    isProcessing,
    parsedResult,
    setParsedResult,
    lastSpokenText,
    startListening,
    stopListening,
    processText,
    confirmAndExecute,
    speak
  };
};
