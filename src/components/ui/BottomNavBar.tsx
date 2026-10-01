// E-Presensi UI · Modern Shadcn Dock NavBar
// Crisp 1px hairline border, soft primary pill active state, haptic feedback.

import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { select } from '../../services/feedbackService';
import { colors, radius } from '../../theme';

export type UserTabKey = 'presensi' | 'kalender' | 'izin' | 'profil';

interface TabItem {
  key: UserTabKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

const TABS: TabItem[] = [
  { key: 'presensi', label: 'Presensi', icon: 'check-circle' },
  { key: 'kalender', label: 'Kalender', icon: 'calendar' },
  { key: 'izin', label: 'Pengajuan', icon: 'file-text' },
  { key: 'profil', label: 'Profil', icon: 'user' },
];

interface BottomNavBarProps {
  activeTab: UserTabKey;
  onTabChange: (tab: UserTabKey) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 8);

  const handlePress = (tabKey: UserTabKey) => {
    if (tabKey !== activeTab) {
      void select();
      onTabChange(tabKey);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <View style={styles.navRow}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => handlePress(tab.key)}
              style={styles.tabButton}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              <View style={[styles.tabContent, isActive && styles.tabContentActive]}>
                <Feather
                  name={tab.icon}
                  size={19}
                  color={isActive ? colors.primary : colors.muted}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: colors.ink,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 -2px 10px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  navRow: {
    flexDirection: 'row',
    height: 56,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    gap: 6,
  },
  tabContentActive: {
    backgroundColor: colors.primarySoft,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
});
