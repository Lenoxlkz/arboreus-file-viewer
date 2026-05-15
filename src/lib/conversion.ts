import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { VirtualFile } from '../types';
import { saveFileBlob, getFileBlob, getExtractedImages } from './storage';

export async function convertToCBZ(file: VirtualFile, imageBlobs: Blob[]): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('images');
  
  imageBlobs.forEach((blob, i) => {
    const ext = blob.type.split('/')[1] || 'jpg';
    folder?.file(`page_${i.toString().padStart(3, '0')}.${ext}`, blob);
  });
  
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return new Blob([zipBlob], { type: 'application/vnd.comicbook+zip' });
}

export async function convertToPDF(file: VirtualFile, imageBlobs: Blob[]): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'p',
    unit: 'px',
  });

  for (let i = 0; i < imageBlobs.length; i++) {
    const blob = imageBlobs[i];
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    if (i > 0) pdf.addPage();
    
    // Get image dimensions
    const img: any = await new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.src = dataUrl;
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Fit to page
    const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
    const width = img.width * ratio;
    const height = img.height * ratio;
    const x = (pageWidth - width) / 2;
    const y = (pageHeight - height) / 2;

    const mimeType = blob.type || 'image/jpeg';
    const format = mimeType.split('/')[1]?.toUpperCase() as any || 'JPEG';

    pdf.addImage(dataUrl, format, x, y, width, height);
  }

  return pdf.output('blob');
}
