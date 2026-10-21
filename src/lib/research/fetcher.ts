import robotsParser from "robots-parser";
import { stableHash } from "@/lib/utils";

/**
 * Politeness layer for outbound research requests:
 *  - per-host minimum delay between requests (token bucket, 1 token)
 *  - robots.txt check per host (cached in-process)
 *  - honest, identifiable User-Agent
 *  - hard timeout via AbortController
 */

const USER_AGENT =
  process.env.RESEARCH_USER_AGENT ?? "PayGateResearch/1.0";
const MIN_DELAY_MS = Number(process.env.RESEARCH_MIN_DELAY_MS ?? 1500);
const RESPECT_ROBOTS =
  (process.env.RESEARCH_RESPECT_ROBOTS ?? "true") !== "false";
const TIMEOUT_MS = 20_000;

const lastFetchAt = new Map<string, number>();
const robotsCache = new Map<string, ReturnType<typeof robotsParser>>();

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
  hash: string;
  fetchedAt: Date;
  robotsAllowed: boolean;
  error?: string;
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

async function throttle(h: string) {
  const now = Date.now();
  const wait = MIN_DELAY_MS - (now - (lastFetchAt.get(h) ?? 0));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastFetchAt.set(h, Date.now());
}

async function robotsAllowed(url: string): Promise<boolean> {
  if (!RESPECT_ROBOTS) return true;
  const h = host(url);
  if (!h) return false;
  if (!robotsCache.has(h)) {
    try {
      const res = await fetch(`https://${h}/robots.txt`, {
        headers: { "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const text = res.ok ? await res.text() : "";
      robotsCache.set(
        h,
        robotsParser(`https://${h}/robots.txt`, text)
      );
    } catch {
      robotsCache.set(h, robotsParser(`https://${h}/robots.txt`, ""));
    }
  }
  const robots = robotsCache.get(h);
  return robots ? robots.isAllowed(url, USER_AGENT) !== false : true;
}

export async function fetchPage(url: string): Promise<FetchResult> {
  const fetchedAt = new Date();
  const base: Omit<FetchResult, "status" | "body" | "contentType" | "hash"> = {
    url,
    finalUrl: url,
    fetchedAt,
    robotsAllowed: true,
  };

  const allowed = await robotsAllowed(url);
  if (!allowed) {
    return {
      ...base,
      status: 0,
      body: "",
      contentType: "",
      hash: "",
      robotsAllowed: false,
      error: "Disallowed by robots.txt",
    };
  }

  await throttle(host(url));

  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    return {
      ...base,
      finalUrl: res.url || url,
      status: res.status,
      contentType,
      body: body.slice(0, 2_000_000),
      hash: stableHash(body),
    };
  } catch (err) {
    return {
      ...base,
      status: 0,
      body: "",
      contentType: "",
      hash: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
