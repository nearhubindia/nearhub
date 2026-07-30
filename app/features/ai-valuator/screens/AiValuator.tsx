import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MOBILE_RATE_CARD,
  type MobileCondition,
  type MobileProcessor,
} from '@/lib/mobile-rate-card';
import { findMobileDeviceMaster } from '@/lib/mobile-device-master';
import { getTotalStorageGb } from '@/lib/device-storage';
import { readBatteryDiagnostics } from '@/lib/battery-diagnostics';
import {
  compareDisplayCapabilities,
  readDisplayCapabilities,
  type DisplayAssessment,
} from '@/lib/display-capabilities';
import { getApiUrl } from '@/lib/query-client';
import { useAuth } from '@/shared/contexts/auth-context';
import { buildUserAuthHeaders } from '@/lib/user-auth-headers';

const PROGRESS_RING_SIZE = 140;
const PROGRESS_RING_RADIUS = 54;
const PROGRESS_RING_STROKE = 10;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;

// Android memory values can include small OEM/runtime differences from the
// advertised tier. Choose the nearest tier instead of rounding upward.
const normalizeDetectedRamGb = (totalMemoryBytes: number): number => {
  const reportedGb = totalMemoryBytes / 1024 / 1024 / 1024;
  const marketedTiers = [2, 3, 4, 6, 8, 12, 16, 18, 24, 32];
  return marketedTiers.reduce((nearest, tier) =>
    Math.abs(tier - reportedGb) < Math.abs(nearest - reportedGb) ? tier : nearest
  );
};

type Report = {
  id: string;
  brand: string;
  model: string;
  ram: number;
  storage: number;
  processor: MobileProcessor;
  age: number;
  ageBasis?: 'model_release' | 'user_reported' | 'unknown';
  verifiedReleaseDate?: string | null;
  displayAssessment?: DisplayAssessment;
  condition: string;
  battery: number;
  batteryHealthType?: 'measured' | 'estimated' | 'unavailable';
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
  recommendedSellingPrice?: number;
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
    marketMedian?: number | null;
    marketLow?: number | null;
    marketHigh?: number | null;
    currentNewPrice?: number | null;
    evidenceQuality?: 'none' | 'low' | 'medium' | 'high';
    marketSources?: { title: string; uri: string }[];
    searchedAt?: string | null;
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
const formatPurchaseMonthYear = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};
const purchaseAgeInMonths = (value: string, now = new Date()): number | null => {
  const match = value.match(/^(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  if (month < 1 || month > 12) return null;
  const months = (now.getFullYear() - year) * 12 + now.getMonth() - (month - 1);
  return months >= 0 && months <= 240 ? months : null;
};
const escapeHtml = (value: string | number) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

async function getReportLogoSource(): Promise<string> {
  const asset = Asset.fromModule(require('@/assets/images/nearhub_logo.png'));
  try {
    await asset.downloadAsync();
    if (asset.localUri) {
      const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/png;base64,${base64}`;
    }
  } catch {
    // The bundled asset URI remains usable on platforms that do not expose a local file URI.
  }
  return asset.uri;
}

function ReportBreakdown({ report }: { report: Report }) {
  const recommendedSellingPrice =
    report.recommendedSellingPrice ?? Math.round((report.low + report.high) / 2);
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
          EXPECTED SELLING RANGE
        </Text>
        <Text style={{ color: '#1D4ED8', fontSize: 31, fontWeight: '900', marginTop: 9 }}>
          {money(report.low)} – {money(report.high)}
        </Text>
        <Text style={{ color: '#475569', fontSize: 11, marginTop: 6 }}>
          Recommended listing price: {money(recommendedSellingPrice)}
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
          ? `✓ AI-validated${report.validation.marketSources?.length ? ` with ${report.validation.marketSources.length} live market sources` : report.validation.comparableCount ? ` with ${report.validation.comparableCount} NearHub comparables` : ''}`
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
  const [buildModel, setBuildModel] = useState('');
  const [ram, setRam] = useState('8');
  const [storage, setStorage] = useState('128');
  const [processor, setProcessor] = useState<MobileProcessor>('mid');
  const [screenCondition, setScreenCondition] =
    useState<(typeof SCREEN_CONDITIONS)[number]>('Intact');
  const [bodyDefect, setBodyDefect] = useState<(typeof BODY_DEFECTS)[number]>('None');
  const [age, setAge] = useState('');
  const [battery, setBattery] = useState('');
  const [batteryDiagnostic, setBatteryDiagnostic] = useState<string>('Not available');
  const [androidVersion, setAndroidVersion] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [detected, setDetected] = useState(false);
  const [cpuArchitecture, setCpuArchitecture] = useState('');
  const [detectedStorage, setDetectedStorage] = useState<number | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationProgress, setEvaluationProgress] = useState<number | null>(null);
  const [displayAssessment, setDisplayAssessment] = useState<DisplayAssessment | null>(null);

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
    [detected, brand, model, battery]
  );

  const detectDevice = async () => {
    if (!Device.isDevice) {
      Alert.alert(
        'Use a physical phone',
        'Device detection is only available in a development or production build running on a real phone.'
      );
      return;
    }
    const detectedManufacturer = Device.manufacturer || Device.brand || 'Unknown';
    const detectedBrand = Device.brand || Device.manufacturer || '';
    const detectedModel = Device.modelName || Device.productName || '';
    setManufacturer(detectedManufacturer);
    setBrand(detectedBrand);
    setModel(detectedModel);
    // modelId is Android's hardware/build model (for example CPH2573). Keep
    // it alongside the readable name so the server/AI can resolve both.
    setBuildModel(Device.modelId || '');
    setAndroidVersion(
      Platform.OS === 'android'
        ? Device.osVersion || 'Unknown'
        : `${Device.osName || Platform.OS} ${Device.osVersion || ''}`.trim()
    );
    const detectedRamGb = Device.totalMemory ? normalizeDetectedRamGb(Device.totalMemory) : 0;
    if (detectedRamGb) setRam(String(detectedRamGb));
    // deviceYearClass describes relative hardware performance, not manufacture/purchase year.
    // Treating it as a calendar year made new entry-level phones appear many years old.
    setAge('');
    const memoryGb = detectedRamGb;
    setProcessor(
      memoryGb >= 12 ? 'flagship' : memoryGb >= 8 ? 'upperMid' : memoryGb >= 4 ? 'mid' : 'entry'
    );
    setCpuArchitecture(Device.supportedCpuArchitectures?.join(', ') || 'Unknown architecture');
    const batteryInfo = await readBatteryDiagnostics();
    if (batteryInfo) {
      if (batteryInfo.healthPercent > 0) {
        setBattery(String(batteryInfo.healthPercent));
        setBatteryDiagnostic(`Measured by Android (${batteryInfo.healthPercent}%)`);
      } else {
        setBatteryDiagnostic(
          batteryInfo.health === 'GOOD'
            ? 'Android reports normal battery health; percentage not exposed'
            : `Android reports ${batteryInfo.health.toLowerCase().replace('_', ' ')}`
        );
      }
    }
    const measuredDisplay = await readDisplayCapabilities();
    const deviceMaster = findMobileDeviceMaster(detectedBrand, detectedModel);
    setDisplayAssessment(compareDisplayCapabilities(deviceMaster, measuredDisplay));
    try {
      const totalBytes = await FileSystem.getTotalDiskCapacityAsync();
      if (totalBytes) {
        const totalGb = getTotalStorageGb(totalBytes, deviceMaster?.storageOptionsGb);
        setDetectedStorage(totalGb);
        setStorage(String(totalGb));
      }
    } catch {
      // Storage capacity is unavailable on some web/dev runtimes.
    }
    setDetected(true);
  };

  const printDetailedReport = async () => {
    if (!report) return;
    const logoSource = await getReportLogoSource();
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
    const marketSources = report.validation.marketSources || [];
    const estimatedCentre = (report.low + report.high) / 2;
    const retainedValue = report.validation.currentNewPrice
      ? Math.round((estimatedCentre / report.validation.currentNewPrice) * 100)
      : null;
    const sourceList = marketSources.length
      ? `<ol class="sources">${marketSources.map((source) => `<li><a href="${escapeHtml(source.uri)}">${escapeHtml(source.title)}</a></li>`).join('')}</ol>`
      : '<p class="muted">No sufficiently relevant live web sources were returned for this model.</p>';
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>
      @page{size:A4;margin:13mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#122033;font-size:12px;line-height:1.5;margin:0;background:#fff}.page{max-width:760px;margin:auto}.header{display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;border-bottom:3px solid #0b3158}.brand-logo{display:block;width:174px;height:auto}.document-title{text-align:right}.document-title h1{font-size:20px;line-height:1.15;letter-spacing:.7px;color:#0b3158;margin:0}.document-title p{font-size:10px;color:#64748b;letter-spacing:1.4px;text-transform:uppercase;margin:6px 0 0}.meta{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #dbe3ec;color:#52647a;font-size:10px}.status{display:inline-block;padding:4px 9px;border-radius:20px;background:#eaf8ef;color:#19703b;font-weight:bold}.device-block{padding:22px 0 16px}.eyebrow{color:#60718a;font-size:10px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase}.device{font-size:28px;line-height:1.2;color:#101d30;margin:5px 0 0}.range{position:relative;overflow:hidden;background:#0b3158;border-radius:12px;padding:22px 25px;color:#fff}.range:after{content:'';position:absolute;right:-38px;top:-65px;width:180px;height:180px;border-radius:50%;background:#145fa6}.range-label{position:relative;z-index:1;color:#bcd5ee;font-size:10px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase}.range-value{position:relative;z-index:1;font-size:36px;line-height:1.1;font-weight:bold;margin-top:8px}.summary{display:flex;margin:13px 0 0;gap:10px}.summary-card{flex:1;border:1px solid #dbe3ec;border-radius:9px;padding:12px 14px;background:#f8fafc}.summary-card strong{display:block;color:#0b3158;font-size:19px;margin-top:2px}.summary-card.accent{border-left:4px solid #ff7200}.explanation{margin:14px 0 0;padding:11px 13px;border-left:3px solid #2286c4;background:#f3f8fc;color:#40536a}.disclaimer{font-size:9px;color:#718096;margin:7px 0 0}.muted{color:#718096}.section{margin-top:20px;break-inside:avoid}.section-heading{display:flex;align-items:center;gap:9px;margin-bottom:9px}.section-number{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#0b3158;color:#fff;font-size:10px;font-weight:bold}.section h2{font-size:15px;margin:0;color:#0b3158}.section p{margin:6px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8e1eb;padding:8px 9px;text-align:left;vertical-align:top}th{background:#eff4f8;color:#42566e;font-size:9px;text-transform:uppercase;letter-spacing:.55px}td{color:#1f3045}.score{font-weight:bold;color:#0d67b1}.assessment thead th{background:#0b3158;color:#fff}.assessment tbody tr:nth-child(even) td{background:#f8fafc}.assessment tbody tr:last-child th{background:#e6f1fa;color:#0b3158}.market-grid{display:flex;gap:9px}.market-card{flex:1;padding:11px;border:1px solid #d8e1eb;border-radius:8px;background:#f8fafc}.market-card strong{display:block;margin-top:3px;color:#0b3158;font-size:17px}.market-note{font-size:9px;color:#64748b}.sources{margin:8px 0 0;padding-left:18px;font-size:9px}.sources li{margin:3px 0}.sources a{color:#0d67b1;text-decoration:none}.method{background:#f6f8fb;border:1px solid #dbe3ec;border-radius:9px;padding:12px 14px}.notice{background:#fff8eb;border:1px solid #f4d7a6;border-left:4px solid #f59e0b;border-radius:8px;padding:11px 13px}.notice strong{color:#8a5200}.footer{display:flex;justify-content:space-between;border-top:2px solid #0b3158;margin-top:22px;padding-top:9px;font-size:8.5px;color:#64748b}.footer-right{text-align:right}.orange{color:#f97316}
    </style></head><body><main class="page">
      <header class="header"><img class="brand-logo" src="${escapeHtml(logoSource)}" alt="NearHub"><div class="document-title"><h1>MOBILE DEVICE<br><span class="orange">VALUATION REPORT</span></h1><p>Independent market assessment</p></div></header>
      <div class="meta"><span><strong>Report ID:</strong> ${escapeHtml(report.reportId)} &nbsp;|&nbsp; <strong>Issued:</strong> ${dateLabel(report.createdAt)}</span><span class="status">${report.validation.status === 'ai_validated' ? '✓ AI VALIDATED' : 'RULES VALIDATED'}</span></div>
      <section class="device-block"><div class="eyebrow">Device assessed</div><h2 class="device">${escapeHtml(report.brand)} ${escapeHtml(report.model)}</h2></section>
      <section class="range"><div class="range-label">Expected selling range</div><div class="range-value">${money(report.low)} – ${money(report.high)}</div><div style="position:relative;z-index:1;margin-top:7px;color:#bcd5ee">Recommended listing price: ${money(report.recommendedSellingPrice ?? Math.round((report.low + report.high) / 2))}</div></section>
      <div class="summary"><div class="summary-card accent"><span class="eyebrow">Valuation confidence</span><strong>${report.confidence}%</strong></div><div class="summary-card"><span class="eyebrow">Report validity</span><strong>${MOBILE_RATE_CARD.validityDays} Days</strong></div><div class="summary-card"><span class="eyebrow">Overall assessment</span><strong>${report.score}/100</strong></div></div>
      <p class="explanation"><strong>Valuation opinion:</strong> Most transactions for a comparable device in this reported condition are expected to fall within the range above.</p><p class="disclaimer">Final value may vary following physical inspection and verification of accessories, battery health, ownership status and local demand.</p>

      <section class="section"><div class="section-heading"><span class="section-number">01</span><h2>Device details</h2></div><table><tbody>
        <tr><th>Manufacturer</th><td>${escapeHtml(report.manufacturer || report.brand)}</td><th>Model</th><td>${escapeHtml(report.model)}</td></tr>
        <tr><th>RAM</th><td>${report.ram} GB</td><th>Total Storage</th><td>${report.storage} GB</td></tr>
        <tr><th>Processor tier</th><td>${escapeHtml(MOBILE_RATE_CARD.processor[report.processor].label)}</td><th>CPU architecture</th><td>${escapeHtml(report.cpuArchitecture || 'Unavailable')}</td></tr>
        <tr><th>Operating system</th><td>${escapeHtml(report.androidVersion || 'Unavailable')}</td><th>${report.ageBasis === 'model_release' ? 'Model age' : report.ageBasis === 'user_reported' ? 'Reported device age' : 'Device age'}</th><td>${report.ageBasis === 'unknown' ? 'Unknown / not verified' : escapeHtml(ageLabel)}</td></tr>
        <tr><th>Verified Release Date</th><td>${report.verifiedReleaseDate ? dateLabel(report.verifiedReleaseDate) : 'Not verified'}</td><th>Release verification</th><td>${report.verifiedReleaseDate ? 'Matched against the verified device model catalogue' : 'No verified model release record available'}</td></tr>
        <tr><th>Assessed condition</th><td>${escapeHtml(conditionLabel)}</td><th>Battery health</th><td>${report.batteryHealthType === 'unavailable' ? 'Not Verified' : `${report.battery}% (${report.batteryHealthType === 'measured' ? 'Measured' : 'Estimated'})`}</td></tr>
        <tr><th>Display specification check</th><td colspan="3"><strong>${escapeHtml(report.displayAssessment?.label || 'Not tested')}</strong>${report.displayAssessment?.details.length ? `<br><span class="muted">${escapeHtml(report.displayAssessment.details.join(' • '))}</span>` : ''}<br><span class="muted">OEM screen authenticity: not electronically verified.</span></td></tr>
      </tbody></table></section>

      <section class="section"><div class="section-heading"><span class="section-number">02</span><h2>Valuation assessment</h2></div><table class="assessment"><thead><tr><th>Assessment area</th><th>Score</th><th>What it reflects</th></tr></thead><tbody>
        <tr><td>Device performance</td><td class="score">${report.performanceScore}/100</td><td>Processor tier, RAM and storage configuration</td></tr>
        <tr><td>Physical condition</td><td class="score">${Math.round(MOBILE_RATE_CARD.condition[report.condition as MobileCondition]?.multiplier * 100 || 0)}/100</td><td>Reported screen and body condition</td></tr>
        <tr><td>Battery</td><td class="score">${report.batteryScore}/100</td><td>Estimated from available device diagnostics; battery replacement risk applies at 75% or below</td></tr>
        <tr><td>Software support</td><td class="score">${report.softwareSupportScore}/100</td><td>${escapeHtml(report.androidSupportStatus)}</td></tr>
        <tr><td>Market demand</td><td class="score">${report.marketValueScore}/100</td><td>${demandLabel} demand profile for this brand and configuration</td></tr>
        <tr><th>Overall device assessment</th><th class="score">${report.score}/100</th><th>Weighted assessment across the factors above</th></tr>
      </tbody></table></section>

      <section class="section"><div class="section-heading"><span class="section-number">03</span><h2>Current market evidence</h2></div><div class="market-grid"><div class="market-card"><span class="eyebrow">Current new price</span><strong>${report.validation.currentNewPrice ? money(report.validation.currentNewPrice) : 'Not available'}</strong></div><div class="market-card"><span class="eyebrow">Observed used market</span><strong>${report.validation.marketLow && report.validation.marketHigh ? `${money(report.validation.marketLow)} – ${money(report.validation.marketHigh)}` : report.validation.marketMedian ? money(report.validation.marketMedian) : 'Insufficient evidence'}</strong></div><div class="market-card"><span class="eyebrow">Estimated value retained</span><strong>${retainedValue === null ? 'Not available' : `${retainedValue}%`}</strong></div></div><p class="market-note">Evidence quality: ${escapeHtml(report.validation.evidenceQuality || 'none')} • Search checked: ${report.validation.searchedAt ? dateLabel(report.validation.searchedAt) : 'Not available'} • Asking prices are not confirmed sale prices.</p>${sourceList}</section>

      <section class="section"><div class="section-heading"><span class="section-number">04</span><h2>Selling recommendation</h2></div><div class="method"><p><strong>List near ${money(report.recommendedSellingPrice ?? Math.round((report.low + report.high) / 2))}.</strong> Based on the submitted device configuration and condition, a realistic selling outcome is expected between ${money(report.low)} and ${money(report.high)}.</p><p>The final transaction price can vary with buyer demand, physical verification, accessories and negotiation.</p></div></section>

      <section class="section"><div class="section-heading"><span class="section-number">05</span><h2>Valuation methodology</h2></div><div class="method"><p>The NearHub valuation engine assesses hardware configuration, model age, reported physical condition, battery health, software support and current market demand.</p><p>${report.ageBasis === 'model_release' ? 'The displayed age is the model age calculated from its release date; this device’s purchase or activation date has not been verified.' : report.ageBasis === 'user_reported' ? 'Device age was reported by the user and has not been independently verified.' : 'Device age was unavailable and is not presented as a verified fact.'}</p><p>${escapeHtml(report.validation.rationale)} ${report.validation.comparableCount ? `${report.validation.comparableCount} current NearHub market comparables were included.` : 'No sufficiently relevant NearHub market comparables were available.'}</p><p>The selling range is 20% wide (±10% around the recommended price). Confidence reflects input completeness, grounded market evidence, comparable evidence and validation quality.</p></div></section>

      <section class="section"><div class="section-heading"><span class="section-number">06</span><h2>Verification status</h2></div><div class="notice"><strong>Physical and IMEI verification not completed</strong><p>The device has not been physically inspected. IMEI blacklist status, activation lock, internal components and submitted condition should be verified independently.</p></div></section>

      <footer class="footer"><div><strong>NearHub Mobile Valuation</strong><br>This report is an AI-assisted market estimate and not a purchase guarantee.</div><div class="footer-right">Report ${escapeHtml(report.reportId)}<br>Valid until ${dateLabel(report.validUntil)} • Engine ${escapeHtml(report.modelVersion)}</div></footer>
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
    const enteredHealth = Number(battery);
    const health =
      Number.isFinite(enteredHealth) && enteredHealth >= 1 && enteredHealth <= 100
        ? Math.round(enteredHealth)
        : 85;
    const deviceMaster = findMobileDeviceMaster(brand, model);
    const releaseDate = deviceMaster ? new Date(deviceMaster.releaseDate) : null;
    const reportedPurchaseAge = age.trim() ? purchaseAgeInMonths(age) : null;
    if (!deviceMaster && age.trim() && reportedPurchaseAge === null) {
      Alert.alert(
        'Invalid purchase date',
        'Enter the purchase month and year as MM/YY, for example 11/23.'
      );
      return;
    }
    const months =
      releaseDate && !Number.isNaN(releaseDate.getTime())
        ? Math.max(
            0,
            (new Date().getFullYear() - releaseDate.getFullYear()) * 12 +
              new Date().getMonth() -
              releaseDate.getMonth()
          )
        : (reportedPurchaseAge ?? 0);
    const ageSource = deviceMaster ? 'model_release' : age.trim() ? 'user_reported' : 'unknown';
    setIsEvaluating(true);
    setEvaluationProgress(5);
    const progressTimer = setInterval(() => {
      setEvaluationProgress((current) => {
        if (current === null) return 5;
        const remaining = 92 - current;
        return Math.min(92, current + Math.max(1, Math.ceil(remaining * 0.12)));
      });
    }, 450);
    try {
      const response = await fetch(`${getApiUrl()}/api/valuations/mobile`, {
        method: 'POST',
        headers: buildUserAuthHeaders(user),
        body: JSON.stringify({
          brand: brand.trim(),
          model: model.trim(),
          buildModel: buildModel.trim(),
          ram: r,
          storage: s,
          processor,
          ageMonths: months,
          ageSource,
          battery: health,
          batteryHealthType: batteryDiagnostic.includes('Measured') ? 'measured' : 'unavailable',
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
      const next = {
        ...(body.report as Report),
        verifiedReleaseDate:
          (body.report as Report).verifiedReleaseDate || deviceMaster?.releaseDate || null,
        displayAssessment: displayAssessment || undefined,
      };
      setEvaluationProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 300));
      setReport(next);
      setReports([]);
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    } catch (error) {
      Alert.alert(
        'Valuation unavailable',
        error instanceof Error ? error.message : 'Please check your connection and try again.'
      );
    } finally {
      clearInterval(progressTimer);
      setIsEvaluating(false);
      setEvaluationProgress(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingTop: Math.max(insets.top, 14), paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <LinearGradient colors={['#155EEF', '#7257F5']} style={styles.headerIcon}>
          <Feather name="smartphone" size={27} color="#fff" />
        </LinearGradient>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>AI Mobile Valuation</Text>
          <Text style={styles.subtitle}>
            Get an independent, condition-based market estimate in seconds.
          </Text>
        </View>
        <View style={styles.trustBadge}>
          <Feather name="shield" size={19} color="#0F9D88" />
          <Text style={styles.trustValue}>100%</Text>
          <Text style={styles.trustLabel}>Independent</Text>
        </View>
      </View>
      <Pressable style={styles.detectButton} onPress={detectDevice}>
        <LinearGradient
          colors={['#155EEF', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.detectButtonContent}
        >
          <View style={styles.detectIcon}>
            <Feather name="cpu" size={22} color="#fff" />
          </View>
          <View style={styles.detectCopy}>
            <Text style={styles.detectText}>
              {detected ? 'Device details detected' : 'Auto-detect this Android device'}
            </Text>
            <Text style={styles.detectSubtext}>Tap to fetch specs for greater accuracy</Text>
          </View>
        </LinearGradient>
      </Pressable>
      <View style={styles.card}>
        <View style={styles.sectionHeading}>
          <View style={styles.smallIcon}>
            <Feather name="smartphone" size={15} color="#29416F" />
          </View>
          <Text style={styles.sectionTitle}>Device details</Text>
        </View>
        {detected ? (
          <>
            <Text style={styles.detectedMeta}>
              {manufacturer || 'Unknown manufacturer'} • Android{' '}
              {androidVersion || 'Unknown version'} • CPU {cpuArchitecture || 'Unknown'} • Total
              Storage {detectedStorage ? `${detectedStorage} GB` : 'Unknown'}
            </Text>
            {displayAssessment ? (
              <View
                style={[
                  styles.displayCheck,
                  displayAssessment.status === 'matches'
                    ? styles.displayCheckPass
                    : displayAssessment.status === 'mismatch'
                      ? styles.displayCheckFail
                      : styles.displayCheckNeutral,
                ]}
              >
                <Feather
                  name={displayAssessment.status === 'matches' ? 'check-circle' : 'monitor'}
                  size={14}
                  color={displayAssessment.status === 'matches' ? '#166534' : '#92400E'}
                />
                <Text style={styles.displayCheckText}>{displayAssessment.label}</Text>
              </View>
            ) : null}
          </>
        ) : null}
        <View style={styles.row}>
          <View style={styles.fieldColumn}>
            <Text style={styles.fieldLabel}>Brand</Text>
            <TextInput
              style={[styles.input, detected && styles.inputLocked]}
              editable={!detected}
              placeholder="e.g. Samsung"
              value={brand}
              onChangeText={setBrand}
            />
          </View>
          <View style={styles.fieldColumn}>
            <Text style={styles.fieldLabel}>Model</Text>
            <TextInput
              style={[styles.input, detected && styles.inputLocked]}
              editable={!detected}
              placeholder="e.g. S24"
              value={model}
              onChangeText={setModel}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.fieldColumn}>
            <Text style={styles.fieldLabel}>RAM</Text>
            <TextInput
              style={[styles.input, detected && styles.inputLocked]}
              editable={!detected}
              keyboardType="numeric"
              placeholder="8 GB"
              value={ram}
              onChangeText={setRam}
            />
          </View>
          <View style={styles.fieldColumn}>
            <Text style={styles.fieldLabel}>Total Storage</Text>
            <TextInput
              style={[styles.input, detected && styles.inputLocked]}
              editable={!detected}
              keyboardType="numeric"
              placeholder="128 GB"
              value={storage}
              onChangeText={setStorage}
            />
          </View>
        </View>
        <View style={styles.labelRow}>
          <View style={styles.smallIcon}>
            <Feather name="cpu" size={14} color="#29416F" />
          </View>
          <Text style={styles.label}>Processor tier (auto-detected)</Text>
        </View>
        <View style={styles.chips}>
          {PROCESSORS.map((item) => (
            <View
              key={item}
              style={[styles.chip, processor === item && styles.processorChipActive]}
            >
              <Text style={[styles.chipText, processor === item && styles.processorChipTextActive]}>
                {MOBILE_RATE_CARD.processor[item].label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.labelRow}>
          <View style={styles.smallIcon}>
            <Feather name="smartphone" size={14} color="#29416F" />
          </View>
          <Text style={styles.label}>Screen condition</Text>
        </View>
        <View style={styles.chips}>
          {SCREEN_CONDITIONS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setScreenCondition(item)}
              style={[styles.chip, screenCondition === item && styles.conditionChipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  screenCondition === item && styles.conditionChipTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.labelRow}>
          <View style={styles.smallIcon}>
            <Feather name="shield" size={14} color="#29416F" />
          </View>
          <Text style={styles.label}>Body scratches &amp; defects</Text>
        </View>
        <View style={styles.chips}>
          {BODY_DEFECTS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setBodyDefect(item)}
              style={[styles.chip, bodyDefect === item && styles.conditionChipActive]}
            >
              <Text
                style={[styles.chipText, bodyDefect === item && styles.conditionChipTextActive]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <View style={styles.fieldColumn}>
            <Text style={styles.fieldLabel}>Purchased (MM/YY)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="MM/YY"
              value={age}
              onChangeText={(value) => setAge(formatPurchaseMonthYear(value))}
              maxLength={7}
            />
          </View>
          <View style={styles.fieldColumn}>
            <Text style={styles.fieldLabel}>Battery health</Text>
            <View style={styles.input}>
              <Text style={styles.inputPlaceholder}>{battery || 'Not verified'}</Text>
            </View>
            <Text style={styles.fieldHint}>
              {battery ? batteryDiagnostic : 'Not verified. A physical inspection is required.'}
            </Text>
          </View>
        </View>
        <View style={styles.tipCard}>
          <Feather name="star" size={20} color="#3155D9" />
          <View style={styles.tipCopy}>
            <Text style={styles.tipTitle}>Tip</Text>
            <Text style={styles.tipText}>
              Accurate details help us give you the fairest, market-aligned valuation.
            </Text>
          </View>
          <Feather name="trending-up" size={34} color="#6D5DFB" />
        </View>
      </View>
      <Pressable
        style={[styles.buttonWrap, (!canEvaluate || isEvaluating) && styles.buttonDisabled]}
        disabled={!canEvaluate || isEvaluating}
        onPress={evaluate}
      >
        <LinearGradient
          colors={['#155EEF', '#5B5CF6', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.button}
        >
          <Feather name="star" size={19} color="#fff" />
          <Text style={styles.buttonText}>
            {isEvaluating ? 'Generating valuation…' : 'Generate AI Valuation'}
          </Text>
        </LinearGradient>
      </Pressable>
      <Modal visible={isEvaluating} transparent animationType="fade" statusBarTranslucent={false}>
        <View style={styles.progressOverlay}>
          <View style={styles.progressCard}>
            <View
              style={styles.progressRing}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: evaluationProgress ?? 0 }}
            >
              <Svg
                width={PROGRESS_RING_SIZE}
                height={PROGRESS_RING_SIZE}
                style={styles.progressRingSvg}
              >
                <Circle
                  cx={PROGRESS_RING_SIZE / 2}
                  cy={PROGRESS_RING_SIZE / 2}
                  r={PROGRESS_RING_RADIUS}
                  fill="none"
                  stroke="#DBEAFE"
                  strokeWidth={PROGRESS_RING_STROKE}
                />
                <Circle
                  cx={PROGRESS_RING_SIZE / 2}
                  cy={PROGRESS_RING_SIZE / 2}
                  r={PROGRESS_RING_RADIUS}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth={PROGRESS_RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${PROGRESS_RING_CIRCUMFERENCE} ${PROGRESS_RING_CIRCUMFERENCE}`}
                  strokeDashoffset={
                    PROGRESS_RING_CIRCUMFERENCE *
                    (1 - Math.max(0, Math.min(100, evaluationProgress ?? 0)) / 100)
                  }
                />
              </Svg>
              <Text style={styles.progressRingText}>{evaluationProgress ?? 0}%</Text>
            </View>
            <Text style={styles.progressTitle}>Generating AI Valuation</Text>
            <Text style={styles.progressMessage}>
              Checking device details and current market evidence…
            </Text>
          </View>
        </View>
      </Modal>
      <View style={styles.secureFooter}>
        <Feather name="lock" size={13} color="#94A3B8" />
        <Text style={styles.secureText}>Secure, private &amp; independent estimate</Text>
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
  container: { flex: 1, backgroundColor: '#F7F9FD' },
  content: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
  },
  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900', color: '#10244C' },
  subtitle: { color: '#52647F', marginTop: 7, fontSize: 12, lineHeight: 18 },
  trustBadge: {
    width: 67,
    paddingVertical: 11,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  trustValue: { color: '#15305D', fontSize: 14, fontWeight: '900', marginTop: 2 },
  trustLabel: { color: '#52647F', fontSize: 8, marginTop: 1 },
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
    marginHorizontal: 14,
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#35517A',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#10244C' },
  smallIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#F1F5FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectButton: {
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#3155D9',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 5,
  },
  detectButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  detectIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectCopy: { flex: 1 },
  detectText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  detectSubtext: { color: '#DCE8FF', fontSize: 11, marginTop: 3 },
  detectedMeta: { color: '#64748B', fontSize: 11, marginBottom: 8, textAlign: 'center' },
  displayCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  displayCheckPass: { backgroundColor: '#ECFDF3', borderColor: '#BBF7D0', borderWidth: 1 },
  displayCheckFail: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1 },
  displayCheckNeutral: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1 },
  displayCheckText: { flex: 1, color: '#334155', fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  fieldColumn: { flex: 1, minWidth: 0 },
  fieldLabel: { color: '#172B52', fontSize: 12, fontWeight: '800', marginBottom: 7 },
  fieldHint: { color: '#64748B', fontSize: 9, lineHeight: 13, marginTop: 5 },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#CFD8E6',
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 13,
    color: '#0F172A',
    backgroundColor: '#fff',
  },
  inputPlaceholder: {
    color: '#6B7280',
    fontSize: 16,
  },
  inputLocked: { backgroundColor: '#F1F5F9', color: '#475569' },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5, marginBottom: 9 },
  label: { color: '#172B52', fontSize: 13, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 },
  chip: {
    flexGrow: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#F3F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: { fontSize: 11, color: '#334766', textAlign: 'center' },
  processorChipActive: { backgroundColor: '#F5F6FF', borderColor: '#5965F2' },
  processorChipTextActive: { color: '#244FD1', fontWeight: '800' },
  conditionChipActive: { backgroundColor: '#F0FFF7', borderColor: '#32C477' },
  conditionChipTextActive: { color: '#14A35F', fontWeight: '800' },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 3,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D8E3FA',
    backgroundColor: '#F5F8FF',
  },
  tipCopy: { flex: 1 },
  tipTitle: { color: '#244FD1', fontSize: 13, fontWeight: '900' },
  tipText: { color: '#51647F', fontSize: 10, lineHeight: 15, marginTop: 3 },
  buttonWrap: {
    width: '76%',
    maxWidth: 310,
    alignSelf: 'center',
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#3155D9',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { flex: 1, color: '#fff', fontWeight: '900', fontSize: 16, textAlign: 'center' },
  secureFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
  },
  secureText: { color: '#94A3B8', fontSize: 11 },
  progressRing: {
    width: PROGRESS_RING_SIZE,
    height: PROGRESS_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11, 52, 112, 0.38)',
    paddingHorizontal: 24,
  },
  progressCard: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#0B3470',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  progressRingSvg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  progressRingText: {
    color: '#0B3470',
    fontSize: 24,
    fontWeight: '700',
  },
  progressTitle: {
    marginTop: 16,
    color: '#0B3470',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressMessage: {
    marginTop: 7,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
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
