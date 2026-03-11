import SettingsView from '../components/SettingsView';

interface SettingsPageProps {
  focusStarterKit?: boolean;
}

export default function SettingsPage({ focusStarterKit = false }: SettingsPageProps) {
  return <SettingsView focusStarterKit={focusStarterKit} />;
}
