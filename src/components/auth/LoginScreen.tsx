import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AttendanceService } from '../../services/attendanceService';
import { UserProfile } from '../../types/attendance';
import { Button } from '../ui/Button';
import { colors, fontSize, radius, spacing } from '../../theme';

interface LoginScreenProps {
  onLoginSuccess: (user?: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Isi email dan kata sandi dulu, lalu tekan Masuk.');
      return;
    }

    setLoading(true);
    const { user, error } = await AttendanceService.signInWithEmail(email, password);
    setLoading(false);

    if (user) {
      onLoginSuccess(user);
      return;
    }

    setErrorMessage(error || 'Gagal masuk. Periksa kembali email dan kata sandi.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Feather name="check-square" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>E-Presensi</Text>
            <Text style={styles.subtitle}>Absensi karyawan yang mudah dipakai</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Masuk</Text>
            <Text style={styles.cardHint}>Gunakan email dan kata sandi dari kantor.</Text>

            {errorMessage && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={18} color={colors.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Feather name="mail" size={18} color={colors.faint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="nama@kantor.com"
                  placeholderTextColor={colors.faint}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Kata sandi</Text>
              <View style={styles.inputRow}>
                <Feather name="lock" size={18} color={colors.faint} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Kata sandi"
                  placeholderTextColor={colors.faint}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  hitSlop={12}
                >
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
                </TouchableOpacity>
              </View>
            </View>

            <Button
              title={loading ? 'Sedang masuk...' : 'Masuk'}
              icon="log-in"
              loading={loading}
              onPress={handleLogin}
              style={styles.loginBtn}
            />

            <Text style={styles.help}>
              Lupa kata sandi atau belum punya akun?{'\n'}Hubungi bagian admin kantor.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  cardHint: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 4,
    marginBottom: spacing.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.danger,
    fontWeight: '600',
    lineHeight: 22,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FBFE',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 54,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.ink,
    paddingVertical: 14,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    textAlignVertical: 'center',
  },
  eyeBtn: {
    padding: 8,
    marginLeft: spacing.xs,
  },
  loginBtn: {
    marginTop: spacing.sm,
  },
  help: {
    fontSize: fontSize.xs,
    color: colors.muted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
});
