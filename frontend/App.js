import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, TouchableOpacity, Text, StatusBar, Platform, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME } from './src/constants/theme';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { SyncProvider } from './src/context/SyncContext';
import { LocalDB } from './src/db/localDb';

// Import Screens
import { HomeScreen } from './src/screens/HomeScreen';
import { VoiceEntryScreen } from './src/screens/VoiceEntryScreen';
import { PurchasesScreen } from './src/screens/PurchasesScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SmartPricingScreen } from './src/screens/SmartPricingScreen';
import { WhereToBuyScreen } from './src/screens/WhereToBuyScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { DailySalesEntryScreen } from './src/screens/DailySalesEntryScreen';
import { DailyReportModal } from './src/screens/DailyReportModal';

const MainNavigator = () => {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [isOnboarded, setIsOnboarded] = useState(null); // null = checking, false = show onboarding, true = main app
  const [reportModalData, setReportModalData] = useState(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const { t, language } = useLanguage();

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const completed = await LocalDB.getOnboardingCompleted();
      setIsOnboarded(completed);
    } catch (e) {
      setIsOnboarded(true); // default to true if check fails to prevent softlock
    }
  };

  const handleOnboardingComplete = () => {
    setIsOnboarded(true);
    setCurrentScreen('home');
  };

  const handleReportGenerated = (report) => {
    setReportModalData(report);
    setReportModalVisible(true);
  };

  if (isOnboarded === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.colors.primary} />
      </View>
    );
  }

  // First-time vendor onboarding view
  if (isOnboarded === false) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.colors.primary} />
        <OnboardingScreen onComplete={handleOnboardingComplete} isEditMode={false} />
      </SafeAreaView>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={setCurrentScreen} />;
      case 'dailySalesEntry':
        return (
          <DailySalesEntryScreen
            onNavigate={setCurrentScreen}
            onReportGenerated={handleReportGenerated}
          />
        );
      case 'onboarding_edit':
        return (
          <OnboardingScreen
            onComplete={() => setCurrentScreen('settings')}
            isEditMode={true}
          />
        );
      case 'voice':
        return <VoiceEntryScreen onNavigate={setCurrentScreen} />;
      case 'purchases':
        return <PurchasesScreen onNavigate={setCurrentScreen} />;
      case 'reports':
        return <ReportsScreen onNavigate={setCurrentScreen} />;
      case 'pricing':
        return <SmartPricingScreen onNavigate={setCurrentScreen} />;
      case 'whereToBuy':
        return <WhereToBuyScreen onNavigate={setCurrentScreen} />;
      case 'settings':
        return <SettingsScreen onNavigate={setCurrentScreen} />;
      default:
        return <HomeScreen onNavigate={setCurrentScreen} />;
    }
  };

  const navItems = [
    { key: 'home', labelEn: 'Home', labelTa: 'முகப்பு', icon: 'home' },
    { key: 'dailySalesEntry', labelEn: 'Daily', labelTa: 'பதிவு', icon: 'clipboard-text-clock' },
    { key: 'voice', labelEn: 'Voice', labelTa: 'குரல்', icon: 'microphone', isHero: true },
    { key: 'pricing', labelEn: 'Price', labelTa: 'விலை', icon: 'tag-outline' },
    { key: 'reports', labelEn: 'Profit', labelTa: 'லாபம்', icon: 'chart-bar' },
    { key: 'settings', labelEn: 'Settings', labelTa: 'அமைப்பு', icon: 'cog-outline' }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.primary} />

      {/* SCREEN CONTAINER */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* ACCESSIBLE BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNav}>
        {navItems.map((item) => {
          const isActive = currentScreen === item.key;
          const label = language === 'ta' ? item.labelTa : item.labelEn;

          if (item.isHero) {
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setCurrentScreen(item.key)}
                style={styles.heroNavBtn}
                activeOpacity={0.8}
              >
                <View style={styles.heroNavInner}>
                  <MaterialCommunityIcons name="microphone" size={28} color="#FFFFFF" />
                </View>
                <Text style={styles.heroNavLabel} numberOfLines={1}>{label}</Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setCurrentScreen(item.key)}
              style={styles.navBtn}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={item.icon}
                size={23}
                color={isActive ? THEME.colors.primary : '#6B7280'}
              />
              <Text
                style={[
                  styles.navLabel,
                  isActive && styles.navLabelActive
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* AUTOMATIC DAILY REPORT MODAL */}
      <DailyReportModal
        visible={reportModalVisible}
        reportData={reportModalData}
        onClose={() => setReportModalVisible(false)}
        onRevisitReports={() => setCurrentScreen('reports')}
      />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <SyncProvider>
        <MainNavigator />
      </SyncProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.primary,
    ...Platform.select({
      web: {
        height: '100vh',
        width: '100%',
        maxWidth: 500,
        marginHorizontal: 'auto',
        boxShadow: '0 0 20px rgba(0,0,0,0.15)'
      }
    })
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.colors.bg
  },
  screenContainer: {
    flex: 1,
    backgroundColor: THEME.colors.bg
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.5,
    borderTopColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 2,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4
  },
  navBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    flex: 1,
    minHeight: 46
  },
  navLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center'
  },
  navLabelActive: {
    color: THEME.colors.primary,
    fontWeight: '900'
  },
  heroNavBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    flex: 1.1
  },
  heroNavInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: '#FFFFFF'
  },
  heroNavLabel: {
    fontSize: 10.5,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginTop: 2,
    textAlign: 'center'
  }
});
