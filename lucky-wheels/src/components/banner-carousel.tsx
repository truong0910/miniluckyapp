import {
  getActiveBanners,
  getDefaultBanners,
  type BannerConfig,
} from "@/services/content.services";
import { useEffect, useState } from "react";

export default function BannerCarousel() {
  const [banners, setBanners] = useState<BannerConfig[]>(() => getActiveBanners());
  const [activeIndex, setActiveIndex] = useState(0);
  const [brokenBannerIds, setBrokenBannerIds] = useState<string[]>([]);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const displayBanners = banners.filter((banner) => !brokenBannerIds.includes(banner.id));

  useEffect(() => {
    const refresh = () => {
      setBanners(getActiveBanners());
      setActiveIndex(0);
      setBrokenBannerIds([]);
    };

    window.addEventListener("storage", refresh);
    window.addEventListener("lucky-wheels:banners-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("lucky-wheels:banners-updated", refresh);
    };
  }, []);

  useEffect(() => {
    if (displayBanners.length <= 1 || isDragging) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % displayBanners.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [displayBanners.length, isDragging]);

  const banner =
    displayBanners[activeIndex % Math.max(1, displayBanners.length)] ||
    getDefaultBanners()[0];
  if (!banner) return null;

  const handleImageError = () => {
    if (banner.id === "default-slide") return;
    setBrokenBannerIds((current) =>
      current.includes(banner.id) ? current : [...current, banner.id]
    );
    setActiveIndex(0);
  };

  const minSwipeDistance = 40;

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchStartX(e.targetTouches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX !== null && touchEndX !== null) {
      const distance = touchStartX - touchEndX;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isLeftSwipe) {
        setActiveIndex((current) => (current + 1) % Math.max(1, displayBanners.length));
      } else if (isRightSwipe) {
        setActiveIndex((current) => (current - 1 + displayBanners.length) % Math.max(1, displayBanners.length));
      }
    }
    setIsDragging(false);
    setTouchStartX(null);
    setTouchEndX(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setTouchEndX(null);
    setTouchStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTouchEndX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      handleTouchEnd();
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleTouchEnd();
    }
  };

  const image = (
    <img
      src={banner.imageUrl}
      alt={banner.title}
      width={840}
      height={420}
      fetchPriority="high"
      decoding="async"
      onError={handleImageError}
      className="aspect-[2/1] h-auto w-full object-cover transition-all duration-300 select-none pointer-events-none"
    />
  );

  return (
    <div
      className="mx-4 mt-3 overflow-hidden rounded-3xl border-2 border-red-500/30 shadow-[0_15px_35px_rgba(0,0,0,0.5)] select-none touch-pan-y cursor-grab active:cursor-grabbing"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {banner.linkUrl ? (
        <a
          href={banner.linkUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={banner.title}
          onClick={(e) => {
            if (touchStartX !== null && touchEndX !== null && Math.abs(touchStartX - touchEndX) > 10) {
              e.preventDefault();
            }
          }}
        >
          {image}
        </a>
      ) : (
        image
      )}

      {displayBanners.length > 1 && (
        <div className="flex justify-center gap-1.5 bg-slate-950/80 py-2">
          {displayBanners.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Xem banner ${index + 1}`}
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex ? "w-6 bg-red-500" : "w-1.5 bg-slate-600"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
