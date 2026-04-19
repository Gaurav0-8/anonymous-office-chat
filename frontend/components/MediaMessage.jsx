'use client';

export default function MediaMessage({ fileId, width, height, onOpen }) {
  const isUrl = fileId && (fileId.startsWith('http://') || fileId.startsWith('https://'));
  const src = isUrl ? fileId : `/uploads/${fileId}`;
  
  const aspectRatio = width && height ? `${width}/${height}` : 'auto';

  return (
    <div className="media-message" style={{ maxWidth: 350 }}>
      <img
        src={src}
        alt="Shared media"
        style={{ aspectRatio, minHeight: '100px', backgroundColor: '#1c1c28' }}
        className="media-msg-img fade-in"
        loading="lazy"
        onClick={() => onOpen(src)}
        onError={(e) => { 
          // Fallback if pathing is stripped
          if (!e.target.src.includes('undefined') && !e.target.src.includes('/uploads/')) {
             e.target.src = `/uploads/${fileId}`;
          }
        }}
      />

      <style jsx>{`
        .media-message { width: 100%; cursor: pointer; margin-bottom: 4px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .media-msg-img {
          width: 100%; height: auto; border-radius: 12px;
          object-fit: cover; display: block;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .media-msg-img:hover { transform: scale(1.02); }
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
