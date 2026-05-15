import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { VirtualFile } from '../types';
import { saveFileBlob, getFileBlob, getExtractedImages } from './storage';
import * as pdfjsLib from 'pdfjs-dist';
import { Document, Packer, Paragraph, TextRun } from 'docx';

// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export async function convertPdfToDocx(file: VirtualFile): Promise<Blob> {
  const fileBlob = await getFileBlob(file.id);
  if (!fileBlob) throw new Error("PDF blob not found");
  
  const arrayBuffer = await fileBlob.arrayBuffer();
  
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  
  let fullText = "";
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + "\n\n";
  }
  
  // Create DOCX
  const paragraphs = fullText.split("\n\n").map(text => 
    new Paragraph({
      children: [new TextRun(text)]
    })
  );
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }]
  });
  
  return await Packer.toBlob(doc);
}

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

export async function convertToEPUB(file: VirtualFile, imageBlobs: Blob[]): Promise<Blob> {
  const zip = new JSZip();

  zip.file('mimetype', 'application/epub+zip');
  
  const metaInf = zip.folder('META-INF');
  metaInf?.file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  const oebps = zip.folder('OEBPS');
  const images = oebps?.folder('images');
  
  let manifest = '';
  let spine = '';
  
  for (let i = 0; i < imageBlobs.length; i++) {
    const blob = imageBlobs[i];
    const ext = blob.type.split('/')[1] || 'jpg';
    const numId = i.toString().padStart(3, '0');
    const imageId = `img_${numId}`;
    const pageId = `page_${numId}`;
    const imgPath = `images/${imageId}.${ext}`;
    
    images?.file(`${imageId}.${ext}`, blob);
    
    manifest += `<item id="${imageId}" href="${imgPath}" media-type="${blob.type || 'image/jpeg'}"/>\n`;
    manifest += `<item id="${pageId}" href="${pageId}.html" media-type="application/xhtml+xml"/>\n`;
    
    spine += `<itemref idref="${pageId}"/>\n`;
    
    const html = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Page ${i + 1}</title>
  <style>
    body { margin: 0; padding: 0; text-align: center; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <img src="${imgPath}" alt="Page ${i + 1}" />
</body>
</html>`;
    
    oebps?.file(`${pageId}.html`, html);
  }
  
  oebps?.file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${file.name.replace(/\.[^/.]+$/, "")}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookID" opf:scheme="UUID">urn:uuid:${file.id}</dc:identifier>
  </metadata>
  <manifest>
    ${manifest}
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    ${spine}
  </spine>
</package>`);

  oebps?.file('toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${file.id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${file.name.replace(/\.[^/.]+$/, "")}</text>
  </docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel>
        <text>Start</text>
      </navLabel>
      <content src="page_000.html"/>
    </navPoint>
  </navMap>
</ncx>`);

  const epubBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  return epubBlob;
}
