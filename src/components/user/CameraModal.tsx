// Hallmark Component · CameraModal (Viewfinder Verification)
// Anti-AI-slop: Authentic photographic viewfinder, zero cybernetic grids, locked tokens.

import React, { createElement, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '../ui/Button';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing } from '../../theme';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmPhoto: (photoUri: string) => void;
  attendanceTypeLabel: string;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  visible,
  onClose,
  onConfirmPhoto,
  attendanceTypeLabel,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [webStream, setWebStream] = useState<MediaStream | null>(null);
  const [webError, setWebError] = useState<string | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const videoNodeRef = useRef<HTMLVideoElement | null>(null);

  // Initialize Web Camera Stream when modal opens on Web
  useEffect(() => {
    if (visible && Platform.OS === 'web' && !capturedPhoto) {
      initWebCamera();
    } else {
      stopWebCamera();
    }

    return () => {
      stopWebCamera();
    };
  }, [visible, capturedPhoto]);

  const initWebCamera = async () => {
    setWebError(null);
    try {
      if (typeof window !== 'undefined' && navigator?.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        setWebStream(stream);

        if (videoNodeRef.current) {
          videoNodeRef.current.srcObject = stream;
          videoNodeRef.current.play().catch(() => {});
        }
      } else {
        setWebError('Peramban Anda tidak mendukung akses kamera.');
      }
    } catch (err: any) {
      setWebError('Gagal mengakses kamera: ' + (err.message || 'Izin kamera ditolak.'));
    }
  };

  const stopWebCamera = () => {
    if (webStream) {
      webStream.getTracks().forEach((track) => track.stop());
      setWebStream(null);
    }
  };

  const handleTakePicture = async () => {
    setCapturing(true);

    try {
      if (Platform.OS === 'web') {
        // Web Canvas Snapshot
        const video = videoNodeRef.current;
        if (video) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1); // Flip horizontally for natural selfie orientation
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setCapturedPhoto(dataUrl);
            stopWebCamera();
          }
        } else {
          setWebError('Kamera belum siap. Mohon tunggu...');
        }
      } else {
        // Native Expo Camera Snapshot
        if (cameraRef.current) {
          const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
          if (photo?.uri) {
            setCapturedPhoto(photo.uri);
          }
        }
      }
    } catch (e: any) {
      setWebError('Gagal mengambil potret: ' + e.message);
    } finally {
      setCapturing(false);
    }
  };

  const handleConfirm = () => {
    if (capturedPhoto) {
      onConfirmPhoto(capturedPhoto);
      setCapturedPhoto(null);
      stopWebCamera();
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    if (Platform.OS === 'web') {
      setTimeout(initWebCamera, 250);
    }
  };

  const handleCloseModal = () => {
    stopWebCamera();
    setCapturedPhoto(null);
    onClose();
  };

  // Helper renderer for Web Video Element in React Native Web
  const renderWebVideo = () => {
    return (
      <View style={styles.webCameraContainer}>
        {webError ? (
          <View style={styles.webErrorBox}>
            <Feather name="alert-triangle" size={32} color={colors.danger} />
            <Text style={styles.webErrorTitle}>Akses Kamera Ditutup</Text>
            <Text style={styles.webErrorText}>{webError}</Text>
            <Button
              title="Aktifkan Kamera"
              variant="primary"
              onPress={initWebCamera}
              style={{ marginTop: 14 }}
            />
          </View>
        ) : (
          <View style={styles.videoWrapper}>
            {createElement('video', {
              ref: (node: HTMLVideoElement | null) => {
                videoNodeRef.current = node;
                if (node && webStream && node.srcObject !== webStream) {
                  node.srcObject = webStream;
                  node.play().catch(() => {});
                }
              },
              autoPlay: true,
              playsInline: true,
              muted: true,
              style: {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // Mirror feed
              },
            })}
            <View style={styles.targetGuideOverlay}>
              <View style={styles.targetCircle} />
              <Text style={styles.targetGuideText}>Posisikan wajah Anda di dalam panduan</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCloseModal}>
      <SafeAreaView style={styles.container}>
        {/* Minimalist Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCloseModal} style={styles.closeBtn} accessibilityLabel="Tutup Kamera">
            <Feather name="x" size={20} color={colors.ink} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Verifikasi Swafoto</Text>
            <Text style={styles.headerSub}>{attendanceTypeLabel}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Captured Photo Validation vs Live Camera Stream */}
        {capturedPhoto ? (
          <View style={styles.previewContainer}>
            <View style={styles.validationBanner}>
              <Feather name="check-circle" size={18} color={colors.successInk} style={{ marginRight: 8 }} />
              <Text style={styles.validationText}>
                Foto berhasil diambil. Periksa kejelasan sebelum konfirmasi.
              </Text>
            </View>

            <View style={styles.photoFrame}>
              <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
            </View>

            <View style={styles.actionRow}>
              <Button
                title="Ambil Ulang"
                variant="outline"
                icon="refresh-cw"
                onPress={handleRetake}
                style={{ flex: 1, marginRight: 6 }}
              />
              <Button
                title="Konfirmasi"
                variant="primary"
                icon="check"
                onPress={handleConfirm}
                style={{ flex: 1, marginLeft: 6 }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.cameraViewArea}>
            {Platform.OS === 'web' ? (
              renderWebVideo()
            ) : !permission?.granted ? (
              <View style={styles.permissionBox}>
                <Feather name="camera-off" size={36} color={colors.faint} />
                <Text style={styles.permText}>Izin Kamera Diperlukan</Text>
                <Text style={styles.permSubText}>
                  Aplikasi membutuhkan akses kamera untuk mengambil foto bukti presensi langsung.
                </Text>
                <Button
                  title="Izinkan Akses Kamera"
                  onPress={requestPermission}
                  style={{ marginTop: 14 }}
                />
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <CameraView style={styles.nativeCamera} facing="front" ref={cameraRef}>
                  <View style={styles.targetGuideOverlay}>
                    <View style={styles.targetCircle} />
                    <Text style={styles.targetGuideText}>Posisikan wajah Anda di dalam panduan</Text>
                  </View>
                </CameraView>
              </View>
            )}

            {/* Bottom Camera Snap Controls */}
            <View style={styles.bottomControls}>
              <View style={{ width: 44 }} />

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleTakePicture}
                disabled={capturing}
                style={styles.snapBtn}
                accessibilityLabel="Ambil Foto"
              >
                <View style={styles.snapInnerCircle} />
              </TouchableOpacity>

              <View style={{ width: 44 }} />
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: '500',
    marginTop: 1,
  },
  previewContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  validationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: radius.md,
    width: '100%',
  },
  validationText: {
    fontSize: fontSize.sm,
    color: colors.successInk,
    fontWeight: '600',
    flex: 1,
  },
  photoFrame: {
    width: 240,
    height: 320,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cameraViewArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  webCameraContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.surfaceSoft,
  },
  webErrorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  webErrorTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 12,
  },
  webErrorText: {
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  nativeCamera: {
    flex: 1,
  },
  targetGuideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  targetCircle: {
    width: 220,
    height: 300,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  targetGuideText: {
    color: colors.ink,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  bottomControls: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  snapBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  snapInnerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  permText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 14,
  },
  permSubText: {
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
});
