/**
 * Geolocation Service
 *
 * Detects IP geolocation using free APIs to match fingerprint
 * timezone/language with proxy exit IP location.
 *
 * Uses ip-api.com as primary API (free, no API key required).
 */

import type { GeoLocation, ProxyConfig } from './types.ts';
import { TIMEZONES, COUNTRY_LANGUAGES } from './fingerprint-data.ts';
import { spawn } from 'child_process';

/**
 * Detect the geolocation of an IP address
 * Uses ip-api.com (free, no API key required)
 */
export async function detectIpGeoLocation(ip: string): Promise<GeoLocation | null> {
  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,timezone,lat,lon,isp`
    );

    if (!response.ok) {
      console.error(`IP geolocation request failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as {
      status: string;
      message?: string;
      country?: string;
      countryCode?: string;
      region?: string;
      regionName?: string;
      city?: string;
      timezone?: string;
      lat?: number;
      lon?: number;
      isp?: string;
    };

    if (data.status !== 'success') {
      console.error(`IP geolocation failed: ${data.message || 'Unknown error'}`);
      return null;
    }

    return {
      ip,
      country: data.countryCode || '',
      countryName: data.country || '',
      region: data.regionName || data.region || '',
      city: data.city || '',
      timezone: data.timezone || '',
      latitude: data.lat || 0,
      longitude: data.lon || 0,
      isp: data.isp,
      detectedAt: Date.now(),
    };
  } catch (error) {
    console.error('Failed to detect IP geolocation:', error);
    return null;
  }
}

/**
 * Detect geolocation through a proxy by making a request that reveals the exit IP
 * Uses curl with proxy support as it handles both SOCKS5 and HTTP proxies
 * Throws an error with specific message if detection fails
 */
export async function detectProxyGeoLocation(proxy: ProxyConfig): Promise<GeoLocation | null> {
  console.log(`Detecting geolocation for proxy: ${proxy.type}://${proxy.host}:${proxy.port}`);

  // First, get the exit IP of the proxy using curl
  let exitIp: string | null = null;
  let lastError: string | null = null;

  try {
    exitIp = await getProxyExitIpViaCurl(proxy);
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.log('curl method failed:', lastError);
  }

  // If curl failed, try alternative method
  if (!exitIp) {
    console.log('Trying alternative IP detection services...');
    try {
      exitIp = await getProxyExitIpAlternative(proxy);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.log('Alternative method failed:', lastError);
    }
  }

  if (!exitIp) {
    const errorMsg = lastError
      ? `Failed to connect through proxy: ${lastError}`
      : 'Could not determine exit IP. Proxy may be offline or unreachable.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  console.log('Exit IP detected:', exitIp);

  // Then detect geolocation for that IP
  const geoLocation = await detectIpGeoLocation(exitIp);
  if (!geoLocation) {
    throw new Error(`IP detected (${exitIp}) but geolocation lookup failed`);
  }

  return geoLocation;
}

/**
 * Alternative method to get exit IP using ip-api.com directly
 * This calls ip-api.com which returns the client's IP in the response
 */
async function getProxyExitIpAlternative(proxy: ProxyConfig): Promise<string | null> {
  return new Promise((resolve) => {
    // Try using curl with different IP detection services
    const services = [
      'http://ip-api.com/json/?fields=query',
      'https://ifconfig.me/ip',
      'https://icanhazip.com',
    ];

    const tryService = async (index: number) => {
      if (index >= services.length) {
        resolve(null);
        return;
      }

      const service = services[index];
      const args = [
        '-s',
        '-S',
        '--max-time', '15',
        '--connect-timeout', '10',
      ];

      if (proxy.type === 'socks5') {
        args.push('--socks5-hostname', `${proxy.host}:${proxy.port}`);
        if (proxy.username && proxy.password) {
          args.push('--proxy-user', `${proxy.username}:${proxy.password}`);
        }
      } else {
        let proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`;
        if (proxy.username && proxy.password) {
          proxyUrl = `${proxy.type}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
        }
        args.push('--proxy', proxyUrl);
      }

      args.push(service!);

      console.log(`Trying alternative service: ${service}`);

      const curl = spawn('curl', args);
      let stdout = '';

      curl.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      curl.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          const response = stdout.trim();

          // If it's JSON (ip-api.com), parse it
          if (response.startsWith('{')) {
            try {
              const json = JSON.parse(response);
              if (json.query) {
                resolve(json.query);
                return;
              }
            } catch {
              // Not JSON, continue
            }
          }

          // Check if it's a valid IP
          const ip = response.split('\n')[0]?.trim();
          if (ip && (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || ip.includes(':'))) {
            resolve(ip);
            return;
          }
        }

        // Try next service
        tryService(index + 1);
      });

      curl.on('error', () => {
        tryService(index + 1);
      });
    };

    tryService(0);
  });
}

/**
 * Get the exit IP address of a proxy using curl
 * This works for both SOCKS5 and HTTP/HTTPS proxies
 */
async function getProxyExitIpViaCurl(proxy: ProxyConfig): Promise<string | null> {
  return new Promise((resolve, reject) => {
    // Build curl arguments based on proxy type
    const args = [
      '-s', // Silent
      '-S', // Show errors
      '--max-time', '20', // Timeout
      '--connect-timeout', '10',
    ];

    // Add proxy arguments based on type
    if (proxy.type === 'socks5') {
      // Use --socks5-hostname to resolve DNS through proxy
      args.push('--socks5-hostname', `${proxy.host}:${proxy.port}`);
      if (proxy.username && proxy.password) {
        args.push('--proxy-user', `${proxy.username}:${proxy.password}`);
      }
    } else {
      // HTTP/HTTPS proxy
      let proxyUrl: string;
      if (proxy.username && proxy.password) {
        proxyUrl = `${proxy.type}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
      } else {
        proxyUrl = `${proxy.type}://${proxy.host}:${proxy.port}`;
      }
      args.push('--proxy', proxyUrl);
    }

    // Target URL to get IP
    args.push('https://api.ipify.org');

    console.log('Running curl with args:', args.join(' ').replace(/:[^:@]+@/, ':***@'));

    const curl = spawn('curl', args);
    let stdout = '';
    let stderr = '';

    curl.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    curl.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    curl.on('close', (code) => {
      console.log('curl exit code:', code, 'stdout:', stdout, 'stderr:', stderr);
      if (code === 0) {
        const ip = stdout.trim();
        // Validate IP format (IPv4)
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
          console.log('Detected exit IP:', ip);
          resolve(ip);
          return;
        }
        // Try IPv6 format
        if (ip.includes(':')) {
          console.log('Detected exit IP (IPv6):', ip);
          resolve(ip);
          return;
        }
        // Invalid response format
        reject(new Error(`Invalid IP response: ${ip}`));
        return;
      }
      // curl failed
      const errorMsg = stderr.trim() || stdout.trim() || `exit code ${code}`;
      reject(new Error(`Proxy connection failed: ${errorMsg}`));
    });

    curl.on('error', (err) => {
      console.error('Failed to spawn curl:', err);
      reject(new Error(`curl not found or failed to execute: ${err.message}`));
    });
  });
}

/**
 * Get the recommended language configuration for a country code
 */
export function getLanguageForCountry(
  countryCode: string
): { language: string; languages: string[] } {
  const code = countryCode.toUpperCase();
  const langConfig = COUNTRY_LANGUAGES[code];

  if (langConfig) {
    return langConfig;
  }

  // Default to English (US) if country not found
  return { language: 'en-US', languages: ['en-US', 'en'] };
}

/**
 * Get timezone offset in minutes from IANA timezone name
 * Returns undefined if timezone not found in our data
 */
export function getTimezoneOffset(timezoneName: string): number | undefined {
  const tz = TIMEZONES.find((t) => t.name === timezoneName);
  return tz?.offset;
}

/**
 * Validate if a string is a valid IANA timezone
 */
export function isValidTimezone(timezoneName: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezoneName });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get timezone offset dynamically using JavaScript Intl API
 * More accurate than static lookup, handles DST
 */
export function getTimezoneOffsetDynamic(timezoneName: string): number | undefined {
  try {
    // Get the offset in minutes
    const now = new Date();
    const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const local = new Date(now.toLocaleString('en-US', { timeZone: timezoneName }));
    // Offset is UTC - local, convert to minutes
    return Math.round((utc.getTime() - local.getTime()) / 60000);
  } catch {
    // Fall back to static lookup
    return getTimezoneOffset(timezoneName);
  }
}

/**
 * Get country flag emoji from country code
 */
export function getCountryFlag(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '🌍';

  // Convert country code to flag emoji using regional indicator symbols
  const codePoints = code
    .split('')
    .map((char) => 0x1f1e6 + char.charCodeAt(0) - 'A'.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}
