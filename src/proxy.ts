import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * Publication gate for dynamic routes.
 *
 * Under Cache Components, `notFound()` thrown during streamed rendering keeps
 * a 200 status (the shell commits first) — a soft-404. The only documented
 * way to return a real 404 for a request-time check is in Proxy, which runs
 * before rendering. This file performs a single indexed existence check for
 * each dynamic route family so unpublished providers, draft/review/rejected
 * content pages, and unknown countries/industries return HTTP 404.
 *
 * Fail-open: a DB error never takes the whole site down — the page-level
 * `notFound()` checks still apply as the content-safety backstop.
 */

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Not found | PayGate Directory</title>
<style>
  body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;background:#fafafa;color:#18181b}
  main{text-align:center;max-width:28rem;padding:2rem}
  h1{font-size:1.5rem;margin:0 0 .5rem}
  p{color:#52525b;margin:0 0 1.5rem}
  a{color:#18181b;text-decoration:underline}
</style>
</head>
<body><main>
<h1>This page could not be found.</h1>
<p>The resource you're looking for doesn't exist or isn't published yet.</p>
<a href="/">Back to the directory</a>
</main></body>
</html>`;

function notFoundResponse() {
  return new NextResponse(NOT_FOUND_HTML, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function proxy(req: NextRequest) {
  const seg = req.nextUrl.pathname.split("/").filter(Boolean);
  // Only guard detail routes — index pages like /providers pass through.
  if (seg.length !== 2) return NextResponse.next();
  const [section, slug] = seg;
  if (!slug) return NextResponse.next();

  try {
    let exists: boolean;
    switch (section) {
      case "providers":
        exists = !!(await db.provider.findFirst({
          where: { slug, status: "published" },
          select: { id: true },
        }));
        break;
      case "guides":
        exists = !!(await db.contentPage.findFirst({
          where: { slug, status: "published" },
          select: { id: true },
        }));
        break;
      case "countries":
        exists = !!(await db.country.findUnique({
          where: { code: slug.toUpperCase() },
          select: { code: true },
        }));
        break;
      case "industries":
        exists = !!(await db.industry.findUnique({
          where: { slug },
          select: { slug: true },
        }));
        break;
      default:
        return NextResponse.next();
    }
    return exists ? NextResponse.next() : notFoundResponse();
  } catch {
    // Fail open: an unavailable DB should not 404 the site; the page-level
    // notFound() remains as the safety net.
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/providers/:path*",
    "/guides/:path*",
    "/countries/:path*",
    "/industries/:path*",
  ],
};
