import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import {
  MOBILE_RATE_CARD,
  type MobileCondition,
  type MobileProcessor,
} from '@/lib/mobile-rate-card';
import { findMobileDeviceMaster } from '@/lib/mobile-device-master';
import { getApiUrl } from '@/lib/query-client';
import { useAuth } from '@/shared/contexts/auth-context';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

type Report = {
  id: string;
  brand: string;
  model: string;
  ram: number;
  storage: number;
  processor: MobileProcessor;
  age: number;
  condition: string;
  battery: number;
  androidVersion?: string;
  manufacturer?: string;
  cpuArchitecture?: string;
  detectedStorage?: number;
  score: number;
  confidence: number;
  reportId: string;
  marketValueScore: number;
  usabilityScore: number;
  performanceScore: number;
  batteryScore: number;
  softwareSupportScore: number;
  androidSupportStatus: string;
  demandFactor: number;
  low: number;
  high: number;
  createdAt: string;
  validUntil: string;
  signature: string;
  modelVersion: string;
  validation: {
    status: 'ai_validated' | 'rules_fallback';
    provider: string;
    model: string | null;
    rationale: string;
    flags: string[];
    adjustmentPercent: number;
    comparableCount: number;
    comparableMedian: number | null;
  };
};

const STORAGE_KEY = 'nearhub_mobile_valuation_reports_v1';
const PROCESSORS: MobileProcessor[] = ['entry', 'mid', 'upperMid', 'flagship'];
const SCREEN_CONDITIONS = [
  'Intact',
  'Minor scratches',
  'Deep scratches',
  'Cracked',
  'Broken',
] as const;
const BODY_DEFECTS = ['None', 'Light scratches', 'Heavy scratches', 'Dents'] as const;
const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

function ReportBreakdown({ report }: { report: Report }) {
  return (
    <View
      style={{
        margin: 16,
        marginBottom: 0,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
      }}
    >
      <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
        NEARHUB AI MOBILE VALUATION
      </Text>
      <Text style={{ color: '#475569', fontSize: 11, lineHeight: 16, marginTop: 7 }}>
        NearHub provides an independent AI estimate of the current fair market value of used mobile
        devices.
      </Text>
      <Text style={{ color: '#64748B', fontSize: 11, marginTop: 3 }}>
        Report {report.reportId} • Powered by NearHub Valuation Engine v{MOBILE_RATE_CARD.version}
      </Text>
      <Text style={{ color: '#0F172A', fontSize: 21, fontWeight: '900', marginTop: 22 }}>
        {report.brand} {report.model}
      </Text>
      <View style={{ backgroundColor: '#EFF6FF', borderRadius: 14, padding: 16, marginTop: 18 }}>
        <Text style={{ color: '#475569', fontSize: 12, fontWeight: '800' }}>
          ESTIMATED FAIR MARKET RANGE
        </Text>
        <Text style={{ color: '#1D4ED8', fontSize: 31, fontWeight: '900', marginTop: 9 }}>
          {money(report.low)} – {money(report.high)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800' }}>
            VALUATION CONFIDENCE
          </Text>
          <Text style={{ color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 4 }}>
            {report.confidence}%
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800' }}>REPORT VALIDITY</Text>
          <Text style={{ color: '#0F172A', fontSize: 18, fontWeight: '900', marginTop: 4 }}>
            {MOBILE_RATE_CARD.validityDays} Days
          </Text>
        </View>
      </View>
      <Text style={{ color: '#475569', fontSize: 12, lineHeight: 17, marginTop: 18 }}>
        Most transactions for a device in this condition are expected to fall within this range.
      </Text>
      <Text
        style={{
          color: report.validation.status === 'ai_validated' ? '#166534' : '#92400E',
          fontSize: 11,
          fontWeight: '800',
          marginTop: 12,
        }}
      >
        {report.validation.status === 'ai_validated'
          ? `✓ AI-validated${report.validation.comparableCount ? ` with ${report.validation.comparableCount} market comparables` : ''}`
          : 'Rules-based estimate • AI validation unavailable'}
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 10, lineHeight: 14, marginTop: 12 }}>
        Final value may vary after physical inspection, accessories, battery health and local
        demand.
      </Text>
      <Text style={{ color: '#64748B', fontSize: 10, marginTop: 10 }}>
        Issued {dateLabel(report.createdAt)} • Valid until {dateLabel(report.validUntil)}
      </Text>
    </View>
  );
}

export default function AiValuator() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [ram, setRam] = useState('8');
  const [storage, setStorage] = useState('128');
  const [processor, setProcessor] = useState<MobileProcessor>('mid');
  const [screenCondition, setScreenCondition] =
    useState<(typeof SCREEN_CONDITIONS)[number]>('Intact');
  const [bodyDefect, setBodyDefect] = useState<(typeof BODY_DEFECTS)[number]>('None');
  const [age, setAge] = useState('12');
  const [battery, setBattery] = useState('90');
  const [androidVersion, setAndroidVersion] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [detected, setDetected] = useState(false);
  const [cpuArchitecture, setCpuArchitecture] = useState('');
  const [detectedStorage, setDetectedStorage] = useState<number | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        JSON.parse(raw);
      } catch {
        /* ignore legacy history */
      }
    });
  }, []);

  const canEvaluate = useMemo(
    () => Boolean(detected && brand.trim() && model.trim()),
    [detected, brand, model]
  );

  const detectDevice = async () => {
    if (!Device.isDevice) {
      Alert.alert(
        'Use a physical phone',
        'Device detection is only available in a development or production build running on a real phone.'
      );
      return;
    }
    setManufacturer(Device.manufacturer || Device.brand || 'Unknown');
    setBrand(Device.brand || Device.manufacturer || '');
    setModel(Device.modelName || Device.productName || '');
    setAndroidVersion(
      Platform.OS === 'android'
        ? Device.osVersion || 'Unknown'
        : `${Device.osName || Platform.OS} ${Device.osVersion || ''}`.trim()
    );
    if (Device.totalMemory) setRam(String(Math.round(Device.totalMemory / 1024 / 1024 / 1024)));
    const estimatedAgeMonths = Device.deviceYearClass
      ? Math.max(0, (new Date().getFullYear() - Device.deviceYearClass) * 12)
      : 12;
    setAge(String(estimatedAgeMonths));
    const memoryGb = Device.totalMemory ? Device.totalMemory / 1024 / 1024 / 1024 : 0;
    setProcessor(
      memoryGb >= 12 ? 'flagship' : memoryGb >= 8 ? 'upperMid' : memoryGb >= 4 ? 'mid' : 'entry'
    );
    setCpuArchitecture(Device.supportedCpuArchitectures?.join(', ') || 'Unknown architecture');
    try {
      const totalBytes = await FileSystem.getTotalDiskCapacityAsync();
      if (totalBytes) {
        const totalGb = Math.round(totalBytes / 1024 / 1024 / 1024);
        setDetectedStorage(totalGb);
        setStorage(String(totalGb));
      }
    } catch {
      // Storage capacity is unavailable on some web/dev runtimes.
    }
    try {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      if (batteryLevel >= 0) setBattery(String(Math.round(batteryLevel * 100)));
    } catch {
      // Battery APIs are unavailable on web and simulators.
    }
    setDetected(true);
  };

  const printDetailedReport = async () => {
    if (!report) return;
    const conditionLabel =
      MOBILE_RATE_CARD.condition[report.condition as MobileCondition]?.label || report.condition;
    const demandLabel =
      report.demandFactor > 1.02
        ? 'Above average'
        : report.demandFactor < 0.98
          ? 'Below average'
          : 'Stable';
    const ageLabel =
      report.age >= 12
        ? `${Math.floor(report.age / 12)} year${Math.floor(report.age / 12) === 1 ? '' : 's'}${report.age % 12 ? ` ${report.age % 12} months` : ''}`
        : `${report.age} months`;
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
      @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0f172a;font-size:13px;line-height:1.45;margin:0}.page{max-width:760px;margin:auto}.header{border-bottom:3px solid #0f2a43;padding-bottom:16px}.eyebrow{color:#64748b;font-size:11px;font-weight:bold;letter-spacing:1px}.muted{color:#64748b}.tagline{font-size:12px;margin:7px 0}.reportMeta{font-size:11px}.device{font-size:27px;margin:25px 0 0}.range{background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:24px;margin:20px 0}.rangeValue{font-size:38px;font-weight:bold;color:#1d4ed8;margin-top:8px}.facts{display:flex;gap:70px;margin:20px 0}.fact{min-width:180px}.fact strong{display:block;font-size:21px;margin-top:4px}.explanation{font-size:14px;border-top:1px solid #e2e8f0;padding-top:15px}.disclaimer{font-size:10px}.section{margin-top:24px;break-inside:avoid}.section h2{font-size:17px;margin:0 0 10px;color:#0f2a43}.section p{margin:6px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:9px;text-align:left;vertical-align:top}th{background:#f1f5f9;color:#334155;font-size:11px;text-transform:uppercase;letter-spacing:.4px}.score{font-weight:bold;color:#1d4ed8}.notice{background:#fffbeb;border:1px solid #fde68a;border-radius:9px;padding:12px}.method{background:#f8fafc;border-radius:9px;padding:12px}.footer{border-top:1px solid #cbd5e1;margin-top:26px;padding-top:10px;font-size:10px;color:#64748b}
    </style></head><body><main class="page">
      <header class="header"><div class="eyebrow">NEARHUB AI MOBILE VALUATION</div><p class="tagline muted">NearHub provides an independent AI estimate of the current fair market value of used mobile devices.</p><div class="reportMeta muted">Report ${escapeHtml(report.reportId)} • Model ${escapeHtml(report.modelVersion)} • ${report.validation.status === 'ai_validated' ? `AI-validated${report.validation.model ? ` by ${escapeHtml(report.validation.model)}` : ''}` : 'Rules-based fallback'}</div></header>
      <h1 class="device">${escapeHtml(report.brand)} ${escapeHtml(report.model)}</h1>
      <section class="range"><div class="eyebrow">ESTIMATED FAIR MARKET RANGE</div><div class="rangeValue">${money(report.low)} – ${money(report.high)}</div></section>
      <div class="facts"><div class="fact"><span class="eyebrow">VALUATION CONFIDENCE</span><strong>${report.confidence}%</strong></div><div class="fact"><span class="eyebrow">REPORT VALIDITY</span><strong>${MOBILE_RATE_CARD.validityDays} Days</strong></div></div>
      <p class="explanation">Most transactions for a device in this condition are expected to fall within this range.</p><p class="disclaimer muted">Final value may vary after physical inspection, accessories, battery health and local demand.</p>

      <section class="section"><h2>Device details</h2><table><tbody>
        <tr><th>Manufacturer</th><td>${escapeHtml(report.manufacturer || report.brand)}</td><th>Model</th><td>${escapeHtml(report.model)}</td></tr>
        <tr><th>RAM</th><td>${report.ram} GB</td><th>Storage</th><td>${report.storage} GB</td></tr>
        <tr><th>Processor tier</th><td>${escapeHtml(MOBILE_RATE_CARD.processor[report.processor].label)}</td><th>CPU architecture</th><td>${escapeHtml(report.cpuArchitecture || 'Unavailable')}</td></tr>
        <tr><th>Operating system</th><td>${escapeHtml(report.androidVersion || 'Unavailable')}</td><th>Device age</th><td>${escapeHtml(ageLabel)}</td></tr>
        <tr><th>Assessed condition</th><td>${escapeHtml(conditionLabel)}</td><th>Battery level</th><td>${report.battery}%</td></tr>
      </tbody></table></section>

      <section class="section"><h2>Valuation assessment</h2><table><thead><tr><th>Assessment area</th><th>Score</th><th>What it reflects</th></tr></thead><tbody>
        <tr><td>Device performance</td><td class="score">${report.performanceScore}/100</td><td>Processor tier, RAM and storage configuration</td></tr>
        <tr><td>Physical condition</td><td class="score">${Math.round(MOBILE_RATE_CARD.condition[report.condition as MobileCondition]?.multiplier * 100 || 0)}/100</td><td>Reported screen and body condition</td></tr>
        <tr><td>Battery</td><td class="score">${report.batteryScore}/100</td><td>Reported battery level at assessment</td></tr>
        <tr><td>Software support</td><td class="score">${report.softwareSupportScore}/100</td><td>${escapeHtml(report.androidSupportStatus)}</td></tr>
        <tr><td>Market demand</td><td class="score">${report.marketValueScore}/100</td><td>${demandLabel} demand profile for this brand and configuration</td></tr>
        <tr><th>Overall device assessment</th><th class="score">${report.score}/100</th><th>Weighted assessment across the factors above</th></tr>
      </tbody></table></section>

      <section class="section"><h2>How this valuation was prepared</h2><div class="method"><p>The NearHub valuation engine assesses hardware configuration, device age, reported physical condition, battery level, software support and current market demand.</p><p>${escapeHtml(report.validation.rationale)} ${report.validation.comparableCount ? `${report.validation.comparableCount} current NearHub market comparables were included.` : 'No sufficiently relevant NearHub market comparables were available.'}</p><p>The estimated fair market range is 20% wide (±10% around the validated market estimate). Valuation confidence reflects input completeness, comparable evidence and validation quality.</p></div></section>

      <section class="section"><h2>Verification status</h2><div class="notice"><strong>Physical and IMEI verification not completed</strong><p>The device has not been physically inspected. IMEI blacklist status, activation lock, internal components and submitted condition should be verified independently.</p></div></section>

      <footer class="footer">Issued ${dateLabel(report.createdAt)} • Valid until ${dateLabel(report.validUntil)} • Report ${escapeHtml(report.reportId)}<br/>This report is an AI-assisted market estimate and does not guarantee a final transaction value.</footer>
    </main></body></html>`;
    try {
      await Print.printAsync({ html });
    } catch {
      Alert.alert('Print unavailable', 'Please use a physical device or browser print support.');
    }
  };

  const printReport = printDetailedReport;

  const evaluate = async () => {
    const r = Math.max(1, Number(ram) || 1);
    const s = Math.max(16, Number(storage) || 16);
    const health = Math.min(100, Math.max(1, Number(battery) || 1));
    const deviceMaster = findMobileDeviceMaster(brand, model);
    const releaseDate = deviceMaster ? new Date(deviceMaster.releaseDate) : null;
    const months =
      releaseDate && !Number.isNaN(releaseDate.getTime())
        ? Math.max(
            0,
            (new Date().getFullYear() - releaseDate.getFullYear()) * 12 +
              new Date().getMonth() -
              releaseDate.getMonth()
          )
        : Math.max(0, Number(age) || 0);
    setIsEvaluating(true);
    try {
      const response = await fetch(`${getApiUrl()}/api/valuations/mobile`, {
        method: 'POST',
        headers: buildUserAuthHeaders(user),
        body: JSON.stringify({
          brand: brand.trim(),
          model: model.trim(),
          ram: r,
          storage: s,
          processor,
          ageMonths: months,
          battery: health,
          screenCondition,
          bodyDefect,
          androidVersion,
          manufacturer,
          cpuArchitecture,
          detectedStorage: detectedStorage || undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body?.report)
        throw new Error(body?.error || 'The valuation service did not return a report.');
      const next = body.report as Report;
      setReport(next);
      setReports([]);
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    } catch (error) {
      Alert.alert(
        'Valuation unavailable',
        error instanceof Error ? error.message : 'Please check your connection and try again.'
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(insets.top, 14), paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Feather name="smartphone" size={22} color="#fff" />
        </View>
        <View>
          <Text style={styles.title}>AI Mobile Valuation</Text>
          <Text style={styles.subtitle}>Get an independent, condition-based market estimate.</Text>
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Device details</Text>
        <Pressable style={styles.detectButton} onPress={detectDevice}>
          <Feather name="crosshair" size={16} color="#1D4ED8" />
          <Text style={styles.detectText}>
            {detected ? 'Device details detected' : 'Auto-detect this Android device'}
          </Text>
        </Pressable>
        {detected ? (
          <Text style={styles.detectedMeta}>
            {manufacturer || 'Unknown manufacturer'} • Android {androidVersion || 'Unknown version'}{' '}
            • CPU {cpuArchitecture || 'Unknown'} • Storage{' '}
            {detectedStorage ? `${detectedStorage} GB` : 'Unknown'}
          </Text>
        ) : null}
        <View style={styles.row}>
          <TextInput
            style={[styles.input, detected && styles.inputLocked]}
            editable={!detected}
            placeholder="Brand (e.g. Samsung)"
            value={brand}
            onChangeText={setBrand}
          />
          <TextInput
            style={[styles.input, detected && styles.inputLocked]}
            editable={!detected}
            placeholder="Model (e.g. S24)"
            value={model}
            onChangeText={setModel}
          />
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, detected && styles.inputLocked]}
            editable={!detected}
            keyboardType="numeric"
            placeholder="RAM (GB)"
            value={ram}
            onChangeText={setRam}
          />
          <TextInput
            style={[styles.input, detected && styles.inputLocked]}
            editable={!detected}
            keyboardType="numeric"
            placeholder="Storage (GB)"
            value={storage}
            onChangeText={setStorage}
          />
        </View>
        <Text style={styles.label}>Processor tier (auto-detected)</Text>
        <View style={styles.chips}>
          <View style={[styles.chip, styles.chipActive]}>
            <Text style={[styles.chipText, styles.chipTextActive]}>
              {MOBILE_RATE_CARD.processor[processor].label}
            </Text>
          </View>
        </View>
        <Text style={styles.label}>Screen condition</Text>
        <View style={styles.chips}>
          {SCREEN_CONDITIONS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setScreenCondition(item)}
              style={[styles.chip, screenCondition === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, screenCondition === item && styles.chipTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Body scratches and defects</Text>
        <View style={styles.chips}>
          {BODY_DEFECTS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setBodyDefect(item)}
              style={[styles.chip, bodyDefect === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, bodyDefect === item && styles.chipTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, detected && styles.inputLocked]}
            editable={!detected}
            keyboardType="numeric"
            placeholder="Age (months)"
            value={age}
            onChangeText={setAge}
          />
          <TextInput
            style={[styles.input, detected && styles.inputLocked]}
            editable={!detected}
            keyboardType="numeric"
            placeholder="Battery level %"
            value={battery}
            onChangeText={setBattery}
          />
        </View>
        <Pressable
          style={[styles.button, (!canEvaluate || isEvaluating) && styles.buttonDisabled]}
          disabled={!canEvaluate || isEvaluating}
          onPress={evaluate}
        >
          <Feather name="file-text" size={18} color="#fff" />
          <Text style={styles.buttonText}>
            {isEvaluating ? 'Validating with AI…' : 'Generate AI valuation'}
          </Text>
        </Pressable>
      </View>
      {reports.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.sectionTitle}>Recent reports</Text>
          {reports.slice(0, 5).map((item) => (
            <Pressable key={item.id} style={styles.historyRow} onPress={() => setReport(item)}>
              <View>
                <Text style={styles.historyTitle}>
                  {item.brand} {item.model}
                </Text>
                <Text style={styles.historyMeta}>
                  Score {item.score} • Valid until {dateLabel(item.validUntil)}
                </Text>
              </View>
              <Text style={styles.historyPrice}>{money(item.low)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={styles.disclaimer}>
        An independent AI estimate of the current fair market value.
      </Text>
      {report ? (
        <>
          <ReportBreakdown report={report} />
          <Pressable
            style={[styles.reportPrintButton, { marginHorizontal: 16 }]}
            onPress={printReport}
          >
            <Feather name="printer" size={16} color="#0F2A43" />
            <Text style={styles.reportPrintText}>Print this valuation</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  reportPrintButton: {
    marginTop: 14,
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  reportPrintText: { color: '#0F2A43', fontWeight: '800', fontSize: 13 },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  headerIcon: {
    backgroundColor: Colors.primary,
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 21, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#64748B', marginTop: 3, fontSize: 13 },
  rateCardButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rateCardButtonText: { color: '#1D4ED8', fontWeight: '800', fontSize: 13 },
  card: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  detectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 11,
    marginBottom: 8,
  },
  detectText: { color: '#1D4ED8', fontWeight: '800', fontSize: 13 },
  detectedMeta: { color: '#64748B', fontSize: 11, marginBottom: 8, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#0F172A',
    backgroundColor: '#fff',
  },
  inputLocked: { backgroundColor: '#F1F5F9', color: '#475569' },
  label: { color: '#475569', fontSize: 13, fontWeight: '700', marginTop: 7, marginBottom: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  chipActive: { backgroundColor: '#DBEAFE' },
  chipText: { fontSize: 12, color: '#475569' },
  chipTextActive: { color: '#1D4ED8', fontWeight: '700' },
  button: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  report: { margin: 16, padding: 18, borderRadius: 18, backgroundColor: '#0F2A43' },
  reportTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  reportEyebrow: { color: '#93C5FD', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  reportTitle: { color: '#fff', fontSize: 23, fontWeight: '800', marginTop: 5 },
  score: {
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 14,
    padding: 10,
    minWidth: 66,
  },
  scoreValue: { color: '#fff', fontSize: 25, fontWeight: '900' },
  scoreLabel: { color: '#BFDBFE', fontSize: 10 },
  recommendation: { color: '#BFDBFE', marginTop: 12, fontWeight: '700' },
  priceBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginTop: 15 },
  priceLabel: { color: '#64748B', fontSize: 12 },
  price: { color: '#0F172A', fontSize: 22, fontWeight: '900', marginTop: 3 },
  depreciation: { color: '#DC2626', fontSize: 18, fontWeight: '900', marginBottom: 7 },
  range: { color: '#64748B', fontSize: 16, fontWeight: '800', marginTop: 3 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  spec: {
    color: '#E2E8F0',
    fontSize: 12,
    backgroundColor: '#1E3A56',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  stolenNotice: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 14,
    padding: 10,
    backgroundColor: '#4A3A16',
    borderRadius: 9,
  },
  stolenNoticeText: { flex: 1, color: '#FDE68A', fontSize: 11, lineHeight: 16 },
  valid: { color: '#93C5FD', fontSize: 11, marginTop: 15 },
  history: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  historyTitle: { color: '#0F172A', fontWeight: '700' },
  historyMeta: { color: '#64748B', fontSize: 11 },
  historyPrice: { color: '#1D4ED8', fontWeight: '800' },
  disclaimer: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginHorizontal: 20,
    textAlign: 'center',
  },
});
