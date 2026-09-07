import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing } from '../../theme';

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
    <View style={[styles.card, style]}>
      {(title || action) && (
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            {title && (
              <View style={styles.titleRow}>
                {icon && <Feather name={icon} size={20} color={colors.ink} style={styles.titleIcon} />}
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
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    marginRight: 8,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.ink,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 4,
    lineHeight: 21,
  },
});
