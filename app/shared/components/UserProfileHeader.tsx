import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { colors } from '@/constants/colors';
import { ReportUserModal } from './ReportUserModal';
import { useSpamDetection } from '@/lib/use-spam-detection';

interface UserProfileHeaderProps {
  userId: string;
  userName: string;
  userImage?: string;
  currentUserId: string; // Logged in user's ID
  rating?: number;
  listings?: number;
  responseTime?: string;
}

/**
 * Example integration: User profile header with report button
 */
export const UserProfileHeader: React.FC<UserProfileHeaderProps> = ({
  userId,
  userName,
  userImage,
  currentUserId,
  rating = 4.8,
  listings = 12,
  responseTime = '2 hours',
}) => {
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [spamProfile, setSpamProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const { getUserSpamProfile, isUserBlocked } = useSpamDetection();

  // Load user spam profile on mount
  useEffect(() => {
    loadSpamProfile();
  }, [userId]);

  const loadSpamProfile = async () => {
    setLoadingProfile(true);

    try {
      const profile = await getUserSpamProfile(userId);
      setSpamProfile(profile);

      // Show warning if user is blocked or has high spam score
      if (profile.isBlocked) {
        Alert.alert(
          '⚠️ Warning',
          'This user account has been blocked due to suspicious activity. Proceed with caution.',
          [{ text: 'OK' }]
        );
      } else if (profile.spamScore >= 70) {
        Alert.alert(
          '⚠️ High Risk',
          `This user has ${profile.totalReports} reports. Consider this when trading.`,
          [{ text: 'I Understand' }]
        );
      }
    } catch (err) {
      console.error('Failed to load spam profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleOpenReport = () => {
    // Verify user not reporting themselves
    if (userId === currentUserId) {
      Alert.alert('Error', 'You cannot report yourself');
      return;
    }

    setReportModalVisible(true);
  };

  const getSpamScoreBadge = () => {
    if (!spamProfile) return null;

    const score = spamProfile.spamScore;

    if (spamProfile.isBlocked) {
      return {
        color: colors.danger,
        text: '🔒 BLOCKED',
        bgColor: '#fee',
      };
    }

    if (score >= 70) {
      return {
        color: colors.danger,
        text: '⚠️ HIGH RISK',
        bgColor: '#fee',
      };
    }

    if (score >= 40) {
      return {
        color: '#ff9800',
        text: '⚠️ CAUTION',
        bgColor: '#fff3e0',
      };
    }

    return null;
  };

  const badge = getSpamScoreBadge();

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        {/* Avatar Placeholder */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName[0]?.toUpperCase() || 'U'}</Text>
        </View>

        {/* Profile Info */}
        <View style={styles.profileInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{userName}</Text>
            {loadingProfile ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
            ) : null}
          </View>

          {badge && (
            <View
              style={[
                styles.spamBadge,
                { backgroundColor: badge.bgColor, borderColor: badge.color },
              ]}
            >
              <Text style={[styles.spamBadgeText, { color: badge.color }]}>{badge.text}</Text>
            </View>
          )}

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{rating}</Text>
              <Text style={styles.statLabel}>★ Rating</Text>
            </View>

            <View style={styles.stat}>
              <Text style={styles.statValue}>{listings}</Text>
              <Text style={styles.statLabel}>Listings</Text>
            </View>

            <View style={styles.stat}>
              <Text style={styles.statValue}>{responseTime}</Text>
              <Text style={styles.statLabel}>Response</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.button, styles.messageButton]}>
          <Text style={styles.messageButtonText}>💬 Message</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.reportButton,
            spamProfile?.isBlocked && styles.reportButtonDisabled,
          ]}
          onPress={handleOpenReport}
          disabled={spamProfile?.isBlocked}
        >
          <Text style={styles.reportButtonText}>🚩 Report</Text>
        </TouchableOpacity>
      </View>

      {/* Spam Details (if score is visible) */}
      {spamProfile && spamProfile.totalReports > 0 && (
        <View style={styles.spamDetails}>
          <Text style={styles.spamDetailsTitle}>Report Summary</Text>
          <View style={styles.spamStats}>
            <View style={styles.spamStat}>
              <Text style={styles.spamStatValue}>{spamProfile.totalReports}</Text>
              <Text style={styles.spamStatLabel}>Reports</Text>
            </View>

            <View style={styles.spamStat}>
              <Text style={styles.spamStatValue}>{Math.round(spamProfile.spamScore)}</Text>
              <Text style={styles.spamStatLabel}>Risk Score</Text>
            </View>

            {spamProfile.lastReportDate && (
              <View style={styles.spamStat}>
                <Text style={styles.spamStatValue}>
                  {new Date(spamProfile.lastReportDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.spamStatLabel}>Last Report</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Report Modal */}
      <ReportUserModal
        visible={reportModalVisible}
        reportedUserId={userId}
        reporterUserId={currentUserId}
        onClose={() => setReportModalVisible(false)}
        onSuccess={() => {
          // Refresh spam profile after successful report
          loadSpamProfile();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg_primary,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileSection: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text_primary,
  },
  loader: {
    marginLeft: 8,
  },
  spamBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 8,
  },
  spamBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text_primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text_secondary,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  messageButton: {
    backgroundColor: colors.primary,
  },
  messageButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  reportButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportButtonDisabled: {
    opacity: 0.5,
  },
  reportButtonText: {
    color: colors.text_primary,
    fontWeight: '600',
    fontSize: 13,
  },
  spamDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  spamDetailsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text_secondary,
    marginBottom: 8,
  },
  spamStats: {
    flexDirection: 'row',
    gap: 16,
  },
  spamStat: {
    alignItems: 'center',
    flex: 1,
  },
  spamStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  spamStatLabel: {
    fontSize: 11,
    color: colors.text_secondary,
    marginTop: 2,
  },
});
