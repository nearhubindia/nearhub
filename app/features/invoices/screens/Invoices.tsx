import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import colors from '@/constants/colors';
import AuthRequiredState from '@/shared/components/AuthRequiredState';
import { useAuth } from '@/shared/contexts/auth-context';
import { getApiUrl } from '@/lib/query-client';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INVOICES_STORAGE_KEY = '@nearhub_invoices';

interface Invoice {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  total: number;
  sellerName?: string;
  sellerCity?: string;
  sellerGstin?: string;
  paymentId?: string;
  orderId?: string;
  invoiceHtmlUrl?: string;
  invoiceDownloadUrl?: string;
  rawInvoiceData?: Record<string, unknown>;
  status: string;
  storedAt?: string;
}

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const webTopInset = Platform.OS === 'web' ? 67 : 0;

  const loadInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      const [stored, apiUrl] = await Promise.all([
        AsyncStorage.getItem(INVOICES_STORAGE_KEY),
        getApiUrl(),
      ]);

      const localInvoices: Invoice[] = stored ? (JSON.parse(stored) as Invoice[]) : [];
      let remoteInvoices: Invoice[] = [];

      if (user?.id) {
        try {
          const response = await fetch(`${apiUrl}/api/users/invoices`, {
            headers: buildUserAuthHeaders({ id: user.id, phone: user.phone || '' }),
          });
          const data = await response.json();
          if (response.ok && data?.success && Array.isArray(data?.invoices)) {
            remoteInvoices = data.invoices.map((invoice: any) => ({
              invoiceNumber: String(invoice.invoiceNumber || ''),
              invoiceDate: String(invoice.invoiceDate || ''),
              customerName: String(invoice.customerName || ''),
              total: Number(invoice.total || 0),
              sellerName: invoice.sellerName,
              sellerCity: invoice.sellerCity,
              sellerGstin: invoice.sellerGstin,
              paymentId: invoice.paymentId,
              orderId: invoice.orderId,
              invoiceHtmlUrl: invoice.invoiceHtmlUrl,
              invoiceDownloadUrl: invoice.invoiceDownloadUrl,
              rawInvoiceData: invoice.rawInvoiceData,
              status: String(invoice.status || 'paid'),
              storedAt: invoice.storedAt,
            }));
          }
        } catch (remoteError) {
          console.warn('[Invoices] Failed to fetch remote invoices:', remoteError);
        }
      }

      const deduped = new Map<string, Invoice>();
      [...remoteInvoices, ...localInvoices].forEach((invoice) => {
        if (invoice?.invoiceNumber) {
          deduped.set(invoice.invoiceNumber, invoice);
        }
      });

      const mergedInvoices = [...deduped.values()].sort(
        (a, b) =>
          new Date(b.storedAt || b.invoiceDate).getTime() -
          new Date(a.storedAt || a.invoiceDate).getTime()
      );

      setInvoices(mergedInvoices);
      await AsyncStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(mergedInvoices));
    } catch (error) {
      console.error('[Invoices] Error loading invoices:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, user?.phone]);

  useFocusEffect(
    useCallback(() => {
      void loadInvoices();
    }, [loadInvoices])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      const apiUrl = await getApiUrl();
      const fallbackViewUrl = invoice.rawInvoiceData
        ? `${apiUrl}/api/invoices/${encodeURIComponent(invoice.invoiceNumber)}/view?data=${encodeURIComponent(JSON.stringify(invoice.rawInvoiceData))}`
        : '';
      const absoluteUrl = invoice.invoiceHtmlUrl
        ? `${apiUrl}${invoice.invoiceHtmlUrl}`
        : fallbackViewUrl;

      if (!absoluteUrl) {
        Alert.alert('Invoice Not Available', 'Invoice data is missing for this record.');
        return;
      }

      if (Platform.OS === 'web') {
        window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      await WebBrowser.openBrowserAsync(absoluteUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch (error) {
      console.error('[Invoices] Error viewing invoice:', error);
      Alert.alert('Error', 'Failed to view invoice');
    }
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      const apiUrl = await getApiUrl();
      const fallbackDownloadUrl = invoice.rawInvoiceData
        ? `${apiUrl}/api/invoices/${encodeURIComponent(invoice.invoiceNumber)}/download?data=${encodeURIComponent(JSON.stringify(invoice.rawInvoiceData))}`
        : '';
      const absoluteUrl = invoice.invoiceDownloadUrl
        ? `${apiUrl}${invoice.invoiceDownloadUrl}`
        : fallbackDownloadUrl;

      if (!absoluteUrl) {
        Alert.alert('Invoice Not Available', 'Download link is missing for this invoice.');
        return;
      }

      if (Platform.OS === 'web') {
        window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      const canOpen = await Linking.canOpenURL(absoluteUrl);
      if (!canOpen) {
        Alert.alert('Download Failed', 'Unable to open download URL on this device.');
        return;
      }

      await Linking.openURL(absoluteUrl);
      Alert.alert('Download Started', 'Invoice opened in browser for download.');
    } catch (error) {
      console.error('[Invoices] Error downloading invoice:', error);
      Alert.alert('Error', 'Failed to download invoice');
    }
  };

  const handleDeleteInvoice = (invoice: Invoice) => {
    Alert.alert(
      'Delete Invoice',
      `Are you sure you want to delete invoice ${invoice.invoiceNumber}?`,
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              const updated = invoices.filter((i) => i.invoiceNumber !== invoice.invoiceNumber);
              await AsyncStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(updated));
              setInvoices(updated);
              Alert.alert('Success', 'Invoice deleted');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete invoice');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (!isAuthenticated) {
    return <AuthRequiredState message="Please sign in to view your invoices" />;
  }

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: (insets.top || webTopInset) + 20 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (invoices.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: (insets.top || webTopInset) + 20 }]}>
        <ScrollView
          contentContainerStyle={[
            styles.emptyScrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyContainer}>
            <Feather name="file-text" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>No Invoices Yet</Text>
            <Text style={styles.emptySubtitle}>
              Your invoices from paid subscriptions will appear here
            </Text>
            <Pressable
              style={styles.createListingButton}
              onPress={() => router.push('/create-listing')}
            >
              <Feather name="plus" size={20} color="white" />
              <Text style={styles.createListingButtonText}>Create Listing</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: (insets.top || webTopInset) + 20 }]}>
      <FlatList
        data={invoices}
        keyExtractor={(item) => item.invoiceNumber}
        onRefresh={onRefresh}
        refreshing={refreshing}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Pressable
                onPress={() => {
                  router.back();
                }}
                style={styles.backButton}
                hitSlop={8}
              >
                <Feather name="arrow-left" size={24} color={colors.text} />
              </Pressable>
              <Text style={styles.screenTitle}>Invoices</Text>
              <View style={{ width: 40 }} />
            </View>
            <Text style={styles.subtitle}>
              {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.invoiceCard}>
            <View style={styles.invoiceHeader}>
              <View>
                <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
                <Text style={styles.invoiceDate}>
                  {new Date(item.storedAt || item.invoiceDate).toLocaleDateString('en-IN')}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'paid' && styles.statusPaid,
                  item.status === 'pending' && styles.statusPending,
                ]}
              >
                <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.invoiceBody}>
              <View style={styles.invoiceDetail}>
                <Text style={styles.detailLabel}>Customer</Text>
                <Text style={styles.detailValue}>{item.customerName}</Text>
              </View>
              <View style={styles.invoiceDetail}>
                <Text style={styles.detailLabel}>Amount</Text>
                <Text style={styles.amountValue}>₹{item.total.toLocaleString('en-IN')}</Text>
              </View>
            </View>

            <View style={styles.invoiceActions}>
              <Pressable
                style={[styles.actionButton, styles.viewButton]}
                onPress={() => handleViewInvoice(item)}
              >
                <Feather name="eye" size={16} color={colors.primary} />
                <Text style={styles.viewButtonText}>View</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.downloadButton]}
                onPress={() => handleDownloadInvoice(item)}
              >
                <Feather name="download" size={16} color={colors.primary} />
                <Text style={styles.downloadButtonText}>Download</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDeleteInvoice(item)}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createListingButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
  },
  createListingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  invoiceCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  invoiceDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  statusPaid: {
    backgroundColor: '#DCFCE7',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991B1B',
  },
  invoiceBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  invoiceDetail: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  invoiceActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  viewButton: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  viewButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  downloadButton: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9FF',
  },
  downloadButtonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    flex: 0.5,
  },
});
