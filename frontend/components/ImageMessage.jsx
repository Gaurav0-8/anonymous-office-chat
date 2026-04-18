'use client';

export default function ImageMessage({ fileId, width, height, onOpen }) {
  const src = `/uploads/${fileId}`;
  const aspectRatio = width && height ? `${width}/${height}` : '4/3';
  const maxWidth = Math.min(width || 300, 320);

  return (
    <div className="image-message" style={{ maxWidth }}>
      <img
        src={src}
        alt="Shared image"
        style={{ aspectRatio }}
        className="image-msg-img"
        loading="lazy"
        onClick={() => onOpen(src)}
        onError={(e) => { e.target.style.display = 'none'; }}
      />

      <style jsx>{`
        .image-message { width: 100%; cursor: pointer; margin-bottom: 4px; }
        .image-msg-img {
          width: 100%; height: auto; border-radius: 10px;
          object-fit: cover; display: block;
          transition: opacity 0.2s;
        }
        .image-msg-img:hover { opacity: 0.9; }
      `}</style>
    </div>
  );
}
