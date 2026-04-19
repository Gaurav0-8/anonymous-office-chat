'use client';

export default function MediaMessage({ fileId, width, height, onOpen }) {
  // Check if it already has the /uploads/ prefix or is a full URL
  const isUrl = fileId && (fileId.startsWith('http') || fileId.startsWith('/uploads/'));
  const src = isUrl ? fileId : `/uploads/${fileId}`;
  
  const aspectRatio = width && height ? `${width}/${height}` : 'auto';

  return (
    <div className="media-message">
      <img
        src={src}
        alt="Shared media"
        style={{ aspectRatio, minHeight: '100px', backgroundColor: '#1c1c28' }}
        className="media-msg-img fade-in"
        loading="lazy"
        onClick={() => onOpen(src)}
        onError={(e) => { 
          // Last resort fallback
          if (!e.target.src.includes('undefined') && !e.target.src.includes('/uploads/')) {
             e.target.src = `/uploads/${fileId}`;
          }
        }}
      />

      <style jsx>{`
        .media-message { width: 100%; cursor: pointer; margin-bottom: 4px; border-radius: 18px; overflow: hidden; }
        .media-msg-img {
          width: 100%; height: auto; border-radius: 12px;
          object-fit: cover; display: block;
          transition: transform 0.3s ease;
        }
        .media-msg-img:hover { transform: scale(1.02); }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
