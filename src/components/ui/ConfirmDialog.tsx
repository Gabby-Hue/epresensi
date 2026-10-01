// E-Presensi UI · Modern Shadcn Confirm Dialog
// Clean hairline borders, soft overlay backdrop, accessible buttons.

import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, neoShadow, radius, spacing } from '../../theme';
import { tap } from '../../services/feedbackService';

interface ConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: keyof typeof Feather.glyphMap;
  variant?: 'danger' | 'primary';
  singleButton?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Ya, Keluar',
  cancelText = 'Batal',
  icon = 'log-out',
  variant = 'danger',
  singleButton = false,
}) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, neoShadow.lg]}>
              <View
                style={[
                  styles.iconBox,
                  variant === 'danger' ? styles.dangerIconBox : styles.primaryIconBox,
                ]}
              >
                <Feather
                  name={icon}
                  size={24}
                  color={variant === 'danger' ? colors.danger : colors.primary}
                />
              </View>

              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>

              <View style={styles.buttonRow}>
                {!singleButton && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      tap();
                      onClose();
                    }}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelText}>{cancelText}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    tap();
                    onClose();
                    onConfirm();
                  }}
                  style={[
                    styles.confirmBtn,
                    variant === 'danger' ? styles.dangerConfirmBtn : styles.primaryConfirmBtn,
                    singleButton && styles.singleConfirmBtn,
                  ]}
                >
                  <Text style={styles.confirmText}>{confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dangerIconBox: {
    backgroundColor: colors.dangerSoft,
  },
  primaryIconBox: {
    backgroundColor: colors.primarySoft,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  cancelText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.ink,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  singleConfirmBtn: {
    width: '100%',
  },
  dangerConfirmBtn: {
    backgroundColor: colors.danger,
  },
  primaryConfirmBtn: {
    backgroundColor: colors.primary,
  },
  confirmText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
