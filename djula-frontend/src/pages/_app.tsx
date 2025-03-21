import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { SettingsProvider } from '@/src/contexts/SettingsContext';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SettingsProvider>
      <Component {...pageProps} />
    </SettingsProvider>
  );
}

export default MyApp;