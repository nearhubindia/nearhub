import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { createResponsiveStyles } from '@/lib/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { getTabOverlayContentPadding } from '@/constants/layout';

export default function CreateEntryScreen() {
  const insets = useSafeAreaInsets();
  const bottomContentPadding = getTabOverlayContentPadding(insets.bottom, 28);

  return (
    <View style={styles.container}>
      <View style={styles.backgroundOrbPrimary} />
      <View style={styles.backgroundOrbSecondary} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: bottomContentPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#0F172A', '#0759E6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroBadge}>
            <Feather name="layers" size={14} color="#FFFFFF" />
            <Text style={styles.heroBadgeText}>Standard NearHub Flow</Text>
          </View>
          <Text style={styles.heroTitle}>Choose how you want to publish today.</Text>
          <Text style={styles.heroSubtitle}>
            Listings create new inventory. Deals add a promotional layer on top of listings you
            already own.
          </Text>
        </LinearGradient>

        <Pressable style={styles.optionCard} onPress={() => router.push('/create-listing')}>
          <View style={styles.optionTopRow}>
            <View style={styles.optionIconWrap}>
              <Feather name="plus-square" size={22} color="#0F172A" />
            </View>
            <View style={styles.optionTag}>
              <Text style={styles.optionTagText}>New Post</Text>
            </View>
          </View>
          <View style={styles.optionBody}>
            <Text style={styles.optionTitle}>Create Listing</Text>
            <Text style={styles.optionCopy}>
              Post a product, service, job, or wanted listing from scratch.
            </Text>
          </View>
          <View style={styles.optionFooter}>
            <Text style={styles.optionFooterText}>Fresh posting flow</Text>
            <Feather name="arrow-up-right" size={16} color={Colors.primary} />
          </View>
        </Pressable>

        <Pressable
          style={[styles.optionCard, styles.dealOptionCard]}
          onPress={() => router.push('/create-deal')}
        >
          <View style={styles.optionTopRow}>
            <View style={[styles.optionIconWrap, styles.dealIconWrap]}>
              <Feather name="tag" size={22} color="#0B5B43" />
            </View>
            <View style={[styles.optionTag, styles.dealOptionTag]}>
              <Text style={[styles.optionTagText, styles.dealOptionTagText]}>Promote</Text>
            </View>
          </View>
          <View style={styles.optionBody}>
            <Text style={styles.optionTitle}>Create Deal</Text>
            <Text style={styles.optionCopy}>
              Upgrade one listing into a deal, or select two listings to build a combo deal.
            </Text>
          </View>
          <View style={styles.dealLogicInline}>
            <Feather name="info" size={14} color="#0B5B43" />
            <Text style={styles.dealLogicInlineText}>
              Deal logic: promos sit on top of existing listings. Combo deals use one primary
              listing plus one more item.
            </Text>
          </View>
          <View style={styles.optionFooter}>
            <Text style={styles.optionFooterText}>Promotion flow</Text>
            <Feather name="arrow-up-right" size={16} color="#0B5B43" />
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = createResponsiveStyles({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  backgroundOrbPrimary: {
    position: 'absolute',
    top: -72,
    right: -52,
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: 'rgba(7, 89, 230, 0.12)',
  },
  backgroundOrbSecondary: {
    position: 'absolute',
    top: 118,
    left: -58,
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: 'rgba(255, 176, 74, 0.14)',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 18,
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
  optionCard: {
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 14,
  },
  dealOptionCard: {
    borderColor: '#BBF7D0',
    shadowColor: '#0B5B43',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  optionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  dealIconWrap: {
    backgroundColor: '#D1FAE5',
  },
  optionTag: {
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dealOptionTag: {
    backgroundColor: '#ECFDF3',
  },
  optionTagText: {
    color: '#4338CA',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  dealOptionTagText: {
    color: '#047857',
  },
  optionBody: {
    gap: 4,
  },
  optionTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
  },
  optionCopy: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter_400Regular',
  },
  optionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
  },
  optionFooterText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  dealLogicInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dealLogicInlineText: {
    flex: 1,
    color: '#166534',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
});
