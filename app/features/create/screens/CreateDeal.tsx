import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { createResponsiveStyles } from '@/lib/responsive';
import { Listing } from '@/lib/types';
import { useAuth } from '@/shared/contexts/auth-context';
import { useListings } from '@/shared/contexts/listings-context';
import { LinearGradient } from 'expo-linear-gradient';

type DealType = 'normal' | 'combo';
type DealRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
type PurchaseLimitType = 'ONE_TIME' | 'UNLIMITED';
type PostDealMode = 'original' | 'discount';

const formatDealTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unavailable';
  }

  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const padTwo = (value: number) => String(value).padStart(2, '0');

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;

const toTimeInputValue = (date: Date) => `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;

const parseLocalDateTime = (dateValue: string, timeValue: string): Date | null => {
  const dateMatch = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeValue.trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day ||
    candidate.getHours() !== hour ||
    candidate.getMinutes() !== minute
  ) {
    return null;
  }

  return candidate;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const parseSourceIds = (rawValue: string | string[] | undefined): string[] => {
  if (Array.isArray(rawValue)) {
    return rawValue
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return String(rawValue || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export default function CreateDealScreen() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const authRedirect = pathname && pathname !== '/auth/register' ? pathname : '';
  const params = useLocalSearchParams<{
    dealType?: DealType;
    sourceListings?: string | string[];
  }>();
  const { user, isAuthenticated } = useAuth();
  const { listings, updateListing, refreshListings } = useListings();
  const [dealType, setDealType] = useState<DealType>(
    params.dealType === 'combo' ? 'combo' : 'normal'
  );
  const [offerPrice, setOfferPrice] = useState('');
  const [dealStartDate, setDealStartDate] = useState(() => toDateInputValue(new Date()));
  const [dealStartTime, setDealStartTime] = useState(() => toTimeInputValue(new Date()));
  const [dealEndDate, setDealEndDate] = useState(() => toDateInputValue(addDays(new Date(), 7)));
  const [dealEndTime, setDealEndTime] = useState(() => toTimeInputValue(new Date()));
  const [dealRecurrence, setDealRecurrence] = useState<DealRecurrence>('none');
  const [dealRecurrenceUntilDays, setDealRecurrenceUntilDays] = useState('30');
  const [dealCycleQuantity, setDealCycleQuantity] = useState('1');
  const [maxDealBookings, setMaxDealBookings] = useState('10');
  const [purchaseLimitType, setPurchaseLimitType] = useState<PurchaseLimitType>('ONE_TIME');
  const [postDealPriceMode, setPostDealPriceMode] = useState<PostDealMode>('original');
  const [postDealDiscountPrice, setPostDealDiscountPrice] = useState('');
  const [dealTerms, setDealTerms] = useState('');
  const [voucherEnabled, setVoucherEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUserId = String(user?.id || '').trim();
  const ownedListings = useMemo(
    () => listings.filter((item) => String(item.userId || '').trim() === normalizedUserId),
    [listings, normalizedUserId]
  );
  const selectedIds = useMemo(() => parseSourceIds(params.sourceListings), [params.sourceListings]);
  const selectedListings = useMemo(
    () =>
      selectedIds
        .map((id) => ownedListings.find((item) => item.id === id))
        .filter(Boolean) as Listing[],
    [ownedListings, selectedIds]
  );
  const primaryListing = selectedListings[0];
  const dealStartAt = useMemo(
    () => parseLocalDateTime(dealStartDate, dealStartTime)?.toISOString() || '',
    [dealStartDate, dealStartTime]
  );
  const dealEndAt = useMemo(
    () => parseLocalDateTime(dealEndDate, dealEndTime)?.toISOString() || '',
    [dealEndDate, dealEndTime]
  );
  const comboItems = useMemo(() => {
    if (dealType !== 'combo') return undefined;
    return selectedListings.map((item) => item.title.trim()).filter(Boolean);
  }, [dealType, selectedListings]);

  const chooseListings = () => {
    router.push({
      pathname: '/my-listings',
      params: {
        picker: 'deal',
        dealType,
        selected: selectedIds.join(','),
      },
    });
  };

  const validate = () => {
    if (!primaryListing) {
      Alert.alert('Choose listing', 'Select a listing before creating a deal.');
      return false;
    }
    if (dealType === 'combo' && selectedListings.length < 2) {
      Alert.alert('Choose combo items', 'Select two listings to create a combo deal.');
      return false;
    }
    if (!offerPrice.trim() || Number(offerPrice) <= 0) {
      Alert.alert('Missing deal price', 'Enter the deal price buyers will pay.');
      return false;
    }
    if (Number(offerPrice) >= Number(primaryListing.price || 0)) {
      Alert.alert(
        'Invalid deal price',
        'Deal price must be lower than the original listing price.'
      );
      return false;
    }
    if (postDealPriceMode === 'discount') {
      if (!postDealDiscountPrice.trim() || Number(postDealDiscountPrice) <= 0) {
        Alert.alert(
          'Missing post-deal price',
          'Enter the price that should remain after the deal ends.'
        );
        return false;
      }
      if (Number(postDealDiscountPrice) >= Number(primaryListing.price || 0)) {
        Alert.alert(
          'Invalid post-deal price',
          'Post-deal price must stay below the original listing price.'
        );
        return false;
      }
    }
    if (!purchaseLimitType) {
      Alert.alert('Select purchase limit', 'Choose whether buyers can book once or unlimited.');
      return false;
    }
    if (!dealStartAt) {
      Alert.alert('Missing start time', 'Enter a valid deal start date and time.');
      return false;
    }
    if (!dealEndAt) {
      Alert.alert('Missing end time', 'Enter a valid deal end date and time.');
      return false;
    }

    const startAtMs = new Date(dealStartAt).getTime();
    const endAtMs = new Date(dealEndAt).getTime();
    const nowMs = Date.now();

    if (!Number.isFinite(startAtMs)) {
      Alert.alert('Missing start time', 'Enter a valid deal start date and time.');
      return false;
    }
    if (!Number.isFinite(endAtMs)) {
      Alert.alert('Missing end time', 'Enter a valid deal end date and time.');
      return false;
    }
    if (startAtMs <= nowMs) {
      Alert.alert('Invalid start time', 'Deal start time must be in the future.');
      return false;
    }
    if (endAtMs <= nowMs) {
      Alert.alert('Invalid end time', 'Deal end time must be in the future.');
      return false;
    }
    if (endAtMs <= startAtMs) {
      Alert.alert('Invalid end time', 'Deal end time must be after the start time.');
      return false;
    }
    return true;
  };

  const submitDeal = async () => {
    if (!validate() || !primaryListing) return;

    setIsSubmitting(true);
    try {
      await updateListing(primaryListing.id, {
        isDeal: true,
        dealType,
        offerPrice: Number(offerPrice),
        dealStartAt,
        dealEndAt,
        dealRecurrence,
        dealRecurrenceUntil:
          dealRecurrence !== 'none'
            ? addDays(
                new Date(dealEndAt || dealStartAt || Date.now()),
                Number(dealRecurrenceUntilDays) || 30
              ).toISOString()
            : undefined,
        dealCycleQuantity: dealRecurrence !== 'none' ? Number(dealCycleQuantity) || 1 : undefined,
        maxDealBookings: Number(maxDealBookings) || 10,
        purchaseLimitType,
        postDealPriceMode,
        postDealDiscountPrice:
          postDealPriceMode === 'discount' ? Number(postDealDiscountPrice) || undefined : undefined,
        comboItems,
        dealTerms: dealTerms.trim() || 'Voucher can be redeemed while stock is available.',
        voucherEnabled,
      });

      await refreshListings();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Deal created', 'Your listing was upgraded into a deal successfully.', [
        {
          text: 'View My Listings',
          onPress: () => router.replace('/my-listings'),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Failed', error?.message || 'Could not create the deal. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centered]}>
        <View style={styles.authCard}>
          <Text style={styles.authTitle}>Sign in to create deals</Text>
          <Text style={styles.authSubtitle}>
            Promote listings with the same branded NearHub flow used across the app.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.push({
                pathname: '/auth/register',
                params: authRedirect ? { redirect: authRedirect } : undefined,
              })
            }
          >
            <Text style={styles.primaryButtonText}>Register with Mobile</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.backgroundOrbPrimary} />
      <View style={styles.backgroundOrbSecondary} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <LinearGradient
            colors={['#0B5B43', '#075985']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBadge}>
              <Feather name="zap" size={14} color="#FFFFFF" />
              <Text style={styles.heroBadgeText}>Promotion Layer</Text>
            </View>
            <Text style={styles.heroTitle}>Turn an existing listing into a stronger offer.</Text>
            <Text style={styles.heroSubtitle}>
              We keep the same NearHub card language here, with clearer structure for pricing,
              recurrence, and voucher rules.
            </Text>
          </LinearGradient>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deal Type</Text>
            <View style={styles.chipRow}>
              {(['normal', 'combo'] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.chip, dealType === type && styles.chipActive]}
                  onPress={() => setDealType(type)}
                >
                  <Text style={[styles.chipText, dealType === type && styles.chipTextActive]}>
                    {type === 'normal' ? 'Deal' : 'Combo Deal'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {dealType === 'combo' ? 'Choose Two Listings' : 'Choose Listing'}
              </Text>
              <Pressable onPress={chooseListings}>
                <Text style={styles.linkText}>
                  {selectedListings.length > 0 ? 'Change' : 'Select'}
                </Text>
              </Pressable>
            </View>
            {selectedListings.length === 0 ? (
              <Pressable style={styles.selectorCard} onPress={chooseListings}>
                <Feather name="tag" size={18} color={Colors.primary} />
                <Text style={styles.selectorText}>
                  Open My Listings and select{' '}
                  {dealType === 'combo' ? 'two listings' : 'one listing'} to promote.
                </Text>
              </Pressable>
            ) : (
              <View style={styles.selectedList}>
                {selectedListings.map((item, index) => (
                  <View key={item.id} style={styles.listingCard}>
                    <View style={styles.listingIndex}>
                      <Text style={styles.listingIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.listingBody}>
                      <Text style={styles.listingTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.listingMeta}>
                        Original price: ₹{Number(item.price || 0).toLocaleString('en-IN')}
                      </Text>
                      <Text style={styles.listingMeta}>
                        {item.location?.city || 'Location unavailable'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {primaryListing ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Deal Pricing</Text>
                <Text style={styles.fieldLabel}>Original price</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>
                    ₹{Number(primaryListing.price || 0).toLocaleString('en-IN')}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Deal price</Text>
                <TextInput
                  style={styles.input}
                  value={offerPrice}
                  onChangeText={setOfferPrice}
                  keyboardType="numeric"
                  placeholder="Enter deal price"
                  placeholderTextColor={Colors.textTertiary}
                />

                <Text style={styles.fieldLabel}>Deal timing</Text>
                <View style={styles.timingCard}>
                  <View style={styles.timingInputGrid}>
                    <View style={styles.timingInputHalf}>
                      <Text style={styles.timingLabel}>Start date</Text>
                      <TextInput
                        style={styles.input}
                        value={dealStartDate}
                        onChangeText={setDealStartDate}
                        keyboardType="numbers-and-punctuation"
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={Colors.textTertiary}
                      />
                    </View>
                    <View style={styles.timingInputHalf}>
                      <Text style={styles.timingLabel}>Start time</Text>
                      <TextInput
                        style={styles.input}
                        value={dealStartTime}
                        onChangeText={setDealStartTime}
                        keyboardType="numbers-and-punctuation"
                        placeholder="HH:MM"
                        placeholderTextColor={Colors.textTertiary}
                      />
                    </View>
                    <View style={styles.timingInputHalf}>
                      <Text style={styles.timingLabel}>End date</Text>
                      <TextInput
                        style={styles.input}
                        value={dealEndDate}
                        onChangeText={setDealEndDate}
                        keyboardType="numbers-and-punctuation"
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={Colors.textTertiary}
                      />
                    </View>
                    <View style={styles.timingInputHalf}>
                      <Text style={styles.timingLabel}>End time</Text>
                      <TextInput
                        style={styles.input}
                        value={dealEndTime}
                        onChangeText={setDealEndTime}
                        keyboardType="numbers-and-punctuation"
                        placeholder="HH:MM"
                        placeholderTextColor={Colors.textTertiary}
                      />
                    </View>
                  </View>
                  <View style={styles.timingDivider} />
                  <View style={styles.timingRow}>
                    <Text style={styles.timingLabel}>Start preview</Text>
                    <Text style={styles.timingValue}>{formatDealTimestamp(dealStartAt)}</Text>
                  </View>
                  <View style={styles.timingDivider} />
                  <View style={styles.timingRow}>
                    <Text style={styles.timingLabel}>End preview</Text>
                    <Text style={styles.timingValue}>{formatDealTimestamp(dealEndAt)}</Text>
                  </View>
                </View>
                <Text style={styles.timingHint}>
                  Enter the exact deal start and end date-time in your local timezone. These
                  timestamps will be saved with the deal.
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Deal Rules</Text>
                <Text style={styles.fieldLabel}>Recurrence</Text>
                <View style={styles.chipRow}>
                  {(['none', 'daily', 'weekly', 'monthly'] as const).map((value) => (
                    <Pressable
                      key={value}
                      style={[styles.chip, dealRecurrence === value && styles.chipActive]}
                      onPress={() => setDealRecurrence(value)}
                    >
                      <Text
                        style={[styles.chipText, dealRecurrence === value && styles.chipTextActive]}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {dealRecurrence !== 'none' ? (
                  <>
                    <Text style={styles.fieldLabel}>Repeat until days</Text>
                    <TextInput
                      style={styles.input}
                      value={dealRecurrenceUntilDays}
                      onChangeText={setDealRecurrenceUntilDays}
                      keyboardType="numeric"
                      placeholder="30"
                      placeholderTextColor={Colors.textTertiary}
                    />

                    <Text style={styles.fieldLabel}>Cycle quantity</Text>
                    <TextInput
                      style={styles.input}
                      value={dealCycleQuantity}
                      onChangeText={setDealCycleQuantity}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  </>
                ) : null}

                <Text style={styles.fieldLabel}>Max bookings</Text>
                <TextInput
                  style={styles.input}
                  value={maxDealBookings}
                  onChangeText={setMaxDealBookings}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={Colors.textTertiary}
                />

                <Text style={styles.fieldLabel}>Purchase limit</Text>
                <View style={styles.chipRow}>
                  {(
                    [
                      { value: 'ONE_TIME', label: 'One time per buyer' },
                      { value: 'UNLIMITED', label: 'Unlimited bookings' },
                    ] as const
                  ).map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.chip, purchaseLimitType === option.value && styles.chipActive]}
                      onPress={() => setPurchaseLimitType(option.value)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          purchaseLimitType === option.value && styles.chipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>After deal ends</Text>
                <View style={styles.chipRow}>
                  {(['original', 'discount'] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      style={[styles.chip, postDealPriceMode === mode && styles.chipActive]}
                      onPress={() => setPostDealPriceMode(mode)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          postDealPriceMode === mode && styles.chipTextActive,
                        ]}
                      >
                        {mode === 'original' ? 'Restore original price' : 'Keep discount price'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {postDealPriceMode === 'discount' ? (
                  <>
                    <Text style={styles.fieldLabel}>Post-deal discount price</Text>
                    <TextInput
                      style={styles.input}
                      value={postDealDiscountPrice}
                      onChangeText={setPostDealDiscountPrice}
                      keyboardType="numeric"
                      placeholder="Enter price"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  </>
                ) : null}

                <Text style={styles.fieldLabel}>Deal terms</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={dealTerms}
                  onChangeText={setDealTerms}
                  multiline
                  numberOfLines={4}
                  placeholder="Add booking instructions, timing notes, or redemption rules."
                  placeholderTextColor={Colors.textTertiary}
                />

                <View style={styles.switchRow}>
                  <View style={styles.switchCopy}>
                    <Text style={styles.switchTitle}>Enable voucher</Text>
                    <Text style={styles.switchSubtitle}>
                      Buyers can track and redeem the booking like the web flow.
                    </Text>
                  </View>
                  <Switch
                    value={voucherEnabled}
                    onValueChange={setVoucherEnabled}
                    trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                    thumbColor={voucherEnabled ? '#0B5B43' : '#F8FAFC'}
                  />
                </View>
              </View>
            </>
          ) : null}

          <Pressable
            style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
            onPress={isSubmitting ? undefined : submitDeal}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="tag" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Create Deal</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backgroundOrbPrimary: {
    position: 'absolute',
    top: -64,
    right: -48,
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: 'rgba(11, 91, 67, 0.12)',
  },
  backgroundOrbSecondary: {
    position: 'absolute',
    top: 168,
    left: -50,
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(7, 89, 230, 0.10)',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 22,
    gap: 12,
  },
  authSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  content: {
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    padding: 20,
    gap: 10,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 30,
    fontFamily: 'Inter_700Bold',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  section: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E8DD',
    padding: 18,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    borderColor: '#0B5B43',
    backgroundColor: '#DCFCE7',
  },
  chipText: {
    color: '#475569',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  chipTextActive: {
    color: '#0B5B43',
  },
  linkText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  selectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 16,
  },
  selectorText: {
    flex: 1,
    color: '#1E3A8A',
    fontSize: 13,
    lineHeight: 19,
  },
  selectedList: {
    gap: 10,
  },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  listingIndex: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B5B43',
  },
  listingIndexText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  listingBody: {
    flex: 1,
    gap: 2,
  },
  listingTitle: {
    color: '#0F172A',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  listingMeta: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: '#0F172A',
    fontSize: 14,
  },
  readOnlyField: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  readOnlyText: {
    color: '#166534',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  timingCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F8FFFB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  timingInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timingInputHalf: {
    flexBasis: '48%',
    flexGrow: 1,
    gap: 6,
  },
  timingRow: {
    gap: 4,
  },
  timingLabel: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timingValue: {
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_600SemiBold',
  },
  timingDivider: {
    height: 1,
    backgroundColor: '#D1FAE5',
  },
  timingHint: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  textArea: {
    minHeight: 104,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  switchCopy: {
    flex: 1,
    gap: 3,
  },
  switchTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  switchSubtitle: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: '#0B5B43',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  authTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
  },
});
