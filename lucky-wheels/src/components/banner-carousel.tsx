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
    if (banners.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % banners.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [banners.length]);

  const displayBanners = banners.filter((banner) => !brokenBannerIds.includes(banner.id));
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

  const image = (
    <img
      src={banner.imageUrl}
      alt={banner.title}
      width={840}
      height={420}
      fetchPriority="high"
      decoding="async"
      onError={handleImageError}
      className="aspect-[2/1] h-auto w-full object-cover transition-opacity duration-300"
    />
  );

  return (
    <div className="mx-4 mt-3 overflow-hidden rounded-3xl border-2 border-amber-400/40 shadow-[0_15px_35px_rgba(0,0,0,0.5)]">
      {banner.linkUrl ? (
        <a href={banner.linkUrl} target="_blank" rel="noreferrer" aria-label={banner.title}>
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
                index === activeIndex ? "w-6 bg-amber-300" : "w-1.5 bg-slate-500"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
