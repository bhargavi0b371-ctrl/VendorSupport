import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import { useVoice } from '../hooks/useVoice';
import { Header } from '../components/Header';
import { BigButton } from '../components/BigButton';

export const VoiceEntryScreen = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const {
    isListening,
    transcript,
    setTranscript,
    isProcessing,
    parsedResult,
    setParsedResult,
    startListening,
    stopListening,
    processText,
    confirmAndExecute,
    speak
  } = useVoice();

  const [manualInput, setManualInput] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Quick sample buttons for test / practice / noisy environments
  const SAMPLES = [
    { labelEn: "Sold 3 kg Tomato ₹90", labelTa: "3 கிலோ தக்காளி ₹90 வித்தேன்", text: language === 'ta' ? "3 கிலோ தக்காளி 90 ரூபாய்க்கு வித்தேன்" : "Sold 3 kg tomato for 90 rupees" },
    { labelEn: "5 kg Onion ₹250", labelTa: "5 கிலோ வெங்காயம் ₹250", text: language === 'ta' ? "5 கிலோ வெங்காயம் 250 ரூபாய்" : "5 kg onion 250 rs" },
    { labelEn: "Bought 20 kg Potato ₹480", labelTa: "20 கிலோ உருளை ₹480 வாங்கினேன்", text: language === 'ta' ? "20 கிலோ உருளைக்கிழங்கு 480 ரூபாய்க்கு வாங்கினேன்" : "Bought 20 kg potato for 480 rupees" },
    { labelEn: "Today's Profit?", labelTa: "இன்னைக்கு லாபம் என்ன?", text: language === 'ta' ? "இன்னைக்கு லாபம் என்ன" : "what is my profit today" },
    { labelEn: "Best Price Onion", labelTa: "வெங்காயம் நல்ல விலை என்ன?", text: language === 'ta' ? "வெங்காயம் நல்ல விலை என்ன" : "best price for onion" },
    { labelEn: "Where to buy Tomato?", labelTa: "தக்காளி எங்கே வாங்கலாம்?", text: language === 'ta' ? "தக்காளி எங்கே வாங்கலாம்" : "where to buy tomato" }
  ];

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      setSaveSuccess(false);
      startListening();
    }
  };

  const handleSamplePress = async (sample) => {
    setSaveSuccess(false);
    setTranscript(sample.text);
    await processText(sample.text);
  };

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;
    setSaveSuccess(false);
    await processText(manualInput);
    setManualInput('');
  };

  const handleConfirm = async () => {
    try {
      const res = await confirmAndExecute();
      setSaveSuccess(true);
      setLastSaved(res);
      // Wait 2 seconds and navigate back to home or refresh
      setTimeout(() => {
        onNavigate('home');
      }, 1600);
    } catch (e) {
      console.warn("Failed to confirm voice", e);
    }
  };

  const handleCancelUndo = () => {
    setParsedResult(null);
    setTranscript('');
    setSaveSuccess(false);
    const cancelMsg = language === 'ta' ? 'ரத்து செய்யப்பட்டது' : 'Cancelled';
    speak(cancelMsg);
  };

  return (
    <View style={styles.screen}>
      <Header title={t('tabVoice')} showBack onBack={() => onNavigate('home')} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* BIG MIC LISTENING HERO */}
        <View style={styles.micCard}>
          <TouchableOpacity
            onPress={handleMicToggle}
            activeOpacity={0.8}
            style={[
              styles.micButton,
              isListening && styles.micButtonListening
            ]}
          >
            <MaterialCommunityIcons 
              name={isListening ? "stop" : "microphone"} 
              size={58} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>

          <Text style={styles.micStatus}>
            {isListening ? t('listening') : (isProcessing ? t('processing') : t('tapToSpeak'))}
          </Text>
          <Text style={styles.micHelp}>{t('speakNow')}</Text>

          {/* REALTIME OR CAPTURED TRANSCRIPT */}
          {transcript ? (
            <View style={styles.transcriptBox}>
              <MaterialCommunityIcons name="format-quote-open" size={20} color="#1B5E20" />
              <Text style={styles.transcriptText}>{transcript}</Text>
            </View>
          ) : null}

          {isProcessing && <ActivityIndicator size="large" color={THEME.colors.primary} style={{ marginTop: 12 }} />}
        </View>

        {/* PARSED RESULT CARD FOR VISUAL VERIFICATION */}
        {parsedResult && (
          <View style={styles.parsedCard}>
            <View style={styles.parsedHeaderRow}>
              <MaterialCommunityIcons name="check-circle" size={26} color={THEME.colors.primary} />
              <Text style={styles.parsedTitle}>{t('parsedResult')}</Text>
              <TouchableOpacity onPress={() => speak(language === 'ta' ? parsedResult.spoken_confirmation_ta : parsedResult.spoken_confirmation_en)}>
                <MaterialCommunityIcons name="volume-high" size={26} color={THEME.colors.primary} />
              </TouchableOpacity>
            </View>

            {/* ACTION BADGE */}
            <View style={styles.actionBadgeRow}>
              <View style={[
                styles.actionBadge, 
                parsedResult.action === 'sale' ? styles.saleBadge : (parsedResult.action === 'purchase' ? styles.purchaseBadge : styles.queryBadge)
              ]}>
                <Text style={styles.actionBadgeText}>
                  {parsedResult.action.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* KEY DETAILS GRID */}
            {parsedResult.item_name_en && (
              <View style={styles.detailsRow}>
                <View style={styles.detailBox}>
                  <Text style={styles.detailLabel}>{t('item')}</Text>
                  <Text style={styles.detailValue}>
                    {language === 'ta' ? parsedResult.item_name_ta : parsedResult.item_name_en}
                  </Text>
                </View>

                {parsedResult.quantity && (
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>{t('quantity')}</Text>
                    <Text style={styles.detailValue}>
                      {parsedResult.quantity} {parsedResult.unit}
                    </Text>
                  </View>
                )}

                {parsedResult.amount && (
                  <View style={styles.detailBox}>
                    <Text style={styles.detailLabel}>{t('amount')}</Text>
                    <Text style={[styles.detailValue, { color: THEME.colors.primary }]}>
                      ₹{parsedResult.amount}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* SPOKEN CONFIRMATION PREVIEW TEXT */}
            <View style={styles.spokenPreviewBox}>
              <MaterialCommunityIcons name="text-to-speech" size={22} color="#1565C0" />
              <Text style={styles.spokenPreviewText}>
                {language === 'ta' ? parsedResult.spoken_confirmation_ta : parsedResult.spoken_confirmation_en}
              </Text>
            </View>

            {/* CONFIRM & CANCEL BUTTONS */}
            <View style={styles.buttonActionRow}>
              <BigButton
                title={t('confirmAndSave')}
                icon="check-bold"
                color={THEME.colors.primary}
                onPress={handleConfirm}
                size="large"
                style={{ flex: 1 }}
              />
            </View>

            <TouchableOpacity 
              onPress={handleCancelUndo}
              style={styles.cancelLink}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={20} color="#C62828" />
              <Text style={styles.cancelLinkText}>{t('cancelUndo')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SAVE SUCCESS NOTIFICATION */}
        {saveSuccess && (
          <View style={styles.successBox}>
            <MaterialCommunityIcons name="check-decagram" size={36} color="#1B5E20" />
            <Text style={styles.successTitle}>{t('voiceSuccess')}</Text>
          </View>
        )}

        {/* QUICK SAMPLE PHRASES (For practice, low literacy, and noisy environments) */}
        <View style={styles.samplesSection}>
          <Text style={styles.samplesTitle}>{t('trySaying')}</Text>
          <View style={styles.samplesGrid}>
            {SAMPLES.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleSamplePress(s)}
                style={styles.sampleChip}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons name="microphone-outline" size={18} color="#1B5E20" />
                <Text style={styles.sampleChipText}>
                  {language === 'ta' ? s.labelTa : s.labelEn}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* MANUAL TEXT ENTRY FALLBACK (for very noisy markets) */}
        <View style={styles.manualFallbackSection}>
          <Text style={styles.fallbackTitle}>
            {language === 'ta' ? 'அல்லது தட்டச்சு செய்து அனுப்பவும்:' : 'Or type text:'}
          </Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder={language === 'ta' ? "உதா: 3 கிலோ தக்காளி 90 ரூபாய்" : "e.g. 3 kg tomato 90 rs"}
              value={manualInput}
              onChangeText={setManualInput}
              onSubmitEditing={handleManualSubmit}
            />
            <TouchableOpacity 
              onPress={handleManualSubmit}
              style={styles.sendButton}
            >
              <MaterialCommunityIcons name="send" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  micCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8
  },
  micButtonListening: {
    backgroundColor: '#C62828', // Pulsing red when recording
    transform: [{ scale: 1.05 }]
  },
  micStatus: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginTop: 16
  },
  micHelp: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 4
  },
  transcriptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: '#C8E6C9',
    width: '100%',
    gap: 8
  },
  transcriptText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1B5E20',
    flex: 1
  },
  parsedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    marginBottom: 16
  },
  parsedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  parsedTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    flex: 1,
    marginLeft: 8
  },
  actionBadgeRow: {
    marginBottom: 12
  },
  actionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12
  },
  saleBadge: {
    backgroundColor: '#E1F5FE'
  },
  purchaseBadge: {
    backgroundColor: '#FFF3E0'
  },
  queryBadge: {
    backgroundColor: '#EDE7F6'
  },
  actionBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827'
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10
  },
  detailBox: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280'
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    marginTop: 4
  },
  spokenPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    gap: 8
  },
  spokenPreviewText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D47A1',
    flex: 1
  },
  buttonActionRow: {
    marginTop: 8
  },
  cancelLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 6,
    gap: 6
  },
  cancelLinkText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#C62828'
  },
  successBox: {
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#A5D6A7',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1B5E20'
  },
  samplesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  samplesTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 12
  },
  samplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    gap: 6
  },
  sampleChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B5E20'
  },
  manualFallbackSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 8
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827'
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
