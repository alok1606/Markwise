// Browser-only: reads an image's pixels via canvas and returns a deterministic colour sample.
import { sampleColours, type ColourSample } from './checks';

export async function readImageColours(url: string): Promise<{ samples: ColourSample[] | null; error: string | null }> {
  try {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'sync';
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('the image could not be loaded for colour reading')); img.src = url; });
    // Draw at natural size (capped) so sampling positions do not depend on browser resizing.
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return { samples: null, error: 'this browser does not allow reading image colours' };
    ctx.drawImage(img, 0, 0, w, h);
    const samples = sampleColours(ctx.getImageData(0, 0, w, h).data, w, h);
    return samples.length ? { samples, error: null } : { samples: null, error: 'no visible colours could be read from the image' };
  } catch (e) {
    return { samples: null, error: e instanceof Error && /load/.test(e.message) ? e.message : 'the browser blocked reading this image\'s colours' };
  }
}
