import { useRef, useState } from 'react';

export default function PreviewMedia({ videoSrc, posterSrc, alt }) {
  const videoRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPaused) {
      const playback = video.play();
      setIsPaused(false);
      if (playback) playback.catch(() => setIsPaused(true));
    } else {
      video.pause();
      setIsPaused(true);
    }
  };

  return (
    <section className="preview-media" aria-label="Template preview">
      <div className="preview-media__strip">
        <div className="preview-media__pane preview-media__video-pane">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            poster={posterSrc}
            aria-label={alt}
            onPlay={() => setIsPaused(false)}
            onPause={() => setIsPaused(true)}
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
          <button type="button" className="preview-media__control" onClick={togglePlayback}>
            {isPaused ? 'Play video' : 'Pause video'}
          </button>
        </div>
        <div className="preview-media__pane">
          <img src={posterSrc} alt={alt} />
        </div>
      </div>
    </section>
  );
}
