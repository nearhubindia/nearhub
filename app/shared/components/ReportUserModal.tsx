import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpamDetection, type ReportReason } from '@/lib/use-spam-detection';
import { colors } from '@/constants/colors';

interface ReportUserModalProps {
  visible: boolean;
  reportedUserId: string;
  reporterUserId: string;
  listingId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const REPORT_REASONS: { id: ReportReason; label: string; description: string }[] = [
  {
    id: 'spam',
    label: '🚨 Spam',
    description: 'Irrelevant or repetitive content',
  },
  {
    id: 'scam',
    label: '🔓 Scam/Fraud',
    description: 'Suspicious or fraudulent activity',
  },
  {
    id: 'harassment',
    label: '😠 Harassment',
    description: 'Abusive, rude, or threatening language',
  },
  {
    id: 'inappropriate',
    label: '⚠️ Inappropriate',
    description: 'Explicit or offensive content',
  },
  {
    id: 'other',
    label: '❓ Other',
    description: 'Something else',
  },
];

export const ReportUserModal: React.FC<ReportUserModalProps> = ({
  visible,
  reportedUserId,
  reporterUserId,
  listingId,
  onClose,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  const { reportUser, error, loading } = useSpamDetection();

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    if (description.trim().length < 10) {
      Alert.alert('Error', 'Please provide at least 10 characters of detail');
      return;
    }

    setSubmitting(true);

    try {
      await reportUser(
        reportedUserId,
        reporterUserId,
        selectedReason,
        description.trim(),
        listingId
      );

      Alert.alert('Success', 'User reported successfully. Our team will review this shortly.', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedReason(null);
            setDescription('');
            onClose();
            onSuccess?.();
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to report user. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={submitting || loading}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Report User</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Description */}
          <Text style={styles.sectionTitle}>Why are you reporting this user?</Text>
          <Text style={styles.sectionDescription}>
            Help us keep our community safe. Report spam, scams, harassment, and inappropriate
            behavior.
          </Text>

          {/* Reasons */}
          <View style={styles.reasonsList}>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonItem,
                  selectedReason === reason.id && styles.reasonItemSelected,
                ]}
                onPress={() => setSelectedReason(reason.id)}
                disabled={submitting || loading}
              >
                <View style={styles.reasonContent}>
                  <Text style={styles.reasonLabel}>{reason.label}</Text>
                  <Text style={styles.reasonDesc}>{reason.description}</Text>
                </View>
                <View
                  style={[styles.checkbox, selectedReason === reason.id && styles.checkboxChecked]}
                >
                  {selectedReason === reason.id && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Details */}
          <Text style={styles.sectionTitle}>Additional Details</Text>
          <Text style={styles.sectionDescription}>
            Provide details to help us understand the issue better (minimum 10 characters).
          </Text>

          <TextInput
            style={styles.detailsInput}
            placeholder="Describe what happened..."
            placeholderTextColor={colors.text_secondary}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            editable={!submitting && !loading}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
          />

          <Text style={styles.charCount}>{description.length}/500 characters</Text>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedReason || description.trim().length < 10 || submitting || loading) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedReason || description.trim().length < 10 || submitting || loading}
          >
            {submitting || loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <Text style={styles.footerNote}>
            False reports may result in account restrictions. All reports are reviewed by our team.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg_secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    fontSize: 24,
    color: colors.text_primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text_primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text_primary,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.text_secondary,
    marginBottom: 16,
  },
  reasonsList: {
    marginBottom: 24,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg_primary,
  },
  reasonItemSelected: {
    borderColor: colors.primary,
    backgroundColor: '#f0f7ff',
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text_primary,
    marginBottom: 4,
  },
  reasonDesc: {
    fontSize: 13,
    color: colors.text_secondary,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkboxChecked: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkmark: {
    color: '#fff',
    fontWeight: '600',
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text_primary,
    backgroundColor: colors.bg_primary,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: colors.text_secondary,
    textAlign: 'right',
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#fee',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 12,
    color: colors.text_secondary,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
});
