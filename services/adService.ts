import { AdData } from '../types';

// Replace with your published Google Sheet CSV URL if needed
export const DATA_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJFFwidtwlArlo9ncjT4XIQh7ANWevpa7WrQCohc57O-Q44Ljns9lUXnlPvdPPRfxCZPaw9kLSl8N4/pub?output=csv"; 

// INSERT YOUR MAKE.COM WEBHOOK URL HERE
export const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/sqjjitn1wqf4i9u9gt9ijxus1olstcju";

// How long to wait for Apify/Make to finish (in seconds). Default 5 minutes.
export const SCRAPE_WAIT_TIME_SECONDS = 300;

const MOCK_DATA: AdData[] = [
  {
    id: '1',
    page_name: 'Lumina Skin',
    reach: 150000,
    ad_library_url: '#',
    video_url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 
    thumbnail: 'https://picsum.photos/600/340',
    heading: 'Get Glowing Skin in 7 Days',
    ad_copy: "Stop masking your skin problems. Solve them. Our new Vitamin C serum is clinically proven to brighten skin tone.",
  },
];

export const fetchAdData = async (useRealUrl: boolean = true, sessionId?: string): Promise<AdData[]> => {
  // Append timestamp to URL to prevent caching when reloading after scrape
  const urlWithCacheBust = `${DATA_URL}&t=${new Date().getTime()}`;

  if (!useRealUrl) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return MOCK_DATA;
  }

  try {
    const response = await fetch(urlWithCacheBust, {
      method: 'GET',
      cache: 'no-store', // Ensure we don't get cached data
      redirect: 'follow'
    });
    
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    
    const text = await response.text();
    return parseCSV(text, sessionId);
  } catch (error) {
    console.error("Error fetching data, falling back to mock", error);
    // Fallback to empty array or mock data depending on preference, keeping empty to show state
    return []; 
  }
};

export const triggerScrapeWorkflow = async (urls: string[], sessionId: string): Promise<boolean> => {
  if (!MAKE_WEBHOOK_URL || MAKE_WEBHOOK_URL.includes("INSERT_YOUR")) {
    console.error("Make Webhook URL not configured");
    return true; 
  }

  try {
    const payload = {
      "sessionId": sessionId, // <--- NYT FELT: Make skal bruge dette!
      "count": 300,
      "period": "last30d",
      "scrapeAdDetails": true,
      "scrapePageAds.activeStatus": "all",
      "scrapePageAds.countryCode": "ALL",
      "urls": urls.map(url => ({
        "url": url,
        "method": "GET"
      }))
    };

    // Using mode: 'no-cors' is crucial for client-side webhooks to Make.com
    // because Make usually doesn't send Access-Control-Allow-Origin headers.
    // 'no-cors' allows the request to go through, but we get an "opaque" response.
    await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    // Since we can't read the status in no-cors mode, we assume success if no network error was thrown.
    return true;
  } catch (error) {
    console.error("Failed to trigger Make scenario", error);
    return false;
  }
};

const cleanVideoUrl = (rawUrl: string | undefined): string => {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  
  // Handle JSON formatted URLs (common in some scrapers)
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.video_hd_url || parsed.video_url || '';
    } catch (e) {
      return '';
    }
  }
  
  // Handle standard URLs
  if (trimmed.startsWith('http')) {
    return trimmed;
  }
  
  return '';
};

// Advanced CSV Parser that handles newlines inside quotes
// Advanced CSV Parser that handles newlines inside quotes
const parseCSV = (text: string, sessionId?: string): AdData[] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  // Parse character by character to handle newlines within quoted fields correctly
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Handle escaped quotes ("")
        currentVal += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++; // Handle CRLF
      currentRow.push(currentVal);
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  // Push last row if exists
  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal);
    rows.push(currentRow);
  }

  const data: AdData[] = [];
  
  // Skip header (row 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Basic validation to ensure row has enough columns
    if (row.length < 6) continue;

    /**
     * MAPPING:
     * Col 0: ad_id
     * Col 1: Page Name
     * Col 2: Video URL
     * Col 3: Thumbnail
     * Col 4: Outbound Link
     * Col 5: Total reach
     * Col 6: Heading
     * Col 7: Ad copy
     * Col 8: Ad Library URL
     * Col 9: Session ID (Make sørger for at mappe dette)
     */
    
    const rowSessionId = row[9]?.trim();

    // --- FILTRERING START ---
    // Hvis appen kører med et sessionId, og rækken i CSV'en ikke matcher det ID, så skip rækken.
    // Dette sikrer, at brugeren kun ser sine egne data.
    if (sessionId && rowSessionId !== sessionId) {
        continue;
    }
    // --- FILTRERING SLUT ---

    const rawReach = row[5]?.replace(/[^0-9]/g, '') || '0';

    data.push({
      id: row[0] || `row-${i}`,
      page_name: row[1]?.trim() || "Unknown Brand",
      video_url: cleanVideoUrl(row[2]), // Husk at cleanVideoUrl funktionen skal være tilgængelig i filen
      thumbnail: row[3]?.trim() || "", 
      reach: parseInt(rawReach),
      heading: row[6]?.trim() || "",
      ad_copy: row[7]?.trim() || "",
      ad_library_url: row[8]?.trim() || "#"
    });
  }

  // Sort by reach (descending) and take top 20
  return data.sort((a, b) => b.reach - a.reach).slice(0, 20);
};