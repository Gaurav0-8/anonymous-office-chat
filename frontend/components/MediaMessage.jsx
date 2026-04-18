'use client';

export default function MediaMessage({ fileId, width, height, onOpen }) {
  // If fileId is a full URL (starts with http), use it directly. 
  // Otherwise, it's a local file ID and needs the /uploads/ prefix.
  const isUrl = fileId && (fileId.startsWith('http://') || fileId.startsWith('https://'));
  const src = isUrl ? fileId : `/uploads/${fileId}`;
  
  const aspectRatio = width && height ? `${width}/${height}` : 'auto';
  const maxWidth = Math.min(width || 300, 320);

  return (
    <div className="media-message" style={{ maxWidth }}>
      <img
        src={src}
        alt="Shared media"
        style={{ aspectRatio, minHeight: '100px', backgroundColor: 'var(--bg-secondary)' }}
        className="media-msg-img"
        loading="lazy"
        onClick={() => onOpen(src)}
        onError={(e) => { 
          // If it fails, maybe it's missing an extension or just invalid
          console.error('Media failed to load:', src);
          e.target.style.display = 'none'; 
        }}
      />

      <style jsx>{`
        .media-message { width: 100%; cursor: pointer; margin-bottom: 4px; }
        .media-msg-img {
          width: 100%; height: auto; border-radius: 10px;
          object-fit: cover; display: block;
          transition: opacity 0.2s;
        }
        .media-msg-img:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}
