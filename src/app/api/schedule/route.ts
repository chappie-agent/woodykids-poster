import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { ScheduleRequest } from '@/lib/types';

const ZERNIO_BASE_URL = 'https://zernio.com/api';

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'WoodyKids-Poster/1.0' },
  });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function uploadToZernio(imageBuffer: Buffer): Promise<string> {
  // Step 1: Get presigned upload URL
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) {
    throw new Error('ZERNIO_API_KEY environment variable is not set');
  }

  const uploadUrlResponse = await fetch(`${ZERNIO_BASE_URL}/v1/media/upload`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!uploadUrlResponse.ok) {
    const errorText = await uploadUrlResponse.text();
    throw new Error(`Zernio presigned URL failed (${uploadUrlResponse.status}): ${errorText}`);
  }

  const { uploadUrl, publicUrl } = await uploadUrlResponse.json();

  // Step 2: PUT the image to the presigned URL
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'image/jpeg',
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!putResponse.ok) {
    const errorText = await putResponse.text();
    throw new Error(`Image upload failed (${putResponse.status}): ${errorText}`);
  }

  return publicUrl;
}

async function createZernioPost(
  caption: string,
  mediaUrls: string[],
  platforms: string[],
  scheduledFor: string | null,
  timezone: string
): Promise<string> {
  const platformsArray = platforms.map((platform) => ({
    platform,
    accountId:
      platform === 'instagram'
        ? process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID
        : process.env.ZERNIO_FACEBOOK_ACCOUNT_ID,
  }));

  const mediaItems = mediaUrls.map((url) => ({
    type: 'image',
    url,
  }));

  const payload: Record<string, unknown> = {
    content: caption,
    platforms: platformsArray,
    mediaItems,
    timezone,
  };

  if (scheduledFor) {
    payload.scheduledFor = scheduledFor;
  } else {
    payload.publishNow = true;
  }

  const response = await fetch(`${ZERNIO_BASE_URL}/v1/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.ZERNIO_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zernio post creation failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Response format: { message: 'Post scheduled successfully', post: { _id: '...', ... } }
  return data.post?._id || data.post?.id || 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const body: ScheduleRequest = await request.json();

    const {
      session_id,
      caption,
      image_urls,
      platforms,
      scheduled_for,
      timezone = 'Europe/Amsterdam',
    } = body;

    // Validate input
    if (!caption || !image_urls || image_urls.length === 0) {
      return NextResponse.json(
        { error: 'Caption en minimaal 1 afbeelding zijn vereist' },
        { status: 400 }
      );
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json(
        { error: 'Selecteer minimaal 1 platform' },
        { status: 400 }
      );
    }

    // Download and upload images to Zernio
    const zernioMediaUrls: string[] = [];

    for (let i = 0; i < image_urls.length; i++) {
      const imageUrl = image_urls[i];
      try {
        const buffer = await downloadImage(imageUrl);
        const zernioUrl = await uploadToZernio(buffer);
        zernioMediaUrls.push(zernioUrl);
      } catch (err) {
        console.error(`Failed to process image ${i}:`, err);
        return NextResponse.json(
          { error: `Fout bij verwerken van afbeelding ${i + 1}: ${err instanceof Error ? err.message : 'Onbekend'}` },
          { status: 400 }
        );
      }
    }

    // Create post on Zernio
    let zernioPostId: string;
    try {
      zernioPostId = await createZernioPost(
        caption,
        zernioMediaUrls,
        platforms,
        scheduled_for,
        timezone
      );
    } catch (err) {
      console.error('Failed to create post on Zernio:', err);
      return NextResponse.json(
        { error: `Zernio fout: ${err instanceof Error ? err.message : 'Onbekend'}` },
        { status: 500 }
      );
    }

    // Store post record in Supabase
    try {
      const { data, error } = await supabaseServer
        .from('posts')
        .insert({
          session_id: session_id || null,
          caption,
          image_urls: zernioMediaUrls,
          platforms,
          scheduled_for,
          timezone,
          zernio_post_id: zernioPostId,
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to store post in Supabase:', error);
        // Post was created on Zernio but DB storage failed - still return success
        return NextResponse.json({
          success: true,
          post_id: null,
          zernio_post_id: zernioPostId,
          warning: 'Post ingepland maar niet opgeslagen in database',
        });
      }

      // Update session status if we have a session_id
      if (session_id) {
        await supabaseServer
          .from('sessions')
          .update({ status: 'scheduled' })
          .eq('id', session_id);
      }

      return NextResponse.json({
        success: true,
        post_id: data.id,
        zernio_post_id: zernioPostId,
        message: scheduled_for
          ? `Post ingepland voor ${scheduled_for}`
          : 'Post wordt nu gepubliceerd',
      });
    } catch (err) {
      console.error('Database error:', err);
      return NextResponse.json({
        success: true,
        post_id: null,
        zernio_post_id: zernioPostId,
        warning: 'Post ingepland maar database opslag mislukt',
      });
    }
  } catch (error) {
    console.error('Schedule error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Onverwachte fout bij inplannen' },
      { status: 500 }
    );
  }
}
