// E-Presensi UI · User Profile Screen
// Clean circular avatar with camera/gallery image picker, refined layout, and device info.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { UserProfile } from '../../types/attendance';
import { getDeviceInfo } from '../../services/deviceService';
import { StorageService } from '../../services/storageService';
import { AttendanceService } from '../../services/attendanceService';
import { succeed, fail, select, tap } from '../../services/feedbackService';
import { colors, fontSize, radius, spacing } from '../../theme';
import { CameraModal } from './CameraModal';

interface ProfileScreenProps {
  user: UserProfile;
  onBack: () => void;
  onLogout?: () => void;
  onUpdateUser?: (updated: UserProfile) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  onBack,
  onLogout,
  onUpdateUser,
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [photoPickerModal, setPhotoPickerModal] = useState(false);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);

  const isAdminRole = user.role === 'admin' || user.role === 'superadmin';
  const [deviceModel, setDeviceModel] = useState<string>(
    isAdminRole ? 'Bebas Perangkat (Multi-Device)' : (user.deviceModel || 'Belum terkunci')
  );
  const [deviceId, setDeviceId] = useState<string>(isAdminRole ? '-' : (user.deviceId || '-'));
  const [deviceNote, setDeviceNote] = useState<string>(
    isAdminRole
      ? 'Akun Admin/Superadmin tidak dikunci perangkat: bebas masuk dari PC, laptop, atau HP mana pun.'
      : user.deviceModel || user.deviceId
        ? 'Perangkat resmi: akun terkunci di perangkat ini.'
        : 'Belum ada perangkat terkunci.'
  );

  useEffect(() => {
    let isMounted = true;
    if (isAdminRole) {
      setDeviceModel('Bebas Perangkat (Multi-Device)');
      setDeviceId('-');
      setDeviceNote('Akun Admin/Superadmin tidak dikunci perangkat: bebas masuk dari PC, laptop, atau HP mana pun.');
      return;
    }

    if (user.deviceModel || user.deviceId) {
      setDeviceModel(user.deviceModel || '-');
      setDeviceId(user.deviceId || '-');
      setDeviceNote('Perangkat resmi: akun terkunci di perangkat ini.');
      return () => {
        isMounted = false;
      };
    }

    getDeviceInfo().then((info) => {
      if (isMounted) {
        setDeviceModel(info.modelName);
        setDeviceId(info.deviceId);
        setDeviceNote('Belum terkunci: HP ini dikunci otomatis saat login berikutnya.');
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Otomatis kompres/resize foto di web agar ringan (< 200KB) dan tidak pernah error 500
  const prepareAvatar = async (uri: string): Promise<string> => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return uri;
    return new Promise((resolve) => {
      const img = new (window as any).Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const maxDim = 512;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(uri);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    });
  };

  const handlePickFromCamera = () => {
    setPhotoPickerModal(false);
    setCameraModalVisible(true);
  };

  const handlePickFromGallery = async () => {
    setPhotoPickerModal(false);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const compactUri = await prepareAvatar(res.assets[0].uri);
        await uploadAndSaveAvatar(compactUri);
      }
    } catch (e: any) {
      fail();
      Alert.alert('Gagal', e?.message || 'Tidak dapat memilih foto dari galeri.');
    }
  };

  const uploadAndSaveAvatar = async (uri: string) => {
    setUploadingAvatar(true);
    try {
      // 1. Upload ke server Express /uploads/avatar
      const publicUrl = await StorageService.uploadAvatar(user.id, uri);

      // 2. Simpan ke database user
      const res = await AttendanceService.updateAvatar(user.id, publicUrl);
      if (!res.success) {
        throw new Error(res.message || 'Gagal menyimpan foto ke database.');
      }

      setAvatarUrl(publicUrl);
      if (res.user) {
        onUpdateUser?.(res.user);
      }
      succeed();
      Alert.alert('Berhasil', 'Foto profil Anda berhasil diperbarui.');
    } catch (e: any) {
      fail();
      Alert.alert('Gagal Unggah', e?.message || 'Terjadi kesalahan saat mengunggah foto.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const departmentName = user.department || 'General';

  const initials = user.fullName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Navigation Bar */}
      <View style={styles.topNav}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Profil Pengguna</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.contentWrapper}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          {/* Avatar Section — 100% Bulat Sempurna */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={uploadingAvatar}
                onPress={() => {
                  tap();
                  setPhotoPickerModal(true);
                }}
                style={styles.avatarCircle}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}

                {uploadingAvatar && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Edit Camera Button Badge */}
              <TouchableOpacity
                activeOpacity={0.8}
                disabled={uploadingAvatar}
                onPress={() => {
                  tap();
                  setPhotoPickerModal(true);
                }}
                style={styles.cameraBadge}
              >
                <Feather name="camera" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.userNameText}>{user.fullName}</Text>
            <Text style={styles.userRoleText}>
              {user.role === 'superadmin' ? 'Superadmin' : user.role === 'admin' ? 'Administrator' : departmentName}
            </Text>
          </View>

          {/* User Details Information Cards */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Feather name="mail" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoLabel}>Email Kantor</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Feather name="briefcase" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoLabel}>Departemen</Text>
                <Text style={styles.infoValue}>{departmentName}</Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Feather name="smartphone" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoLabel}>Model Perangkat</Text>
                <Text style={styles.infoValue}>{deviceModel}</Text>
                <Text style={styles.infoSubNote}>{deviceNote}</Text>
              </View>
            </View>

            <View style={styles.rowDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Feather name="cpu" size={18} color={colors.primary} />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoLabel}>ID Perangkat</Text>
                <Text style={styles.infoValue}>{deviceId}</Text>
              </View>
            </View>
          </View>

          {/* Tombol Logout Akun */}
          {onLogout && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onLogout}
              style={styles.logoutBtn}
            >
              <Feather name="log-out" size={18} color={colors.danger} style={{ marginRight: 8 }} />
              <Text style={styles.logoutBtnText}>Keluar dari Akun</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Modal Dialog Pilihan Foto: Kamera atau Galeri */}
      <Modal
        visible={photoPickerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPhotoPickerModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPhotoPickerModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>Ubah Foto Profil</Text>
                <Text style={styles.modalSubtitle}>Pilih sumber foto yang ingin digunakan</Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handlePickFromCamera}
                  style={styles.modalOptionBtn}
                >
                  <View style={styles.modalOptionIconBox}>
                    <Feather name="camera" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.modalOptionTextWrap}>
                    <Text style={styles.modalOptionTitle}>Ambil Foto Sendiri</Text>
                    <Text style={styles.modalOptionSub}>Gunakan kamera perangkat langsung</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handlePickFromGallery}
                  style={styles.modalOptionBtn}
                >
                  <View style={styles.modalOptionIconBox}>
                    <Feather name="image" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.modalOptionTextWrap}>
                    <Text style={styles.modalOptionTitle}>Pilih dari Galeri</Text>
                    <Text style={styles.modalOptionSub}>Ambil foto dari penyimpanan album</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setPhotoPickerModal(false)}
                  style={styles.modalCancelBtn}
                >
                  <Text style={styles.modalCancelText}>Batal</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal Kamera Swafoto Langsung (Webcam / Native Camera) */}
      <CameraModal
        visible={cameraModalVisible}
        onClose={() => setCameraModalVisible(false)}
        onConfirmPhoto={async (photoUri) => {
          setCameraModalVisible(false);
          await uploadAndSaveAvatar(photoUri);
        }}
        attendanceTypeLabel="Foto Profil"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  // 100% Bulat Sempurna
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.primaryBorder,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: '700',
    color: colors.primary,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 52,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: { elevation: 3 },
      web: { boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)' },
    }),
  },
  userNameText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  userRoleText: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  infoSubNote: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
    lineHeight: 16,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.borderMuted,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: radius.lg,
    paddingVertical: 13,
    marginTop: 8,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  // Modal Sheet Pilihan Foto
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  modalOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  modalOptionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  modalOptionTextWrap: {
    flex: 1,
  },
  modalOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  modalOptionSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  modalCancelBtn: {
    marginTop: spacing.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radius.md,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
});
