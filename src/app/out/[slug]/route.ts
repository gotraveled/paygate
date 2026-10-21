import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Affiliate/referral redirect. Only redirects to a stored affiliate URL that
 * exists because a partnership was approved — never constructed on the fly.
 * If no approved affiliate URL exists, falls back to the official site.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const provider = await db.provider.findUnique({
    where: { slug },
    select: { affiliateUrl: true, websiteUrl: true },
  });

  const target = provider?.affiliateUrl ?? provider?.websiteUrl;
  if (!target) {
    return NextResponse.redirect(new URL("/providers", request.url));
  }

  // Fire-and-forget click logging; never block the redirect on it.
  db.referralClick
    .create({
      data: {
        slug,
        target,
        referer: request.headers.get("referer"),
      },
    })
    .catch(() => {});

  return NextResponse.redirect(target, 302);
}
