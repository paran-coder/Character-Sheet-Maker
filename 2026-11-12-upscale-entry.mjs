import Upscaler from 'upscaler';

let upscaler;
export async function upscaleImage(url) {
  upscaler ??= new Upscaler({
    model: { path: '/2026-11-12-upscale-model/model.json', scale: 4, modelType: 'layers' },
  });
  const image = new Image();
  image.src = url;
  await image.decode();
  if (image.naturalWidth * image.naturalHeight > 6000000 ||
      Math.max(image.naturalWidth, image.naturalHeight) > 4096) {
    throw new Error('업스케일은 600만 픽셀 이하, 한 변 4096px 이하의 이미지를 지원합니다.');
  }
  const data = await upscaler.upscale(image, { patchSize: 128, padding: 8, awaitNextFrame: true });
  return (await fetch(data)).blob();
}
