'use client';

export default function MediaMessage({ fileId, width, height, onOpen }) {
  const rawApiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const apiBase = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;
  
  // Construct the correct source URL
  let src = fileId;
  if (fileId && !fileId.startsWith('http')) {
    const cleanFileId = fileId.startsWith('/uploads/') ? fileId.substring(9) : (fileId.startsWith('uploads/') ? fileId.substring(8) : fileId);
    src = `${apiBase}/uploads/${cleanFileId.startsWith('/') ? cleanFileId.substring(1) : cleanFileId}`;
  }
  
  const aspectRatio = width && height ? `${width}/${height}` : 'auto';

  return (
    <div className="media-message-container">
      <img
        src={src}
        alt="Shared media"
        style={{ maxWidth: '100%', maxHeight: '450px', objectFit: 'contain', display: 'block', borderRadius: '12px' }}
        className="media-msg-img fade-in"
        loading="lazy"
        onClick={() => onOpen(src)}
      />
      <style jsx>{`
        .media-message-container {
          width: fit-content;
          max-width: 100%;
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          min-width: 100px;
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
      `}</style>

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
