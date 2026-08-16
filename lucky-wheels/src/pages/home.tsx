import Background from "@/components/background";
import BannerCarousel from "@/components/banner-carousel";
import Header from "@/components/header";
import RegisterForm from "@/components/register-form";
import { Page } from "zmp-ui";

export default function HomePage() {
  return (
    <Page
      hideScrollbar
      className="relative overflow-y-scroll overflow-x-hidden bg-slate-950 min-h-screen pb-20"
    >
      <Background />
      <div className="relative max-w-md mx-auto z-10">
        <Header />
        <BannerCarousel />
        <RegisterForm />
      </div>
    </Page>
  );
}
