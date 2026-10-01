// E-Presensi UI · Modern Shadcn Button
// Clean hairline borders, subtle ambient micro-shadow, and responsive tactile sound/vibration feedback.

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, neoShadow, radius, touch } from '../../theme';
import { tap } from '../../services/feedbackService';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  icon,
  loading = false,
  fullWidth = true,
  disabled,
  style,
  textColor,
  ...props
}) => {
  const palette = {
    primary: { bg: colors.primary, text: '#FFFFFF', border: colors.primary },
    secondary: { bg: colors.surfaceSoft, text: colors.ink, border: colors.border },
    outline: { bg: colors.surface, text: colors.ink, border: colors.borderStrong },
    danger: { bg: colors.danger, text: '#FFFFFF', border: colors.danger },
  }[variant];

  const effectiveTextColor = textColor || (disabled ? colors.faint : palette.text);
  const iconColor = textColor || (disabled ? colors.faint : palette.text);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || loading}
      style={[
        styles.button,
        !disabled && variant === 'primary' && neoShadow.sm,
        {
          backgroundColor: disabled ? colors.surfaceSoft : palette.bg,
          borderColor: disabled ? colors.border : palette.border,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...props}
      onPress={(e) => {
        tap();
        props.onPress?.(e);
      }}
    >
      {loading ? (
        <ActivityIndicator color={textColor || palette.text} size="small" />
      ) : (
        <>
          {icon && <Feather name={icon} size={16} color={iconColor} style={styles.icon} />}
          <Text style={[styles.text, { color: effectiveTextColor }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: touch.buttonMinHeight,
  },
  fullWidth: {
    width: '100%',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
