// E-Presensi UI · Modern Shadcn Card
// Crisp hairline border, soft ambient shadow, structured header.

import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, neoShadow, radius, spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ children, title, subtitle, action, icon, style }) => {
  return (
    <View style={[styles.card, neoShadow.sm, style]}>
      {(title || action) && (
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            {title && (
              <View style={styles.titleRow}>
                {icon && (
                  <View style={styles.iconBox}>
                    <Feather name={icon} size={15} color={colors.primary} />
                  </View>
                )}
                <Text style={styles.title}>{title}</Text>
              </View>
            )}
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>
          {action && <View>{action}</View>}
        </View>
      )}
      <View>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  titleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 18,
    fontWeight: '500',
  },
});
