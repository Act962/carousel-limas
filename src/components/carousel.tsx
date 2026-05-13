"use client";
import { ButtonFullScreen } from "@/components/button";
import { useEffect, useRef, useState } from "react";

interface CarouselProps {
  videos: string[];
}

export function Carousel({ videos }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleStart = () => {
    setStarted(true);
  };

  const handleEnded = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
  };

  useEffect(() => {
    if (started && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, started]);

  if (videos.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black">
        <span className="text-white text-lg">
          Nenhum vídeo disponível no momento.
        </span>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-black overflow-hidden">
      {!started ? (
        <button
          type="button"
          onClick={handleStart}
          className="flex items-center justify-center w-24 h-24 rounded-full bg-white/10 hover:bg-white/20 border-2 border-white transition cursor-pointer"
          aria-label="Iniciar vídeos"
        >
          <svg
            viewBox="0 0 24 24"
            fill="white"
            className="w-12 h-12 ml-1"
            aria-hidden="true"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      ) : (
        <>
          <video
            ref={videoRef}
            key={currentIndex}
            src={videos[currentIndex]}
            controls={false}
            autoPlay
            playsInline
            onEnded={handleEnded}
            className="w-full h-screen object-contain"
          />

          {/* <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
            {videos.map((src, i) => (
              <button
                key={src}
                disabled
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`w-3 h-3 rounded-full transition ${
                  i === currentIndex ? "bg-white" : "bg-white/40"
                }`}
                aria-label={`Ir para vídeo ${i + 1}`}
              />
            ))}
          </div> */}
        </>
      )}

      <ButtonFullScreen />
    </main>
  );
}
